import { createHash, randomUUID } from 'node:crypto';

/** Envelope ID — unique per ingest. */
export type EnvelopeId = string & { readonly __brand: 'EnvelopeId' };

/** Mapping status của envelope (C-11, R-05). */
export type MappingStatus = 'pending' | 'mapped' | 'error';

/**
 * Commercial Envelope v1 (C-11, R-05, I-11, I-12).
 *
 * Contract cho mọi inbound adapter (manual/synthetic/pancake):
 * - `rawPayload` immutable — I-12, không bao giờ sửa sau khi tạo.
 * - `rawPayloadHash` = SHA-256(JSON(rawPayload)) — verifies integrity.
 * - `mappingStatus` = pending → mapped/error; lỗi mapping giữ nguyên raw, không fabricate canonical fields.
 * - Idempotency key: `connection` + `externalRecordId` (R-06).
 */
export interface CommercialEnvelope {
  readonly envelopeId: EnvelopeId;
  readonly schemaVersion: 1;
  readonly connection: string; // workspace-scoped connection ID
  readonly externalRecordId: string; // immutable — idempotency key part 1
  readonly externalEventType: string; // message | conversation | customer | note | order
  readonly sourceCapturedAt: string; // ISO 8601
  readonly ingestedAt: string; // ISO 8601
  readonly rawPayload: unknown; // immutable (I-12)
  readonly rawPayloadHash: string; // SHA-256 hex
  readonly mappingStatus: MappingStatus;
  readonly mappingError?: string;
  readonly canonicalProjection?: unknown;
  readonly isSynthetic: boolean; // I-12 segregation (R-28)
}

export interface CreateEnvelopeInput {
  readonly connection: string;
  readonly externalRecordId: string;
  readonly externalEventType: string;
  readonly sourceCapturedAt: string;
  readonly rawPayload: unknown;
  readonly isSynthetic?: boolean;
}

/** SHA-256 hex digest của JSON-serialized payload (stable ordering). */
export function hashRawPayload(rawPayload: unknown): string {
  const canonical = JSON.stringify(rawPayload, Object.keys(rawPayload ?? {}).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Tạo envelope v1 với raw payload preserved (I-12).
 * Mapping starts ở `pending` — canonical projection xảy ra sau (anti-corruption layer).
 */
export function createEnvelope(input: CreateEnvelopeInput): CommercialEnvelope {
  const ingestedAt = new Date().toISOString();
  return {
    envelopeId: randomUUID() as EnvelopeId,
    schemaVersion: 1,
    connection: input.connection,
    externalRecordId: input.externalRecordId,
    externalEventType: input.externalEventType,
    sourceCapturedAt: input.sourceCapturedAt,
    ingestedAt,
    rawPayload: structuredClone(input.rawPayload),
    rawPayloadHash: hashRawPayload(input.rawPayload),
    mappingStatus: 'pending',
    isSynthetic: input.isSynthetic ?? false,
  };
}

/** Idempotency key = connection + externalRecordId (R-06). */
export function idempotencyKey(envelope: Pick<CommercialEnvelope, 'connection' | 'externalRecordId'>): string {
  return `${envelope.connection}:${envelope.externalRecordId}`;
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
