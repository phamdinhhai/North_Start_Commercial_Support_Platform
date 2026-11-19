import type { PilotLeadQuery, PilotLeadPage } from './pilot-closure';
import { EnvelopeIdempotencyConflictError, idempotencyKey, canonicalizePayload, type CommercialEnvelope } from '../domain/envelope/envelope';
import type { AuditRecord } from './audit';
import type { AuditHistoryEntry, PilotLoopState, PilotQueuePage, PilotQueueQuery } from './pilot-loop.types';

export interface EvidenceRefRecord {
  readonly isSynthetic?: boolean;
  readonly rawPayloadDigest?: CommercialEnvelope['rawPayloadDigest'];
  readonly envelopeId: string;
  readonly workspaceId: string;
  readonly rawPayloadHash: string;
  readonly sourceCapturedAt: string;
  readonly speaker: string | null;
  readonly acquisitionMode: 'automatic_observation' | 'imported_record';
  readonly acquisitionSource: 'system' | 'manual';
}

export interface PilotLoopStore {
  leads(query: PilotLeadQuery): Promise<PilotLeadPage>;
  appendAccess(leadId: string, actor: string): Promise<void>;
  load(leadId: string): Promise<PilotLoopState | undefined>;
  loadIngest(key: Pick<CommercialEnvelope, 'workspaceId' | 'connection' | 'externalRecordId'>): Promise<PilotLoopState | undefined>;
  save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[], options?: { readonly checkSourceCapturedAt?: boolean }): Promise<PilotLoopState>;
  history(leadId: string): Promise<readonly AuditHistoryEntry[]>;
  loadEvidence(envelopeId: string): Promise<EvidenceRefRecord | undefined>;
  queue(query: PilotQueueQuery): Promise<PilotQueuePage>;
}

export function assertSameEnvelope(
  existing: CommercialEnvelope,
  incoming: CommercialEnvelope,
  options: { readonly checkSourceCapturedAt?: boolean } = {},
): void {
  const conflicts = [
    ...(canonicalizePayload(existing.rawPayload) !== canonicalizePayload(incoming.rawPayload) ? ['rawPayloadHash' as const] : []),
    ...(existing.isSynthetic !== incoming.isSynthetic ? ['externalEventType' as const] : []),
    ...(existing.externalEventType !== incoming.externalEventType ? ['externalEventType' as const] : []),
    ...(options.checkSourceCapturedAt !== false && existing.sourceCapturedAt !== incoming.sourceCapturedAt ? ['sourceCapturedAt' as const] : []),
  ];
  if (conflicts.length) {
    throw new EnvelopeIdempotencyConflictError(idempotencyKey(incoming), conflicts, existing, incoming);
  }
}

export const PILOT_STORE = Symbol('PILOT_STORE');
