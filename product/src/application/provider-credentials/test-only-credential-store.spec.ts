import { describe, expect, it, vi, afterEach } from 'vitest';
import { TestOnlyProviderCredentialStore } from './test-only-credential-store';
import type { AuthContext } from '../../ports/auth';
import { ProviderCredentialError } from '../../ports/provider-credentials';

const admin: AuthContext = { workspaceId: 'ws-r412', userId: 'owner', role: 'admin', isDemo: false };
const manager: AuthContext = { ...admin, userId: 'manager', role: 'manager' };
const identity = { workspaceId: 'ws-r412', connectionId: 'conn-r412', provider: 'pancake' as const, accountId: 'page-r412', scopes: ['messages.read'] };
const secret = 'fabricated-provider-secret-012345678901234567890';

describe('R4.12 test-only provider credential boundary', () => {
  afterEach(()=>vi.unstubAllEnvs());
  it('fails closed outside local/test or when disabled', () => {
    expect(() => new TestOnlyProviderCredentialStore('production', true)).toThrowError(new ProviderCredentialError('CREDENTIALS_TEST_ONLY', 503));
    expect(() => new TestOnlyProviderCredentialStore('test', false)).toThrowError(new ProviderCredentialError('CREDENTIALS_DISABLED', 404));
    vi.stubEnv('NODE_ENV','production');expect(()=>new TestOnlyProviderCredentialStore('local',true)).toThrowError(new ProviderCredentialError('CREDENTIALS_TEST_ONLY',503));
  });
  it('allows admin configuration but returns metadata without secret', async () => {
    const store = new TestOnlyProviderCredentialStore('test', true);
    const configured = await store.configure(admin, identity, secret);
    expect(configured).toMatchObject({ mode: 'TEST_ONLY', state: 'CONFIGURED', version: 1, scopes: ['messages.read'] });
    expect(JSON.stringify(configured)).not.toContain(secret);
    expect((await store.inspect(admin, configured.credentialId))).not.toHaveProperty('secret');
    await expect(store.configure(manager, identity, secret)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(store.configure({ ...admin, role: 'sales' }, identity, secret)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(store.configure({ ...admin, isDemo: true }, identity, secret)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('binds service principal to workspace/provider/account and keeps human authority separate', async () => {
    const store = new TestOnlyProviderCredentialStore('test', true); const metadata = await store.configure(admin, identity, secret);
    const principal = await store.issuePrincipal(admin, metadata.credentialId);
    expect((await store.resolve(principal)).secret).toBe(secret);
    expect(JSON.stringify(await store.resolve(principal))).not.toContain(secret);
    for (const change of [{ workspaceId: 'ws-other' }, { provider: 'meta-page' as const }, { accountId: 'other-page' }]) await expect(store.resolve({ ...principal, ...change })).rejects.toMatchObject({ code: 'CREDENTIAL_UNAVAILABLE' });
    await expect(store.resolve({ ...principal, capability: 'write' as never })).rejects.toMatchObject({ code: 'CREDENTIAL_UNAVAILABLE' });
  });
  it('rotates with optimistic version and revocation blocks subsequent resolution', async () => {
    const store = new TestOnlyProviderCredentialStore('test', true); const before = await store.configure(admin, identity, secret); const principal = await store.issuePrincipal(admin, before.credentialId);
    const nextSecret = `${secret}-rotated`; const rotated = await store.rotate(admin, before.credentialId, nextSecret, 1);
    expect(rotated.version).toBe(2); expect(JSON.stringify(rotated)).not.toContain(nextSecret);
    await expect(store.resolve(principal)).rejects.toMatchObject({ code: 'CREDENTIAL_VERSION_CONFLICT' });
    await expect(store.rotate(admin, before.credentialId, secret, 1)).rejects.toMatchObject({ code: 'CREDENTIAL_VERSION_CONFLICT' });
    const fresh = await store.issuePrincipal(admin, rotated.credentialId); await store.revoke(admin, before.credentialId); await expect(store.resolve(fresh)).rejects.toMatchObject({ code: 'CREDENTIAL_REVOKED' });
    expect(store.audit(admin,before.credentialId).map(e=>e.action)).toEqual(['configured','rotated','revoked']);expect(JSON.stringify(store.audit(admin,before.credentialId))).not.toContain(secret);
  });
  it('rejects malformed/short/expired credentials without echoing secrets', async () => {
    const store = new TestOnlyProviderCredentialStore('test', true);
    for (const bad of ['', 'short\nsecret', 'x'.repeat(4097)]) await expect(store.configure(admin, identity, bad)).rejects.toMatchObject({ code: 'INPUT_INVALID' });
    const expiredMetadata = await store.configure(admin, { ...identity, connectionId: 'conn-r412-expired', expiresAt: '2020-01-01T00:00:00Z' }, secret);
    const expired = await store.issuePrincipal(admin, expiredMetadata.credentialId);
    await expect(store.resolve(expired)).rejects.toMatchObject({ code: 'CREDENTIAL_EXPIRED' });
    const configured = await store.configure(admin, { ...identity, connectionId: 'conn-r412-next' }, secret);
    expect(JSON.stringify(configured)).not.toContain(secret);
    await store.revoke(admin, configured.credentialId);
    await expect(store.configure(admin, { ...identity, connectionId: 'conn-r412-next' }, secret)).rejects.toMatchObject({ code: 'CREDENTIAL_REVOKED' });
  });
  it('keeps identical connection IDs separate by workspace and refuses supplied foreign workspace',async()=>{
    const store=new TestOnlyProviderCredentialStore('test',true),a=await store.configure(admin,identity,secret);
    const other={...admin,workspaceId:'ws-other'};
    const b=await store.configure(other,{...identity,workspaceId:'ws-other'},secret+'other');
    expect(a.credentialId).not.toBe(b.credentialId);expect((await store.resolve(await store.issuePrincipal(admin,a.credentialId))).secret).toBe(secret);
    await expect(store.issuePrincipal(other,a.credentialId)).rejects.toMatchObject({code:'CREDENTIAL_NOT_FOUND'});
    await expect(store.configure(admin,{...identity,workspaceId:'forged'},secret)).rejects.toMatchObject({code:'CREDENTIAL_SCOPE_MISMATCH'});
  });
  it('rechecks actual environment after construction and rejects impossible expiry dates',async()=>{
    const store=new TestOnlyProviderCredentialStore('test',true),metadata=await store.configure(admin,identity,secret),principal=await store.issuePrincipal(admin,metadata.credentialId);
    await expect(store.configure(admin,{...identity,expiresAt:'2026-02-30T00:00:00Z'},secret)).rejects.toMatchObject({code:'INPUT_INVALID'});
    vi.stubEnv('APP_MODE','pilot');await expect(store.resolve(principal)).rejects.toMatchObject({code:'CREDENTIALS_TEST_ONLY'});
  });
});
