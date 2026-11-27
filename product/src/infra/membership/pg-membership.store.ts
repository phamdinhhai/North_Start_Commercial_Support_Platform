import {
  MembershipError,
  type AuthRole,
  type MembershipActor,
  type MembershipGrantInput,
  type MembershipStatus,
  type MembershipStore,
  type WorkspaceMemberListing,
  type WorkspaceMembership,
} from '../../ports/auth';
import type { SqlExecutor } from '../postgres/postgres.service';
import { BASE_ROLES, MAX_MEMBERSHIP_LIST, UUID_PATTERN, assertActor, assertMembershipInput, assertWorkspaceId } from './in-memory-membership.store';

/**
 * PostgreSQL membership store (migration 010, ADR-006). Parameterized SQL only.
 * - Principals: `platform_user` + immutable `external_identity(issuer, subject) → user_id` links.
 *   Reads never provision; only `grant` (admin pre-grant) creates a user + identity link.
 * - Reads are uncached so a committed revocation is visible to the next request.
 * - Mutations run in ONE transaction that first sets the transaction-local
 *   `north.membership_actor` to the acting admin's internal user id; the database trigger writes
 *   append-only `membership_audit` rows with that actor (operator/seed path: `db:<session_user>`).
 * - Rows are never deleted; role change = revoke + new row in the same transaction.
 * - Tenant isolation: each membership records the identity link its grant used (`identity_id`);
 *   listings expose only that identity, never links created for other workspaces. USER_DISABLED is
 *   only stated to a workspace that already has a relationship with the user.
 * - LAST_ADMIN: revoking/demoting an admin locks the workspace row (FOR NO KEY UPDATE) and refuses
 *   when no other active admin would remain; concurrent changes serialize on that lock.
 */
interface MembershipRow {
  id: string;
  workspace_id: string;
  user_id: string;
  base_role: string;
  status: string;
  created_at: Date;
  revoked_at: Date | null;
}

type TransactionalSql = SqlExecutor & { withTransaction?<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> };

const COLUMNS = 'id, workspace_id, user_id, base_role, status, created_at, revoked_at';
const UNIQUE_VIOLATION = '23505';

function toMembership(row: MembershipRow): WorkspaceMembership | null {
  if (!(BASE_ROLES as readonly string[]).includes(row.base_role)) return null; // fail closed
  if (row.status !== 'active' && row.status !== 'revoked') return null;
  return Object.freeze({
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    baseRole: row.base_role as AuthRole,
    status: row.status,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  });
}

function required(row: MembershipRow | undefined): WorkspaceMembership {
  const membership = row ? toMembership(row) : null;
  if (!membership) throw new Error('membership statement returned no usable row');
  return membership;
}

const isUniqueViolation = (error: unknown, constraint?: string): boolean =>
  !!error && typeof error === 'object' && (error as { code?: string }).code === UNIQUE_VIOLATION &&
  (constraint === undefined || (error as { constraint?: string }).constraint === constraint);

export class PgMembershipStore implements MembershipStore {
  constructor(private readonly db: TransactionalSql) {}

