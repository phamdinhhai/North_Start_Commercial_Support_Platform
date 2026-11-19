import { beforeAll, describe, expect, it } from 'vitest';
import { JwksKeyStore } from './jwks-key-store';
import { OidcAuthenticator } from './oidc-authenticator';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_ISSUER, type TestSigningKey } from './oidc-test-kit';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';

/** Independent QA (R2, Subagent I) — additional adversarial OIDC probes (all expected to pass). */
describe('R2 independent QA — OIDC adversarial probes', () => {
  let rsa: TestSigningKey;
  let ec: TestSigningKey;
  beforeAll(async () => {
    rsa = await createTestKey('kid-shared');
    ec = await createTestKey('kid-shared', 'ES256');
  });

  const store = (published: unknown[], clock: { t: number }) => {
    const state = { calls: 0 };
    const keys = new JwksKeyStore(async () => {
      state.calls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return { keys: published };
    }, { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000, now: () => clock.t });
    return { keys, state };
  };

  it('a concurrent flood of random kids against a cold cache causes exactly one JWKS fetch', async () => {
    const clock = { t: Date.now() };
    const { keys, state } = store([rsa.publicJwk], clock);
    const verifier = new OidcTokenVerifier(testConfig(), keys, () => new Date(clock.t));
    const strangers = await Promise.all(Array.from({ length: 20 }, (_, i) => createTestKey(`flood-${i}`)));
    const results = await Promise.all(strangers.map(async (k) => verifier.verify(await mintToken(k))));
    expect(results.every((r) => !r.ok)).toBe(true);
    expect(state.calls).toBe(1);
  });

  it('alg/kid confusion: ES256 token reusing the kid of a published RSA key is rejected', async () => {
    const clock = { t: Date.now() };
    const { keys } = store([rsa.publicJwk], clock);
    const verifier = new OidcTokenVerifier(testConfig({ algorithms: ['RS256', 'ES256'] }), keys, () => new Date(clock.t));
    const r = await verifier.verify(await mintToken(ec));
    expect(r.ok).toBe(false);
  });

  it('typ variants of the enrollment type and unknown typ are refused before key lookup', async () => {
    const clock = { t: Date.now() };
    const { keys, state } = store([rsa.publicJwk], clock);
    const verifier = new OidcTokenVerifier(testConfig(), keys, () => new Date(clock.t));
    for (const typ of ['AIL-ENROLLMENT', 'ail-enrollment', 'JWS', 'at+jwt+x']) {
      expect(await verifier.verify(await mintToken(rsa, { typ }))).toEqual({ ok: false, reason: 'token_type' });
    }
    expect(state.calls).toBe(0);
  });

  it('x-workspace-id cannot select a demo, revoked or foreign workspace; claims never select one', async () => {
    const clock = { t: Date.now() };
    const { keys } = store([rsa.publicJwk], clock);
    const memberships = new InMemoryMembershipStore();
    await memberships.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'u1', baseRole: 'sales' });
    await memberships.grant({ workspaceId: 'ws-old', issuer: TEST_ISSUER, subject: 'u1', baseRole: 'admin' });
    await memberships.revoke({ workspaceId: 'ws-old', issuer: TEST_ISSUER, subject: 'u1' });
    const auth = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys, () => new Date(clock.t)), memberships);
    const token = await mintToken(rsa, { sub: 'u1', extraClaims: { workspaceId: 'ws-b', role: 'admin' } });
    const as = (ws?: string) => auth.authenticate({ authorization: `Bearer ${token}`, ...(ws ? { 'x-workspace-id': ws } : {}) });
    expect(await as()).toMatchObject({ kind: 'authenticated', context: { workspaceId: 'ws-a', role: 'sales' } });
    expect(await as('ws-old')).toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
    expect(await as('ws-b')).toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
    expect(await as('demo:ws-a')).toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
    expect(await as('ws-a\nx')).toEqual({ kind: 'invalid_request', reason: 'workspace_header_invalid' });
  });
});
