import {
  createEnvelope,
  EnvelopeIdempotencyConflictError,
  hashRawPayload,
  idempotencyKey,
  type CommercialEnvelope,
} from '../../domain/envelope/envelope';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import type { PancakeReadPort } from '../../ports/pancake-read.port';
import type {
  PancakeAdapterOptions,
  PancakeCheckpoint,
  PancakeConnectionReference,
  PancakeCursor,
  PancakeDuplicate,
  PancakeOutOfOrderRecord,
  PancakeQuarantinedItem,
  PancakeRawPage,
  PancakeRawRecord,
  PancakeReadRequest,
  PancakeReadResult,
  PancakeRetryClassification,
  PancakeSurface,
  PancakeTransport,
  PancakeTransportResponse,
} from './pancake.types';

const DEFAULTS = {
  pageSize: 100,
  maxPages: 100,
  maxAttempts: 3,
  baseBackoffMs: 100,
} as const;

/**
 * Contract-first Pancake read adapter. It is intentionally disabled unless enabled
 * is explicitly true. It contains no credential or private-endpoint handling.
 * Conversations and POS cannot be mixed in one connection reference.
 */
export class PancakeReadAdapter implements PancakeReadPort {
  private readonly envelopes = new Map<string, CommercialEnvelope>();
  private readonly options: Required<Omit<PancakeAdapterOptions, 'sleep'>> & Pick<PancakeAdapterOptions, 'sleep'>;

  constructor(
    private readonly transport: PancakeTransport,
    options: PancakeAdapterOptions = {},
  ) {
    this.options = {
      enabled: options.enabled ?? false,
      pageSize: options.pageSize ?? DEFAULTS.pageSize,
      maxPages: options.maxPages ?? DEFAULTS.maxPages,
      maxAttempts: options.maxAttempts ?? DEFAULTS.maxAttempts,
      baseBackoffMs: options.baseBackoffMs ?? DEFAULTS.baseBackoffMs,
      sleep: options.sleep,
    };
    if (!Number.isInteger(this.options.pageSize) || this.options.pageSize < 1) throw new Error('pageSize must be positive');
    if (!Number.isInteger(this.options.maxPages) || this.options.maxPages < 1) throw new Error('maxPages must be positive');
    if (!Number.isInteger(this.options.maxAttempts) || this.options.maxAttempts < 1) throw new Error('maxAttempts must be positive');
  }

  async read(connection: PancakeConnectionReference, initialCursor: PancakeCursor = { value: null, pageIndex: 0 }): Promise<PancakeReadResult> {
    const initialCheckpoint = this.checkpointFor(connection);
    if (!this.options.enabled) {
      return {
        status: 'disabled', surface: connection.surface, envelopes: [], duplicates: [], outOfOrder: [], quarantined: [],
        pagesRead: 0, cursor: initialCursor, checkpoint: initialCheckpoint,
      };
    }
    validateConnection(connection);
    let cursor = initialCursor;
    let checkpoint = initialCheckpoint;
    const envelopes: CommercialEnvelope[] = [];
    const duplicates: PancakeDuplicate[] = [];
    const outOfOrder: PancakeOutOfOrderRecord[] = [];
    const quarantined: PancakeQuarantinedItem[] = [];
    let pagesRead = 0;
    let previousCapturedAt: string | undefined;

    while (pagesRead < this.options.maxPages) {
      const request: PancakeReadRequest = { connection, cursor, pageSize: this.options.pageSize };
      const response = await this.readWithRetry(request);
      const classification = classifyResponse(response);
      if (response.status < 200 || response.status >= 300) {
        quarantined.push({ reason: classification.reason === 'success' ? 'transport_error' : classification.reason as PancakeQuarantinedItem['reason'], raw: response.page, detail: UNKNOWN_SENTINEL, pageIndex: cursor.pageIndex });
        break;
      }
      const page = parsePage(response.page);
      if (!page) {
        quarantined.push({ reason: 'malformed_page', raw: response.page, detail: UNKNOWN_SENTINEL, pageIndex: cursor.pageIndex });
        break;
      }
      pagesRead += 1;
      for (const record of page.records) {
        const mapped = this.mapRecord(connection, record, cursor.pageIndex, previousCapturedAt);
        if (mapped.kind === 'quarantine') {
          quarantined.push(mapped.item);
          continue;
        }
        if (mapped.kind === 'out-of-order') outOfOrder.push(mapped.item);
        if (mapped.kind === 'duplicate') {
          duplicates.push(mapped.item);
          if (previousCapturedAt && mapped.capturedAt < previousCapturedAt) {
            outOfOrder.push({ externalRecordId: mapped.item.externalRecordId, pageIndex: mapped.item.pageIndex, capturedAt: mapped.capturedAt, previousCapturedAt });
          }
          continue;
        }
        previousCapturedAt = mapped.capturedAt;
        envelopes.push(mapped.envelope);
        checkpoint = {
          ...checkpoint,
          lastExternalRecordId: mapped.envelope.externalRecordId,
          acceptedCount: checkpoint.acceptedCount + 1,
        };
      }
      cursor = { value: page.nextCursor, pageIndex: cursor.pageIndex + 1 };
      if (page.nextCursor === null || page.records.length === 0) break;
    }
    return { status: quarantined.length > 0 ? 'unknown' : 'completed', surface: connection.surface, envelopes, duplicates, outOfOrder, quarantined, pagesRead, cursor, checkpoint };
  }

