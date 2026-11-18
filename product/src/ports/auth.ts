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
// Experimental OIDC + server-side membership seam (AUTH_MODE=oidc, default OFF).
// // OPEN: PM-1 — these types carry identity and the EXISTING base roles only. They do not
// define a capability matrix, add roles, or grant mutation authority; who may create or
// revoke memberships is undecided and no HTTP surface for it exists.
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
  | 'jwks_unavailable';

export type TokenVerification =
  | { readonly ok: true; readonly principal: VerifiedPrincipal }
  | { readonly ok: false; readonly reason: TokenRejectionReason };

export interface AccessTokenVerifier {
  verify(token: string): Promise<TokenVerification>;
}

export type MembershipStatus = 'active' | 'revoked';

export interface WorkspaceMembership {
  readonly workspaceId: string;
  readonly issuer: string;
  readonly subject: string;
  /** One of the existing base roles; membership storage never introduces new roles. */
  readonly baseRole: AuthRole;
  readonly status: MembershipStatus;
  readonly createdAt: Date;
  readonly revokedAt: Date | null;
}

/** Read side used on every request; no caching so revocation applies to the next request. */
export interface MembershipReader {
  listActive(issuer: string, subject: string): Promise<WorkspaceMembership[]>;
}

/**
 * Operator/test seeding seam. // OPEN: PM-1 — not exposed over HTTP; the approval workflow,
 * invite lifecycle and who may call this are undecided.
 */
export interface MembershipAdministration {
  grant(input: { workspaceId: string; issuer: string; subject: string; baseRole: AuthRole }): Promise<WorkspaceMembership>;
  revoke(input: { workspaceId: string; issuer: string; subject: string }): Promise<boolean>;
}

export type MembershipStore = MembershipReader & MembershipAdministration;

/**
 * Synchronous lookup of a context that was established asynchronously (signature + membership)
 * earlier in the same request. Keys are server-owned request objects, never client values.
 */
export interface VerifiedContextLookup {
  lookup(headers: object): AuthContext | null;
}

export const MEMBERSHIP_STORE = Symbol('MEMBERSHIP_STORE');
export const VERIFIED_CONTEXT_LOOKUP = Symbol('VERIFIED_CONTEXT_LOOKUP');
