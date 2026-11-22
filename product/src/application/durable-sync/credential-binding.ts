import type {ProviderCredentialStore,ProviderServicePrincipal} from '../../ports/provider-credentials';
import type {SyncCommitAuthorization} from '../../ports/durable-sync';
import {SourceIntegrationError} from '../../ports/source-observation';
/** Server-supplied principal only. Fixture scope strings are not provider entitlements.
 * This callback performs no provider request or nested PostgreSQL pool acquisition. */
export function bindSyncCredential(credentials:ProviderCredentialStore,principal:ProviderServicePrincipal):SyncCommitAuthorization{
 return async binding=>{
  try{
   const c=await credentials.resolve(principal);
   if(c.workspaceId!==binding.workspaceId||c.connectionId!==binding.connectionId||c.provider!==binding.provider||c.accountId!==binding.accountId||!c.scopes.includes('messages.read'))throw new Error('scope');
  }catch{throw new SourceIntegrationError('CREDENTIAL_REVOKED',403);}
 };
}
