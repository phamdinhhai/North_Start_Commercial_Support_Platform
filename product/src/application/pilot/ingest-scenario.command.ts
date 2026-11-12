import { createLead, type Lead } from '../../domain/lead/lead';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import type { ScenarioInput, PilotLoopState } from '../../ports/pilot-loop.types';
import { PilotDomainError } from '../../ports/pilot-loop.types';
import { PilotCommandContext } from './pilot-command-context';

/** Intake orchestration: immutable envelope first, then a lead aggregate. */
export class IngestScenarioCommand {
  constructor(private readonly context: PilotCommandContext) {}

  async execute(input: ScenarioInput): Promise<PilotLoopState> {
    if (!input.workspaceId) throw new PilotDomainError('INPUT_REQUIRED', 400, 'workspaceId is required');
    if (!input.utterance) throw new PilotDomainError('INPUT_REQUIRED', 400, 'utterance is required');
    const key = { workspaceId: input.workspaceId, connection: input.connection, externalRecordId: input.externalRecordId };
    const existing = await this.context.store.loadIngest(key);
    if (existing) {
      this.context.assertIngestMatch(existing, input);
      return existing;
    }

    let envelope;
    try {
      envelope = this.context.adapter.ingest({
        workspaceId: input.workspaceId,
        connection: input.connection,
        externalRecordId: input.externalRecordId,
        externalEventType: 'message',
        sourceCapturedAt: input.occurredAt === undefined || input.occurredAt === UNKNOWN_SENTINEL
          ? undefined
          : new Date(input.occurredAt).toISOString(),
        rawPayload: { utterance: input.utterance, speaker: input.speaker,
          ...(input.occurredAt === UNKNOWN_SENTINEL ? { occurredAt: UNKNOWN_SENTINEL } : {}) },
        isSynthetic: input.isSynthetic ?? true,
        acquisitionMode: 'imported_record',
        acquisitionSource: 'manual',
      });
    } catch (error) {
      if (PilotCommandContext.isIdempotencyConflict(error)) {
        const winner = await this.context.store.loadIngest(key);
        if (winner) {
          this.context.assertIngestMatch(winner, input);
          return winner;
        }
        throw new PilotDomainError('IDEMPOTENCY_CONFLICT', 409, error.message, {
          key: error.key, conflicts: error.conflicts, existing: error.existing, incoming: error.incoming,
        });
      }
      throw error;
    }

    const lead: Lead = createLead({
      workspaceId: input.workspaceId,
      displayName: input.displayName,
      conversationSource: input.conversationSource,
      attribution: UNKNOWN_SENTINEL,
    });
    const state: PilotLoopState = {
      lead,
      workItems: [],
      outcomes: [],
      ownerUserId: input.ownerUserId ?? (input.speaker === 'staff' ? 'staff:intake' : 'operator:intake'),
      sourceEnvelopeId: envelope.envelopeId,
      envelope,
    };
    let persistedState = state;
    try {
      persistedState = await this.context.persist(state, [
        {
          entityType: 'lead', entityId: lead.id, workspaceId: lead.workspaceId, actor: state.ownerUserId!,
          newValue: JSON.stringify({ status: lead.status, envelopeId: envelope.envelopeId }),
          reason: 'scenario ingested', eventType: 'lead_created',
        },
      ], { checkSourceCapturedAt: input.occurredAt !== undefined && input.occurredAt !== UNKNOWN_SENTINEL });
    } catch (error) {
      if (PilotCommandContext.isIdempotencyConflict(error)) {
        const winner = await this.context.store.loadIngest(key);
        if (winner) {
          this.context.assertIngestMatch(winner, input);
          return winner;
        }
        throw new PilotDomainError('IDEMPOTENCY_CONFLICT', 409, error.message, {
          key: error.key, conflicts: error.conflicts, existing: error.existing, incoming: error.incoming,
        });
      }
      throw error;
    }
    this.context.assertIngestMatch(persistedState, input);
    return persistedState;
  }
}
