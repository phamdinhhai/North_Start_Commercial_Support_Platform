import type { QueryResultRow } from 'pg';
import type {
  ConnectorHealthReader, EnrollmentHealthPage, EnrollmentHealthRow,
} from '../../ports/connector-health';

/** Narrow read-only executor: this adapter never opens a transaction or writes. */
export interface ReadOnlySql {
  query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

interface Row extends QueryResultRow {
  id: string;
  workspace_id: string;
  connection_id: string | null;
  provider_surface: string | null;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  checkpoint: string;
  checkpoint_advanced_at: Date | null;
  last_receipt_at: Date | null;
  receipt_count: string;
  last_audit_operation: 'enroll' | 'revoke' | 'receipt' | null;
  last_audit_at: Date | null;
  observed_at: Date;
}

/**
 * Read model over migration 008 tables. Selects only operational columns: receipt
 * `metadata` (observation content) and `fingerprint` are never read. Tenant isolation is the
 * server-fixed enrollment scope (`scope->>'workspaceId'`), bound as a parameter.
 * Note: no index on scope->>'workspaceId' (no migrations in this change); acceptable for the
 * experimental enrollment volume, revisit before broader exposure.
 */
const SQL = `
SELECT e.id, e.scope->>'workspaceId' AS workspace_id, e.scope->>'connectionId' AS connection_id,
       e.scope->>'providerSurface' AS provider_surface, e.created_at, e.expires_at, e.revoked_at,
       e.checkpoint, c.received_at AS checkpoint_advanced_at,
       r.last_receipt_at, COALESCE(r.receipt_count, 0) AS receipt_count,
       a.operation AS last_audit_operation, a.recorded_at AS last_audit_at,
       clock_timestamp() AS observed_at
  FROM integration_enrollment e
  LEFT JOIN integration_receipt c ON c.enrollment_id = e.id AND c.sequence = e.checkpoint
  LEFT JOIN LATERAL (
    SELECT max(received_at) AS last_receipt_at, count(*) AS receipt_count
      FROM integration_receipt WHERE enrollment_id = e.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT operation, recorded_at FROM integration_audit WHERE enrollment_id = e.id ORDER BY id DESC LIMIT 1
  ) a ON true
 WHERE e.scope->>'workspaceId' = $1
 ORDER BY e.created_at DESC, e.id
 LIMIT $2`;

const NOW_SQL = 'SELECT clock_timestamp() AS observed_at';

function toRow(row: Row): EnrollmentHealthRow {
  return {
    enrollmentId: row.id,
    workspaceId: row.workspace_id,
    connectionId: row.connection_id ?? 'UNKNOWN',
    providerSurface: row.provider_surface ?? 'UNKNOWN',
    enrolledAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    checkpoint: Number(row.checkpoint),
    checkpointAdvancedAt: row.checkpoint_advanced_at ? new Date(row.checkpoint_advanced_at) : null,
    lastReceiptAt: row.last_receipt_at ? new Date(row.last_receipt_at) : null,
    receiptCount: Number(row.receipt_count),
    lastAuditOperation: row.last_audit_operation,
    lastAuditAt: row.last_audit_at ? new Date(row.last_audit_at) : null,
  };
}

export class PgConnectorHealthReader implements ConnectorHealthReader {
  constructor(private readonly db: ReadOnlySql) {}

  async listByWorkspace(workspaceId: string, limit: number): Promise<EnrollmentHealthPage> {
    if (typeof workspaceId !== 'string' || !workspaceId.trim()) throw new Error('workspaceId required');
    const bounded = Math.max(1, Math.min(500, Math.floor(limit)));
    const result = await this.db.query<Row>(SQL, [workspaceId, bounded + 1]);
    const rows = result.rows.slice(0, bounded);
    const observedAt = rows[0]?.observed_at
      ?? (await this.db.query<{ observed_at: Date }>(NOW_SQL)).rows[0]?.observed_at
      ?? new Date();
    return { observedAt: new Date(observedAt), rows: rows.map(toRow), truncated: result.rows.length > bounded };
  }
}
