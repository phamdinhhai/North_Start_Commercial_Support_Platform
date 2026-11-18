import type { AuthContext } from '../../ports/auth';
import type {
  ConnectorHealthReader, ConnectorHealthReport, EnrollmentHealthRow, EnrollmentHealthView, TransportState,
} from '../../ports/connector-health';

/** Maximum enrollments returned in one report; the response states when it was truncated. */
export const CONNECTOR_HEALTH_LIMIT = 100;

export type ConnectorHealthErrorCode = 'AIL_DISABLED' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'HEALTH_UNAVAILABLE';

export class ConnectorHealthError extends Error {
  constructor(readonly code: ConnectorHealthErrorCode, readonly status: number) { super(code); }
}

const PRIVILEGED = new Set<AuthContext['role']>(['admin', 'manager']);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

function transportState(row: EnrollmentHealthRow, observedAt: Date): TransportState {
  if (row.revokedAt) return 'revoked';
  return row.expiresAt.getTime() <= observedAt.getTime() ? 'expired' : 'active';
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function view(row: EnrollmentHealthRow, observedAt: Date): EnrollmentHealthView {
  const since = row.checkpointAdvancedAt ?? row.enrolledAt;
  return {
    enrollmentId: row.enrollmentId,
    connectionId: row.connectionId,
    providerSurface: row.providerSurface,
    transport: {
      state: transportState(row, observedAt),
      enrolledAt: row.enrolledAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      revokedAt: iso(row.revokedAt),
    },
    delivery: {
      receiptCount: row.receiptCount,
      lastReceiptAt: iso(row.lastReceiptAt),
      checkpoint: row.checkpoint,
      checkpointAdvancedAt: iso(row.checkpointAdvancedAt),
      checkpointAgeSeconds: Math.max(0, Math.floor((observedAt.getTime() - since.getTime()) / 1000)),
      lastAuditOperation: row.lastAuditOperation,
      lastAuditAt: iso(row.lastAuditAt),
      rejectedConflicts: { count: null, reason: 'NOT_PERSISTED' },
    },
    // Never derived from transport/delivery facts. Only a future reconciliation may change this.
    completeness: 'UNKNOWN',
    completenessReason: 'NO_RECONCILIATION',
  };
}

/**
 * Read-only connector health query. Authorization: an authenticated, non-demo manager or
 * admin sees only enrollments scoped to their own server-resolved workspace (I-09).
 * OPEN: PM-1 — manager/admin capability matrix; this read is the narrowest safe default.
 */
export class ConnectorHealthQuery {
  constructor(
    private readonly reader: ConnectorHealthReader,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  /** Flag-off behaves like the intake routes: 404 so the experimental surface is not advertised. */
  enabled(): boolean {
    return this.env.AIL_RESEARCH_ENABLED === 'true';
  }

  authorize(ctx: AuthContext | null): AuthContext {
    if (!ctx || !nonEmpty(ctx.workspaceId) || !nonEmpty(ctx.userId)) throw new ConnectorHealthError('UNAUTHORIZED', 401);
    if (ctx.isDemo || !PRIVILEGED.has(ctx.role)) throw new ConnectorHealthError('FORBIDDEN', 403);
    return ctx;
  }

  async report(ctx: AuthContext | null): Promise<ConnectorHealthReport> {
    if (!this.enabled()) throw new ConnectorHealthError('AIL_DISABLED', 404);
    const principal = this.authorize(ctx);
    let page;
    try {
      page = await this.reader.listByWorkspace(principal.workspaceId, CONNECTOR_HEALTH_LIMIT);
    } catch {
      throw new ConnectorHealthError('HEALTH_UNAVAILABLE', 503);
    }
    // Defence in depth: the adapter filters by workspace; drop anything that slipped through.
    const rows = page.rows.filter((row) => row.workspaceId === principal.workspaceId).slice(0, CONNECTOR_HEALTH_LIMIT);
    return {
      classification: 'OPERATIONAL_TELEMETRY_NOT_COMMERCIAL_EVIDENCE',
      workspaceId: principal.workspaceId,
      observedAt: page.observedAt.toISOString(),
      completeness: 'UNKNOWN',
      enrollments: rows.map((row) => view(row, page.observedAt)),
      truncated: page.truncated,
    };
  }
}
