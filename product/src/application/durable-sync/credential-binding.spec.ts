import{describe,it,expect}from'vitest';import{randomBytes}from'node:crypto';
import{bindSyncCredential}from'./credential-binding';import{TestOnlyProviderCredentialStore}from'../provider-credentials/test-only-credential-store';
describe('current worker credential binding',()=>{
 const ctx={workspaceId:'binding-workspace',userId:'operator',role:'admin' as const,isDemo:false};
 const identity={workspaceId:ctx.workspaceId,connectionId:'connection',provider:'pancake' as const,accountId:'account',scopes:['messages.read']};
 it('authorizes only the exact current server-bound account and refuses each substituted field',async()=>{
  const store=new TestOnlyProviderCredentialStore('test',true),meta=await store.configure(ctx,identity,randomBytes(48).toString('base64')),principal=await store.issuePrincipal(ctx,meta.credentialId),authorize=bindSyncCredential(store,principal);
  await expect(authorize(identity)).resolves.toBeUndefined();
  for(const change of[{workspaceId:'foreign'},{connectionId:'foreign'},{provider:'meta-page' as const},{accountId:'foreign'}])await expect(authorize({...identity,...change})).rejects.toMatchObject({code:'CREDENTIAL_REVOKED',status:403});
  await store.rotate(ctx,meta.credentialId,randomBytes(48).toString('base64'),1);await expect(authorize(identity)).rejects.toMatchObject({code:'CREDENTIAL_REVOKED'});
 });
 it('refuses profile-only scope, forged principal and credential revocation',async()=>{
  const store=new TestOnlyProviderCredentialStore('test',true),meta=await store.configure(ctx,{...identity,scopes:['profile.read']},randomBytes(48).toString('base64')),principal=await store.issuePrincipal(ctx,meta.credentialId);
  await expect(bindSyncCredential(store,principal)(identity)).rejects.toMatchObject({code:'CREDENTIAL_REVOKED'});
  await expect(bindSyncCredential(store,{...principal})(identity)).rejects.toMatchObject({code:'CREDENTIAL_REVOKED'});
  await store.revoke(ctx,meta.credentialId);await expect(bindSyncCredential(store,principal)(identity)).rejects.toMatchObject({code:'CREDENTIAL_REVOKED'});
 });
});
