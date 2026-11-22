/** Bounded, fabricated-only local engineering benchmark. Build first; never use a pilot database. */
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { PostgresService } = require('../dist/infra/postgres/postgres.service');
const { Migrator, loadMigrations } = require('../dist/infra/postgres/migrator');
const { PgSourceIntegrationStore } = require('../dist/infra/source-integration/pg-source-integration.store');
const { installContentDigester } = require('../dist/ports/content-digester-runtime');
const { configuredContentDigester } = require('../dist/infra/crypto/configured-content-digester');
const url = new URL(process.env.TEST_DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/(north_r411_performance|perf_[a-z0-9_]+|r411_[a-z0-9_]+)$/.test(url.pathname)) throw Error('Dedicated local performance database required');
if (!process.env.BENCH_OUTPUT) throw Error('BENCH_OUTPUT must name an artifact outside the repository');
const artifactRelative = relative(fileURLToPath(new URL('../../', import.meta.url)), resolve(process.env.BENCH_OUTPUT));
if (!artifactRelative.startsWith('..') && !/^[A-Za-z]:/.test(artifactRelative)) throw Error('Raw benchmark artifact must stay outside the repository');
const db = new PostgresService({ connectionString: url.href, max: 8, application_name: 'r411-bounded-benchmark', statement_timeout: 10000 });
const store = new PgSourceIntegrationStore(db);
const started = performance.now();
const cap = setTimeout(() => { console.error('Benchmark exceeded 120 second cap'); process.exit(2); }, 120000);
const report = { sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),label: process.env.BENCH_LABEL ?? 'baseline', workers: 8, seedReceipts: 1200, workloads: {}, plans: {}, observations: {} };
const ctx = { workspaceId: `bench-${randomUUID()}`, userId: 'fabricated-admin', role: 'admin', isDemo: false };
const observation = (messageId = randomUUID(), eventId = null) => ({ schemaVersion: 1, accountId: 'fabricated-page', provider: 'pancake', route: 'pancake-synthetic', synthetic: true, sourceAuthority: 'synthetic_fixture', completeness: 'UNKNOWN', verification: 'UNVERIFIED', receiptId: randomUUID(), native: { system: 'meta', pageId: 'fabricated-page', conversationId: null, messageId, eventId, revision: null }, observedAt: '2026-11-20T00:00:00Z', occurredAt: null, lifecycle: 'upsert-observed', displayName: 'Fabricated benchmark', rawPayload: { utterance: 'Fabricated content', speaker: 'customer', original: { fabricated: true } } });
async function workload(name, count, task) {
  let next = 0; const times = []; const errors = {};
  const start = performance.now();
  await Promise.all(Array.from({ length: Math.min(8, count) }, async () => {
    while (next < count) { const i = next++; const at = performance.now(); try { await task(i); } catch (e) { errors[e.code ?? e.message] = (errors[e.code ?? e.message] ?? 0) + 1; } times.push(performance.now() - at); }
  }));
  times.sort((a, b) => a - b);
  report.workloads[name] = { count, elapsedMs: performance.now() - start, p50Ms: times[Math.ceil(count * .5) - 1], p95Ms: times[Math.ceil(count * .95) - 1], p99Ms: times[Math.ceil(count * .99) - 1], errors };
}
try {
  await new Migrator(db, loadMigrations()).up();
  installContentDigester(configuredContentDigester({ NODE_ENV: 'test' }));
  await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)', [ctx.workspaceId]);
  const create = (c = ctx) => store.createConnection(c, { provider: 'pancake', route: 'pancake-synthetic', pageId: 'fabricated-page' });
  const connections = await Promise.all(Array.from({ length: 8 }, () => create()));
  const monitoring = new PostgresService({ connectionString: url.href, max: 1, application_name: 'r411-benchmark-monitor' });
  let lockSamples = 0, maxWaiting = 0, sampleBusy = false;
  const monitor = setInterval(async () => { if (sampleBusy) return; sampleBusy = true; try { maxWaiting = Math.max(maxWaiting, db.getPool().waitingCount); const r = await monitoring.query("SELECT count(*)::int n FROM pg_stat_activity WHERE application_name='r411-bounded-benchmark' AND wait_event_type='Lock'"); lockSamples += r.rows[0].n; } finally { sampleBusy = false; } }, 10);
  try {
    await workload('seed', 1200, i => store.intake(ctx, connections[i % 8].id, observation(`fabricated-${i}`, `event-${i}`)));
    await db.query('ANALYZE source_receipt');
    const queries = {
      receipt: ['SELECT * FROM source_receipt WHERE workspace_id=$1 AND connection_id=$2 AND receipt_id=$3', [ctx.workspaceId, connections[0].id, 'missing']],
      native: ['SELECT * FROM source_receipt WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND message_id=$4 ORDER BY created_at,id', [ctx.workspaceId, 'meta', 'fabricated-page', 'fabricated-600']],
      event: ['SELECT message_id FROM source_receipt WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND event_id=$4 AND revision IS NOT DISTINCT FROM $5', [ctx.workspaceId, 'meta', 'fabricated-page', 'event-600', null]],
      health: ['SELECT c.id,count(r.id) FROM source_connection c LEFT JOIN source_receipt r ON r.workspace_id=c.workspace_id AND r.connection_id=c.id WHERE c.workspace_id=$1 GROUP BY c.id ORDER BY c.id LIMIT 100', [ctx.workspaceId]],
      currentHealth: [`WITH page AS MATERIALIZED (SELECT * FROM source_connection WHERE workspace_id=$1 ORDER BY created_at,id LIMIT 100)
        SELECT c.*,r.* FROM page c CROSS JOIN LATERAL (SELECT count(*)::int receipt_count,
        count(*) FILTER(WHERE quarantine_reason IS NOT NULL)::int quarantine_count,max(created_at) last_receipt_at
        FROM source_receipt WHERE workspace_id=c.workspace_id AND connection_id=c.id) r ORDER BY c.created_at,c.id`,[ctx.workspaceId]],
    };
    const lead=(await db.query('SELECT lead_id FROM source_receipt WHERE workspace_id=$1 AND lead_id IS NOT NULL LIMIT 1',[ctx.workspaceId])).rows[0].lead_id;
    queries.leadEvidence=[`SELECT r.*,to_jsonb(e) envelope FROM source_receipt r JOIN commercial_envelope e ON e.id=r.envelope_id AND e.workspace_id=r.workspace_id
      WHERE r.workspace_id=$1 AND r.lead_id=$2::uuid ORDER BY r.created_at,r.id LIMIT 21`,[ctx.workspaceId,lead]];
    for (const [name, [sql, args]] of Object.entries(queries)) report.plans[name] = (await db.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`, args)).rows[0]['QUERY PLAN'];
    await workload('sameConnectionDifferentMessages', 64, () => store.intake(ctx, connections[0].id, observation()));
    await workload('sameConnectionSameMessage', 64, () => store.intake(ctx, connections[0].id, observation('same-message')));
    await workload('differentConnectionsSameNative', 64, i => store.intake(ctx, connections[i % 8].id, observation('dual-message')));
    const replay = observation(); await store.intake(ctx, connections[0].id, replay);
    await workload('concurrentReplay', 64, () => store.intake(ctx, connections[0].id, replay));
    const other = { ...ctx, workspaceId: `bench-${randomUUID()}` }; await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)', [other.workspaceId]); const foreign = await create(other);
    await workload('differentWorkspace', 64, i => store.intake(i % 2 ? ctx : other, i % 2 ? connections[0].id : foreign.id, observation('workspace-message')));
    await store.intake(ctx, connections[0].id, observation('collision-one', 'collision'));
    await workload('eventCollisionRollback', 16, () => store.intake(ctx, connections[1].id, observation('collision-two', 'collision')));
    const revoke = await create();
    const race = await Promise.allSettled([store.intake(ctx, revoke.id, observation()), store.revokeConnection(ctx, revoke.id)]);
    report.observations.revokeRace = race.map(r => r.status === 'fulfilled' ? r.value.status ?? r.value.disposition : r.reason.code);
    await workload('afterRevoke', 8, () => store.intake(ctx, revoke.id, observation()));
    report.observations.lockWaitSessionSamples = lockSamples;
    report.observations.maxPoolWaitingCount = maxWaiting;
    report.observations.databaseDeadlocks = (await db.query('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()')).rows[0].deadlocks;
    report.observations.receipts = (await db.query('SELECT count(*)::int n FROM source_receipt WHERE workspace_id IN ($1,$2)', [ctx.workspaceId, other.workspaceId])).rows[0].n;
  } finally { clearInterval(monitor); while (sampleBusy) await new Promise(resolve => setTimeout(resolve, 10)); await monitoring.onModuleDestroy(); }
  report.elapsedMs = performance.now() - started;
  const raw = JSON.stringify(report, null, 2); writeFileSync(process.env.BENCH_OUTPUT, raw);
  console.log(JSON.stringify({ artifactSha256: createHash('sha256').update(raw).digest('hex'), ...report, plans: '[external artifact]' }, null, 2));
} finally { clearTimeout(cap); await db.onModuleDestroy(); }
