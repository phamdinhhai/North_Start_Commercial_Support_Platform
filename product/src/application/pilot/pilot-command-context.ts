import { hashRawPayload, idempotencyKey, EnvelopeIdempotencyConflictError } from '../../domain/envelope/envelope';
import { transitionLead } from '../../domain/lead/lead-state';
import type { Lead, LeadId } from '../../domain/lead/lead';
import type { ManualIngestPort } from '../../ports/manual-ingest.port';
import type { AuditDraft, AuditHistoryEntry, PilotLoopState, ScenarioInput } from '../../ports/pilot-loop.types';
import { PilotDomainError } from '../../ports/pilot-loop.types';
import type { PilotLoopStore } from '../../ports/pilot-loop.store';

/** Shared application-boundary services for pilot commands. */
export class PilotCommandContext {
  constructor(
    readonly store: PilotLoopStore,
    readonly adapter: ManualIngestPort,
  ) {}

  transition(lead: Lead, input: { readonly to: Lead['status']; readonly actor: string; readonly reason: string }): Lead {
    try {
      return transitionLead(lead, input).lead;
    } catch (err) {
      if (err instanceof Error && /frozen boundary/.test(err.message)) {
        throw new PilotDomainError('CE1_BOUNDARY', 422, `transition ${lead.status} → ${input.to} is outside the CE-1 hypothesis (ADR-001)`);
      }
      throw err;
    }
  }

  async evidence(state: PilotLoopState, pointer: string, action: string, requireRelation = true) {
    const record = await this.store.loadEvidence(pointer);
    if (!record) throw new PilotDomainError('EVIDENCE_NOT_FOUND', 422, `evidence pointer "${pointer}" does not resolve to stored raw evidence — ${action} needs a real envelope reference (I-12)`);
    if (record.workspaceId !== state.lead.workspaceId) {
      throw new PilotDomainError('EVIDENCE_OUT_OF_SCOPE', 403, `evidence ${pointer} belongs to another workspace — it cannot evidence this case (I-09)`);
    }
    const related = pointer === state.sourceEnvelopeId || state.handoff?.evidenceRefs.some((r) => r.envelopeId === pointer) === true || state.workItems.some((w) => w.evidenceRef === pointer);
    if (requireRelation && !related) {
      throw new PilotDomainError('EVIDENCE_NOT_RELATED', 422, `evidence ${pointer} exists in this workspace but is not referenced by this lead, its handoff or its work items — it cannot evidence ${action}`);
    }
    return record;
  }

  async require(leadId: LeadId): Promise<PilotLoopState> {
    const state = await this.store.load(leadId);
    if (!state) throw new PilotDomainError('LEAD_NOT_FOUND', 404, 'lead not found in pilot loop');
    return state;
  }

  async persist(state: PilotLoopState, audits: readonly AuditDraft[], options?: { readonly checkSourceCapturedAt?: boolean }): Promise<PilotLoopState> {
    const saved = await this.store.save(state, audits, options);
    if (saved.version !== undefined) Object.assign(state, { version: saved.version });
    return saved;
  }

  assertIngestMatch(state: PilotLoopState, input: ScenarioInput): void {
    const env = state.envelope;
    if (!env) throw new Error('pilot ingest command has no persisted envelope');
    const incomingHash = hashRawPayload({ utterance: input.utterance, speaker: input.speaker,
      ...(input.occurredAt === 'unknown' ? { occurredAt: 'unknown' } : {}) });
    const conflicts = [
      ...(env.rawPayloadHash !== incomingHash ? ['rawPayloadHash'] : []),
      ...(env.externalEventType !== 'message' ? ['externalEventType'] : []),
      ...(input.occurredAt !== undefined && input.occurredAt !== 'unknown' && env.sourceCapturedAt !== input.occurredAt &&
        (!Number.isFinite(Date.parse(env.sourceCapturedAt)) || !Number.isFinite(Date.parse(input.occurredAt)) ||
          Date.parse(env.sourceCapturedAt) !== Date.parse(input.occurredAt)) ? ['sourceCapturedAt'] : []),
    ];
    if (conflicts.length) {
      throw new PilotDomainError('IDEMPOTENCY_CONFLICT', 409,
        `idempotency key already exists with different immutable fields: ${conflicts.join(',')}`,
        { key: idempotencyKey(env), conflicts,
          existing: { rawPayloadHash: env.rawPayloadHash, externalEventType: env.externalEventType, sourceCapturedAt: env.sourceCapturedAt },
          incoming: { rawPayloadHash: incomingHash, externalEventType: 'message', sourceCapturedAt: input.occurredAt ?? env.sourceCapturedAt } });
    }
  }

  static isIdempotencyConflict(error: unknown): error is EnvelopeIdempotencyConflictError {
    return error instanceof EnvelopeIdempotencyConflictError;
  }
}

export type PilotContext = PilotCommandContext;
export type { AuditHistoryEntry };
