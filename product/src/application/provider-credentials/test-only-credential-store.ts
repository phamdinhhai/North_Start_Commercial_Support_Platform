import { randomUUID } from 'node:crypto';
import type { AuthContext } from '../../ports/auth';
import type { ProviderConnectionIdentity, ProviderCredentialMetadata, ProviderCredentialStore, ProviderServicePrincipal, ResolvedProviderCredential } from '../../ports/provider-credentials';
import { ProviderCredentialError } from '../../ports/provider-credentials';

type Entry = ProviderCredentialMetadata & { secret: string };
const ID = /^[A-Za-z0-9:_./-]{1,256}$/;
const SCOPE = /^[A-Za-z0-9._:/-]{1,128}$/;
const secretOk = (value: unknown): value is string => typeof value === 'string' && Buffer.byteLength(value, 'utf8') >= 32 && Buffer.byteLength(value, 'utf8') <= 4096 && !/[\u0000-\u001f\u007f]/u.test(value);
const idOk = (value: unknown): value is string => typeof value === 'string' && ID.test(value);

/**
 * Explicitly test-only credential custody. It keeps fabricated secrets in memory and is
 * impossible to construct in pilot/production. No token is persisted, logged, or returned by
 * metadata methods. A real deployment must supply a separately reviewed vault implementation.
 */
export class TestOnlyProviderCredentialStore implements ProviderCredentialStore {
  private readonly entries = new Map<string, Entry>();
  private readonly principals = new WeakSet<object>();
  private readonly principalVersions = new WeakMap<object, number>();
  private readonly mode = 'TEST_ONLY' as const;
  private readonly auditEntries: { action: 'configured'|'rotated'|'revoked'; credentialId: string; workspaceId: string; version: number; actorId: string; at: string }[] = [];
  constructor(private readonly deploymentMode: string, enabled: boolean) {
    if (enabled !== true) throw new ProviderCredentialError('CREDENTIALS_DISABLED', 404);
    this.guard();
  }

  async configure(ctx: AuthContext, input: ProviderConnectionIdentity & { readonly expiresAt?: string | null }, secret: string): Promise<ProviderCredentialMetadata> {
    this.admin(ctx); this.identity(input); this.expiry(input.expiresAt); if (!secretOk(secret)) this.invalid();
    if(input.workspaceId!==ctx.workspaceId)throw new ProviderCredentialError('CREDENTIAL_SCOPE_MISMATCH',403);
    const key = this.key(ctx.workspaceId, input.connectionId);
    const existing = this.entries.get(key);
    if (existing?.state === 'REVOKED' || existing?.state === 'DISABLED') throw new ProviderCredentialError('CREDENTIAL_REVOKED', 403);
    if(existing&&(existing.provider!==input.provider||existing.accountId!==input.accountId))throw new ProviderCredentialError('CREDENTIAL_SCOPE_MISMATCH',403);
    const now = new Date().toISOString();
    const metadata: ProviderCredentialMetadata = {
      workspaceId: ctx.workspaceId, connectionId: input.connectionId, provider: input.provider, accountId: input.accountId,
      scopes: [...input.scopes], credentialId: existing?.credentialId ?? randomUUID(), mode: this.mode,
      state: 'CONFIGURED', version: existing ? existing.version + 1 : 1, expiresAt: input.expiresAt ?? null,
      rotatedAt: now, revokedAt: null,
    };
    this.record('configured',ctx,metadata);this.entries.set(key, { ...metadata, secret }); return this.public({...metadata,secret});
  }

  async issuePrincipal(ctx: AuthContext, credentialId: string): Promise<ProviderServicePrincipal> {
    this.admin(ctx); if (!idOk(credentialId)) this.invalid();
    const entry = [...this.entries.values()].find(item => item.credentialId === credentialId && item.workspaceId === ctx.workspaceId);
    if (!entry) throw new ProviderCredentialError('CREDENTIAL_NOT_FOUND', 404);
    if (entry.state === 'REVOKED' || entry.state === 'DISABLED') throw new ProviderCredentialError('CREDENTIAL_REVOKED', 403);
    const principal: ProviderServicePrincipal = Object.freeze({ kind: 'provider_service', workspaceId: entry.workspaceId, connectionId: entry.connectionId, provider: entry.provider, accountId: entry.accountId, capability: 'read', credentialVersion: entry.version });
    this.principals.add(principal); this.principalVersions.set(principal, entry.version); return principal;
  }

