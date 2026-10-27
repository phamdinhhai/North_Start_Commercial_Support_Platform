import { Injectable } from '@nestjs/common';
import { AuditStore, type AuditRecord } from '../../infra/audit/audit-store';
import type { CommercialEnvelope } from '../../domain/envelope/envelope';
import type { AuditHistoryEntry, PilotLoopState } from './pilot.types';

function evidenceRecordOf(env: CommercialEnvelope): EvidenceRefRecord {
  const sp = typeof env.rawPayload === 'object' && env.rawPayload !== null ? (env.rawPayload as { speaker?: unknown }).speaker : undefined;
  return {
    envelopeId: env.envelopeId,
    workspaceId: env.workspaceId,
    rawPayloadHash: env.rawPayloadHash,
    sourceCapturedAt: env.sourceCapturedAt,
    speaker: typeof sp === 'string' ? sp : null,
  };
}

/**
 * Minimal, read-only view of stored raw evidence — enough to prove a pointer resolves
 * (P1-4) AND to judge what kind of record it is (P1-4b: the customer's intake question can
 * never be proof that a staff action happened). Deliberately NOT the full envelope: a caller
 * must never learn another tenant's payload through the validation path, only that the id does
 * not resolve in scope. `speaker` is the coarse author role captured at ingest, not message text.
 */
export interface EvidenceRefRecord {
  readonly envelopeId: string;
  readonly workspaceId: string;
  readonly rawPayloadHash: string;
  readonly sourceCapturedAt: string;
  /** Author role of the referenced record ('customer' | 'staff'), or null when not recorded. */
  readonly speaker: string | null;
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
  /** Entity ids known to belong to each lead — accumulates across saves (P1-5). */
  private readonly caseEntities = new Map<string, Set<string>>();
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
      this.evidence.set(state.envelope.envelopeId, evidenceRecordOf(state.envelope));
    }
    // Track which entity ids belong to THIS case (lead + every entity its own mutations
    // touched) so history can never serve another case's trail (P1-5). Accumulated across
    // saves on purpose: `state.handoff` holds only the LATEST handoff, but an earlier
    // handoff's audit records still belong to this lead.
    const members = this.caseEntities.get(state.lead.id) ?? new Set<string>();
    members.add(state.lead.id);
    for (const a of audits) if (a.entityId) members.add(a.entityId);
    this.caseEntities.set(state.lead.id, members);
    this.cases.set(state.lead.id, state);
  }

  /**
   * Lead-scoped audit view (P1-5, I-05 + I-09).
   *
   * Membership is resolved through the case's OWN entity ids (lead, its handoffs, work items
   * and outcomes) accumulated in `caseEntities`, never through "everything in this workspace
   * that isn't the lead" — the old filter leaked other leads' entire trails (their contexts,
   * reasons and actors) into one case's history. Unknown lead → empty, never a full dump.
   */
  async history(leadId: string): Promise<readonly AuditHistoryEntry[]> {
    const members = this.caseEntities.get(leadId);
    if (!members || members.size === 0) return [];
    return this.audit
      .all()
      .filter((r) => members.has(r.entityId))
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
