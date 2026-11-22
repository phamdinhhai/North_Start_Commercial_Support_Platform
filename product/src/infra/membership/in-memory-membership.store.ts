import { randomUUID } from 'node:crypto';
import {
  MembershipError,
  type AuthRole,
  type ExternalIdentityRef,
  type MembershipActor,
  type MembershipGrantInput,
  type MembershipStatus,
  type MembershipStore,
  type WorkspaceMemberListing,
  type WorkspaceMembership,
} from '../../ports/auth';

/**
 * In-memory membership store for tests and DB-less local runs (starts EMPTY: nobody is a member).
 * Mirrors migration 010 (ADR-006): internal platform users, immutable identity links, one active
 * membership per (workspace, user), terminal revoke, re-grant = new row, role change = revoke +
 * grant, no deletion, and an append-only audit log carrying the acting admin's internal id.
 * Tenant isolation and LAST_ADMIN mirror PgMembershipStore (single-threaded, so each mutation is atomic).
 */
export const BASE_ROLES: readonly AuthRole[] = Object.freeze(['admin', 'manager', 'sales', 'viewer']);
export const MAX_MEMBERSHIP_LIST = 500;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

const text = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max && !CONTROL.test(value);

export function assertWorkspaceId(workspaceId: unknown): asserts workspaceId is string {
  if (!text(workspaceId, 128) || !/^[a-zA-Z0-9:_./-]+$/.test(workspaceId) || workspaceId.startsWith('demo:')) {
    throw new MembershipError('INPUT_INVALID', 400);
  }
}

export function assertIdentity(issuer: unknown, subject: unknown): void {
  if (!text(issuer, 2048) || !text(subject, 255)) throw new MembershipError('INPUT_INVALID', 400);
}

export function assertMembershipInput(input: { workspaceId: string; issuer: string; subject: string; baseRole?: string }): void {
  assertWorkspaceId(input.workspaceId);
  assertIdentity(input.issuer, input.subject);
  if (input.baseRole !== undefined && !(BASE_ROLES as readonly string[]).includes(input.baseRole)) {
    throw new MembershipError('INPUT_INVALID', 400);
  }
}

/** The audit actor: the acting admin's internal id, or `null` for the operator/seed path. */
export function assertActor(actor: MembershipActor | undefined): string | null {
  if (!actor) return null;
  if (!UUID_PATTERN.test(actor.userId)) throw new MembershipError('INPUT_INVALID', 400);
  return actor.userId;
}

export interface InMemoryAuditEntry {
  readonly membershipId: string;
  readonly operation: 'grant' | 'revoke';
  readonly workspaceId: string;
  readonly userId: string;
  readonly baseRole: AuthRole;
  readonly actor: string;
}

