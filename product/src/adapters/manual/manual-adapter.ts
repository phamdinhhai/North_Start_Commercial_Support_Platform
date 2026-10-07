import { createEnvelope, idempotencyKey, type CommercialEnvelope } from '../../domain/envelope/envelope';

/** Input cho manual ingest (R-04, R-05, I-12). */
export interface ManualIngestInput {
  /** Authenticated workspace (I-09/R-01) — part of the idempotency scope. */
  readonly workspaceId: string;
  readonly connection: string;
  readonly externalRecordId: string;
  readonly externalEventType: string; // message | conversation | note | ...
  readonly rawPayload: unknown;
  readonly sourceCapturedAt?: string;
  readonly isSynthetic?: boolean;
}

/**
 * Manual adapter (C-05, C-11, P0 fallback).
 * - Tạo envelope v1 cho manual paste / synthetic demo.
 * - Idempotent: workspaceId + connection + externalRecordId (R-06 within I-09) —
 *   duplicate trong cùng workspace trả envelope cũ; KHÁC workspace là envelope
 *   riêng (P1-1: connection name từ hệ thống ngoài có thể trùng giữa các tenant).
 * - Raw payload immutable (I-12).
 */
export class ManualAdapter {
  private readonly store = new Map<string, CommercialEnvelope>();

  ingest(input: ManualIngestInput): CommercialEnvelope {
    if (!input.workspaceId) throw new Error('workspaceId is required — envelope scope (I-09/R-01)');
    if (!input.connection) throw new Error('connection is required');
    if (!input.externalRecordId) throw new Error('externalRecordId is required');
    if (!input.rawPayload) throw new Error('rawPayload is required');

    const key = idempotencyKey(input);
    const existing = this.store.get(key);
    if (existing) return existing;

    const envelope = createEnvelope({
      workspaceId: input.workspaceId,
      connection: input.connection,
      externalRecordId: input.externalRecordId,
      externalEventType: input.externalEventType ?? 'message',
      sourceCapturedAt: input.sourceCapturedAt ?? new Date().toISOString(),
      rawPayload: input.rawPayload,
      isSynthetic: input.isSynthetic ?? false,
    });

    this.store.set(key, envelope);
    return envelope;
  }

  /** Lấy envelope theo idempotency key (workspace-scoped) — dùng cho test/verify. */
  getByKey(workspaceId: string, connection: string, externalRecordId: string): CommercialEnvelope | undefined {
    return this.store.get(idempotencyKey({ workspaceId, connection, externalRecordId }));
  }

  /** Lấy envelope theo envelopeId. */
  getByEnvelopeId(envelopeId: string): CommercialEnvelope | undefined {
    for (const env of this.store.values()) {
      if (env.envelopeId === envelopeId) return env;
    }
    return undefined;
  }

  count(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
