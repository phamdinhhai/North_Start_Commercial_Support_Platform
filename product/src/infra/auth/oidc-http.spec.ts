import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { MEMBERSHIP_STORE } from '../../ports/auth';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';
import { JwksKeyStore } from './jwks-key-store';
import { OIDC_AUTHENTICATOR } from './oidc-auth.module';
import { OidcAuthenticator } from './oidc-authenticator';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_AUDIENCE, TEST_ISSUER, type TestSigningKey } from './oidc-test-kit';

/** Full HTTP path: Fastify hook → AuthService → real PilotLoopController (GET /pilot/queue). */
const ENV_KEYS = ['AUTH_MODE', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI', 'DEPLOYMENT_MODE', 'PILOT_STORE_MODE',
  'AUTH_DEV_UNSIGNED_TOKENS', 'DEMO_WORKSPACES', 'BOOTSTRAP_TOKEN', 'DATABASE_URL'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function restoreEnv(): void {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>): void {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(values)) if (v !== undefined) process.env[k] = v;
}
const unsigned = (claims: Record<string, unknown>) => Buffer.from(JSON.stringify(claims)).toString('base64');

async function boot(overrides?: (builder: ReturnType<typeof Test.createTestingModule>) => void): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  overrides?.(builder);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function get(app: NestFastifyApplication, headers: Record<string, string>) {
  return app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/pilot/queue', headers });
}

describe('AUTH_MODE=oidc over HTTP (experimental, default OFF)', () => {
  let app: NestFastifyApplication;
  let key: TestSigningKey;
  let store: InMemoryMembershipStore;

  beforeAll(async () => {
    setEnv({
      AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory',
      OIDC_ISSUER: TEST_ISSUER, OIDC_AUDIENCE: TEST_AUDIENCE, OIDC_JWKS_URI: 'https://idp.test.invalid/jwks',
      // Legacy paths deliberately switched ON to prove OIDC mode ignores them.
      AUTH_DEV_UNSIGNED_TOKENS: 'true', BOOTSTRAP_TOKEN: `boot-${Math.random().toString(36).slice(2)}`,
    });
    key = await createTestKey('kid-http');
    store = new InMemoryMembershipStore();
    await store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'alice', baseRole: 'sales' });
    await store.grant({ workspaceId: 'ws-gone', issuer: TEST_ISSUER, subject: 'carol', baseRole: 'manager' });
    await store.revoke({ workspaceId: 'ws-gone', issuer: TEST_ISSUER, subject: 'carol' });
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const authenticator = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), store);
    app = await boot((b) => {
      b.overrideProvider(MEMBERSHIP_STORE).useValue(store);
      b.overrideProvider(OIDC_AUTHENTICATOR).useValue(authenticator);
    });
  });
  afterAll(async () => {
    await app?.close();
    restoreEnv();
  });

  it('valid token + active membership → 200 via the real controller', async () => {
    const res = await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'alice' })}` });
    expect(res.statusCode).toBe(200);
  });

  it('no membership → 401; revoked membership → 401', async () => {
    expect((await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'bob' })}` })).statusCode).toBe(401);
    expect((await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'carol' })}` })).statusCode).toBe(401);
  });

  it('client-requested workspace without membership → 403 (spoof refused)', async () => {
    const res = await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'alice' })}`, 'x-workspace-id': 'ws-b' });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'WORKSPACE_MEMBERSHIP_REQUIRED' });
    const ok = await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'alice' })}`, 'x-workspace-id': 'ws-a' });
    expect(ok.statusCode).toBe(200);
  });

  it('invalid tokens → 401 (expired, wrong audience, tampered)', async () => {
    expect((await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'alice', expSecondsFromNow: -600 })}` })).statusCode).toBe(401);
    expect((await get(app, { authorization: `Bearer ${await mintToken(key, { sub: 'alice', aud: 'other' })}` })).statusCode).toBe(401);
    const [h, p] = (await mintToken(key, { sub: 'alice' })).split('.');
    expect((await get(app, { authorization: `Bearer ${h}.${p}.AAAA` })).statusCode).toBe(401);
  });

  it('legacy unsigned admin-claim token and bootstrap token are refused in OIDC mode', async () => {
    const forged = unsigned({ workspaceId: 'ws-a', userId: 'alice', role: 'sales' });
    expect((await get(app, { authorization: `Bearer ${forged}` })).statusCode).toBe(401);
    expect((await get(app, { 'x-bootstrap-token': process.env.BOOTSTRAP_TOKEN! })).statusCode).toBe(401);
  });

  it('AIL enrollment token is never a login; hook leaves non-OIDC bearers to the owning controller', async () => {
    const enrollment = await mintToken(key, { sub: 'alice', typ: 'AIL-ENROLLMENT' });
    expect((await get(app, { authorization: `Bearer ${enrollment}` })).statusCode).toBe(401);
    // Even with a (spoofed) workspace header the hook does not answer: no 400/403 for unverified bearers.
    expect((await get(app, { authorization: `Bearer ${enrollment}`, 'x-workspace-id': 'ws-a' })).statusCode).toBe(401);
    expect((await get(app, { authorization: 'Bearer opaque-enrollment', 'x-workspace-id': 'bad header!' })).statusCode).toBe(401);
  });

  it('health stays unauthenticated and unaffected by a bad bearer', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/health', headers: { authorization: 'Bearer junk' } });
    expect(res.statusCode).toBe(200);
  });
});

describe('AUTH_MODE flag off / misconfigured', () => {
  afterEach(() => restoreEnv());

  it('flag off: legacy unsigned dev token behaviour unchanged; JWT bearer is not OIDC-verified', async () => {
    setEnv({ DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory', AUTH_DEV_UNSIGNED_TOKENS: 'true' });
    const app = await boot();
    try {
      const legacy = unsigned({ workspaceId: 'ws-a', userId: 'alice', role: 'sales' });
      expect((await get(app, { authorization: `Bearer ${legacy}` })).statusCode).toBe(200);
      const key = await createTestKey('kid-off');
      expect((await get(app, { authorization: `Bearer ${await mintToken(key)}` })).statusCode).toBe(401);
      expect((await get(app, {})).statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it.each([
    ['missing issuer', { AUTH_MODE: 'oidc', OIDC_AUDIENCE: 'a', OIDC_JWKS_URI: 'https://idp.invalid/certs' }],
    ['unknown AUTH_MODE', { AUTH_MODE: 'jwt-unsafe' }],
  ])('%s → application bootstrap fails closed', async (_label, env) => {
    setEnv({ DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory', ...env });
    await expect(boot()).rejects.toThrow(/OIDC configuration invalid/);
  });
});
