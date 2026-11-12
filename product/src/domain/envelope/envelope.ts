import { createHash, randomUUID } from 'node:crypto';

/** Envelope ID — unique per ingest. */
export type EnvelopeId = string & { readonly __brand: 'EnvelopeId' };

/** Mapping status của envelope (C-11, R-05). */
export type MappingStatus = 'pending' | 'mapped' | 'error';

/** Provenance of an evidence record; automatic observations are the only source of observed action proof. */
export type EvidenceAcquisitionMode = 'automatic_observation' | 'imported_record';
export type EvidenceAcquisitionSource = 'system' | 'manual';

/**
 * Commercial Envelope v1 (C-11, R-05, I-11, I-12).
 *
 * Contract cho mọi inbound adapter (manual/synthetic/pancake):
 * - `rawPayload` immutable — I-12, không bao giờ sửa sau khi tạo.
 * - `rawPayloadHash` = SHA-256(JSON(rawPayload)) — verifies integrity.
 * - `mappingStatus` = pending → mapped/error; lỗi mapping giữ nguyên raw, không fabricate canonical fields.
 * - Idempotency key: `workspaceId` + `connection` + `externalRecordId` (R-06 within I-09/R-01).
 *   Connection names come from external systems and collide across tenants, so the key MUST
 *   include the authenticated workspace — otherwise workspace B receives workspace A's evidence.
 */
export interface CommercialEnvelope {
  readonly envelopeId: EnvelopeId;
  readonly schemaVersion: 1;
  /** Authenticated workspace scope (I-09/R-01). Part of the idempotency key. */
  readonly workspaceId: string;
  readonly connection: string; // workspace-scoped connection ID
  readonly externalRecordId: string; // immutable — idempotency key part 2
  readonly externalEventType: string; // message | conversation | customer | note | order
  readonly sourceCapturedAt: string; // ISO 8601
  readonly ingestedAt: string; // ISO 8601
  readonly rawPayload: unknown; // immutable (I-12)
  readonly rawPayloadHash: string; // SHA-256 hex
  readonly mappingStatus: MappingStatus;
  readonly mappingError?: string;
  readonly canonicalProjection?: unknown;
  readonly isSynthetic: boolean; // I-12 segregation (R-28)
  /** Explicit provenance; legacy rows are treated as imported records. */
  readonly acquisitionMode: EvidenceAcquisitionMode;
  readonly acquisitionSource: EvidenceAcquisitionSource;
}

export interface CreateEnvelopeInput {
  readonly workspaceId: string;
  readonly connection: string;
  readonly externalRecordId: string;
  readonly externalEventType: string;
  readonly sourceCapturedAt: string;
  readonly rawPayload: unknown;
  readonly isSynthetic?: boolean;
  readonly acquisitionMode?: EvidenceAcquisitionMode;
  readonly acquisitionSource?: EvidenceAcquisitionSource;
}

/**
 * Serialize JSON-shaped values deterministically before hashing.
 *
 * Object keys are sorted at every depth, while arrays retain their order.  The
 * replacer-array form of JSON.stringify only sorted the root object and also
 * dropped nested keys, which made distinct payloads hash alike.  Explicit
 * primitive handling keeps null and scalar values in the canonical stream.
 */
export function canonicalizePayload(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalizePayload).join(',')}]`;
  if (typeof value === 'object') {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalizePayload(nested)}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'undefined') return '"[undefined]"';
  if (typeof value === 'number' && !Number.isFinite(value)) return JSON.stringify(String(value));
  return JSON.stringify(value);
}

/** SHA-256 hex digest of the recursively canonicalized raw payload. */
export function hashRawPayload(rawPayload: unknown): string {
  return createHash('sha256').update(canonicalizePayload(rawPayload)).digest('hex');
}

export type ImmutableEnvelopeField = 'rawPayloadHash' | 'externalEventType' | 'sourceCapturedAt';

/** Stable, machine-readable refusal for a reused key with changed immutable evidence. */
export class EnvelopeIdempotencyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT' as const;

  constructor(
    readonly key: string,
    readonly conflicts: readonly ImmutableEnvelopeField[],
    readonly existing: Readonly<Pick<CommercialEnvelope, 'rawPayloadHash' | 'externalEventType' | 'sourceCapturedAt'>>,
    readonly incoming: Readonly<Pick<CommercialEnvelope, 'rawPayloadHash' | 'externalEventType' | 'sourceCapturedAt'>>,
  ) {
    super(`idempotency key already exists with different immutable fields: ${conflicts.join(',')}`);
    this.name = 'EnvelopeIdempotencyConflictError';
  }
}

/**
 * Tạo envelope v1 với raw payload preserved (I-12).
 * Mapping starts ở `pending` — canonical projection xảy ra sau (anti-corruption layer).
 */
export function createEnvelope(input: CreateEnvelopeInput): CommercialEnvelope {
  if (!input.workspaceId) throw new Error("workspaceId is required — envelope scope (I-09/R-01)");
  const ingestedAt = new Date().toISOString();
  return {
    envelopeId: randomUUID() as EnvelopeId,
    schemaVersion: 1,
    workspaceId: input.workspaceId,
    connection: input.connection,
    externalRecordId: input.externalRecordId,
    externalEventType: input.externalEventType,
    sourceCapturedAt: input.sourceCapturedAt,
    ingestedAt,
    rawPayload: structuredClone(input.rawPayload),
    rawPayloadHash: hashRawPayload(input.rawPayload),
    mappingStatus: 'pending',
    isSynthetic: input.isSynthetic ?? false,
    acquisitionMode: input.acquisitionMode ?? 'imported_record',
    acquisitionSource: input.acquisitionSource ?? 'manual',
  };
}

/**
 * Idempotency key = workspaceId + connection + externalRecordId (R-06 within I-09).
 * Connection names collide across tenants, so the workspace is part of the key.
 *
 * P1-1: components are encoded as a JSON tuple, not colon-joined. A raw `:` separator is
 * ambiguous — `("review-tenant", "b:inbox", "msg-1")` and `("review-tenant:b", "inbox",
 * "msg-1")` both produced `review-tenant:b:inbox:msg-1`, so one tenant could hit another's
 * idempotent record in the in-memory store. JSON encoding is injective over the string
 * triple, so distinct scopes never collapse to one key. (The PostgreSQL path is unaffected —
 * it uses a real three-column UNIQUE constraint.)
 */
export function idempotencyKey(
  envelope: Pick<CommercialEnvelope, 'workspaceId' | 'connection' | 'externalRecordId'>,
): string {
  return JSON.stringify([envelope.workspaceId, envelope.connection, envelope.externalRecordId]);
}

/**
 * Chuyển mappingStatus sang mapped — canonical projection đính kèm.
 * KHÔNG sửa rawPayload (I-12).
 */
export function markMapped(
  envelope: CommercialEnvelope,
  projection: unknown,
): CommercialEnvelope {
  if (envelope.mappingStatus === 'error') {
    throw new Error('Cannot mark mapped: envelope in error state');
  }
  return { ...envelope, mappingStatus: 'mapped', canonicalProjection: structuredClone(projection) };
}

/**
 * Ghi mapping error — raw envelope preserved (I-12), không fabricate.
 * Canonical projection không được set khi lỗi.
 */
export function markMappingError(
  envelope: CommercialEnvelope,
  errorMessage: string,
): CommercialEnvelope {
  return { ...envelope, mappingStatus: 'error', mappingError: errorMessage, canonicalProjection: undefined };
}
