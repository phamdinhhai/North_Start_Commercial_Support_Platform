import type { CommercialEnvelope } from '../../domain/envelope/envelope';

/** The two Pancake products are separate integration surfaces by contract. */
export type PancakeSurface = 'conversations' | 'pos';

/** A workspace-owned connection reference; credentials are deliberately not represented. */
export interface PancakeConnectionReference {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly surface: PancakeSurface;
}

/** Opaque pagination state. It is not a processing checkpoint. */
export interface PancakeCursor {
  readonly value: string | null;
  readonly pageIndex: number;
}

/** Processing progress is independent from the transport cursor. */
export interface PancakeCheckpoint {
  readonly lastExternalRecordId: string | null;
  readonly acceptedCount: number;
  readonly duplicateCount: number;
  readonly quarantinedCount: number;
}

export interface PancakeReadRequest {
  readonly connection: PancakeConnectionReference;
  readonly cursor: PancakeCursor;
  readonly pageSize: number;
}

/** Raw record shape accepted by the contract mapper. Extra fields are preserved. */
export interface PancakeRawRecord {
  readonly id: unknown;
  readonly type?: unknown;
  readonly capturedAt?: unknown;
  readonly payload?: unknown;
  readonly [key: string]: unknown;
}

export interface PancakeRawPage {
  readonly records: readonly PancakeRawRecord[];
  readonly nextCursor: string | null;
}

export interface PancakeTransportResponse {
  readonly status: number;
  readonly page?: unknown;
  readonly retryAfterMs?: number;
}

export interface PancakeTransport {
  readPage(request: PancakeReadRequest): Promise<PancakeTransportResponse>;
}

export type PancakeQuarantineReason =
  | 'unsupported_surface'
  | 'schema_conflict'
  | 'malformed_page'
  | 'malformed_record'
  | 'changed_payload_conflict'
  | 'auth_expired'
  | 'forbidden'
  | 'rate_limited'
  | 'timeout'
  | 'transport_error';

export interface PancakeQuarantinedItem {
  readonly reason: PancakeQuarantineReason;
  readonly raw: unknown;
  readonly detail: string;
  readonly pageIndex: number;
  readonly externalRecordId?: string;
}

export interface PancakeDuplicate {
  readonly externalRecordId: string;
  readonly pageIndex: number;
  readonly envelopeId: string;
}

export interface PancakeOutOfOrderRecord {
  readonly externalRecordId: string;
  readonly pageIndex: number;
  readonly capturedAt: string;
  readonly previousCapturedAt: string;
}

export interface PancakeReadResult {
  readonly status: 'disabled' | 'completed' | 'unknown';
  readonly surface: PancakeSurface;
  readonly envelopes: readonly CommercialEnvelope[];
  readonly duplicates: readonly PancakeDuplicate[];
  readonly outOfOrder: readonly PancakeOutOfOrderRecord[];
  readonly quarantined: readonly PancakeQuarantinedItem[];
  readonly pagesRead: number;
  readonly cursor: PancakeCursor;
  readonly checkpoint: PancakeCheckpoint;
}

export type PancakeRetryDisposition = 'retry' | 'quarantine' | 'stop';

export interface PancakeRetryClassification {
  readonly disposition: PancakeRetryDisposition;
  readonly reason: PancakeQuarantineReason | 'success' | 'empty';
  readonly retryAfterMs: number | null;
}

export interface PancakeAdapterOptions {
  /** Disabled by default; PH4 must explicitly opt in later. */
  readonly enabled?: boolean;
  readonly pageSize?: number;
  readonly maxPages?: number;
  readonly maxAttempts?: number;
  readonly baseBackoffMs?: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}
