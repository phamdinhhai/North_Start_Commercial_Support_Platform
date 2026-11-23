import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { TestOnlyProviderCredentialStore } from './test-only-credential-store';

const admin = { workspaceId: 'qa-workspace', userId: 'qa-owner', role: 'admin' as const, isDemo: false };
const identity = { workspaceId: admin.workspaceId, connectionId: 'qa-connection', provider: 'meta-page' as const, accountId: 'qa-page', scopes: ['messages.read'] };
describe('independent test-only credential custody review', () => {
  it('does not let returned metadata or scope mutation change stored authority', async () => {
    const store = new TestOnlyProviderCredentialStore('test', true), secret = randomBytes(32).toString('hex');
    const metadata = await store.configure(admin, identity, secret);
    (metadata as unknown as { state: string; scopes: string[] }).state = 'AUTHORIZED_SANDBOX';
    (metadata.scopes as string[]).push('messages.write');
    const inspected = await store.inspect(admin, metadata.credentialId);
    expect(inspected.state).toBe('CONFIGURED'); expect(inspected.scopes).toEqual(['messages.read']);
    const principal = await store.issuePrincipal(admin, metadata.credentialId), resolved = await store.resolve(principal);
    expect(Object.isFrozen(principal)).toBe(true); expect(Object.isFrozen(resolved)).toBe(true);
    expect(JSON.stringify({ metadata: inspected, principal, resolved, audit: store.audit(admin, metadata.credentialId) })).not.toContain(secret);
    expect({ ...resolved }).not.toHaveProperty('secret'); expect(resolved.secret).toBe(secret);
  });
  it('keeps equal connection selectors isolated and never revives revoked custody', async () => {
    const store = new TestOnlyProviderCredentialStore('test', true), secret = randomBytes(32).toString('hex');
    const own = await store.configure(admin, identity, secret), other = { ...admin, workspaceId: 'qa-foreign' };
    const foreign = await store.configure(other, { ...identity, workspaceId: other.workspaceId }, randomBytes(32).toString('hex'));
    const ownPrincipal = await store.issuePrincipal(admin, own.credentialId);
    await store.revoke(other, foreign.credentialId); expect((await store.resolve(ownPrincipal)).secret).toBe(secret);
    await expect(store.inspect(other, own.credentialId)).rejects.toMatchObject({ code: 'CREDENTIAL_NOT_FOUND' });
    await expect(store.configure(other, { ...identity, workspaceId: other.workspaceId }, secret)).rejects.toMatchObject({ code: 'CREDENTIAL_REVOKED' });
    await store.revoke(admin, own.credentialId);
    await expect(store.resolve(ownPrincipal)).rejects.toMatchObject({ code: 'CREDENTIAL_REVOKED' });
    expect(store.audit(admin, own.credentialId).map(entry => entry.action)).toEqual(['configured', 'revoked']);
  });
});
