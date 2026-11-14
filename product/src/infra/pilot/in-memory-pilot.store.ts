import { Inject, Injectable } from '@nestjs/common';
import { AuditStore, compareAuditRecords, rollbackAuditAppend } from '../audit/audit-store';
import type { AuditRecord } from '../../ports/audit';
import { idempotencyKey, type CommercialEnvelope } from '../../domain/envelope/envelope';
import { decodePilotQueueCursor, encodePilotQueueCursor, isAfterPilotQueueCursor, PilotStaleVersionError, type AuditHistoryEntry, type PilotLoopState, type PilotQueueItem, type PilotQueuePage, type PilotQueueQuery } from '../../ports/pilot-loop.types';
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

  async queue(query: PilotQueueQuery): Promise<PilotQueuePage> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const cursor = decodePilotQueueCursor(query, query.cursor);
    const rows: PilotQueueItem[] = [];
    for (const state of this.cases.values()) {
      if (state.lead.workspaceId !== query.workspaceId) continue;
      if (!canQueueActor(state, query)) continue;
      for (const work of state.workItems) {
        if (query.status && work.status !== query.status) continue;
        if (query.ownerUserId && state.ownerUserId !== query.ownerUserId) continue;
        if (query.recipientUserId && work.actor !== query.recipientUserId) continue;
        if (query.dueBefore && (!work.dueAt || work.dueAt >= query.dueBefore)) continue;
        if (query.dueAfter && (!work.dueAt || work.dueAt <= query.dueAfter)) continue;
        rows.push(toQueueItem(state, work));
      }
    }
    rows.sort(compareQueueItems);
    const page = rows.filter((item) => isAfterPilotQueueCursor(item, cursor)).slice(0, limit);
    const last = page.at(-1);
    const hasMore = last !== undefined && rows.some((item) => isAfterPilotQueueCursor(item, {
      version: 1,
      scope: JSON.stringify([
        query.workspaceId, query.actorId, query.actorRole, query.status ?? null,
        query.dueBefore ?? null, query.dueAfter ?? null, query.ownerUserId ?? null, query.recipientUserId ?? null,
      ]),
      dueAt: last.dueAt ?? null,
      recordedAt: last.recordedAt,
      id: last.id,
    }));
    return { items: page, ...(hasMore && last ? { nextCursor: encodePilotQueueCursor(query, last) } : {}) };
  }

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

function canQueueActor(state: PilotLoopState, query: PilotQueueQuery): boolean {
  if (query.actorRole === 'admin' || query.actorRole === 'manager') return true;
  return state.ownerUserId === query.actorId || state.workItems.some((w) => w.actor === query.actorId && ['proposed', 'accepted', 'open', 'awaiting-external'].includes(w.status));
}

function toQueueItem(state: PilotLoopState, work: PilotLoopState['workItems'][number]): PilotQueueItem {
  return {
    id: work.id, leadId: work.leadId, workspaceId: work.workspaceId, action: work.action,
    responsibleParty: work.responsibleParty, origin: work.origin, status: work.status,
    completionEvidence: work.completionEvidence, occurredAt: work.occurredAt, dueAt: work.dueAt,
    recordedAt: work.recordedAt, supersedesWorkId: work.supersedesWorkId, actor: work.actor,
    lead: { status: state.lead.status, displayName: state.lead.displayName },
    ...(state.handoffRecipient ? { handoff: { recipientUserId: state.handoffRecipient } } : {}),
  };
}

function compareQueueItems(a: PilotQueueItem, b: PilotQueueItem): number {
  return (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿') || a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id);
}