  async resolveUserId(issuer: string, subject: string): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      `SELECT u.id FROM external_identity i JOIN platform_user u ON u.id = i.user_id
        WHERE i.issuer = $1 AND i.subject = $2 AND u.status = 'active'`,
      [issuer, subject],
    );
    return result.rows[0]?.id ?? null;
  }

  async listActive(userId: string): Promise<WorkspaceMembership[]> {
    if (!UUID_PATTERN.test(userId)) return [];
    const result = await this.db.query<MembershipRow>(
      `SELECT ${COLUMNS} FROM memberships
        WHERE user_id = $1 AND status = 'active' AND revoked_at IS NULL ORDER BY workspace_id`,
      [userId],
    );
    return result.rows.map(toMembership).filter((m): m is WorkspaceMembership => m !== null);
  }

  async grant(input: MembershipGrantInput, actor: MembershipActor = null): Promise<WorkspaceMembership> {
    assertMembershipInput(input);
    const who = assertActor(actor);
    try {
      return await this.transaction(who, async (tx) => {
        const link = await this.provision(tx, input.issuer, input.subject);
        if (link.disabled) {
          // Non-enumerating: only a workspace with an existing (active or historical) membership
          // learns that the user is disabled; anyone else gets an ordinary grant (login stays refused).
          const known = await tx.query('SELECT 1 FROM memberships WHERE workspace_id = $1 AND user_id = $2 LIMIT 1', [input.workspaceId, link.userId]);
          if ((known.rowCount ?? 0) > 0) throw new MembershipError('USER_DISABLED', 409);
        }
        const result = await tx.query<MembershipRow>(
          `INSERT INTO memberships (workspace_id, user_id, identity_id, base_role) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
          [input.workspaceId, link.userId, link.identityId, input.baseRole],
        );
        return required(result.rows[0]);
      });
    } catch (error) {
      if (isUniqueViolation(error, 'memberships_active_unique')) throw new MembershipError('MEMBERSHIP_EXISTS', 409);
      if (isUniqueViolation(error)) throw new MembershipError('CONFLICT', 409); // concurrent first grant of one identity
      throw error;
    }
  }

  /**
   * Operator/test break-glass seam (not reachable over HTTP): revokes by identity WITHOUT the
   * last-admin guard, exactly like operator SQL. The admin API uses revokeById/changeRole.
   */
  async revoke(input: { workspaceId: string; issuer: string; subject: string }, actor: MembershipActor = null): Promise<boolean> {
    const who = assertActor(actor);
    return this.transaction(who, async (tx) => {
      const result = await tx.query(
        `UPDATE memberships m SET status = 'revoked', revoked_at = now()
           FROM external_identity i
          WHERE i.issuer = $1 AND i.subject = $2 AND m.user_id = i.user_id
            AND m.workspace_id = $3 AND m.status = 'active'`,
        [input.issuer, input.subject, input.workspaceId],
      );
      return (result.rowCount ?? 0) > 0;
    });
  }

  async get(workspaceId: string, membershipId: string): Promise<WorkspaceMembership | null> {
    if (!UUID_PATTERN.test(membershipId)) return null;
    const result = await this.db.query<MembershipRow>(
      `SELECT ${COLUMNS} FROM memberships WHERE id = $1 AND workspace_id = $2`, [membershipId, workspaceId]);
    return result.rows[0] ? toMembership(result.rows[0]) : null;
  }

  async revokeById(input: { workspaceId: string; membershipId: string }, actor: MembershipActor = null): Promise<WorkspaceMembership | null> {
    const who = assertActor(actor);
    if (!UUID_PATTERN.test(input.membershipId)) return null;
    return this.transaction(who, (tx) => this.revokeRow(tx, input.workspaceId, input.membershipId));
  }

  async changeRole(
    input: { workspaceId: string; membershipId: string; baseRole: AuthRole },
    actor: MembershipActor = null,
  ): Promise<{ revoked: WorkspaceMembership; granted: WorkspaceMembership } | null> {
    if (!(BASE_ROLES as readonly string[]).includes(input.baseRole)) throw new MembershipError('INPUT_INVALID', 400);
    const who = assertActor(actor);
    if (!UUID_PATTERN.test(input.membershipId)) return null;
    return this.transaction(who, async (tx) => {
      const revoked = await this.revokeRow(tx, input.workspaceId, input.membershipId, input.baseRole);
      if (!revoked) return null;
      // The new row keeps the granting identity of the row it replaces (tenant-scoped provenance).
      const result = await tx.query<MembershipRow>(
        `INSERT INTO memberships (workspace_id, user_id, identity_id, base_role)
         SELECT workspace_id, user_id, identity_id, $2 FROM memberships WHERE id = $1 RETURNING ${COLUMNS}`,
        [revoked.id, input.baseRole],
      );
      return { revoked, granted: required(result.rows[0]) };
    });
  }

  async list(workspaceId: string, options: { status?: MembershipStatus; limit?: number } = {}): Promise<WorkspaceMemberListing[]> {
    assertWorkspaceId(workspaceId);
    const limit = Math.min(Math.max(1, Math.trunc(options.limit ?? MAX_MEMBERSHIP_LIST)), MAX_MEMBERSHIP_LIST);
    // Only the identity THIS membership was granted through (never other links of the user).
    const result = await this.db.query<MembershipRow & { issuer: string; subject: string }>(
      `SELECT m.id, m.workspace_id, m.user_id, m.base_role, m.status, m.created_at, m.revoked_at, i.issuer, i.subject
         FROM memberships m JOIN external_identity i ON i.id = m.identity_id
        WHERE m.workspace_id = $1 AND ($2::text IS NULL OR m.status = $2)
        ORDER BY m.created_at DESC, m.id
        LIMIT $3`,
      [workspaceId, options.status ?? null, limit],
    );
    return result.rows.flatMap((row) => {
      const membership = toMembership(row);
      return membership ? [Object.freeze({ ...membership, identity: Object.freeze({ issuer: row.issuer, subject: row.subject }) })] : [];
    });
  }

  /** Existing identity link → its user; unknown identity → new platform user + immutable link. */
  private async provision(tx: SqlExecutor, issuer: string, subject: string): Promise<{ userId: string; identityId: string; disabled: boolean }> {
    const existing = await tx.query<{ user_id: string; identity_id: string; status: string }>(
      `SELECT u.id AS user_id, i.id AS identity_id, u.status FROM external_identity i JOIN platform_user u ON u.id = i.user_id
        WHERE i.issuer = $1 AND i.subject = $2 FOR SHARE OF u`,
      [issuer, subject],
    );
    const row = existing.rows[0];
    if (row) return { userId: row.user_id, identityId: row.identity_id, disabled: row.status !== 'active' };
    const user = await tx.query<{ id: string }>('INSERT INTO platform_user DEFAULT VALUES RETURNING id');
    const link = await tx.query<{ id: string }>('INSERT INTO external_identity (issuer, subject, user_id) VALUES ($1, $2, $3) RETURNING id', [issuer, subject, user.rows[0].id]);
    return { userId: user.rows[0].id, identityId: link.rows[0].id, disabled: false };
  }

  /**
   * Revokes an active row of this workspace. LAST_ADMIN: when the row is an admin and the change
   * does not keep it admin (`nextRole`), the workspace row is locked first (serializing concurrent
   * membership changes of this workspace) and the change is refused if no other active admin remains.
   */
  private async revokeRow(tx: SqlExecutor, workspaceId: string, membershipId: string, nextRole?: AuthRole): Promise<WorkspaceMembership | null> {
    await tx.query('SELECT 1 FROM workspace WHERE id = $1 FOR NO KEY UPDATE', [workspaceId]);
    const target = await tx.query<{ base_role: string; status: string }>(
      'SELECT base_role, status FROM memberships WHERE id = $1 AND workspace_id = $2', [membershipId, workspaceId]);
    if (target.rows[0]?.status === 'active' && target.rows[0].base_role === 'admin' && nextRole !== 'admin') {
      const others = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM memberships
          WHERE workspace_id = $1 AND status = 'active' AND base_role = 'admin' AND id <> $2`, [workspaceId, membershipId]);
      if ((others.rows[0]?.n ?? 0) < 1) throw new MembershipError('LAST_ADMIN', 409);
    }
    const result = await tx.query<MembershipRow>(
      `UPDATE memberships SET status = 'revoked', revoked_at = now()
        WHERE id = $1 AND workspace_id = $2 AND status = 'active' RETURNING ${COLUMNS}`,
      [membershipId, workspaceId],
    );
    return result.rows[0] ? toMembership(result.rows[0]) : null;
  }

  /** One transaction with the audit actor bound transaction-locally (never session-wide). */
  private async transaction<T>(actorUserId: string | null, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const run = async (tx: SqlExecutor) => {
      if (actorUserId) await tx.query("SELECT set_config('north.membership_actor', $1, true)", [actorUserId]);
      return fn(tx);
    };
    // A bare executor (e.g. a caller-owned transaction client) is assumed to be inside a transaction.
    return this.db.withTransaction ? this.db.withTransaction(run) : run(this.db);
  }
}