  async resolve(principal: ProviderServicePrincipal): Promise<ResolvedProviderCredential> {
    this.guard();
    if (!principal || !this.principals.has(principal as object) || principal.kind !== 'provider_service' || principal.capability !== 'read') throw new ProviderCredentialError('CREDENTIAL_UNAVAILABLE', 401);
    const entry = this.entries.get(this.key(principal.workspaceId, principal.connectionId));
    if (!entry) throw new ProviderCredentialError('CREDENTIAL_NOT_FOUND', 404);
    if (entry.workspaceId !== principal.workspaceId || entry.provider !== principal.provider || entry.accountId !== principal.accountId) throw new ProviderCredentialError('CREDENTIAL_SCOPE_MISMATCH', 403);
    if (this.principalVersions.get(principal) !== entry.version || principal.credentialVersion !== entry.version) throw new ProviderCredentialError('CREDENTIAL_VERSION_CONFLICT', 409);
    if (entry.state === 'REVOKED' || entry.state === 'DISABLED') throw new ProviderCredentialError('CREDENTIAL_REVOKED', 403);
    if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) throw new ProviderCredentialError('CREDENTIAL_EXPIRED', 403);
    const resolved = { workspaceId: entry.workspaceId, connectionId: entry.connectionId, provider: entry.provider, accountId: entry.accountId, scopes: [...entry.scopes], credentialId: entry.credentialId, version: entry.version, expiresAt: entry.expiresAt };
    // Explicit property access by a trusted transport is required; JSON/spread never includes it.
    return Object.freeze(Object.defineProperty(resolved,'secret',{value:entry.secret,enumerable:false})) as unknown as ResolvedProviderCredential;
  }

  async rotate(ctx: AuthContext, credentialId: string, secret: string, expectedVersion: number): Promise<ProviderCredentialMetadata> {
    this.admin(ctx); if (!idOk(credentialId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !secretOk(secret)) this.invalid();
    const current = [...this.entries.values()].find(entry => entry.credentialId === credentialId && entry.workspaceId === ctx.workspaceId); if (!current) throw new ProviderCredentialError('CREDENTIAL_NOT_FOUND', 404);
    if (current.state === 'REVOKED' || current.state === 'DISABLED') throw new ProviderCredentialError('CREDENTIAL_REVOKED', 403);
    if (current.version !== expectedVersion) throw new ProviderCredentialError('CREDENTIAL_VERSION_CONFLICT', 409);
    const metadata = { ...this.public(current), version: current.version + 1, rotatedAt: new Date().toISOString(), state: 'CONFIGURED' as const, revokedAt: null };
    this.record('rotated',ctx,metadata);this.entries.set(this.key(current.workspaceId, current.connectionId), { ...metadata, secret }); return this.public({...metadata,secret});
  }

  async revoke(ctx: AuthContext, credentialId: string): Promise<ProviderCredentialMetadata> {
    this.admin(ctx); if (!idOk(credentialId)) this.invalid();
    const current = [...this.entries.values()].find(entry => entry.credentialId === credentialId && entry.workspaceId === ctx.workspaceId); if (!current) throw new ProviderCredentialError('CREDENTIAL_NOT_FOUND', 404);
    const metadata = { ...this.public(current), state: 'REVOKED' as const, revokedAt: new Date().toISOString() };
    this.record('revoked',ctx,metadata);this.entries.set(this.key(current.workspaceId, current.connectionId), { ...metadata, secret: current.secret }); return this.public({...metadata,secret:current.secret});
  }

  async inspect(ctx: AuthContext, credentialId: string): Promise<ProviderCredentialMetadata> {
    this.admin(ctx); if (!idOk(credentialId)) this.invalid();
    const current = [...this.entries.values()].find(entry => entry.credentialId === credentialId && entry.workspaceId === ctx.workspaceId); if (!current) throw new ProviderCredentialError('CREDENTIAL_NOT_FOUND', 404);
    return this.public(current);
  }

  private public(entry: Entry): ProviderCredentialMetadata { const { secret: _secret, ...metadata } = entry; return { ...metadata, scopes: [...metadata.scopes] }; }
  audit(ctx:AuthContext,credentialId:string){this.admin(ctx);return this.auditEntries.filter(e=>e.workspaceId===ctx.workspaceId&&e.credentialId===credentialId).map(e=>({...e}));}
  private record(action:'configured'|'rotated'|'revoked',ctx:AuthContext,metadata:ProviderCredentialMetadata){
    if(this.auditEntries.length>=1000)throw new ProviderCredentialError('CREDENTIAL_UNAVAILABLE',503);
    this.auditEntries.push(Object.freeze({action,credentialId:metadata.credentialId,workspaceId:ctx.workspaceId,version:metadata.version,actorId:ctx.userId,at:new Date().toISOString()}));
  }
  private guard(){if(!['local','test'].includes(this.deploymentMode)||['DEPLOYMENT_MODE','APP_MODE','NODE_ENV'].some(key=>['production','prod','pilot'].includes((process.env[key]??'').trim().toLowerCase())))throw new ProviderCredentialError('CREDENTIALS_TEST_ONLY',503);}
  private admin(ctx: AuthContext): void { this.guard();if (!ctx?.userId || !ctx.workspaceId || ctx.isDemo || ctx.role !== 'admin') throw new ProviderCredentialError('FORBIDDEN', 403); }
  private key(workspaceId: string, connectionId: string): string { return `${workspaceId}\u0000${connectionId}`; }
  private identity(input: ProviderConnectionIdentity): void {
    if (!input || !idOk(input.workspaceId) || !idOk(input.connectionId) || !idOk(input.accountId) || !['pancake', 'meta-page'].includes(input.provider) || !Array.isArray(input.scopes) || !input.scopes.length || input.scopes.length > 32 || input.scopes.some(scope => typeof scope !== 'string' || !SCOPE.test(scope))) this.invalid();
  }
  private expiry(value: string | null | undefined): void { if (value !== null && value !== undefined && (!/^(?:19|20|21)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,19)!==value.slice(0,19))) this.invalid(); }
  private invalid(): never { throw new ProviderCredentialError('INPUT_INVALID', 400); }
}
