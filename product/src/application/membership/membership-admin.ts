import {
  MembershipError,
  type AuthContext,
  type AuthRole,
  type MembershipAdminConfig,
  type MembershipStatus,
  type MembershipStore,
  type WorkspaceMemberListing,
  type WorkspaceMembership,
} from '../../ports/auth';

/**
 * ADR-006 admin membership API (capability "Membership grant/revoke/đổi role" = admin of the
 * workspace, audited).
 * - Caller = admin of the SERVER-RESOLVED workspace; the workspace never comes from the body.
 * - The acting admin must be an internal principal (UUID): it is written as the audit actor.
 * - Grant is the only provisioning path for a new external identity (user + identity link).
 * - Revoke is terminal; role change = revoke + grant (new row) atomically; nothing is deleted.
 * - An admin cannot revoke or change their own membership (prevents accidental lock-out and
 *   self-escalation paths; another admin must do it). The store additionally refuses revoking or
 *   demoting the workspace's last active admin (LAST_ADMIN, race-safe).
 * - Listings expose only the identity each membership was granted through (tenant isolation).
 */
const BASE_ROLES: readonly AuthRole[] = ['admin', 'manager', 'sales', 'viewer'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WORKSPACE = /^[a-zA-Z0-9:_./-]{1,256}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;
const LIST_STATUSES: readonly MembershipStatus[] = ['active', 'revoked'];

export class MembershipAdminError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'MembershipAdminError';
  }
}

const fail = (code: string, status = 400): never => { throw new MembershipAdminError(code, status); };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isRole = (v: unknown): v is AuthRole => typeof v === 'string' && (BASE_ROLES as readonly string[]).includes(v);
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !CONTROL.test(v);

export interface MembershipView {
  id: string;
  workspaceId: string;
  userId: string;
  baseRole: AuthRole;
  status: MembershipStatus;
  createdAt: string;
  revokedAt: string | null;
}

export interface MembershipListingView extends MembershipView {
  /** Only the identity this workspace's grant used (tenant isolation). */
  identity: { issuer: string; subject: string };
}

function view(m: WorkspaceMembership): MembershipView {
  return {
    id: m.id, workspaceId: m.workspaceId, userId: m.userId, baseRole: m.baseRole, status: m.status,
    createdAt: m.createdAt.toISOString(), revokedAt: m.revokedAt ? m.revokedAt.toISOString() : null,
  };
}

function exactKeys(body: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isObject(body)) return fail('INPUT_INVALID');
  if ('workspaceId' in body) return fail('WORKSPACE_FROM_CONTEXT');
  const present = Object.keys(body).sort();
  if (present.join() !== [...keys].sort().join()) return fail('INPUT_INVALID');
  return body;
}

export class MembershipAdminService {
  constructor(private readonly store: MembershipStore, private readonly config: MembershipAdminConfig | null) {}

  async grant(ctx: AuthContext | null, body: unknown): Promise<MembershipView> {
    const admin = this.admin(ctx);
    const input = exactKeys(body, ['issuer', 'subject', 'baseRole']);
    if (!isText(input.issuer, 2048) || !isText(input.subject, 255) || !isRole(input.baseRole)) return fail('INPUT_INVALID');
    if (!this.config!.issuers.includes(input.issuer)) return fail('ISSUER_NOT_ACCEPTED');
    const granted = await this.guard(() => this.store.grant(
      { workspaceId: admin.workspaceId, issuer: input.issuer as string, subject: input.subject as string, baseRole: input.baseRole as AuthRole },
      { userId: admin.userId },
    ));
    return view(granted);
  }

  async revoke(ctx: AuthContext | null, membershipId: unknown, body?: unknown): Promise<MembershipView> {
    const admin = this.admin(ctx);
    // Authorize first so unauthorized callers learn nothing from validation; the body must be empty.
    if (body !== undefined && body !== null && !(isObject(body) && Object.keys(body).length === 0)) return fail('EMPTY_BODY_REQUIRED');
    await this.target(admin, membershipId);
    const revoked = await this.guard(() => this.store.revokeById({ workspaceId: admin.workspaceId, membershipId: membershipId as string }, { userId: admin.userId }));
    return revoked ? view(revoked) : fail('MEMBERSHIP_NOT_ACTIVE', 409);
  }

  async changeRole(ctx: AuthContext | null, membershipId: unknown, body: unknown): Promise<{ revoked: MembershipView; granted: MembershipView }> {
    const admin = this.admin(ctx);
    const input = exactKeys(body, ['baseRole']);
    if (!isRole(input.baseRole)) return fail('INPUT_INVALID');
    const baseRole = input.baseRole;
    const current = await this.target(admin, membershipId);
    if (current.baseRole === baseRole) return fail('ROLE_UNCHANGED', 409);
    const changed = await this.guard(() => this.store.changeRole({ workspaceId: admin.workspaceId, membershipId: current.id, baseRole }, { userId: admin.userId }));
    return changed ? { revoked: view(changed.revoked), granted: view(changed.granted) } : fail('MEMBERSHIP_NOT_ACTIVE', 409);
  }

  async list(ctx: AuthContext | null, query: unknown): Promise<MembershipListingView[]> {
    const admin = this.admin(ctx);
    const q = isObject(query) ? query : {};
    if (Object.keys(q).some((k) => k !== 'status')) return fail('INPUT_INVALID');
    const status = q.status;
    if (status !== undefined && !(LIST_STATUSES as readonly unknown[]).includes(status)) return fail('INPUT_INVALID');
    const rows: WorkspaceMemberListing[] = await this.guard(() => this.store.list(admin.workspaceId, { status: status as MembershipStatus | undefined }));
    return rows.map((m) => ({ ...view(m), identity: { issuer: m.identity.issuer, subject: m.identity.subject } }));
  }

  /** ADR-006: admin of the server-resolved workspace, real (non-demo) internal principal. */
  private admin(ctx: AuthContext | null): AuthContext {
    if (this.config === null) return fail('MEMBERSHIP_API_DISABLED', 404);
    if (!ctx || typeof ctx.workspaceId !== 'string' || !WORKSPACE.test(ctx.workspaceId) || typeof ctx.userId !== 'string') return fail('UNAUTHORIZED', 401);
    if (ctx.isDemo || ctx.role !== 'admin') return fail('FORBIDDEN', 403);
    if (!UUID.test(ctx.userId)) return fail('INTERNAL_PRINCIPAL_REQUIRED', 403);
    return ctx;
  }

  private async target(admin: AuthContext, membershipId: unknown): Promise<WorkspaceMembership> {
    if (typeof membershipId !== 'string' || !UUID.test(membershipId)) return fail('INPUT_INVALID');
    const current = await this.guard(() => this.store.get(admin.workspaceId, membershipId));
    if (!current) return fail('MEMBERSHIP_NOT_FOUND', 404); // unknown and foreign-workspace ids look the same
    if (current.userId === admin.userId) return fail('SELF_MEMBERSHIP_CHANGE', 409);
    if (current.status !== 'active') return fail('MEMBERSHIP_NOT_ACTIVE', 409);
    return current;
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MembershipError) throw new MembershipAdminError(error.code, error.status);
      throw error;
    }
  }
}
