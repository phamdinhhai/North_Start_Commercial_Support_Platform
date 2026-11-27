import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID, randomBytes, createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { Client } from 'pg';

export const RESTORE_TABLES = Object.freeze([
  'schema_migrations', 'workspace', 'integration_enrollment', 'integration_receipt', 'integration_audit',
  'lead', 'commercial_envelope', 'source_connection', 'source_native_message', 'source_receipt', 'source_episode_link',
  'sync_stream', 'sync_page_commit', 'fabricated_delivery', 'fabricated_delivery_attempt',
  'research_capture_receipt', 'research_capture_audit', 'research_capture_failure', 'audit_record',
]);

export const RESEARCH_CAPTURE_SCOPE = Object.freeze({
  workspaceId: 'restore-synthetic',
  connectionId: 'restore-pos-conn',
  accountId: 'restore-pos-shop',
  providerSurface: 'pancake-pos',
});

export function validateRestoreTarget(env = process.env) {
  // Explicit disposable target only. Never infer a production connection.
  const target = new URL(env.TEST_DATABASE_URL ?? 'invalid:');
  if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
      !['127.0.0.1', 'localhost'].includes(target.hostname) || !/^\/(north_start_ci|r412_root)$/.test(target.pathname) ||
      target.search || target.hash || env.DATABASE_URL) {
    throw new Error('Restore rehearsal requires explicit local TEST_DATABASE_URL /north_start_ci and no DATABASE_URL');
  }
  return target;
}

export async function seedResearchCaptureFixtures(db, { digester, cipher, scope = RESEARCH_CAPTURE_SCOPE }) {
  const { PgResearchReceiptStore } = createRequire(import.meta.url)('../dist/infra/research-capture/pg-research-receipt.store.js');
  const store = new PgResearchReceiptStore(db, {
    enabled: true, deploymentMode: 'test', authorizedWorkspaceIds: [scope.workspaceId], digester, cipher,
  });
  const livePayload = Buffer.from(JSON.stringify({ synthetic: true, kind: 'restore-live-receipt' }), 'utf8');
  const liveDigest = digester.digest(scope.workspaceId, 'receipt', livePayload);
  const liveReceipt = {
    ...scope, receiptId: 'restore-research-live', receivedAt: new Date().toISOString(), retentionDays: 3,
    payloadDigest: liveDigest, payloadHash: `hmac-sha256:${liveDigest.kid}:${liveDigest.value}`,
    rawBody: livePayload, evidenceType: 'synthetic', schemaStatus: 'uninterpreted',
  };
  if ((await store.append(liveReceipt)) !== 'stored') throw new Error('Expected live research receipt to store');

  // Insert one backdated expired synthetic receipt to verify quarantined post-restore purge.
  const clock = (await db.query(
    `SELECT (transaction_timestamp() - interval '8 days') AS accepted_at,
            (transaction_timestamp() - interval '1 day') AS expires_at`,
  )).rows[0];
  const acceptedAt = clock.accepted_at.toISOString();
  const expiresAt = clock.expires_at.toISOString();
  const expiredPayload = Buffer.from(JSON.stringify({ synthetic: true, kind: 'restore-expired-receipt' }), 'utf8');
  const expiredDigest = digester.digest(scope.workspaceId, 'receipt', expiredPayload);
  const sealedExpired = cipher.encrypt({
    ...scope, receiptId: 'restore-research-expired', acceptedAt, expiresAt, retentionDays: 7,
    payloadDigestKid: expiredDigest.kid, payloadDigestValue: expiredDigest.value,
  }, expiredPayload);
  await db.query(
    `INSERT INTO research_capture_receipt (
       workspace_id, connection_id, account_id, provider_surface, receipt_id,
       received_at, accepted_at, retention_days, expires_at,
       payload_digest, encryption_meta, ciphertext, evidence_type, schema_status
     ) VALUES (
       $1, $2, $3, $4, $5, $6::timestamptz, $6::timestamptz, 7, $7::timestamptz,
       $8::jsonb, $9::jsonb, $10, 'synthetic', 'uninterpreted'
     )`,
    [scope.workspaceId, scope.connectionId, scope.accountId, scope.providerSurface, 'restore-research-expired',
      acceptedAt, expiresAt, JSON.stringify(expiredDigest), JSON.stringify(sealedExpired.metadata), Buffer.from(sealedExpired.ciphertext)],
  );
  return { livePayload, liveSelector: { ...scope, receiptId: 'restore-research-live' }, expiredSelector: { ...scope, receiptId: 'restore-research-expired' } };
}

