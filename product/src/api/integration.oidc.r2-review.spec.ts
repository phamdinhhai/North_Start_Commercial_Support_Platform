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

/**
 * Independent QA (R2, Subagent I). DEFECT R2-I-02: under AUTH_MODE=oidc the principal-authenticated
 * enrollment endpoints never see the verified context, because IntegrationController.principal()
 * spreads the headers into a NEW object (`{ ...headers }`) while VerifiedContextRegistry is keyed by
 * the identity of `request.raw.headers` (WeakMap). Fails closed (401), so no bypass — but the round-2
 * "principal issuance via OIDC" path is unusable. `it.fails` asserts the expected behaviour.
 */
const ENV_KEYS = ['AUTH_MODE', 'OIDC_ISSUER', 'OIDC_AUDIENCE', 'OIDC_JWKS_URI', 'DEPLOYMENT_MODE', 'PILOT_STORE_MODE',
  'AUTH_DEV_UNSIGNED_TOKENS', 'DEMO_WORKSPACES', 'BOOTSTRAP_TOKEN', 'DATABASE_URL', 'NODE_ENV',
  'AIL_RESEARCH_ENABLED', 'AIL_SIGNING_SECRET', 'AIL_SIGNING_KEYS', 'AIL_SCOPE_ALLOWLIST', 'AIL_ISSUER_SECRET',
  'AIL_WORKSPACE_ID', 'AIL_CONNECTION_ID', 'AIL_ACCOUNT_ID', 'AIL_PAGE_ID'] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

describe('R2 independent QA — OIDC principal reaches /integration/enrollments', () => {
  let app: NestFastifyApplication;
  let key: TestSigningKey;

  beforeAll(async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    Object.assign(process.env, {
      AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test', PILOT_STORE_MODE: 'memory',
      OIDC_ISSUER: TEST_ISSUER, OIDC_AUDIENCE: TEST_AUDIENCE, OIDC_JWKS_URI: 'https://idp.test.invalid/jwks',
      AIL_RESEARCH_ENABLED: 'true', AIL_SIGNING_SECRET: 's'.repeat(40),
      AIL_SCOPE_ALLOWLIST: JSON.stringify([{ workspaceId: 'ws-a', connectionId: 'c1', accountId: 'a1', pageId: 'p1' }]),
    });
    key = await createTestKey('kid-r2i');
    const store = new InMemoryMembershipStore();
    await store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'mgr', baseRole: 'manager' });
    // R3 / ADR-006: enrollment issue/revoke is admin-only, so the resolution probe uses an admin.
    await store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'adm', baseRole: 'admin' });
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const authenticator = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), store);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MEMBERSHIP_STORE).useValue(store)
      .overrideProvider(OIDC_AUTHENTICATOR).useValue(authenticator)
      .compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app?.close();
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  const inject = (url: string, headers: Record<string, string>, payload?: unknown) =>
    app.getHttpAdapter().getInstance().inject({ method: payload === undefined ? 'GET' : 'POST', url, headers, payload: payload as object });

  it('control: the same verified manager token is authenticated on /pilot/queue', async () => {
    const headers = { authorization: `Bearer ${await mintToken(key, { sub: 'mgr' })}` };
    expect((await inject('/pilot/queue', headers)).statusCode).toBe(200);
  });

  // Body {workspaceId} is refused AFTER principal resolution with 400 WORKSPACE_FROM_CONTEXT, so the
  // status code tells us whether the principal was resolved without touching the store.
  // Fixed by A-M5 (work/r2-fix-auth): flipped from it.fails.
  it('verified admin is resolved by IntegrationController (expected 400 WORKSPACE_FROM_CONTEXT)', async () => {
    const headers = { authorization: `Bearer ${await mintToken(key, { sub: 'adm' })}` };
    const res = await inject('/integration/enrollments', headers, { workspaceId: 'ws-a' });
    expect(res.statusCode).toBe(400);
  });

  // R3 / ADR-006 expectation change: a verified manager is resolved but no longer authorized (403).
  it('verified manager is resolved and refused by the ADR-006 matrix (expected 403)', async () => {
    const headers = { authorization: `Bearer ${await mintToken(key, { sub: 'mgr' })}` };
    expect((await inject('/integration/enrollments', headers, { workspaceId: 'ws-a' })).statusCode).toBe(403);
  });
  // The pre-fix 401 defect-evidence case was removed after A-M5; the case above guards the regression.
});
