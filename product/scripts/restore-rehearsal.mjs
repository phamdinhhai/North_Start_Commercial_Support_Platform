import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID, randomBytes, createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

// Explicit disposable target only. Never infer a production connection.
const target = new URL(process.env.TEST_DATABASE_URL ?? 'invalid:');
if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
    !['127.0.0.1', 'localhost'].includes(target.hostname) || target.pathname !== '/north_start_ci' ||
    target.search || target.hash || process.env.DATABASE_URL) {
  throw new Error('Restore rehearsal requires explicit local TEST_DATABASE_URL /north_start_ci and no DATABASE_URL');
}
const require = createRequire(import.meta.url);
const { PostgresService } = require('../dist/infra/postgres/postgres.service.js');
const { Migrator, loadMigrations } = require('../dist/infra/postgres/migrator.js');
const { PgSourceIntegrationStore } = require('../dist/infra/source-integration/pg-source-integration.store.js');
const { decodeMetaSynthetic, META_SYNTHETIC_FIXTURE } = require('../dist/adapters/meta-synthetic/meta-page-fixture.js');
const { installContentDigester } = require('../dist/ports/content-digester-runtime.js');
const { configuredContentDigester } = require('../dist/infra/crypto/configured-content-digester.js');
// Generated rehearsal-only key retained across source/restore verification, never printed or committed.
installContentDigester(configuredContentDigester({ CONTENT_DIGEST_KEYS_JSON: JSON.stringify([
  { workspaceId: 'restore-synthetic', activeKid: 'rehearsal-v1', keys: [{ kid: 'rehearsal-v1', secretBase64: randomBytes(32).toString('base64') }] },
]) }));
const token = randomUUID().replaceAll('-', '');
const sourceName = `disposable_restore_source_${token}`;
const restoredName = `disposable_restore_target_${token}`;
const urlFor = (name) => { const url = new URL(target); url.pathname = `/${name}`; return url.toString(); };
const admin = new Client({ connectionString: urlFor('postgres'), connectionTimeoutMillis: 5000 });
const directory = await mkdtemp(join(tmpdir(), 'north-restore-'));
const archive = join(directory, 'synthetic.dump');
const created = [];
const snapshotKey = randomBytes(32);
const tables = ['schema_migrations', 'workspace', 'integration_enrollment', 'integration_receipt', 'integration_audit',
  'lead', 'commercial_envelope', 'source_connection', 'source_native_message', 'source_receipt', 'audit_record'];
let source;
let restored;
async function snapshot(db) {
  const result = {};
  for (const table of tables) {
    const rows = (await db.query(`SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
    result[table] = { count: rows.length, hmacSha256: createHmac('sha256', snapshotKey).update(JSON.stringify(rows)).digest('hex') };
  }
  return result;
}
function runHelper(args) {
  const result = spawnSync(process.execPath, [resolve('scripts/backup-verify.mjs'), ...args, '--execute', '--json'], {
    encoding: 'utf8', windowsHide: true, timeout: 120000,
    env: { ...process.env, BACKUP_VERIFY_ACK: 'I_CREATED_THIS_DISPOSABLE_DATABASE' },
  });
  // Do not echo subprocess stderr or command arguments, which may contain credentials.
  if (result.error || result.status !== 0) throw new Error(`Backup helper ${args[0]} failed`);
  return JSON.parse(result.stdout);
}
try {
  await admin.connect();
  for (const name of [sourceName, restoredName]) {
    if (!/^disposable_restore_(source|target)_[a-f0-9]{32}$/.test(name)) throw new Error('Invalid disposable database name');
    await admin.query(`CREATE DATABASE ${name}`);
    created.push(name);
  }
  source = new PostgresService({ connectionString: urlFor(sourceName) });
  restored = new PostgresService({ connectionString: urlFor(restoredName) });
  await new Migrator(source, loadMigrations()).up();
  await source.query("INSERT INTO workspace(id,name) VALUES ('restore-synthetic','Synthetic restore rehearsal')");
  const enrollment = randomUUID();
  await source.query('INSERT INTO integration_enrollment(id,scope,expires_at,checkpoint) VALUES($1,$2,now()+interval \'1 hour\',1)',
    [enrollment, JSON.stringify({ workspaceId: 'restore-synthetic', providerSurface: 'pancake-conversations', connectionId: 'test', accountId: 'test', pageId: 'test' })]);
  await source.query('INSERT INTO integration_receipt(id,enrollment_id,capture_id,sequence,fingerprint,metadata) VALUES($1,$2,$3,1,$4,$5)',
    [randomUUID(), enrollment, 'synthetic-capture', 'a'.repeat(64), JSON.stringify({ synthetic: true, continuity: 'UNKNOWN' })]);
  await source.query("INSERT INTO integration_audit(enrollment_id,operation) VALUES($1,'receipt')", [enrollment]);
  const ctx = { workspaceId: 'restore-synthetic', userId: 'synthetic-restore-admin', role: 'admin', isDemo: false };
  const sourceStore = new PgSourceIntegrationStore(source);
  const connection = await sourceStore.createConnection(ctx, { provider: 'meta-page', route: 'meta-page-synthetic', pageId: 'synthetic-page' });
  const observation = decodeMetaSynthetic(META_SYNTHETIC_FIXTURE);
  const accepted = await sourceStore.intake(ctx, connection.id, observation);
  const expected = await snapshot(source);
  const began = performance.now();
  runHelper(['backup', '--target', urlFor(sourceName), '--output', archive]);
  runHelper(['verify', '--backup', archive]);
  const restoreStarted = performance.now();
  runHelper(['restore-verify', '--backup', archive, '--restore-target', urlFor(restoredName)]);
  const restoreMs = Math.round(performance.now() - restoreStarted);
  const actual = await snapshot(restored);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Restored table content differs');
  const replay = await new PgSourceIntegrationStore(restored).intake(ctx, connection.id, observation);
  if (replay.disposition !== 'receipt_duplicate' || replay.leadId !== accepted.leadId ||
      JSON.stringify(actual) !== JSON.stringify(await snapshot(restored))) throw new Error('Restored source replay changed durable history');
  // The restored unique delivery contract must still reject duplicate source identity.
  try {
    await restored.query('INSERT INTO integration_receipt(id,enrollment_id,capture_id,sequence,fingerprint,metadata) VALUES($1,$2,$3,2,$4,$5)',
      [randomUUID(), enrollment, 'synthetic-capture', 'b'.repeat(64), '{}']);
    throw new Error('Restored receipt uniqueness was not enforced');
  } catch (error) { if (error.code !== '23505') throw error; }
  console.log(JSON.stringify({ result: 'PASS', syntheticOnly: true, sourceReplayAfterRestore: true, tables: actual,
    archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
    restoreMs, rehearsalMs: Math.round(performance.now() - began), sla: 'NOT_ESTABLISHED' }));
} finally {
  await source?.onModuleDestroy();
  await restored?.onModuleDestroy();
  // Only names successfully created by this invocation are eligible for cleanup.
  for (const name of created.reverse()) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