export async function verifyRestoredResearchCapture(restoredDb, { digester, cipher, livePayload, liveSelector, expiredSelector, scope = RESEARCH_CAPTURE_SCOPE }) {
  const { PgResearchReceiptStore } = createRequire(import.meta.url)('../dist/infra/research-capture/pg-research-receipt.store.js');
  const store = new PgResearchReceiptStore(restoredDb, {
    enabled: true, deploymentMode: 'test', authorizedWorkspaceIds: [scope.workspaceId], digester, cipher,
  });
  // 1. Live encrypted receipt still decrypts and verifies HMAC digest with restored metadata/AAD.
  const liveRead = await store.read(liveSelector, 'synthetic-restore-auditor');
  if (liveRead.status !== 'ok' || !Buffer.from(liveRead.rawBody).equals(livePayload)) {
    throw new Error('Restored live research capture receipt failed authenticated decrypt');
  }
  // 2. Restored expired receipt is denied before decrypt and audited as EXPIRED_READ_DENIED.
  const expiredRead = await store.read(expiredSelector, 'synthetic-restore-auditor');
  if (expiredRead.status !== 'expired_denied') {
    throw new Error('Restored expired research capture receipt was not denied before decrypt');
  }
  // 3. Restored DB triggers still forbid direct unexpired DELETE and unaudited expired DELETE.
  try {
    await restoredDb.query('DELETE FROM research_capture_receipt WHERE workspace_id = $1 AND receipt_id = $2', [scope.workspaceId, liveSelector.receiptId]);
    throw new Error('Restored unexpired research capture deletion guard was not enforced');
  } catch (error) { if (error.code !== '23001') throw error; }
  try {
    await restoredDb.withTransaction((tx) => tx.query('DELETE FROM research_capture_receipt WHERE workspace_id = $1 AND receipt_id = $2', [scope.workspaceId, expiredSelector.receiptId]));
    throw new Error('Restored expired research capture purge-audit trigger was not enforced');
  } catch (error) { if (error.code !== '23001') throw error; }
  // 4. Quarantined post-restore purge drains expired ciphertext atomically with PURGED audit while keeping live receipt intact.
  const purge = await store.purgeExpired('system:restore-quarantine-purge', 50);
  if (purge.purgedCount !== 1 || purge.remainingExpiredCount !== 0) {
    throw new Error('Restored research capture quarantine purge did not drain expired row');
  }
  const purgedAudit = await restoredDb.query(
    `SELECT count(*)::int AS count FROM research_capture_audit WHERE workspace_id = $1 AND receipt_id = $2 AND operation = 'PURGED'`,
    [scope.workspaceId, expiredSelector.receiptId],
  );
  if (purgedAudit.rows[0]?.count !== 1) throw new Error('Restored research capture PURGED audit row missing');
  const postPurgeRead = await store.read(expiredSelector, 'synthetic-restore-auditor');
  if (postPurgeRead.status !== 'not_found') throw new Error('Restored expired research capture row survived purge');
  return { liveDecrypted: true, expiredReadDenied: true, triggersEnforced: true, purgedCount: purge.purgedCount, remainingExpiredCount: purge.remainingExpiredCount };
}