  checkpointFor(connection: PancakeConnectionReference): PancakeCheckpoint {
    const values = [...this.envelopes.values()].filter((envelope) => envelope.workspaceId === connection.workspaceId && envelope.connection === connection.connectionId);
    const last = values.at(-1);
    return { lastExternalRecordId: last?.externalRecordId ?? null, acceptedCount: values.length, duplicateCount: 0, quarantinedCount: 0 };
  }

  getByKey(workspaceId: string, connectionId: string, externalRecordId: string): CommercialEnvelope | undefined {
    return this.envelopes.get(idempotencyKey({ workspaceId, connection: connectionId, externalRecordId }));
  }

  private async readWithRetry(request: PancakeReadRequest): Promise<PancakeTransportResponse> {
    let response: PancakeTransportResponse = { status: 599 };
    for (let attempt = 0; attempt < this.options.maxAttempts; attempt += 1) {
      try {
        response = await this.transport.readPage(request);
      } catch {
        response = { status: 599 };
      }
      const classification = classifyResponse(response);
      if (classification.disposition !== 'retry') return response;
      const delay = classification.retryAfterMs ?? this.options.baseBackoffMs * 2 ** attempt;
      if (this.options.sleep) await this.options.sleep(delay);
    }
    return response;
  }

  private mapRecord(connection: PancakeConnectionReference, record: PancakeRawRecord, pageIndex: number, previousCapturedAt?: string):
    | { kind: 'mapped'; envelope: CommercialEnvelope; capturedAt: string }
    | { kind: 'duplicate'; item: PancakeDuplicate; capturedAt: string }
    | { kind: 'out-of-order'; item: PancakeOutOfOrderRecord; envelope: CommercialEnvelope; capturedAt: string }
    | { kind: 'quarantine'; item: PancakeQuarantinedItem } {
    if (typeof record.id !== 'string' || !record.id) return { kind: 'quarantine', item: { reason: 'malformed_record', raw: record, detail: UNKNOWN_SENTINEL, pageIndex } };
    if (typeof record.capturedAt !== 'string' || Number.isNaN(Date.parse(record.capturedAt))) return { kind: 'quarantine', item: { reason: 'schema_conflict', raw: record, detail: UNKNOWN_SENTINEL, pageIndex, externalRecordId: record.id } };
    const capturedAt = record.capturedAt;
    if (record.type !== undefined && typeof record.type !== 'string') return { kind: 'quarantine', item: { reason: 'schema_conflict', raw: record, detail: UNKNOWN_SENTINEL, pageIndex, externalRecordId: record.id } };
    const rawPayload = structuredClone(record.payload ?? record);
    const key = idempotencyKey({ workspaceId: connection.workspaceId, connection: connection.connectionId, externalRecordId: record.id });
    const existing = this.envelopes.get(key);
    if (existing) {
      if (existing.rawPayloadHash !== hashRawPayload(rawPayload)) return { kind: 'quarantine', item: { reason: 'changed_payload_conflict', raw: record, detail: 'IDEMPOTENCY_CONFLICT', pageIndex, externalRecordId: record.id } };
      return { kind: 'duplicate', item: { externalRecordId: record.id, pageIndex, envelopeId: existing.envelopeId }, capturedAt };
    }
    let envelope: CommercialEnvelope;
    try {
      envelope = createEnvelope({ workspaceId: connection.workspaceId, connection: connection.connectionId, externalRecordId: record.id, externalEventType: record.type ?? 'message', sourceCapturedAt: capturedAt, rawPayload, acquisitionMode: 'imported_record', acquisitionSource: 'system' });
    } catch (error) {
      if (error instanceof EnvelopeIdempotencyConflictError) throw error;
      return { kind: 'quarantine', item: { reason: 'schema_conflict', raw: record, detail: UNKNOWN_SENTINEL, pageIndex, externalRecordId: record.id } };
    }
    this.envelopes.set(key, envelope);
    if (previousCapturedAt && capturedAt < previousCapturedAt) return { kind: 'out-of-order', item: { externalRecordId: record.id, pageIndex, capturedAt, previousCapturedAt }, envelope, capturedAt };
    return { kind: 'mapped', envelope, capturedAt };
  }
}

export function classifyResponse(response: PancakeTransportResponse): PancakeRetryClassification {
  if (response.status >= 200 && response.status < 300) return { disposition: 'stop', reason: 'success', retryAfterMs: null };
  if (response.status === 401) return { disposition: 'quarantine', reason: 'auth_expired', retryAfterMs: null };
  if (response.status === 403) return { disposition: 'quarantine', reason: 'forbidden', retryAfterMs: null };
  if (response.status === 408 || response.status === 429 || response.status === 599 || response.status >= 500) {
    return { disposition: 'retry', reason: response.status === 429 ? 'rate_limited' : response.status === 599 ? 'timeout' : 'transport_error', retryAfterMs: response.retryAfterMs ?? null };
  }
  return { disposition: 'quarantine', reason: 'schema_conflict', retryAfterMs: null };
}

function parsePage(value: unknown): PancakeRawPage | null {
  if (!value || typeof value !== 'object') return null;
  const page = value as { records?: unknown; nextCursor?: unknown };
  if (!Array.isArray(page.records) || !(page.nextCursor === null || typeof page.nextCursor === 'string')) return null;
  if (!page.records.every((record) => record && typeof record === 'object' && !Array.isArray(record))) return null;
  return { records: page.records as PancakeRawRecord[], nextCursor: page.nextCursor };
}

function validateConnection(connection: PancakeConnectionReference): void {
  if (!connection.workspaceId) throw new Error('workspaceId is required');
  if (!connection.connectionId) throw new Error('connectionId is required');
  if (connection.surface !== 'conversations' && connection.surface !== 'pos') throw new Error('unsupported_surface');
}
