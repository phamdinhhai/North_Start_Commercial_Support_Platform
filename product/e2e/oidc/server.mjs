import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { startIdp } from './fixture-idp.mjs';
import { registerFrontend } from '../../scripts/pilot/frontend.mjs';

const databaseTarget = new URL(process.env.QA_DATABASE_URL || 'invalid:');
if (!['postgres:', 'postgresql:'].includes(databaseTarget.protocol) || databaseTarget.hostname !== '127.0.0.1' ||
    !/^\/qa_browser_[a-z0-9_]+$/.test(databaseTarget.pathname) || databaseTarget.search || databaseTarget.hash || !databaseTarget.port)
  throw new Error('QA_DATABASE_URL must name a fresh disposable qa_browser_* database on an explicit loopback port');
if (!/^[a-f0-9]{64}$/.test(process.env.QA_CONTROL_SECRET || '')) throw new Error('Test runner control secret required');
const require = createRequire(import.meta.url);
const origin = 'http://127.0.0.1:3410', issuer = 'http://127.0.0.1:3411';
Object.assign(process.env, { DATABASE_URL: process.env.QA_DATABASE_URL, DEPLOYMENT_MODE: 'test', NODE_ENV: 'test', PILOT_STORE_MODE: 'postgres',
  AUTH_MODE: 'oidc', AUTH_DEV_UNSIGNED_TOKENS: 'false', DEMO_WORKSPACES: 'false', OIDC_BROWSER_ENABLED: 'true',
  ...(process.env.NATIVE_INBOX_E2E === 'true' ? { SOURCE_INTEGRATION_SYNTHETIC_ENABLED: 'true' } : {}),
  OIDC_BROWSER_ORIGIN: origin, OIDC_AUTHORIZATION_ENDPOINT: `${issuer}/authorize`, OIDC_TOKEN_ENDPOINT: `${issuer}/token`,
  OIDC_CLIENT_ID: 'qa-browser', OIDC_ISSUER: issuer, OIDC_JWKS_URI: `${issuer}/jwks`, OIDC_AUDIENCE: 'qa-api',
  CONTENT_DIGEST_KEYS_JSON: JSON.stringify(['qa-browser-a', 'qa-browser-b'].map(workspaceId => ({ workspaceId, activeKid: 'fixture-v1', keys: [{ kid: 'fixture-v1', secretBase64: randomBytes(32).toString('base64') }] }))) });
const { installContentDigester } = require('../../dist/ports/content-digester-runtime.js');
const { configuredContentDigester } = require('../../dist/infra/crypto/configured-content-digester.js');
installContentDigester(configuredContentDigester(process.env));
const { PostgresService } = require('../../dist/infra/postgres/postgres.service.js');
const { Migrator, loadMigrations } = require('../../dist/infra/postgres/migrator.js');
const { AppModule } = require('../../dist/app.module.js');
const { MEMBERSHIP_STORE } = require('../../dist/ports/auth.js');
const { BROWSER_SESSION } = require('../../dist/ports/browser-session.js');
const db = new PostgresService(); await new Migrator(db, loadMigrations()).up();
// Refuse reused business data: this setup provisions identities only.
const empty = await db.query('SELECT count(*)::int AS n FROM lead');
if (empty.rows[0].n !== 0) throw new Error('Acceptance database must initially contain no leads');
for (const workspace of ['qa-browser-a', 'qa-browser-b'])
  await db.query('INSERT INTO workspace(id,name) VALUES ($1,$2)', [workspace, 'Fabricated browser QA']);
const idp = await startIdp(3411, origin);
let app;
async function start() {
  // A restart models process termination, including Chromium's requestless TCP
  // preconnect sockets. Node's idle HTTP shutdown does not close those sockets.
  app = await NestFactory.create(AppModule, new FastifyAdapter({ forceCloseConnections: true }), { logger: false });
  app.setGlobalPrefix('v1'); registerFrontend(app.getHttpAdapter().getInstance()); await app.listen(3410, '127.0.0.1');
}
await start();
const members = app.get(MEMBERSHIP_STORE);
for (const account of ['owner', 'recipient', 'viewer', 'bystander', 'foreign', 'admin'])
  await members.grant({ workspaceId: account === 'foreign' ? 'qa-browser-b' : 'qa-browser-a', issuer, subject: account,
    baseRole: account === 'viewer' ? 'viewer' : account === 'admin' ? 'admin' : account === 'bystander' ? 'manager' : 'sales' });
// Loopback-only runner control. Never returns credentials, tokens or session identifiers.
const control = createServer(async (req, res) => {
  if (req.method !== 'POST' || !['/restart', '/expire-sessions'].includes(req.url) || req.headers['x-qa-control'] !== process.env.QA_CONTROL_SECRET) { res.writeHead(403); return res.end(); }
  if (req.url === '/expire-sessions') {
    // Test-only access to compiled private state; production composition is unchanged.
    for (const [key, value] of app.get(BROWSER_SESSION).sessions) app.get(BROWSER_SESSION).sessions.set(key, { ...value, expires: 0 });
    return res.end('expired');
  }
  await app.close(); await start(); res.end('restarted');
});
await new Promise(resolve => control.listen(3412, '127.0.0.1', resolve));
async function close() { await app.close(); await db.onModuleDestroy(); idp.close(); control.close(); process.exit(0); }
process.on('SIGTERM', close); process.on('SIGINT', close);