export async function runRestoreRehearsal(env = process.env) {
  const target = validateRestoreTarget(env);
  const require = createRequire(import.meta.url);
  const { PostgresService } = require('../dist/infra/postgres/postgres.service.js');
  const { Migrator, loadMigrations } = require('../dist/infra/postgres/migrator.js');
  const { PgSourceIntegrationStore } = require('../dist/infra/source-integration/pg-source-integration.store.js');
  const { PgSourceEpisodeLinkStore } = require('../dist/infra/source-continuity/pg-source-episode-link.store.js');
  const { PgSyncCheckpointStore } = require('../dist/infra/sync/pg-sync-checkpoint.store.js');
  const { admitSyncObservation } = require('../dist/application/durable-sync/admission.js');
  const { PgFabricatedDeliveryStore } = require('../dist/infra/sync/pg-fabricated-delivery.store.js');
  const { TestOnlyProviderCredentialStore } = require('../dist/application/provider-credentials/test-only-credential-store.js');
  const { decodeMetaSynthetic, META_SYNTHETIC_FIXTURE } = require('../dist/adapters/meta-synthetic/meta-page-fixture.js');
  const { installContentDigester, contentDigester } = require('../dist/ports/content-digester-runtime.js');
  const { configuredContentDigester } = require('../dist/infra/crypto/configured-content-digester.js');
  const { configuredResearchCipher } = require('../dist/infra/crypto/configured-research-cipher.js');

  // Generated rehearsal-only keys (strictly separate digest vs research encryption), never printed or committed.
  const digestKeysJson = JSON.stringify([
    { workspaceId: 'restore-synthetic', activeKid: 'rehearsal-v1', keys: [{ kid: 'rehearsal-v1', secretBase64: randomBytes(32).toString('base64') }] },
  ]);
  const encryptionKeysJson = JSON.stringify([
    { workspaceId: 'restore-synthetic', activeKid: 'rehearsal-enc-v1', keys: [{ kid: 'rehearsal-enc-v1', secretBase64: randomBytes(32).toString('base64') }] },
  ]);
  installContentDigester(configuredContentDigester({ CONTENT_DIGEST_KEYS_JSON: digestKeysJson }));
  const researchCipher = configuredResearchCipher({
    CONTENT_DIGEST_KEYS_JSON: digestKeysJson,
    RESEARCH_CAPTURE_ENCRYPTION_KEYS_JSON: encryptionKeysJson,
  });

  const token = randomUUID().replaceAll('-', '');
  const sourceName = `disposable_restore_source_${token}`;
  const restoredName = `disposable_restore_target_${token}`;
  const urlFor = (name) => { const url = new URL(target); url.pathname = `/${name}`; return url.toString(); };
  const admin = new Client({ connectionString: urlFor('postgres'), connectionTimeoutMillis: 5000 });
  const directory = await mkdtemp(join(tmpdir(), 'north-restore-'));
  const archive = join(directory, 'synthetic.dump');
  const created = [];
  const snapshotKey = randomBytes(32);
  let source;
  let restored;

  async function snapshot(db) {
    const result = {};
    for (const table of RESTORE_TABLES) {
      const rows = (await db.query(`SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY to_jsonb(t)::text`)).rows;
      result[table] = { count: rows.length, hmacSha256: createHmac('sha256', snapshotKey).update(JSON.stringify(rows)).digest('hex') };
    }
    return result;
  }

  function runHelper(args) {
    const result = spawnSync(process.execPath, [resolve('scripts/backup-verify.mjs'), ...args, '--execute', '--json'], {
      encoding: 'utf8', windowsHide: true, timeout: 120000,
      env: { ...env, BACKUP_VERIFY_ACK: 'I_CREATED_THIS_DISPOSABLE_DATABASE' },
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
    const accepted = await sourceStore.intake(ctx, connection.id, observation, { claimResponsibility: true });
    const second = await sourceStore.intake(ctx, connection.id, { ...observation, receiptId: 'restore-second',
      native: { ...observation.native, messageId: 'restore-second' } }, { claimResponsibility: true });
    const linkInput = { connectionId: connection.id, receiptId: second.receiptId, evidenceEnvelopeId: second.envelopeId,
      expectedVersion: 0, idempotencyKey: 'restore-context-link', action: 'link', reason: 'Fabricated restore episode context' };
    const content = JSON.stringify(linkInput);
    const authorize = async (_ctx, _id, locked) => {
      if (locked && (locked.workspaceId !== ctx.workspaceId || locked.ownerUserId !== ctx.userId)) throw new Error('Restore fixture ownership mismatch');
    };
    const association = await new PgSourceEpisodeLinkStore(source).command(ctx, accepted.leadId, linkInput, content, contentDigester(), authorize);
    const syncStore = new PgSyncCheckpointStore(source, admitSyncObservation, async () => {});
    const stream = await syncStore.createStream(ctx.workspaceId, connection.id);
    const lease = await syncStore.claimLease(ctx.workspaceId, stream.id, 'restore-worker', 5000);
    const page = { pageKey: 'restore-page', expectedCursor: null, expectedVersion: 0, nextCursor: 'opaque-restored-next', completed: false, observations: [observation] };
    await syncStore.commitPage(ctx.workspaceId, stream.id, lease.token, page);
    // Fabricated custody is regenerated in memory only; no provider credential enters the archive.
    const credentials = new TestOnlyProviderCredentialStore('test', true);
    const metadata = await credentials.configure(ctx, { workspaceId: ctx.workspaceId, connectionId: connection.id, provider: 'meta-page', accountId: 'synthetic-page', scopes: ['messages.read'] }, randomBytes(48).toString('base64'));
    const principal = await credentials.issuePrincipal(ctx, metadata.credentialId);
    const delivery = { deliveryId: 'restore-delivery', observations: [observation] };
    await new PgFabricatedDeliveryStore(source, credentials, admitSyncObservation).accept(principal, delivery);
    const researchFixture = await seedResearchCaptureFixtures(source, { digester: contentDigester(), cipher: researchCipher });

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
    const linkReplay = await new PgSourceEpisodeLinkStore(restored).command(ctx, accepted.leadId, linkInput, content, contentDigester(), authorize);
    if (JSON.stringify(linkReplay) !== JSON.stringify(association)) throw new Error('Restored source association replay differs');
    if (replay.disposition !== 'receipt_duplicate' || replay.leadId !== accepted.leadId ||
        JSON.stringify(actual) !== JSON.stringify(await snapshot(restored))) throw new Error('Restored source replay changed durable history');
    const restoredSync = new PgSyncCheckpointStore(restored, admitSyncObservation, async () => {});
    const replayLease = await restoredSync.claimLease(ctx.workspaceId, stream.id, 'restored-worker', 5000);
    const syncReplay = await restoredSync.commitPage(ctx.workspaceId, stream.id, replayLease.token, { ...page, expectedVersion: 1, expectedCursor: 'opaque-restored-next' });
    if (!syncReplay.replay || syncReplay.version !== 1 || syncReplay.cursor !== 'opaque-restored-next') throw Error('Restored checkpoint replay regressed');
    const deliveryReplay = await new PgFabricatedDeliveryStore(restored, credentials, admitSyncObservation).accept(principal, delivery);
    if (!deliveryReplay.duplicate) throw Error('Restored delivery replay duplicated effect');
    const afterReplay = await snapshot(restored);
    for (const table of ['lead', 'commercial_envelope', 'source_receipt', 'source_native_message', 'source_episode_link', 'sync_page_commit', 'fabricated_delivery']) {
      if (JSON.stringify(afterReplay[table]) !== JSON.stringify(actual[table])) throw Error('Restored replay changed immutable ' + table);
    }
    if (afterReplay.fabricated_delivery_attempt.count !== actual.fabricated_delivery_attempt.count + 1) throw Error('Restored delivery attempt was not auditable');
    // The restored unique delivery contract must still reject duplicate source identity.
    try {
      await restored.query('INSERT INTO integration_receipt(id,enrollment_id,capture_id,sequence,fingerprint,metadata) VALUES($1,$2,$3,2,$4,$5)',
        [randomUUID(), enrollment, 'synthetic-capture', 'b'.repeat(64), '{}']);
      throw new Error('Restored receipt uniqueness was not enforced');
    } catch (error) { if (error.code !== '23505') throw error; }

    const researchCaptureAfterRestore = await verifyRestoredResearchCapture(restored, {
      digester: contentDigester(), cipher: researchCipher, ...researchFixture,
    });

    return {
      result: 'PASS',
      syntheticOnly: true,
      sourceReplayAfterRestore: true,
      associationReplayAfterRestore: true,
      syncCheckpointReplayAfterRestore: true,
      fabricatedDeliveryReplayAfterRestore: true,
      researchCaptureAfterRestore,
      tables: actual,
      archiveSha256: createHash('sha256').update(await readFile(archive)).digest('hex'),
      restoreMs,
      rehearsalMs: Math.round(performance.now() - began),
      sla: 'NOT_ESTABLISHED',
    };
  } finally {
    await source?.onModuleDestroy();
    await restored?.onModuleDestroy();
    // Only names successfully created by this invocation are eligible for cleanup.
    for (const name of created.reverse()) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    await admin.end();
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = await runRestoreRehearsal(process.env);
  console.log(JSON.stringify(report));
}
