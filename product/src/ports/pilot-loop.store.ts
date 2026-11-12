import { EnvelopeIdempotencyConflictError, idempotencyKey, type CommercialEnvelope } from '../domain/envelope/envelope';
import type { AuditRecord } from './audit';
import type { AuditHistoryEntry, PilotLoopState } from './pilot-loop.types';

export interface EvidenceRefRecord {
  readonly envelopeId: string;
  readonly workspaceId: string;
  readonly rawPayloadHash: string;
  readonly sourceCapturedAt: string;
  readonly speaker: string | null;
  readonly acquisitionMode: 'automatic_observation' | 'imported_record';
  readonly acquisitionSource: 'system' | 'manual';
}

export interface PilotLoopStore {
  load(leadId: string): Promise<PilotLoopState | undefined>;
  loadIngest(key: Pick<CommercialEnvelope, 'workspaceId' | 'connection' | 'externalRecordId'>): Promise<PilotLoopState | undefined>;
  save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[], options?: { readonly checkSourceCapturedAt?: boolean }): Promise<PilotLoopState>;
  history(leadId: string): Promise<readonly AuditHistoryEntry[]>;
  loadEvidence(envelopeId: string): Promise<EvidenceRefRecord | undefined>;
}

export function assertSameEnvelope(
  existing: CommercialEnvelope,
  incoming: CommercialEnvelope,
  options: { readonly checkSourceCapturedAt?: boolean } = {},
): void {
  const conflicts = [
    ...(existing.rawPayloadHash !== incoming.rawPayloadHash ? ['rawPayloadHash' as const] : []),
    ...(existing.externalEventType !== incoming.externalEventType ? ['externalEventType' as const] : []),
    ...(options.checkSourceCapturedAt !== false && existing.sourceCapturedAt !== incoming.sourceCapturedAt ? ['sourceCapturedAt' as const] : []),
  ];
  if (conflicts.length) {
    throw new EnvelopeIdempotencyConflictError(idempotencyKey(incoming), conflicts, existing, incoming);
  }
}

export const PILOT_STORE = Symbol('PILOT_STORE');
