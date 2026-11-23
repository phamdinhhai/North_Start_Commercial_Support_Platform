import type { AccessTokenVerifier, AuthContext, MembershipReader, TokenRejectionReason } from '../../ports/auth';

/**
 * Turns a verified access token into an AuthContext using SERVER-SIDE principals + membership only.
 *
 * - ADR-006 (R2-P-07): identity = verified `(iss, sub)`, resolved through `external_identity` to an
 *   INTERNAL platform user id (UUID) which becomes `AuthContext.userId`. An unknown identity (or a
 *   disabled user) is unauthenticated — logins never provision; an admin pre-grant creates the
 *   user + identity link (see MembershipAdministration.grant).
 * - Workspace and role come from the active membership row; never from client headers/body or
 *   token claims (role/workspace/groups claims are ignored).
 * - A client may REQUEST a workspace via `x-workspace-id`; it is honored only when an active
 *   membership exists for that exact workspace, otherwise the request is forbidden (403).
 * - Principal + membership are read on every request (no cache), so revocation applies to the next
 *   request (ADR-006: revocation effective on the next request).
 */
export const WORKSPACE_REQUEST_HEADER = 'x-workspace-id';
/** Existing base roles only (ports/auth AuthRole); unknown stored values are ignored. */
const BASE_ROLES: ReadonlySet<string> = new Set(['admin', 'manager', 'sales', 'viewer']);
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** AuthContext contract shared with other consumers of AUTH_CONTEXT_RESOLVER. */
const CONTEXT_WORKSPACE_PATTERN = /^[a-zA-Z0-9:_./-]{1,256}$/;
/** Internal platform user ids are UUIDs (migration 010 `platform_user.id`). */
const INTERNAL_USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type OidcDecision =
  | { readonly kind: 'none' }
  | { readonly kind: 'authenticated'; readonly context: AuthContext }
  | { readonly kind: 'unauthenticated'; readonly reason: TokenRejectionReason | 'malformed_authorization' | 'unknown_identity' | 'no_membership' | 'workspace_selection_required' }
  | { readonly kind: 'forbidden'; readonly reason: 'workspace_not_member' }
  | { readonly kind: 'invalid_request'; readonly reason: 'workspace_header_invalid' };

type HeaderValue = string | string[] | undefined;

function single(value: HeaderValue): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : null; // repeated header → ambiguous → null
}

export class OidcAuthenticator {
  constructor(private readonly verifier: AccessTokenVerifier, private readonly memberships: MembershipReader) {}

  async authenticate(headers: Record<string, HeaderValue>): Promise<OidcDecision> {
    const authorization = single(headers['authorization']);
    if (authorization === undefined) return { kind: 'none' };
    if (authorization === null || !/^Bearer [^\s]+$/.test(authorization)) {
      return { kind: 'unauthenticated', reason: 'malformed_authorization' };
    }
    // Verify first: a bearer that is not a valid OIDC access token (e.g. an AIL enrollment token
    // on /integration/observations) only ever yields "unauthenticated", which the request hook
    // never answers itself — the owning controller keeps full control of that request.
    const verification = await this.verifier.verify(authorization.slice('Bearer '.length));
    if (!verification.ok) return { kind: 'unauthenticated', reason: verification.reason };
    const { issuer, subject } = verification.principal;
    const requested = single(headers[WORKSPACE_REQUEST_HEADER]);
    if (requested === null || (requested !== undefined && !WORKSPACE_ID_PATTERN.test(requested))) {
      return { kind: 'invalid_request', reason: 'workspace_header_invalid' };
    }
    const userId = await this.memberships.resolveUserId(issuer, subject);
    if (userId === null || !INTERNAL_USER_ID.test(userId)) return { kind: 'unauthenticated', reason: 'unknown_identity' };
    const active = (await this.memberships.listActive(userId))
      .filter((m) => m.status === 'active' && m.revokedAt === null && m.userId === userId &&
        BASE_ROLES.has(m.baseRole) && CONTEXT_WORKSPACE_PATTERN.test(m.workspaceId) && !m.workspaceId.startsWith('demo:'));
    if (requested !== undefined) {
      const match = active.find((m) => m.workspaceId === requested);
      if (!match) return { kind: 'forbidden', reason: 'workspace_not_member' };
      return { kind: 'authenticated', context: toContext(match.workspaceId, userId, match.baseRole) };
    }
    if (active.length === 0) return { kind: 'unauthenticated', reason: 'no_membership' };
    if (active.length > 1) return { kind: 'unauthenticated', reason: 'workspace_selection_required' };
    return { kind: 'authenticated', context: toContext(active[0].workspaceId, userId, active[0].baseRole) };
  }
}

function toContext(workspaceId: string, userId: string, role: AuthContext['role']): AuthContext {
  // ADR-006: userId = internal platform user id; lead ownership and audit reference it, so adding
  // or changing an IdP (a new external_identity link) never moves ownership.
  return Object.freeze({ workspaceId, userId, role, isDemo: false });
}
