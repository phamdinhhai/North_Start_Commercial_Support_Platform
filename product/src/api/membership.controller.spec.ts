import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { MEMBERSHIP_STORE } from '../ports/auth';
import { InMemoryMembershipStore } from '../infra/membership/in-memory-membership.store';
import { JwksKeyStore } from '../infra/auth/jwks-key-store';
import { OIDC_AUTHENTICATOR } from '../infra/auth/oidc-auth.module';
import { OidcAuthenticator } from '../infra/auth/oidc-authenticator';
import { OidcTokenVerifier } from '../infra/auth/oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_AUDIENCE, TEST_ISSUER, type TestSigningKey } from '../infra/auth/oidc-test-kit';

/** ADR-006 admin membership API over real HTTP: Fastify hook → AuthService → MembershipController. */
const ENV_KEYS = ['AUTH_MODE', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI', 'DEPLOYMENT_MODE', 'PILOT_STORE_MODE',
  'AUTH_DEV_UNSIGNED_TOKENS', 'DEMO_WORKSPACES', 'BOOTSTRAP_TOKEN', 'DATABASE_URL', 'NODE_ENV'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const restore = () => { for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; };
const URL = '/workspace/memberships';

async function boot(overrides?: (b: ReturnType<typeof Test.createTestingModule>) => void): Promise<NestFastifyApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  overrides?.(builder);
  const app = (await builder.compile()).createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('ADR-006 admin membership API (AUTH_MODE=oidc)', () => {
  let app: NestFastifyApplication;
  let key: TestSigningKey;
  let store: InMemoryMembershipStore;
  let adminId: string;

  const call = async (method: 'GET' | 'POST', url: string, sub?: string, payload?: unknown, extra: Record<string, string> = {}) => {
    const res = await app.getHttpAdapter().getInstance().inject({
      method, url, payload: payload as object,
      headers: { ...(payload !== undefined ? { 'content-type': 'application/json' } : {}), ...(sub ? { authorization: `Bearer ${await mintToken(key, { sub })}` } : {}), ...extra },
    });
    return { status: res.statusCode, body: res.body ? res.json() : undefined };
  };

  beforeAll(async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, {
      AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory',
      OIDC_ISSUER: TEST_ISSUER, OIDC_AUDIENCE: TEST_AUDIENCE, OIDC_JWKS_URI: 'https://idp.test.invalid/jwks',
    });
    key = await createTestKey('kid-membership');
    store = new InMemoryMembershipStore();
    // First admin = operator seed path (no HTTP actor exists yet); audited as the operator.
    adminId = (await store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'ada', baseRole: 'admin' })).userId;
    await store.grant({ workspaceId: 'ws-b', issuer: TEST_ISSUER, subject: 'bea', baseRole: 'admin' });
    for (const [subject, baseRole] of [['mona', 'manager'], ['sam', 'sales'], ['vic', 'viewer']] as const) {
      await store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject, baseRole });
    }
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const authenticator = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), store);
    app = await boot((b) => {
      b.overrideProvider(MEMBERSHIP_STORE).useValue(store);
      b.overrideProvider(OIDC_AUTHENTICATOR).useValue(authenticator);
    });
  });
  afterAll(async () => {
    await app?.close();
    restore();
  });

  it('manager, sales and viewer → 403 on every route; no token / unknown identity → 401; nothing changes', async () => {
    const before = store.auditLog().length;
    const id = (await store.list('ws-a'))[0].id;
    for (const sub of ['mona', 'sam', 'vic']) {
      expect((await call('GET', URL, sub)).status).toBe(403);
      expect((await call('POST', URL, sub, { issuer: TEST_ISSUER, subject: 'x', baseRole: 'admin' })).status).toBe(403);
      expect((await call('POST', `${URL}/${id}/revoke`, sub, {})).status).toBe(403);
      expect((await call('POST', `${URL}/${id}/role`, sub, { baseRole: 'admin' })).status).toBe(403);
    }
    expect((await call('GET', URL)).status).toBe(401);
    expect((await call('GET', URL, 'nobody')).status).toBe(401);
    expect((await call('POST', URL, 'nobody', { issuer: TEST_ISSUER, subject: 'nobody', baseRole: 'admin' })).status).toBe(401);
    expect(store.auditLog()).toHaveLength(before);
    expect(await store.resolveUserId(TEST_ISSUER, 'x')).toBeNull();
  });

  it('admin grant pre-provisions an identity that can then log in; the change is audited with the admin internal id', async () => {
    expect((await call('GET', '/pilot/queue', 'newbie')).status).toBe(401); // unknown identity: no auto-provisioning
    const granted = await call('POST', URL, 'ada', { issuer: TEST_ISSUER, subject: 'newbie', baseRole: 'sales' });
    expect(granted.status).toBe(201);
    expect(granted.body).toMatchObject({ workspaceId: 'ws-a', baseRole: 'sales', status: 'active', revokedAt: null });
    expect(granted.body.userId).toBe(await store.resolveUserId(TEST_ISSUER, 'newbie'));
    expect(store.auditLog().at(-1)).toMatchObject({ operation: 'grant', membershipId: granted.body.id, actor: adminId });
    expect((await call('GET', '/pilot/queue', 'newbie')).status).toBe(200);
    const listed = await call('GET', URL, 'ada');
    expect(listed.status).toBe(200);
    expect(listed.body.find((m: { id: string }) => m.id === granted.body.id)).toMatchObject({ identities: [{ issuer: TEST_ISSUER, subject: 'newbie' }] });
    expect(listed.body.every((m: { workspaceId: string }) => m.workspaceId === 'ws-a')).toBe(true);
    expect((await call('POST', URL, 'ada', { issuer: TEST_ISSUER, subject: 'newbie', baseRole: 'viewer' })).body).toEqual(expect.objectContaining({ code: 'MEMBERSHIP_EXISTS' }));
  });

  it('role change = revoke + grant (new row); revoke is terminal and effective on the next request', async () => {
    const target = (await call('POST', URL, 'ada', { issuer: TEST_ISSUER, subject: 'rhea', baseRole: 'viewer' })).body;
    const changed = await call('POST', `${URL}/${target.id}/role`, 'ada', { baseRole: 'manager' });
    expect(changed.status).toBe(200);
    expect(changed.body.revoked).toMatchObject({ id: target.id, status: 'revoked', baseRole: 'viewer' });
    expect(changed.body.granted).toMatchObject({ status: 'active', baseRole: 'manager', userId: target.userId });
    expect(changed.body.granted.id).not.toBe(target.id);
    expect((await call('GET', '/pilot/queue', 'rhea')).status).toBe(200);
    const revoked = await call('POST', `${URL}/${changed.body.granted.id}/revoke`, 'ada');
    expect(revoked).toMatchObject({ status: 200, body: { status: 'revoked' } });
    expect((await call('GET', '/pilot/queue', 'rhea')).status).toBe(401);
    expect(await call('POST', `${URL}/${changed.body.granted.id}/revoke`, 'ada', {})).toMatchObject({ status: 409, body: { code: 'MEMBERSHIP_NOT_ACTIVE' } });
    const history = await call('GET', `${URL}?status=revoked`, 'ada');
    expect(history.body.filter((m: { userId: string }) => m.userId === target.userId)).toHaveLength(2);
    expect(store.auditLog().filter((e) => e.userId === target.userId).map((e) => [e.operation, e.actor])).toEqual([
      ['grant', adminId], ['revoke', adminId], ['grant', adminId], ['revoke', adminId],
    ]);
  });

  it('workspace never from body/header; foreign workspace ids look missing; self-change and bad input refused', async () => {
    expect((await call('POST', URL, 'ada', { issuer: TEST_ISSUER, subject: 'z', baseRole: 'sales', workspaceId: 'ws-b' })).body).toEqual(expect.objectContaining({ code: 'WORKSPACE_FROM_CONTEXT' }));
    expect((await call('GET', URL, 'ada', undefined, { 'x-workspace-id': 'ws-b' })).status).toBe(403);
    const foreign = (await store.list('ws-b'))[0].id;
    expect((await call('POST', `${URL}/${foreign}/revoke`, 'ada', {})).status).toBe(404);
    expect((await call('POST', `${URL}/${foreign}/role`, 'ada', { baseRole: 'viewer' })).status).toBe(404);
    expect((await store.get('ws-b', foreign))?.status).toBe('active');
    const own = (await store.listActive(adminId))[0].id;
    expect((await call('POST', `${URL}/${own}/revoke`, 'ada', {})).body).toEqual(expect.objectContaining({ code: 'SELF_MEMBERSHIP_CHANGE' }));
    expect((await call('POST', URL, 'ada', { issuer: 'https://evil.invalid', subject: 'z', baseRole: 'admin' })).body).toEqual(expect.objectContaining({ code: 'ISSUER_NOT_ACCEPTED' }));
    expect((await call('POST', URL, 'ada', { issuer: TEST_ISSUER, subject: 'z', baseRole: 'owner' })).status).toBe(400);
    expect((await call('POST', `${URL}/not-a-uuid/revoke`, 'ada', {})).status).toBe(400);
    expect((await call('POST', `${URL}/${foreign}/revoke`, 'ada', { reason: 'x' })).body).toEqual(expect.objectContaining({ code: 'EMPTY_BODY_REQUIRED' }));
    expect((await call('GET', `${URL}?status=deleted`, 'ada')).status).toBe(400);
    expect((await call('POST', URL, 'ada', { issuer: TEST_ISSUER, subject: 'z', baseRole: 'sales', padding: 'x'.repeat(9000) })).status).toBe(413);
    expect(await store.resolveUserId(TEST_ISSUER, 'z')).toBeNull();
  });
});

describe('ADR-006 admin membership API — legacy AUTH_MODE', () => {
  afterAll(() => restore());

  it('is disabled (404) even for the bootstrap admin: no internal principal to attribute changes to', async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    const bootstrap = `boot-${Math.random().toString(36).slice(2)}`;
    Object.assign(process.env, { DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory', BOOTSTRAP_TOKEN: bootstrap });
    const app = await boot();
    try {
      const res = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: URL, headers: { 'x-bootstrap-token': bootstrap } });
      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ code: 'MEMBERSHIP_API_DISABLED' });
    } finally {
      await app.close();
    }
  });
});
