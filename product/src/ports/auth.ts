export type AuthRole = 'admin' | 'manager' | 'sales' | 'viewer';

export interface AuthContext {
  workspaceId: string;
  userId: string;
  role: AuthRole;
  isDemo: boolean;
}

export interface AuthRequestLike {
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

export interface AuthContextResolver {
  resolve(request: AuthRequestLike): AuthContext | null;
}

export const AUTH_CONTEXT_RESOLVER = Symbol('AUTH_CONTEXT_RESOLVER');

// ---------------------------------------------------------------------------
// OIDC + server-side membership seam (AUTH_MODE=oidc, default OFF).
// ADR-006 — principal = internal platform user id (UUID) mapped from external identities;
// workspace + base role come only from server-side membership rows. Base roles are the EXISTING
// four; no role, claim or IdP group ever grants commercial authority.
// ---------------------------------------------------------------------------

export type AuthMode = 'legacy' | 'oidc';

/** Identity proven by a verified access token: nothing else from the token is trusted. */
export interface VerifiedPrincipal {
  readonly issuer: string;
  readonly subject: string;
}

export type TokenRejectionReason =
  | 'malformed'
  | 'too_large'
  | 'alg_not_allowed'
  | 'missing_kid'
  | 'token_type'
  | 'unknown_key'
  | 'signature'
  | 'expired'
  | 'not_yet_valid'
  | 'issuer'
  | 'audience'
  | 'missing_claim'
  | 'lifetime'
  | 'jwks_unavailable';

export type TokenVerification =
  | { readonly ok: true; readonly principal: VerifiedPrincipal }
  | { readonly ok: false; readonly reason: TokenRejectionReason };

export interface AccessTokenVerifier {
  verify(token: string): Promise<TokenVerification>;
}

export type MembershipStatus = 'active' | 'revoked';

/** An external IdP identity linked to an internal platform user (ADR-006 R2-P-07). */
export interface ExternalIdentityRef {
  readonly issuer: string;
  readonly subject: string;
}

export interface WorkspaceMembership {
  readonly id: string;
  readonly workspaceId: string;
  /** Internal platform user id (UUID) — the only principal id used for ownership and audit. */
  readonly userId: string;
  /** One of the existing base roles; membership storage never introduces new roles. */
  readonly baseRole: AuthRole;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

export interface WorkspaceMemberListing extends WorkspaceMembership {
  readonly identities: readonly ExternalIdentityRef[];
}

/** Read side used on every request; no caching so revocation applies to the next request. */
export interface MembershipReader {
  /**
   * (iss, sub) → internal user id of an ACTIVE platform user, or null (unknown identity or
   * disabled user). Never provisions: identities are created only by an admin grant.
   */
  resolveUserId(issuer: string, subject: string): Promise<string | null>;
  listActive(userId: string): Promise<WorkspaceMembership[]>;
}

/**
 * Who performed a membership change. ADR-006: through the app this is the acting admin's
 * internal user id; `null` = operator/seed path (audited as the database role).
 */
export type MembershipActor = { readonly userId: string } | null;

export interface MembershipGrantInput {
  readonly workspaceId: string;
  readonly issuer: string;
  readonly subject: string;
  readonly baseRole: AuthRole;
}

/**
 * ADR-006 membership lifecycle: revoke is terminal, re-grant = new row, role change = revoke +
 * grant in one transaction, nothing is deleted, every change is audited with its actor.
 */
export interface MembershipAdministration {
  /**
   * Safe provisioning path: links (issuer, subject) to a platform user — creating the user and
   * the link when the identity is unknown — then inserts a NEW active membership.
   * Fails with MembershipError MEMBERSHIP_EXISTS (409) while an active row exists, USER_DISABLED (409).
   */
  grant(input: MembershipGrantInput, actor?: MembershipActor): Promise<WorkspaceMembership>;
  /** Operator/test seam: revoke the active membership of (issuer, subject) in the workspace. */
  revoke(input: { workspaceId: string; issuer: string; subject: string }, actor?: MembershipActor): Promise<boolean>;
  get(workspaceId: string, membershipId: string): Promise<WorkspaceMembership | null>;
  /** Revokes an ACTIVE membership of this workspace; null when unknown, foreign or already revoked. */
  revokeById(input: { workspaceId: string; membershipId: string }, actor?: MembershipActor): Promise<WorkspaceMembership | null>;
  /** Revoke + grant (new row, new role) atomically; null when unknown, foreign or not active. */
  changeRole(
    input: { workspaceId: string; membershipId: string; baseRole: AuthRole },
    actor?: MembershipActor,
  ): Promise<{ revoked: WorkspaceMembership; granted: WorkspaceMembership } | null>;
  /** All membership rows (active and revoked history) of one workspace, newest first, bounded. */
  list(workspaceId: string, options?: { status?: MembershipStatus; limit?: number }): Promise<WorkspaceMemberListing[]>;
}

export type MembershipStore = MembershipReader & MembershipAdministration;

export type MembershipErrorCode = 'MEMBERSHIP_EXISTS' | 'USER_DISABLED' | 'CONFLICT' | 'INPUT_INVALID';

export class MembershipError extends Error {
  constructor(readonly code: MembershipErrorCode, readonly status: number) {
    super(code);
    this.name = 'MembershipError';
  }
}

/**
 * Synchronous lookup of a context that was established asynchronously (signature + membership)
 * earlier in the same request. Bound to a server-owned per-request brand, never to client values.
 */
export interface VerifiedContextLookup {
  lookup(headers: object): AuthContext | null;
}

export const MEMBERSHIP_STORE = Symbol('MEMBERSHIP_STORE');
export const VERIFIED_CONTEXT_LOOKUP = Symbol('VERIFIED_CONTEXT_LOOKUP');

/**
 * ADR-006 admin membership API configuration. `null` = API disabled (legacy AUTH_MODE: there is no
 * internal principal to attribute changes to). `issuers` = identity issuers an admin may pre-grant
 * (the configured OIDC issuer), so grants can never target an issuer whose tokens are not accepted.
 */
export interface MembershipAdminConfig {
  readonly issuers: readonly string[];
}

export const MEMBERSHIP_ADMIN_CONFIG = Symbol('MEMBERSHIP_ADMIN_CONFIG');
