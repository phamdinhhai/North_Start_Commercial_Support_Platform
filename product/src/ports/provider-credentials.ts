import type { AuthContext } from './auth';

/** Provider connection lifecycle; these states never imply live authorization by themselves. */
export type CredentialState = 'CONFIGURED' | 'AUTHORIZATION_PENDING' | 'AUTHORIZED_SANDBOX' | 'REVOKED' | 'DISABLED';
export type CredentialMode = 'TEST_ONLY' | 'VAULT_REFERENCE';

export interface ProviderConnectionIdentity {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly provider: 'pancake' | 'meta-page';
  readonly accountId: string;
  readonly scopes: readonly string[];
}

export interface ProviderCredentialMetadata extends ProviderConnectionIdentity {
  readonly credentialId: string;
  readonly mode: CredentialMode;
  readonly state: CredentialState;
  readonly version: number;
  readonly expiresAt: string | null;
  readonly rotatedAt: string;
  readonly revokedAt: string | null;
  /** Deliberately no token, secret, or digest is returned. */
}

export interface ProviderServicePrincipal {
  readonly kind: 'provider_service';
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly provider: ProviderConnectionIdentity['provider'];
  readonly accountId: string;
  readonly capability: 'read';
  readonly credentialVersion: number;
}

export interface ResolvedProviderCredential extends ProviderConnectionIdentity {
  readonly credentialId: string;
  readonly version: number;
  readonly secret: string;
  readonly expiresAt: string | null;
}

export interface ProviderCredentialStore {
  configure(ctx: AuthContext, input: ProviderConnectionIdentity & { readonly expiresAt?: string | null }, secret: string): Promise<ProviderCredentialMetadata>;
  /** Issues an opaque server-bound worker identity; callers must not construct payloads themselves. */
  issuePrincipal(ctx: AuthContext, credentialId: string): Promise<ProviderServicePrincipal>;
  resolve(principal: ProviderServicePrincipal): Promise<ResolvedProviderCredential>;
  rotate(ctx: AuthContext, credentialId: string, secret: string, expectedVersion: number): Promise<ProviderCredentialMetadata>;
  revoke(ctx: AuthContext, credentialId: string): Promise<ProviderCredentialMetadata>;
  inspect(ctx: AuthContext, credentialId: string): Promise<ProviderCredentialMetadata>;
}

export class ProviderCredentialError extends Error {
  constructor(readonly code: 'CREDENTIALS_DISABLED' | 'CREDENTIALS_TEST_ONLY' | 'FORBIDDEN' | 'INPUT_INVALID' | 'CREDENTIAL_NOT_FOUND' | 'CREDENTIAL_REVOKED' | 'CREDENTIAL_EXPIRED' | 'CREDENTIAL_VERSION_CONFLICT' | 'CREDENTIAL_SCOPE_MISMATCH' | 'CREDENTIAL_UNAVAILABLE', readonly status: number) {
    super(code);
  }
}