export class InMemoryMembershipStore implements MembershipStore {
  private readonly users = new Map<string, { status: 'active' | 'disabled' }>();
  private readonly identities = new Map<string, string>(); // JSON[issuer, subject] → userId
  private readonly rows = new Map<string, WorkspaceMembership>();
  private readonly grantedVia = new Map<string, ExternalIdentityRef>(); // membership id → granting identity
  private readonly audit: InMemoryAuditEntry[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  private static identityKey(issuer: string, subject: string): string {
    return JSON.stringify([issuer, subject]);
  }

  async resolveUserId(issuer: string, subject: string): Promise<string | null> {
    const userId = this.identities.get(InMemoryMembershipStore.identityKey(issuer, subject));
    return userId && this.users.get(userId)?.status === 'active' ? userId : null;
  }

  async listActive(userId: string): Promise<WorkspaceMembership[]> {
    return [...this.rows.values()]
      .filter((m) => m.userId === userId && m.status === 'active')
      .sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  }

  async grant(input: MembershipGrantInput, actor: MembershipActor = null): Promise<WorkspaceMembership> {
    assertMembershipInput(input);
    const who = assertActor(actor);
    if (who && !this.users.has(who)) throw new MembershipError('INPUT_INVALID', 400); // mirrors the FK
    const key = InMemoryMembershipStore.identityKey(input.issuer, input.subject);
    let userId = this.identities.get(key);
    if (!userId) {
      userId = randomUUID();
      this.users.set(userId, { status: 'active' });
      this.identities.set(key, userId);
    }
    const owner = userId;
    const inWorkspace = [...this.rows.values()].filter((m) => m.workspaceId === input.workspaceId && m.userId === owner);
    // Non-enumerating: the disabled state is only stated to a workspace that already knows the user.
    if (this.users.get(owner)?.status !== 'active' && inWorkspace.length > 0) throw new MembershipError('USER_DISABLED', 409);
    if (inWorkspace.some((m) => m.status === 'active')) throw new MembershipError('MEMBERSHIP_EXISTS', 409);
    return this.insert(input.workspaceId, owner, input.baseRole, who, { issuer: input.issuer, subject: input.subject });
  }

  /** Operator/test break-glass seam: revoke by identity WITHOUT the last-admin guard (like operator SQL). */
  async revoke(input: { workspaceId: string; issuer: string; subject: string }, actor: MembershipActor = null): Promise<boolean> {
    const who = assertActor(actor);
    const userId = this.identities.get(InMemoryMembershipStore.identityKey(input.issuer, input.subject));
    const row = [...this.rows.values()].find((m) => m.workspaceId === input.workspaceId && m.userId === userId && m.status === 'active');
    if (!row) return false;
    this.revokeRow(row, who);
    return true;
  }

  async get(workspaceId: string, membershipId: string): Promise<WorkspaceMembership | null> {
    return this.lookup(workspaceId, membershipId);
  }

  private lookup(workspaceId: string, membershipId: string): WorkspaceMembership | null {
    const row = this.rows.get(membershipId);
    return row && row.workspaceId === workspaceId ? row : null;
  }

  async revokeById(input: { workspaceId: string; membershipId: string }, actor: MembershipActor = null): Promise<WorkspaceMembership | null> {
    const who = assertActor(actor);
    const row = this.lookup(input.workspaceId, input.membershipId); // synchronous: check + change are atomic
    if (!row || row.status !== 'active') return null;
    this.assertNotLastAdmin(row);
    return this.revokeRow(row, who);
  }

  async changeRole(
    input: { workspaceId: string; membershipId: string; baseRole: AuthRole },
    actor: MembershipActor = null,
  ): Promise<{ revoked: WorkspaceMembership; granted: WorkspaceMembership } | null> {
    if (!(BASE_ROLES as readonly string[]).includes(input.baseRole)) throw new MembershipError('INPUT_INVALID', 400);
    const who = assertActor(actor);
    const row = this.lookup(input.workspaceId, input.membershipId); // synchronous: check + change are atomic
    if (!row || row.status !== 'active') return null;
    if (input.baseRole !== 'admin') this.assertNotLastAdmin(row);
    const revoked = this.revokeRow(row, who);
    return { revoked, granted: this.insert(revoked.workspaceId, revoked.userId, input.baseRole, who, this.grantedVia.get(row.id)!) };
  }

  async list(workspaceId: string, options: { status?: MembershipStatus; limit?: number } = {}): Promise<WorkspaceMemberListing[]> {
    const limit = Math.min(Math.max(1, options.limit ?? MAX_MEMBERSHIP_LIST), MAX_MEMBERSHIP_LIST);
    return [...this.rows.values()]
      .filter((m) => m.workspaceId === workspaceId && (!options.status || m.status === options.status))
      .reverse()
      .slice(0, limit)
      .map((m) => Object.freeze({ ...m, identity: Object.freeze({ ...this.grantedVia.get(m.id)! }) }));
  }

  /** TEST/OPERATOR seam (mirrors `UPDATE platform_user SET status`): disable or re-enable a user. */
  setUserStatus(userId: string, status: 'active' | 'disabled'): void {
    if (!this.users.has(userId)) throw new MembershipError('INPUT_INVALID', 400);
    this.users.set(userId, { status });
  }

  /** TEST/OPERATOR seam (mirrors an operator INSERT into external_identity): link another identity to a user. */
  linkIdentity(userId: string, issuer: string, subject: string): void {
    assertIdentity(issuer, subject);
    const key = InMemoryMembershipStore.identityKey(issuer, subject);
    if (!this.users.has(userId) || this.identities.has(key)) throw new MembershipError('INPUT_INVALID', 400);
    this.identities.set(key, userId);
  }

  /** Append-only audit trail (copy). */
  auditLog(): readonly InMemoryAuditEntry[] {
    return [...this.audit];
  }

  private assertNotLastAdmin(row: WorkspaceMembership): void {
    if (row.baseRole !== 'admin') return;
    const others = [...this.rows.values()].some((m) => m.workspaceId === row.workspaceId && m.id !== row.id && m.status === 'active' && m.baseRole === 'admin');
    if (!others) throw new MembershipError('LAST_ADMIN', 409);
  }

  private revokeRow(row: WorkspaceMembership, who: string | null): WorkspaceMembership {
    const revoked: WorkspaceMembership = Object.freeze({ ...row, status: 'revoked', revokedAt: this.now() });
    this.rows.set(row.id, revoked);
    this.record(revoked, 'revoke', who);
    return revoked;
  }

  private insert(workspaceId: string, userId: string, baseRole: AuthRole, who: string | null, via: ExternalIdentityRef): WorkspaceMembership {
    const row: WorkspaceMembership = Object.freeze({
      id: randomUUID(), workspaceId, userId, baseRole, status: 'active', createdAt: this.now(), revokedAt: null,
    });
    this.rows.set(row.id, row);
    this.grantedVia.set(row.id, Object.freeze({ issuer: via.issuer, subject: via.subject }));
    this.record(row, 'grant', who);
    return row;
  }

  private record(row: WorkspaceMembership, operation: 'grant' | 'revoke', who: string | null): void {
    this.audit.push(Object.freeze({
      membershipId: row.id, operation, workspaceId: row.workspaceId, userId: row.userId, baseRole: row.baseRole, actor: who ?? 'operator',
    }));
  }
}
