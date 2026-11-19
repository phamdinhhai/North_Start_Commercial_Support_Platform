import 'reflect-metadata';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { validateManifest, connection, cleanEnvironment, assertOwnedServer } from './safety.mjs';
import pg from 'pg';
import { startIdp } from '../../e2e/oidc/fixture-idp.mjs';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
const m = validateManifest(process.argv[2]);
const ownerCheck = new pg.Client({ connectionString: connection(m, true, 'postgres'), connectionTimeoutMillis: 5000 });
await ownerCheck.connect();
try { await assertOwnedServer(ownerCheck, m); } finally { await ownerCheck.end(); }
const origin = `http://127.0.0.1:${m.appPort}`, issuer = `http://127.0.0.1:${m.idpPort}`;
const inherited = cleanEnvironment();
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, inherited, { DATABASE_URL: connection(m), NODE_ENV: 'test', DEPLOYMENT_MODE: 'local',
  SYNTHETIC_PILOT_ONLY: 'true', PILOT_STORE_MODE: 'postgres', AUTH_MODE: 'oidc', AUTH_DEV_UNSIGNED_TOKENS: 'false',
  DEMO_WORKSPACES: 'false', OIDC_BROWSER_ENABLED: 'true', OIDC_BROWSER_ORIGIN: origin,
  OIDC_AUTHORIZATION_ENDPOINT: `${issuer}/authorize`, OIDC_TOKEN_ENDPOINT: `${issuer}/token`, OIDC_CLIENT_ID: 'qa-browser',
  OIDC_ISSUER: issuer, OIDC_JWKS_URI: `${issuer}/jwks`, OIDC_AUDIENCE: 'qa-api', CONTENT_DIGEST_KEYS_JSON: JSON.stringify(m.digestKeys) });
const require = createRequire(import.meta.url);
const { installContentDigester } = require('../../dist/ports/content-digester-runtime.js');
const { configuredContentDigester } = require('../../dist/infra/crypto/configured-content-digester.js');
installContentDigester(configuredContentDigester(process.env));
const { PostgresService } = require('../../dist/infra/postgres/postgres.service.js');
const { Migrator, loadMigrations } = require('../../dist/infra/postgres/migrator.js');
const { AppModule } = require('../../dist/app.module.js');
const { MEMBERSHIP_STORE } = require('../../dist/ports/auth.js');
const db = new PostgresService();
let app, idp, control, closing = false;
async function close(code = 0) {
  if (closing) return; closing = true;
  if (existsSync(`${m.home}/ready.json`)) unlinkSync(`${m.home}/ready.json`);
  const deadline = setTimeout(() => process.exit(code || 1), 3000); deadline.unref();
  try {
    control?.closeAllConnections(); control?.close(); idp?.closeAllConnections(); idp?.close();
    await app?.close(); lock.release(true); await db.onModuleDestroy();
  } finally { process.exit(code); }
}
// One application instance for this database. Session lock survives app restarts.
const lock = await db.getPool().connect();
lock.on('error', () => { console.error('PILOT_DATABASE_LOCK_LOST_MANUAL_RESTART_REQUIRED'); void close(1); });
if (!(await lock.query("SELECT pg_try_advisory_lock(hashtext('local-synthetic-pilot')) AS ok")).rows[0].ok) throw new Error('Pilot already running');
await new Migrator(db, loadMigrations()).up();
const unsafe = await db.query(`SELECT
  (SELECT count(*) FROM commercial_envelope WHERE is_synthetic IS DISTINCT FROM true) +
  (SELECT count(*) FROM lead l LEFT JOIN commercial_envelope e ON e.id=l.source_envelope_id
    WHERE e.id IS NULL OR e.workspace_id IS DISTINCT FROM l.workspace_id OR e.is_synthetic IS DISTINCT FROM true) AS n`);
if (Number(unsafe.rows[0].n) !== 0) { console.error('PILOT_NON_SYNTHETIC_HISTORY_REFUSED'); await close(1); }
idp = await startIdp(m.idpPort, origin);
async function start() {
  app = await NestFactory.create(AppModule, new FastifyAdapter({ forceCloseConnections: true }), { logger: false });
  app.setGlobalPrefix('v1'); await app.listen(m.appPort, '127.0.0.1');
}
await start();
const existing = await db.query('SELECT id FROM workspace WHERE id=$1', [m.workspace]);
if (!existing.rowCount) {
  for (const workspace of [m.workspace, `${m.workspace}-foreign`]) await db.query('INSERT INTO workspace(id,name) VALUES ($1,$2)', [workspace, 'LOCAL SYNTHETIC ONLY - no real data']);
  const members = app.get(MEMBERSHIP_STORE);
  for (const [subject, baseRole] of Object.entries({ owner: 'sales', recipient: 'sales', viewer: 'viewer', bystander: 'manager', foreign: 'sales', admin: 'admin' }))
    await members.grant({ workspaceId: subject === 'foreign' ? `${m.workspace}-foreign` : m.workspace, issuer, subject, baseRole });
}
control = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.headers['x-pilot-control'] !== m.control) { res.writeHead(403); return res.end(); }
  if (req.url === '/restart') { await app.close(); await start(); return res.end('restarted'); }
  if (req.url === '/stop') { res.end('stopping'); setTimeout(() => close(0), 50); return; }
  res.writeHead(404); res.end();
});
await new Promise((resolve, reject) => { control.once('error', reject); control.listen(m.controlPort, '127.0.0.1', resolve); });
writeFileSync(`${m.home}/ready.json`, JSON.stringify({ pid: process.pid, origin, syntheticOnly: true }));
process.on('SIGTERM', () => close(0)); process.on('SIGINT', () => close(0));
