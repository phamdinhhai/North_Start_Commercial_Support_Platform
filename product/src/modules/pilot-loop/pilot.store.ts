import { Injectable } from '@nestjs/common';
import { AuditStore, type AuditRecord } from '../../infra/audit/audit-store';
import type { AuditHistoryEntry, PilotLoopState } from './pilot.types';

/**
 * Minimal, read-only view of stored raw evidence — enough to prove a pointer resolves
 * (P1-4). Deliberately NOT the full envelope: a caller must never learn another tenant's
 * payload through the validation path, only that the id does not resolve in scope.
 */
export interface EvidenceRefRecord {
  readonly envelopeId: string;
  readonly workspaceId: string;
  readonly rawPayloadHash: string;
  readonly sourceCapturedAt: string;
}

/**
 * Persistence port for the pilot loop (C-03/C-06).
 *
 * `save` receives the FULL next state plus every audit record produced by the
 * mutation, and must apply them atomically (QA-35: mutation and audit are
 * consistent or neither is). The service never writes state without its audit.
 * `history` returns the append-only audit trail for a lead (I-05).
 * `loadEvidence` resolves an evidence pointer against DURABLE storage, so the check
 * still works after a process restart (the adapter's in-memory map does not survive it).
 */
export interface PilotLoopStore {
  load(leadId: string): Promise<PilotLoopState | undefined>;
  save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[]): Promise<void>;
  history(leadId: string): Promise<readonly AuditHistoryEntry[]>;
  loadEvidence(envelopeId: string): Promise<EvidenceRefRecord | undefined>;
}

export const PILOT_STORE = Symbol('PILOT_STORE');

/**
 * In-memory store — demo/synthetic path (PH1 pattern) and unit tests.
 * NOT durable: application restart loses the case. The PG-backed store
 * (`PgPilotStore`) is the durability path; `scripts/pilot-smoke.sh` runs against it.
 */
@Injectable()
export class InMemoryPilotStore implements PilotLoopStore {
  private readonly cases = new Map<string, PilotLoopState>();
  /** Evidence index (P1-4): envelopeId → workspace scope + raw hash, filled on save (I-12). */
  private readonly evidence = new Map<string, EvidenceRefRecord>();

  constructor(private readonly audit: AuditStore) {}

  async load(leadId: string): Promise<PilotLoopState | undefined> {
    return this.cases.get(leadId);
  }

  async loadEvidence(envelopeId: string): Promise<EvidenceRefRecord | undefined> {
    return this.evidence.get(envelopeId);
  }

  async save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[]): Promise<void> {
    for (const a of audits) this.audit.append(a);
    if (state.envelope) {
      this.evidence.set(state.envelope.envelopeId, {
        envelopeId: state.envelope.envelopeId,
        workspaceId: state.envelope.workspaceId,
        rawPayloadHash: state.envelope.rawPayloadHash,
        sourceCapturedAt: state.envelope.sourceCapturedAt,
      });
    }
    this.cases.set(state.lead.id, state);
  }

  /** In-memory audit view (append order, I-05). */
  async history(leadId: string): Promise<readonly AuditHistoryEntry[]> {
    const leadRecords = this.audit.getByEntity('lead', leadId);
    const extra = this.audit.all().filter((r) => r.workspaceId === (this.cases.get(leadId)?.lead.workspaceId ?? '') && r.entityId !== leadId);
    return [...leadRecords, ...extra]
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        actor: r.actor,
        eventType: r.eventType ?? '',
        previousValue: r.previousValue ?? null,
        newValue: r.newValue,
        reason: r.reason ?? null,
        timestamp: r.timestamp,
        supersedesRecordId: r.supersedesRecordId ?? null,
      }));
  }
}
