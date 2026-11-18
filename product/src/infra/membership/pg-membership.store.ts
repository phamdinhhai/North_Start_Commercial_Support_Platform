import type { AuthRole, MembershipStore, WorkspaceMembership } from '../../ports/auth';
import type { SqlExecutor } from '../postgres/postgres.service';
import { BASE_ROLES, assertMembershipInput } from './in-memory-membership.store';

/**
 * PostgreSQL membership store (migration 010, table `memberships`). Parameterized SQL only.
 * Reads are uncached so a committed revocation is visible to the next request.
 * // OPEN: PM-1 — grant/revoke are operator/test seams; approval workflow and audit linkage
 * are undecided and nothing here is reachable over HTTP.
 */
interface MembershipRow {
  workspace_id: string;
  issuer: string;
  subject: string;
  base_role: string;
  status: string;
  created_at: Date;
  revoked_at: Date | null;
}

const COLUMNS = 'workspace_id, issuer, subject, base_role, status, created_at, revoked_at';

function toMembership(row: MembershipRow): WorkspaceMembership | null {
  if (!(BASE_ROLES as readonly string[]).includes(row.base_role)) return null; // fail closed
  if (row.status !== 'active' && row.status !== 'revoked') return null;
  return Object.freeze({
    workspaceId: row.workspace_id,
    issuer: row.issuer,
    subject: row.subject,
    baseRole: row.base_role as AuthRole,
    status: row.status,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  });
}

export class PgMembershipStore implements MembershipStore {
  constructor(private readonly db: SqlExecutor) {}

  async listActive(issuer: string, subject: string): Promise<WorkspaceMembership[]> {
    const result = await this.db.query<MembershipRow>(
      `SELECT ${COLUMNS} FROM memberships
        WHERE issuer = $1 AND subject = $2 AND status = 'active' AND revoked_at IS NULL
        ORDER BY workspace_id`,
      [issuer, subject],
    );
    return result.rows.map(toMembership).filter((m): m is WorkspaceMembership => m !== null);
  }

  async grant(input: { workspaceId: string; issuer: string; subject: string; baseRole: AuthRole }): Promise<WorkspaceMembership> {
    assertMembershipInput(input);
    const result = await this.db.query<MembershipRow>(
      `INSERT INTO memberships (workspace_id, issuer, subject, base_role)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [input.workspaceId, input.issuer, input.subject, input.baseRole],
    );
    const row = result.rows[0] ? toMembership(result.rows[0]) : null;
    if (!row) throw new Error('membership insert returned no usable row');
    return row;
  }

  async revoke(input: { workspaceId: string; issuer: string; subject: string }): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE memberships SET status = 'revoked', revoked_at = now()
        WHERE issuer = $1 AND subject = $2 AND workspace_id = $3 AND status = 'active'`,
      [input.issuer, input.subject, input.workspaceId],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
