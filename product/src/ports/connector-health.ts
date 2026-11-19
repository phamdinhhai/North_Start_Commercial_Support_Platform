/**
 * Connector health read model (experimental AIL intake, migration 008 tables).
 *
 * OPERATIONAL TELEMETRY ONLY — never commercial evidence (I-04, I-12). The read model
 * reports transport facts (enrollment state), delivery facts (receipts/checkpoint) and a
 * completeness verdict that is ALWAYS `UNKNOWN` until a reconciliation mechanism exists.
 * There is intentionally no aggregate "healthy" field: a reachable connector with a
 * contiguous checkpoint does not prove that every provider event was observed.
 */

/** Raw facts read from integration_enrollment / integration_receipt / integration_audit. */
export interface EnrollmentHealthRow {
  readonly enrollmentId: string;
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly providerSurface: string;
  readonly enrolledAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly checkpoint: number;
  /** received_at of the receipt whose sequence equals the checkpoint (null when checkpoint = 0). */
  readonly checkpointAdvancedAt: Date | null;
  readonly lastReceiptAt: Date | null;
  readonly receiptCount: number;
  readonly lastAuditOperation: 'enroll' | 'revoke' | 'receipt' | null;
  readonly lastAuditAt: Date | null;
}

export interface EnrollmentHealthPage {
  /** Clock used for expiry/age computation (database clock for the PostgreSQL adapter). */
  readonly observedAt: Date;
  readonly rows: readonly EnrollmentHealthRow[];
  readonly truncated: boolean;
}

export interface ConnectorHealthReader {
  /** Must only return enrollments whose server-fixed scope belongs to `workspaceId`. */
  listByWorkspace(workspaceId: string, limit: number): Promise<EnrollmentHealthPage>;
}

export const CONNECTOR_HEALTH_READER = Symbol('CONNECTOR_HEALTH_READER');

export type TransportState = 'active' | 'revoked' | 'expired';

/** Completeness can only become anything other than UNKNOWN through reconciliation (not built). */
export type CompletenessVerdict = 'UNKNOWN';

export interface EnrollmentHealthView {
  readonly enrollmentId: string;
  readonly connectionId: string;
  readonly providerSurface: string;
  readonly transport: {
    readonly state: TransportState;
    readonly enrolledAt: string;
    readonly expiresAt: string;
    readonly revokedAt: string | null;
  };
  readonly delivery: {
    readonly receiptCount: number;
    readonly lastReceiptAt: string | null;
    readonly checkpoint: number;
    readonly checkpointAdvancedAt: string | null;
    /** Seconds since the checkpoint last advanced, or since enrollment when it never advanced. */
    readonly checkpointAgeSeconds: number;
    readonly lastAuditOperation: 'enroll' | 'revoke' | 'receipt' | null;
    readonly lastAuditAt: string | null;
    /** 409 gap/conflict rejections roll back and are not persisted per enrollment. */
    readonly rejectedConflicts: { readonly count: null; readonly reason: 'NOT_PERSISTED' };
  };
  readonly completeness: CompletenessVerdict;
  readonly completenessReason: 'NO_RECONCILIATION';
}

export interface ConnectorHealthReport {
  readonly classification: 'OPERATIONAL_TELEMETRY_NOT_COMMERCIAL_EVIDENCE';
  readonly workspaceId: string;
  readonly observedAt: string;
  readonly completeness: CompletenessVerdict;
  readonly enrollments: readonly EnrollmentHealthView[];
  readonly truncated: boolean;
}
