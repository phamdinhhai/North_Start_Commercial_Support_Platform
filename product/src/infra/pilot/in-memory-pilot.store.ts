import { Inject, Injectable } from '@nestjs/common';
import { AuditStore, compareAuditRecords, rollbackAuditAppend } from '../audit/audit-store';
import type { AuditRecord } from '../../ports/audit';
import { idempotencyKey, type CommercialEnvelope } from '../../domain/envelope/envelope';
import { PilotStaleVersionError, type AuditHistoryEntry, type PilotLoopState } from '../../ports/pilot-loop.types';
import { assertSameEnvelope, type EvidenceRefRecord, type PilotLoopStore } from '../../ports/pilot-loop.store';

function evidenceRecordOf(env: CommercialEnvelope): EvidenceRefRecord {
  const sp = typeof env.rawPayload === 'object' && env.rawPayload !== null ? (env.rawPayload as { speaker?: unknown }).speaker : undefined;
  return {
    envelopeId: env.envelopeId,
    workspaceId: env.workspaceId,
    rawPayloadHash: env.rawPayloadHash,
    sourceCapturedAt: env.sourceCapturedAt,
    speaker: typeof sp === 'string' ? sp : null,
    acquisitionMode: env.acquisitionMode,
    acquisitionSource: env.acquisitionSource,
  };
}

@Injectable()
export class InMemoryPilotStore implements PilotLoopStore {
  private readonly cases = new Map<string, PilotLoopState>();
  private readonly ingestCommands = new Map<string, string>();
  private readonly caseEntities = new Map<string, Set<string>>();
  private readonly evidence = new Map<string, EvidenceRefRecord>();

  constructor(@Inject(AuditStore) private readonly audit: AuditStore) {}

  async load(leadId: string): Promise<PilotLoopState | undefined> { return this.cases.get(leadId); }
  async loadEvidence(envelopeId: string): Promise<EvidenceRefRecord | undefined> { return this.evidence.get(envelopeId); }

  async loadIngest(key: Pick<CommercialEnvelope, 'workspaceId' | 'connection' | 'externalRecordId'>): Promise<PilotLoopState | undefined> {
    const leadId = this.ingestCommands.get(idempotencyKey(key));
    if (!leadId) return undefined;
    const state = this.cases.get(leadId);
    if (!state?.envelope) throw new Error('pilot ingest command references a missing envelope');
    return state;
  }

  async save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[], options: { readonly checkSourceCapturedAt?: boolean } = {}): Promise<PilotLoopState> {
    const current = this.cases.get(state.lead.id);
    const ingestKey = state.version === undefined && state.envelope ? idempotencyKey(state.envelope) : undefined;
    if (ingestKey) {
      const existingId = this.ingestCommands.get(ingestKey);
      if (existingId) {
        const existing = this.cases.get(existingId);
        if (!existing?.envelope) throw new Error('pilot ingest command references a missing envelope');
        assertSameEnvelope(existing.envelope, state.envelope!, options);
        return existing;
      }
    }
    const expected = state.version;
    const actual = current?.version;
    if ((current === undefined && expected !== undefined) || (current !== undefined && expected !== actual)) {
      throw new PilotStaleVersionError(state.lead.id, expected, actual ?? 0);
    }
    const appended: AuditRecord[] = [];
    try {
      for (const a of audits) appended.push(this.audit.append(a));
    } catch (error) {
      rollbackAuditAppend(this.audit, appended);
      throw error;
    }
    if (state.envelope) this.evidence.set(state.envelope.envelopeId, evidenceRecordOf(state.envelope));
    const members = this.caseEntities.get(state.lead.id) ?? new Set<string>();
    members.add(state.lead.id);
    for (const a of audits) if (a.entityId) members.add(a.entityId);
    this.caseEntities.set(state.lead.id, members);
    const committedVersion = (actual ?? 0) + 1;
    Object.assign(state, { version: committedVersion });
    this.cases.set(state.lead.id, state);
    if (ingestKey) this.ingestCommands.set(ingestKey, state.lead.id);
    return state;
  }

  async history(leadId: string): Promise<readonly AuditHistoryEntry[]> {
    const members = this.caseEntities.get(leadId);
    if (!members || members.size === 0) return [];
    return this.audit.all()
      .filter((r) => r.workspaceId === this.cases.get(leadId)?.lead.workspaceId && members.has(r.entityId))
      .sort(compareAuditRecords)
      .map((r) => ({
        id: r.id,
        entityType: r.entityType,
        entityId: r.entityId,
        workspaceId: r.workspaceId,
        actor: r.actor,
        eventType: r.eventType ?? '',
        previousValue: r.previousValue ?? null,
        newValue: r.newValue,
        reason: r.reason ?? null,
        timestamp: r.timestamp,
        supersedesRecordId: r.supersedesRecordId ?? null,
        metadata: { trust: 'recorded' as const, provenance: 'audit_record' as const, unknown: ['business_truth', 'runtime_causality'] as const },
      }));
  }
}
