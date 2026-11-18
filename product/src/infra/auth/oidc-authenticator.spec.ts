import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { JwksKeyStore } from './jwks-key-store';
import { OidcAuthenticator } from './oidc-authenticator';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_ISSUER, type TestSigningKey } from './oidc-test-kit';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';
import type { MembershipReader } from '../../ports/auth';

describe('OidcAuthenticator — server-side workspace membership (security-critical, OPEN: PM-1)', () => {
  let key: TestSigningKey;
  let store: InMemoryMembershipStore;
  let auth: OidcAuthenticator;
  beforeAll(async () => { key = await createTestKey('kid-1'); });
  beforeEach(async () => {
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    store = new InMemoryMembershipStore();
    auth = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), store);
    await store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'user-alice', baseRole: 'sales' });
  });
  const bearer = (token: string, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${token}`, ...extra });

  it('valid token + active membership → context from the membership row', async () => {
    const decision = await auth.authenticate(bearer(await mintToken(key)));
    expect(decision).toEqual({ kind: 'authenticated', context: { workspaceId: 'ws-a', userId: 'user-alice', role: 'sales', isDemo: false } });
  });

  it('token role/workspace claims are ignored (no claim-based escalation)', async () => {
    const token = await mintToken(key, { extraClaims: { role: 'admin', workspaceId: 'ws-b', groups: ['admins'] } });
    const decision = await auth.authenticate(bearer(token));
    expect(decision.kind === 'authenticated' && decision.context).toMatchObject({ workspaceId: 'ws-a', role: 'sales' });
  });

  it('valid signature but no membership → unauthenticated', async () => {
    expect(await auth.authenticate(bearer(await mintToken(key, { sub: 'user-nobody' }))))
      .toEqual({ kind: 'unauthenticated', reason: 'no_membership' });
  });

  it('revoked membership → denied on the very next request', async () => {
    const token = await mintToken(key);
    expect((await auth.authenticate(bearer(token))).kind).toBe('authenticated');
    expect(await store.revoke({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'user-alice' })).toBe(true);
    expect(await auth.authenticate(bearer(token))).toEqual({ kind: 'unauthenticated', reason: 'no_membership' });
    expect(await auth.authenticate(bearer(token, { 'x-workspace-id': 'ws-a' }))).toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
    await expect(store.grant({ workspaceId: 'ws-a', issuer: TEST_ISSUER, subject: 'user-alice', baseRole: 'admin' })).rejects.toThrow();
  });

  it('cross-workspace request without membership → forbidden', async () => {
    expect(await auth.authenticate(bearer(await mintToken(key), { 'x-workspace-id': 'ws-b' })))
      .toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
  });

  it('requested workspace honored only for an active membership; role still from the row', async () => {
    await store.grant({ workspaceId: 'ws-b', issuer: TEST_ISSUER, subject: 'user-alice', baseRole: 'viewer' });
    const token = await mintToken(key);
    expect(await auth.authenticate(bearer(token))).toEqual({ kind: 'unauthenticated', reason: 'workspace_selection_required' });
    const decision = await auth.authenticate(bearer(token, { 'x-workspace-id': 'ws-b' }));
    expect(decision.kind === 'authenticated' && decision.context).toMatchObject({ workspaceId: 'ws-b', role: 'viewer' });
  });

  it('same subject from a different issuer does not inherit membership', async () => {
    await store.grant({ workspaceId: 'ws-z', issuer: 'https://other-idp.invalid', subject: 'user-bob', baseRole: 'admin' });
    expect(await auth.authenticate(bearer(await mintToken(key, { sub: 'user-bob' }))))
      .toEqual({ kind: 'unauthenticated', reason: 'no_membership' });
  });

  it('malformed workspace header / repeated header → invalid_request; malformed authorization → unauthenticated', async () => {
    const token = await mintToken(key);
    expect(await auth.authenticate(bearer(token, { 'x-workspace-id': 'ws a; drop' }))).toEqual({ kind: 'invalid_request', reason: 'workspace_header_invalid' });
    expect(await auth.authenticate({ authorization: `Bearer ${token}`, 'x-workspace-id': ['ws-a', 'ws-b'] })).toEqual({ kind: 'invalid_request', reason: 'workspace_header_invalid' });
    expect(await auth.authenticate({ authorization: `Basic ${token}` })).toEqual({ kind: 'unauthenticated', reason: 'malformed_authorization' });
    expect(await auth.authenticate({ authorization: [`Bearer ${token}`, `Bearer ${token}`] })).toEqual({ kind: 'unauthenticated', reason: 'malformed_authorization' });
    expect(await auth.authenticate({})).toEqual({ kind: 'none' });
  });

  it('token failures surface as unauthenticated with the verifier reason', async () => {
    expect(await auth.authenticate(bearer(await mintToken(key, { expSecondsFromNow: -600 }))))
      .toEqual({ kind: 'unauthenticated', reason: 'expired' });
  });

  it('defensive: rows that are revoked/foreign/unknown-role from a faulty reader are ignored', async () => {
    const now = new Date();
    const faulty: MembershipReader = {
      listActive: async () => [
        { workspaceId: 'ws-r', issuer: TEST_ISSUER, subject: 'user-alice', baseRole: 'admin', status: 'revoked', createdAt: now, revokedAt: now },
        { workspaceId: 'ws-f', issuer: 'https://other.invalid', subject: 'user-alice', baseRole: 'admin', status: 'active', createdAt: now, revokedAt: null },
        { workspaceId: 'ws-u', issuer: TEST_ISSUER, subject: 'user-alice', baseRole: 'superuser' as never, status: 'active', createdAt: now, revokedAt: null },
      ],
    };
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const guarded = new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), faulty);
    expect(await guarded.authenticate(bearer(await mintToken(key)))).toEqual({ kind: 'unauthenticated', reason: 'no_membership' });
  });
});

describe('InMemoryMembershipStore — constraints mirror migration 010', () => {
  it('rejects new roles, demo workspaces and empty identity', async () => {
    const store = new InMemoryMembershipStore();
    await expect(store.grant({ workspaceId: 'ws', issuer: TEST_ISSUER, subject: 's', baseRole: 'owner' as never })).rejects.toThrow(/base role/);
    await expect(store.grant({ workspaceId: 'demo:x', issuer: TEST_ISSUER, subject: 's', baseRole: 'viewer' })).rejects.toThrow();
    await expect(store.grant({ workspaceId: 'ws', issuer: '', subject: 's', baseRole: 'viewer' })).rejects.toThrow();
    await expect(store.grant({ workspaceId: 'ws', issuer: TEST_ISSUER, subject: '', baseRole: 'viewer' })).rejects.toThrow();
    expect(await store.revoke({ workspaceId: 'ws', issuer: TEST_ISSUER, subject: 'missing' })).toBe(false);
  });
});
