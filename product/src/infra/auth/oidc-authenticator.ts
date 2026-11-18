import type { AccessTokenVerifier, AuthContext, MembershipReader, TokenRejectionReason } from '../../ports/auth';

/**
 * Turns a verified access token into an AuthContext using SERVER-SIDE membership only.
 *
 * - Identity = `(iss, sub)` from a verified token. Workspace and role come from the active
 *   membership row; never from client headers/body or unverified/unmapped token claims.
 * - A client may REQUEST a workspace via `x-workspace-id`; it is honored only when an active
 *   membership exists for that exact workspace, otherwise the request is forbidden (403).
 *   Selecting among existing memberships is not a PM-1 decision: it grants nothing new.
 * - Membership is read on every request (no cache), so revocation applies to the next request.
 * // OPEN: PM-1 — capability matrix, membership lifecycle/approval and revocation SLA remain open.
 */
export const WORKSPACE_REQUEST_HEADER = 'x-workspace-id';
/** Existing base roles only (ports/auth AuthRole); unknown stored values are ignored. */
const BASE_ROLES: ReadonlySet<string> = new Set(['admin', 'manager', 'sales', 'viewer']);
const WORKSPACE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
/** AuthContext contract shared with other consumers of AUTH_CONTEXT_RESOLVER. */
const CONTEXT_WORKSPACE_PATTERN = /^[a-zA-Z0-9:_./-]{1,256}$/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type OidcDecision =
  | { readonly kind: 'none' }
  | { readonly kind: 'authenticated'; readonly context: AuthContext }
  | { readonly kind: 'unauthenticated'; readonly reason: TokenRejectionReason | 'malformed_authorization' | 'no_membership' | 'workspace_selection_required' }
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
    if (subject.length === 0 || subject.length > 256 || CONTROL_CHARS.test(subject)) {
      return { kind: 'unauthenticated', reason: 'missing_claim' };
    }
    const requested = single(headers[WORKSPACE_REQUEST_HEADER]);
    if (requested === null || (requested !== undefined && !WORKSPACE_ID_PATTERN.test(requested))) {
      return { kind: 'invalid_request', reason: 'workspace_header_invalid' };
    }
    const active = (await this.memberships.listActive(issuer, subject))
      .filter((m) => m.status === 'active' && m.revokedAt === null && m.issuer === issuer && m.subject === subject &&
        BASE_ROLES.has(m.baseRole) && CONTEXT_WORKSPACE_PATTERN.test(m.workspaceId) && !m.workspaceId.startsWith('demo:'));
    if (requested !== undefined) {
      const match = active.find((m) => m.workspaceId === requested);
      if (!match) return { kind: 'forbidden', reason: 'workspace_not_member' };
      return { kind: 'authenticated', context: toContext(match.workspaceId, subject, match.baseRole) };
    }
    if (active.length === 0) return { kind: 'unauthenticated', reason: 'no_membership' };
    if (active.length > 1) return { kind: 'unauthenticated', reason: 'workspace_selection_required' };
    return { kind: 'authenticated', context: toContext(active[0].workspaceId, subject, active[0].baseRole) };
  }
}

function toContext(workspaceId: string, subject: string, role: AuthContext['role']): AuthContext {
  // userId = OIDC `sub` of the single configured issuer. Multi-issuer principal linking is
  // deliberately not implemented (would touch ID-1/PM-1 identity semantics).
  return Object.freeze({ workspaceId, userId: subject, role, isDemo: false });
}
