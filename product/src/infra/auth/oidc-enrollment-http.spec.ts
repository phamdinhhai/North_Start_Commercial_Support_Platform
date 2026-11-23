import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { IntegrationIntake } from '../../application/integration/intake';
import { MEMBERSHIP_STORE } from '../../ports/auth';
import type { IntegrationStore } from '../../ports/integration';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';
import { JwksKeyStore } from './jwks-key-store';
import { OIDC_AUTHENTICATOR } from './oidc-auth.module';
import { OidcAuthenticator } from './oidc-authenticator';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_AUDIENCE, TEST_ISSUER, type TestSigningKey } from './oidc-test-kit';

/**
 * A-M5 regression: AUTH_MODE=oidc through the real Fastify hook → AuthService → IntegrationController.
 * Before the fix the controller resolved the principal from a COPY of the headers object, so the
 * verified context was never found and every principal enrollment/revoke answered 401.
 */
const ENV_KEYS = ['AUTH_MODE', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI', 'DEPLOYMENT_MODE', 'PILOT_STORE_MODE',
  'AUTH_DEV_UNSIGNED_TOKENS', 'DEMO_WORKSPACES', 'BOOTSTRAP_TOKEN', 'DATABASE_URL', 'NODE_ENV'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

describe('AUTH_MODE=oidc principal enrollment over HTTP (A-M5)', () => {
  let app: NestFastifyApplication;
  let key: TestSigningKey;
  let memberships: InMemoryMembershipStore;
  const store = { enroll: vi.fn().mockResolvedValue(undefined), revoke: vi.fn().mockResolvedValue(undefined), append: vi.fn() } satisfies IntegrationStore;
  const scope = { workspaceId: 'ws-oidc', connectionId: 'c1', accountId: 'a1', pageId: 'p1' };
  const intakeEnv: NodeJS.ProcessEnv = {
    AIL_RESEARCH_ENABLED: 'true', DEPLOYMENT_MODE: 'test', AIL_SCOPE_ALLOWLIST: JSON.stringify([scope]),
    AIL_SIGNING_KEYS: JSON.stringify([{ kid: 'k1', secret: randomBytes(32).toString('base64url'), state: 'active' }]),
  };
  const post = async (url: string, body: unknown, sub?: string, extra: Record<string, string> = {}) =>
    app.getHttpAdapter().getInstance().inject({
      method: 'POST', url, payload: body as object,
      headers: { 'content-type': 'application/json', ...(sub ? { authorization: `Bearer ${await mintToken(key, { sub })}` } : {}), ...extra },
    });

  beforeAll(async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, {
      AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory',
      OIDC_ISSUER: TEST_ISSUER, OIDC_AUDIENCE: TEST_AUDIENCE, OIDC_JWKS_URI: 'https://idp.test.invalid/jwks',
    });
    key = await createTestKey('kid-enroll');
    memberships = new InMemoryMembershipStore();
    await memberships.grant({ workspaceId: 'ws-oidc', issuer: TEST_ISSUER, subject: 'ada', baseRole: 'admin' });
    await memberships.grant({ workspaceId: 'ws-oidc', issuer: TEST_ISSUER, subject: 'mona', baseRole: 'manager' });
    await memberships.grant({ workspaceId: 'ws-oidc', issuer: TEST_ISSUER, subject: 'sam', baseRole: 'sales' });
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const authenticator = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), memberships);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MEMBERSHIP_STORE).useValue(memberships)
      .overrideProvider(OIDC_AUTHENTICATOR).useValue(authenticator)
      .overrideProvider(IntegrationIntake).useValue(new IntegrationIntake(store, intakeEnv))
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
    for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  });

  it('ADR-006: admin membership issues and revokes an enrollment, attributed to the internal platform user id', async () => {
    const issued = await post('/integration/enrollments', {}, 'ada');
    expect(issued.statusCode).toBe(201);
    const body = issued.json();
    expect(body.scope).toEqual({ ...scope, providerSurface: 'pancake-conversations' });
    const actorId = await memberships.resolveUserId(TEST_ISSUER, 'ada');
    expect(actorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.enroll).toHaveBeenCalledWith(expect.objectContaining({ id: body.enrollmentId }), { issuance: 'principal', actorId, role: 'admin', kid: 'k1' });
    const revoked = await post('/integration/enrollments/revoke', { enrollmentId: body.enrollmentId }, 'ada', { 'x-workspace-id': 'ws-oidc' });
    expect(revoked.statusCode).toBe(201);
    expect(store.revoke).toHaveBeenCalledWith(body.enrollmentId, { issuance: 'principal', actorId, role: 'admin', workspaceId: 'ws-oidc' });
  });

  it('ADR-006: manager and sales memberships → 403; unknown identity / no token → 401; foreign workspace header → 403', async () => {
    store.enroll.mockClear();
    store.revoke.mockClear();
    expect((await post('/integration/enrollments', {}, 'mona')).statusCode).toBe(403);
    expect((await post('/integration/enrollments/revoke', { enrollmentId: '11111111-1111-4111-8111-111111111111' }, 'mona')).statusCode).toBe(403);
    expect((await post('/integration/enrollments', {}, 'sam')).statusCode).toBe(403);
    expect((await post('/integration/enrollments/revoke', { enrollmentId: '11111111-1111-4111-8111-111111111111' }, 'sam')).statusCode).toBe(403);
    expect((await post('/integration/enrollments', {}, 'nobody')).statusCode).toBe(401);
    expect((await post('/integration/enrollments', {})).statusCode).toBe(401);
    expect((await post('/integration/enrollments', {}, 'ada', { 'x-workspace-id': 'ws-other' })).statusCode).toBe(403);
    expect(store.enroll).not.toHaveBeenCalled();
    expect(store.revoke).not.toHaveBeenCalled();
  });
});
