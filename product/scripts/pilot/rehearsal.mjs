// Opt-in actual outage/unsafe-history rehearsal against one validated owned fixture.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { validateManifest, connection, pgBin, assertOwnedServer } from './safety.mjs';
const file = process.argv[2], m = validateManifest(file), scripts = dirname(fileURLToPath(import.meta.url));
function run(command) {
  const r = spawnSync(process.execPath, [join(scripts, 'local.mjs'), command, file], { encoding: 'utf8', timeout: 40000, windowsHide: true });
  assert.equal(r.status, 0, `${command}: ${r.stderr}`); return r.stdout;
}
async function counts() {
  const db = new pg.Client({ connectionString: connection(m, true, 'postgres') }); await db.connect();
  try { await assertOwnedServer(db, m); } finally { await db.end(); }
  const app = new pg.Client({ connectionString: connection(m) }); await app.connect();
  try { return (await app.query('SELECT (SELECT count(*) FROM lead)::int leads,(SELECT count(*) FROM membership_audit)::int audit')).rows[0]; }
  finally { await app.end(); }
}
const before = await counts();
const stopped = spawnSync(join(pgBin, 'pg_ctl.exe'), ['-D', m.data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore', windowsHide: true }); assert.equal(stopped.status, 0);
await new Promise(r => setTimeout(r, 3500));
assert.equal(await fetch(`http://127.0.0.1:${m.appPort}/v1/health`, { signal: AbortSignal.timeout(500) }).catch(() => null), null);
assert(readFileSync(join(m.home, 'application.log'), 'utf8').includes('PILOT_DATABASE_LOCK_LOST_MANUAL_RESTART_REQUIRED'));
run('start'); assert.deepEqual(await counts(), before);
console.log(JSON.stringify({ actualPgFastStop: true, applicationClosedOnLockLoss: true, manualFullStart: true, historyPreserved: before }));
// A deliberately false-classified, invented fixture is retained in this old DB.
const fixture = new pg.Client({ connectionString: connection(m) }); await fixture.connect();
await fixture.query(`INSERT INTO commercial_envelope(connection,external_record_id,external_event_type,source_captured_at,raw_payload,raw_payload_hash,is_synthetic,workspace_id)
  VALUES ('local-negative-fixture',gen_random_uuid()::text,'fabricated',now(),'{}','fixture-only',false,$1)`, [m.workspace]);
await fixture.end();
run('stop');
assert.equal(spawnSync(join(pgBin, 'pg_ctl.exe'), ['-D', m.data, '-l', join(m.home, 'postgres.log'), '-w', 'start'], { stdio: 'ignore', windowsHide: true }).status, 0);
const refused = spawnSync(process.execPath, [join(scripts, 'runtime.mjs'), file], { encoding: 'utf8', timeout: 10000, windowsHide: true });
assert.equal(refused.status, 1); assert(refused.stderr.includes('PILOT_NON_SYNTHETIC_HISTORY_REFUSED'));
assert.equal(await fetch(`http://127.0.0.1:${m.appPort}/v1/health`, { signal: AbortSignal.timeout(500) }).catch(() => null), null);
const retained = new pg.Client({ connectionString: connection(m) }); await retained.connect();
assert.equal((await retained.query('SELECT count(*)::int n FROM commercial_envelope WHERE is_synthetic IS DISTINCT FROM true')).rows[0].n, 1); await retained.end();
console.log(JSON.stringify({ nonSyntheticStartupRefused: true, appPortNotOpened: true, falseFixtureRetainedWithoutRelabel: true }));
run('reset'); run('stop');
