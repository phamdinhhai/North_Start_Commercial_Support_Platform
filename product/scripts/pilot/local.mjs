import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, openSync, unlinkSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import pg from 'pg';
import { pgBin, validateManifest, connection, cleanEnvironment, assertClusterFiles, assertOwnedServer } from './safety.mjs';
const product = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const opaque = () => randomBytes(32).toString('hex');
function tool(name, args, env = {}) {
  const r = spawnSync(join(pgBin, `${name}.exe`), args, { env: { ...cleanEnvironment(), ...env }, stdio: 'ignore', timeout: 60000, windowsHide: true });
  if (r.status !== 0) throw new Error(`${name} failed (${r.status}); inspect private cluster log`);
}
function save(m) { writeFileSync(join(m.home, 'manifest.json'), JSON.stringify(m, null, 2), { mode: 0o600 }); }
async function freePort() {
  const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const p = s.address().port; await new Promise(r => s.close(r)); return p;
}
async function withDb(m, admin, database, fn) {
  const client = new pg.Client({ connectionString: connection(m, admin, database), connectionTimeoutMillis: 5000 });
  await client.connect(); try { if (admin) await assertOwnedServer(client, m); return await fn(client); } finally { await client.end(); }
}
async function control(m, command) {
  const r = await fetch(`http://127.0.0.1:${m.controlPort}/${command}`, { method: 'POST', headers: { 'x-pilot-control': m.control }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('Control rejected'); return r.text();
}
async function startPg(m) {
  assertClusterFiles(m);
  const status = spawnSync(join(pgBin, 'pg_ctl.exe'), ['-D', m.data, 'status'], { windowsHide: true, stdio: 'ignore' });
  if (status.status !== 0) tool('pg_ctl', ['-D', m.data, '-l', join(m.home, 'postgres.log'), '-w', 'start']);
  await withDb(m, true, 'postgres', async () => {});
}
async function start(m) {
  await startPg(m);
  try { await fetch(`http://127.0.0.1:${m.controlPort}/`, { signal: AbortSignal.timeout(500) }); throw new Error('Pilot control port already in use'); }
  catch (e) { if (e.message === 'Pilot control port already in use') throw e; }
  if (existsSync(join(m.home, 'ready.json'))) unlinkSync(join(m.home, 'ready.json'));
  const log = openSync(join(m.home, 'application.log'), 'a');
  const child = spawn(process.execPath, [join(product, 'scripts/pilot/runtime.mjs'), m.file], { cwd: product, env: cleanEnvironment(), detached: true, stdio: ['ignore', log, log], windowsHide: true });
  child.unref();
  for (let n = 0; n < 100; n++) {
    if (existsSync(join(m.home, 'ready.json'))) return console.log(`LOCAL SYNTHETIC ONLY: http://127.0.0.1:${m.appPort}/v1/operator`);
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('App did not become ready; inspect private application.log');
}
async function stop(m) {
  const running = spawnSync(join(pgBin, 'pg_ctl.exe'), ['-D', m.data, 'status'], { windowsHide: true, stdio: 'ignore' });
  if (running.status === 0) await withDb(m, true, 'postgres', async () => {});
  try { await control(m, 'stop'); await new Promise(r => setTimeout(r, 1500)); }
  catch (e) {
    // Do not stop a database beneath a responding app or unidentified port owner.
    const status = await fetch(`http://127.0.0.1:${m.appPort}/v1/health`, { signal: AbortSignal.timeout(500) }).catch(() => null);
    if (status) throw e;
  }
  const s = spawnSync(join(pgBin, 'pg_ctl.exe'), ['-D', m.data, 'status'], { windowsHide: true, stdio: 'ignore' });
  if (s.status === 0) tool('pg_ctl', ['-D', m.data, '-m', 'fast', '-w', 'stop']);
  console.log('Owned app and private PostgreSQL stopped');
}
async function newDatabase(m) {
  m.database = `pilot_${randomBytes(16).toString('hex')}`;
  await withDb(m, true, 'postgres', async db => {
    await db.query(`CREATE DATABASE "${m.database}" OWNER "${m.role}"`);
    await db.query(`REVOKE ALL ON DATABASE "${m.database}" FROM PUBLIC`);
  });
  save(m); return m;
}
async function init() {
  const id = randomBytes(16).toString('hex');
  // Exact generated name, not caller-supplied paths/URLs/names.
  const home = join(tmpdir(), `north-synthetic-pilot-${id}`);
  const { mkdirSync } = await import('node:fs'); mkdirSync(home, { mode: 0o700 });
  if (process.platform === 'win32') {
    const r = spawnSync('icacls.exe', [home, '/inheritance:r', '/grant:r', `${userInfo().username}:(OI)(CI)F`], { windowsHide: true, stdio: 'ignore' });
    if (r.status !== 0) throw new Error('Private directory ACL failed');
  }
  const workspace = `synthetic-${id}`;
  const m = { kind: 'LOCAL_SYNTHETIC_ONLY_V1', id, home, data: join(home, 'data'), file: join(home, 'manifest.json'),
    role: `pilot_${id}`, password: opaque(), adminPassword: opaque(), control: opaque(), workspace,
    pgPort: await freePort(), appPort: await freePort(), idpPort: await freePort(), controlPort: await freePort(),
    digestKeys: [workspace, `${workspace}-foreign`].map(workspaceId => ({ workspaceId, activeKid: 'local-v1', keys: [{ kid: 'local-v1', secretBase64: randomBytes(32).toString('base64') }] })) };
  const pw = join(home, 'init-password'); writeFileSync(pw, m.adminPassword, { mode: 0o600 });
  try { tool('initdb', ['-D', m.data, '-U', 'postgres', '--encoding=UTF8', '--auth=scram-sha-256', `--pwfile=${pw}`]); } finally { unlinkSync(pw); }
  writeFileSync(join(m.data, 'postgresql.auto.conf'), `listen_addresses='127.0.0.1'\nport=${m.pgPort}\n`);
  await startPg(m);
  await withDb(m, true, 'postgres', db => db.query(`CREATE ROLE "${m.role}" LOGIN PASSWORD '${m.password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`));
  await newDatabase(m); console.log(`Manifest: ${m.file}`); await start(validateManifest(m.file));
}
const [command, file] = process.argv.slice(2);
try {
  if (command === 'init' && !file) await init();
  else {
    const m = validateManifest(file || '');
    if (command === 'start') await start(m);
    else if (command === 'stop') await stop(m);
    else if (command === 'restart') console.log(await control(m, 'restart'));
    else if (command === 'status') {
      await withDb(m, true, 'postgres', async () => {});
      const r = await fetch(`http://127.0.0.1:${m.appPort}/v1/health/readiness`, { signal: AbortSignal.timeout(5000) });
      console.log(`syntheticOnly=true readinessHTTP=${r.status} database=${m.database}`);
    } else if (command === 'backup') {
      await startPg(m); const backup = join(m.home, `backup-${m.database}.dump`);
      tool('pg_dump', ['-h', '127.0.0.1', '-p', String(m.pgPort), '-U', m.role, '-d', m.database, '-Fc', '-f', backup], { PGPASSWORD: m.password });
      m.backup = backup; save(m); console.log('Synthetic backup recorded in private manifest');
    } else if (command === 'reset' || command === 'restore') {
      await stop(m); await startPg(m);
      const backup = m.backup;
      if (command === 'restore' && (!backup || !existsSync(backup))) throw new Error('Owned backup required');
      await newDatabase(m);
      if (command === 'restore') tool('pg_restore', ['-h', '127.0.0.1', '-p', String(m.pgPort), '-U', m.role, '-d', m.database, '--no-owner', '--no-privileges', backup], { PGPASSWORD: m.password });
      console.log('Fresh database selected; previous database retained'); await start(validateManifest(m.file));
    } else throw new Error('Usage: node scripts/pilot/local.mjs init | start|status|restart|stop|backup|reset|restore <manifest>');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
