import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../app.module';
import { MEMBERSHIP_STORE } from '../../ports/auth';
import { BROWSER_SESSION } from '../../ports/browser-session';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';
import { OIDC_AUTHENTICATOR } from './oidc-auth.module';
import { OidcAuthenticator } from './oidc-authenticator';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { JwksKeyStore } from './jwks-key-store';
import { createTestKey, mintToken, testConfig } from './oidc-test-kit';
import { BrowserSessionService } from './browser-session.service';

const envKeys = ['AUTH_MODE', 'DEPLOYMENT_MODE', 'PILOT_STORE_MODE', 'DATABASE_URL', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI', 'OIDC_BROWSER_ENABLED'] as const;
const previous = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
let app: NestFastifyApplication, sessions: BrowserSessionService, members: InMemoryMembershipStore;
let cookie: string, csrf: string;
const config = { oidc: testConfig(), origin: 'http://127.0.0.1:3100', authorizationEndpoint: 'http://127.0.0.1:3200/authorize',
  tokenEndpoint: 'http://127.0.0.1:3200/token', clientId: 'north-browser', redirectUri: 'http://127.0.0.1:3100/v1/auth/callback', secure: false };
beforeAll(async () => {
  for (const k of envKeys) delete process.env[k];
  Object.assign(process.env, { AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory',
    OIDC_ISSUER: config.oidc.issuer, OIDC_AUDIENCE: config.oidc.audiences.join(','), OIDC_JWKS_URI: config.oidc.jwksUri });
  const key = await createTestKey('browser-http'); const token = await mintToken(key, { sub: 'alice' });
  members = new InMemoryMembershipStore();
  await members.grant({ workspaceId: 'ws-a', issuer: config.oidc.issuer, subject: 'alice', baseRole: 'sales' });
  const auth = new OidcAuthenticator(new OidcTokenVerifier(config.oidc, new JwksKeyStore(async () => ({ keys: [key.publicJwk] }),
    { cacheMaxAgeMs: 600000, refetchCooldownMs: 30000 })), members);
  sessions = new BrowserSessionService(config, auth, async () => ({ accessToken: token, subject: 'alice', expiresAt: Date.now() + 300000 }));
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(OIDC_AUTHENTICATOR).useValue(auth)
    .overrideProvider(MEMBERSHIP_STORE).useValue(members).overrideProvider(BROWSER_SESSION).useValue(sessions).compile();
  app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('v1'); await app.init(); await app.getHttpAdapter().getInstance().ready();
}, 20000);
afterAll(async () => {
  try { await app?.close(); } finally { for (const k of envKeys) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k]; } }
});
describe('browser login HTTP composition (local signed JWT and exchange fixture)', () => {
  it('redirects with bound PKCE and exposes only context/CSRF after callback', async () => {
    const start = await app.inject({ method: 'GET', url: '/v1/auth/login' });
    expect(start.statusCode).toBe(302); const url = new URL(String(start.headers.location));
    const loginCookie = start.cookies.find(c => c.name === 'north_login')!;
    const callback = await app.inject({ method: 'GET', url: `/v1/auth/callback?state=${url.searchParams.get('state')}&code=fixture-code`,
      headers: { cookie: `north_login=${loginCookie.value}` } });
    expect(callback.statusCode).toBe(302);
    const sessionCookie = callback.cookies.find(c => c.name === 'north_session')!;
    cookie = `north_session=${sessionCookie.value}`;
    const view = await app.inject({ method: 'GET', url: '/v1/auth/session', headers: { cookie } });
    expect(view.statusCode).toBe(200); expect(view.json().context.role).toBe('sales'); csrf = view.json().csrfToken;
    expect(view.json()).not.toHaveProperty('accessToken'); expect(view.headers['cache-control']).toBe('no-store');
  });
  it('requires Origin+CSRF on actual pilot mutation and authenticates cookie reads', async () => {
    const payload = { displayName: 'Synthetic fixture', utterance: 'Synthetic message', speaker: 'customer', connection: 'manual', externalRecordId: 'browser-session-http', isSynthetic: true };
    expect((await app.inject({ method: 'POST', url: '/v1/pilot/scenarios', headers: { cookie }, payload })).statusCode).toBe(403);
    const created = await app.inject({ method: 'POST', url: '/v1/pilot/scenarios', headers: { cookie, origin: config.origin, 'x-csrf-token': csrf }, payload });
    expect(created.statusCode).toBe(201);
    expect((await app.inject({ method: 'GET', url: `/v1/pilot/leads/${created.json().leadId}`, headers: { cookie } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/pilot/queue', headers: { cookie, 'x-workspace-id': 'foreign' } })).statusCode).toBe(400);
  });
  it('keeps login shell available after session loss and rejects duplicate/malformed cookies', async () => {
    const expired = `north_session=${'z'.repeat(43)}`;
    expect((await app.inject({ method: 'GET', url: '/v1/operator', headers: { cookie: expired } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/v1/auth/session', headers: { cookie: expired } })).json()).toMatchObject({ authenticated: false, loginAvailable: true });
    expect((await app.inject({ method: 'GET', url: '/v1/pilot/queue', headers: { cookie: expired } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { cookie: `${cookie}; ${cookie}` } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/logout', headers: { cookie: 'north_session=bad' } })).statusCode).toBe(400);
  });
  it('rechecks membership on next request and logout destroys server-side session', async () => {
    await members.revoke({ workspaceId: 'ws-a', issuer: config.oidc.issuer, subject: 'alice' });
    expect((await app.inject({ method: 'GET', url: '/v1/pilot/queue', headers: { cookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/v1/auth/logout',
      headers: { cookie, origin: config.origin, 'x-csrf-token': csrf } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/pilot/queue', headers: { cookie } })).statusCode).toBe(401);
  });
});
