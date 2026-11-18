import type { AuthRole, MembershipStore, WorkspaceMembership } from '../../ports/auth';

/**
 * In-memory membership store for tests and DB-less local runs (starts EMPTY: nobody is a member).
 * Mirrors the PostgreSQL constraints of migration 010.
 * // OPEN: PM-1 — `grant`/`revoke` are seeding seams, not an approved lifecycle or HTTP surface.
 */
export const BASE_ROLES: readonly AuthRole[] = Object.freeze(['admin', 'manager', 'sales', 'viewer']);

export function assertMembershipInput(input: { workspaceId: string; issuer: string; subject: string; baseRole?: string }): void {
  const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
  if (!text(input.workspaceId, 128) || !/^[a-zA-Z0-9:_./-]+$/.test(input.workspaceId) || input.workspaceId.startsWith('demo:')) {
    throw new Error('membership workspaceId invalid');
  }
  const control = /[\u0000-\u001f\u007f]/;
  if (!text(input.issuer, 2048) || control.test(input.issuer)) throw new Error('membership issuer invalid');
  if (!text(input.subject, 255) || control.test(input.subject)) throw new Error('membership subject invalid');
  if (input.baseRole !== undefined && !(BASE_ROLES as readonly string[]).includes(input.baseRole)) {
    throw new Error('membership baseRole must be an existing base role');
  }
}

export class InMemoryMembershipStore implements MembershipStore {
  private readonly rows = new Map<string, WorkspaceMembership>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private static key(issuer: string, subject: string, workspaceId: string): string {
    return JSON.stringify([issuer, subject, workspaceId]);
  }

  async listActive(issuer: string, subject: string): Promise<WorkspaceMembership[]> {
    return [...this.rows.values()]
      .filter((m) => m.issuer === issuer && m.subject === subject && m.status === 'active')
      .sort((a, b) => a.workspaceId.localeCompare(b.workspaceId));
  }

  async grant(input: { workspaceId: string; issuer: string; subject: string; baseRole: AuthRole }): Promise<WorkspaceMembership> {
    assertMembershipInput(input);
    const key = InMemoryMembershipStore.key(input.issuer, input.subject, input.workspaceId);
    // Same rule as the unique constraint: one row per (issuer, subject, workspace), and a
    // revoked row is never reactivated (no overwrite of revocation history).
    if (this.rows.has(key)) throw new Error('membership already exists');
    const row: WorkspaceMembership = Object.freeze({
      workspaceId: input.workspaceId, issuer: input.issuer, subject: input.subject,
      baseRole: input.baseRole, status: 'active', createdAt: this.now(), revokedAt: null,
    });
    this.rows.set(key, row);
    return row;
  }

  async revoke(input: { workspaceId: string; issuer: string; subject: string }): Promise<boolean> {
    const key = InMemoryMembershipStore.key(input.issuer, input.subject, input.workspaceId);
    const row = this.rows.get(key);
    if (!row || row.status !== 'active') return false;
    this.rows.set(key, Object.freeze({ ...row, status: 'revoked', revokedAt: this.now() }));
    return true;
  }
}
