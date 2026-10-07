import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { PostgresService, type SqlExecutor } from '../../infra/postgres/postgres.service';
import type { AuditRecord } from '../../infra/audit/audit-store';
import type { Lead, LeadId, LeadStatus } from '../../domain/lead/lead';
import type { Handoff, HandoffId } from '../../domain/handoff/handoff';
import type { Outcome, OutcomeId, OutcomeValue, OutcomeAcquisitionMode } from '../../domain/outcome/outcome';
import type { CommercialEnvelope } from '../../domain/envelope/envelope';
import { UNKNOWN_SENTINEL, type UnknownState } from '../../domain/unknown-states/unknown-states';
import type {
  CompletionEvidence,
  PilotLoopState,
  ResponsibleParty,
  WorkItem,
  WorkOrigin,
  WorkStatus,
} from './pilot.types';
import type { AuditHistoryEntry } from './pilot.types';
import type { PilotLoopStore } from './pilot.store';

/**
 * Durable pilot-loop store (C-03, C-06, R-18) — PostgreSQL-backed.
 *
 * `save` runs ONE transaction: envelope insert (I-12 append), lead upsert
 * (version bump), handoff/outcome/work-item appends (immutable — ON CONFLICT
 * DO NOTHING), then audit appends. Any failure rolls back everything, so a
 * mutation is never persisted without its audit trail (QA-35).
 *
 * Durability contract proven by `scripts/pilot-smoke.sh` steps 12–14:
 * create → handle over HTTP → restart the process → read back full state+history.
 */
@Injectable()
export class PgPilotStore implements PilotLoopStore {
  constructor(private readonly db: PostgresService) {}

  async load(leadId: string): Promise<PilotLoopState | undefined> {
    const leadRes = await this.db.query<LeadDbRow>(
      `SELECT id, workspace_id, customer_id, conversation_source, acquisition_lineage,
              attribution, status, display_name, created_at, owner_user_id, source_envelope_id
         FROM lead WHERE id = $1`,
      [leadId],
    );
    const leadRow = leadRes.rows[0];
    if (!leadRow) return undefined;

    const [handoffs, outcomes, works, envelopes] = await Promise.all([
      this.db.query<HandoffDbRow>(
        `SELECT id, lead_id, workspace_id, context, evidence_refs, proposed_next_action, created_at, recipient_user_id
           FROM handoff WHERE lead_id = $1 ORDER BY created_at`,
        [leadId],
      ),
      this.db.query<OutcomeDbRow>(
        `SELECT id, lead_id, workspace_id, value, acquisition_mode, assertion_status, actor, timestamp, reason, supersedes_outcome_id
           FROM outcome WHERE lead_id = $1 ORDER BY timestamp`,
        [leadId],
      ),
      this.db.query<WorkDbRow>(
        `SELECT id, lead_id, workspace_id, action, responsible_party, origin, status, completion_evidence,
                occurred_at, due_at, evidence_ref, recorded_at, supersedes_work_id, actor, reason
           FROM pilot_work_item WHERE lead_id = $1 ORDER BY recorded_at`,
        [leadId],
      ),
      leadRow.source_envelope_id
        ? this.db.query<EnvelopeDbRow>(
            `SELECT id, workspace_id, raw_payload, raw_payload_hash, source_captured_at, ingested_at, connection,
                    external_record_id, external_event_type, is_synthetic
               FROM commercial_envelope WHERE id = $1`,
            [leadRow.source_envelope_id],
          )
        : Promise.resolve({ rows: [] as EnvelopeDbRow[] }),
    ]);

    const latestHandoff = handoffs.rows.at(-1);
    return {
      lead: toLead(leadRow),
      handoff: latestHandoff ? toHandoff(latestHandoff) : undefined,
      workItems: works.rows.map(toWork),
      outcomes: outcomes.rows.map(toOutcome),
      ownerUserId: leadRow.owner_user_id ?? undefined,
      sourceEnvelopeId: leadRow.source_envelope_id ?? undefined,
      handoffRecipient: latestHandoff?.recipient_user_id ?? undefined,
      envelope: envelopes.rows[0] ? toEnvelope(envelopes.rows[0]) : undefined,
    };
  }

  async history(leadId: string): Promise<readonly AuditHistoryEntry[]> {
    const res = await this.db.query<AuditDbRow>(
      `SELECT id, entity_type, entity_id, actor, event_type, previous_value, new_value, reason, timestamp, supersedes_record_id
         FROM audit_record
        WHERE entity_id = $1
           OR entity_id IN (SELECT id::text FROM handoff WHERE lead_id = $1::uuid)
           OR entity_id IN (SELECT id::text FROM outcome WHERE lead_id = $1::uuid)
           OR entity_id IN (SELECT id::text FROM pilot_work_item WHERE lead_id = $1::uuid)
        ORDER BY timestamp`,
      [leadId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      actor: r.actor,
      eventType: r.event_type ?? '',
      previousValue: r.previous_value == null ? null : typeof r.previous_value === 'string' ? r.previous_value : JSON.stringify(r.previous_value),
      newValue: typeof r.new_value === 'string' ? r.new_value : JSON.stringify(r.new_value),
      reason: r.reason,
      timestamp: iso(r.timestamp),
      supersedesRecordId: r.supersedes_record_id,
    }));
  }

  async save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[]): Promise<void> {
    await this.db.withTransaction(async (tx) => {
      // Demo/synthetic workspaces được seed tự động (idempotent) — production workspace
      // tạo qua provisioning path riêng; pilot không yêu cầu admin tạo trước.
      await tx.query('INSERT INTO workspace (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [
        state.lead.workspaceId,
        `pilot-${state.lead.workspaceId}`,
      ]);

      const persistedEnvelopeId = state.envelope
        ? await insertEnvelope(tx, state.envelope)
        : state.sourceEnvelopeId ?? null;

      await tx.query(
        `INSERT INTO lead (id, workspace_id, conversation_source, acquisition_lineage, attribution,
                           status, display_name, created_at, owner_user_id, source_envelope_id, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
         ON CONFLICT (id) DO UPDATE
            SET status = EXCLUDED.status,
                owner_user_id = EXCLUDED.owner_user_id,
                updated_at = now(),
                version = lead.version + 1`,
        [
          state.lead.id,
          state.lead.workspaceId,
          state.lead.conversationSource ?? null,
          state.lead.acquisitionLineage ?? null,
          state.lead.attribution,
          state.lead.status,
          state.lead.displayName,
          state.lead.createdAt,
          state.ownerUserId ?? null,
          persistedEnvelopeId,
        ],
      );

      if (state.handoff) {
        await tx.query(
          `INSERT INTO handoff (id, lead_id, workspace_id, context, evidence_refs, proposed_next_action, created_at, recipient_user_id)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [
            state.handoff.id,
            state.handoff.leadId,
            state.handoff.workspaceId,
            state.handoff.context,
            JSON.stringify(state.handoff.evidenceRefs),
            state.handoff.proposedNextAction ? JSON.stringify(state.handoff.proposedNextAction) : null,
            state.handoff.createdAt,
            state.handoffRecipient ?? null,
          ],
        );
      }

      for (const w of state.workItems) {
        // Current-state projection upsert: immutable identity (lead, action, party,
        // origin, supersedes) set once; status/evidence/time are the evolving
        // projection — full history lives in audit_record (I-05, canonical
        // projection selects current state, like lead.status).
        await tx.query(
          `INSERT INTO pilot_work_item (id, lead_id, workspace_id, action, responsible_party, origin, status,
                                         completion_evidence, occurred_at, due_at, evidence_ref, recorded_at,
                                         supersedes_work_id, actor, reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE
              SET status = EXCLUDED.status,
                  completion_evidence = EXCLUDED.completion_evidence,
                  occurred_at = EXCLUDED.occurred_at,
                  due_at = EXCLUDED.due_at,
                  evidence_ref = EXCLUDED.evidence_ref,
                  actor = EXCLUDED.actor,
                  reason = EXCLUDED.reason`,
          [
            w.id,
            w.leadId,
            w.workspaceId,
            w.action,
            w.responsibleParty,
            w.origin,
            w.status,
            w.completionEvidence,
            w.occurredAt,
            w.dueAt ?? null,
            w.evidenceRef ?? null,
            w.recordedAt,
            w.supersedesWorkId ?? null,
            w.actor,
            w.reason ?? null,
          ],
        );
      }

      for (const o of state.outcomes) {
        await tx.query(
          `INSERT INTO outcome (id, lead_id, workspace_id, value, acquisition_mode, assertion_status, actor,
                                timestamp, reason, supersedes_outcome_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
          [
            o.id,
            o.leadId,
            o.workspaceId,
            o.value,
            o.acquisitionMode,
            o.assertionStatus,
            o.actor,
            o.timestamp,
            o.reason ?? null,
            o.supersedesOutcomeId ?? null,
          ],
        );
      }

      for (const a of audits) {
        await tx.query(
          `INSERT INTO audit_record (entity_type, entity_id, workspace_id, actor, previous_value, new_value,
                                     reason, event_type, supersedes_record_id)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
          [
            a.entityType,
            a.entityId,
            a.workspaceId,
            a.actor,
            a.previousValue !== undefined ? JSON.stringify(a.previousValue) : null,
            JSON.stringify(a.newValue),
            a.reason ?? null,
            a.eventType ?? null,
            a.supersedesRecordId ?? null,
          ],
        );
      }
    });
  }
}

async function insertEnvelope(tx: SqlExecutor, env: CommercialEnvelope): Promise<string> {
  // P1-1: idempotency scope = (workspace_id, connection, external_record_id) — R-06
  // within I-09. DO UPDATE (no-op) makes PG RETURN the id of the winning row whether
  // it was just inserted or already existed from a previous process — the lead FK must
  // reference THAT id. Different workspaces NEVER share a row.
  const res = await tx.query<{ id: string }>(
    `INSERT INTO commercial_envelope (id, schema_version, workspace_id, connection, external_record_id, external_event_type,
                                      source_captured_at, ingested_at, raw_payload, raw_payload_hash,
                                      mapping_status, is_synthetic)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
     ON CONFLICT (workspace_id, connection, external_record_id) DO UPDATE SET connection = EXCLUDED.connection
     RETURNING id`,
    [
      env.envelopeId,
      env.schemaVersion,
      env.workspaceId,
      env.connection,
      env.externalRecordId,
      env.externalEventType,
      env.sourceCapturedAt,
      env.ingestedAt,
      JSON.stringify(env.rawPayload),
      env.rawPayloadHash,
      env.mappingStatus,
      env.isSynthetic,
    ],
  );
  return res.rows[0].id;
}

interface LeadDbRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  customer_id: string | null;
  conversation_source: string | null;
  acquisition_lineage: string | null;
  attribution: string;
  status: string;
  display_name: string;
  created_at: Date | string;
  owner_user_id: string | null;
  source_envelope_id: string | null;
}

interface HandoffDbRow extends QueryResultRow {
  id: string;
  lead_id: string;
  workspace_id: string;
  context: string;
  evidence_refs: unknown;
  proposed_next_action: unknown;
  created_at: Date | string;
  recipient_user_id: string | null;
}

interface OutcomeDbRow extends QueryResultRow {
  id: string;
  lead_id: string;
  workspace_id: string;
  value: string;
  acquisition_mode: string;
  assertion_status: string;
  actor: string;
  timestamp: Date | string;
  reason: string | null;
  supersedes_outcome_id: string | null;
}

interface WorkDbRow extends QueryResultRow {
  id: string;
  lead_id: string;
  workspace_id: string;
  action: string;
  responsible_party: string;
  origin: string;
  status: string;
  completion_evidence: string;
  occurred_at: string;
  due_at: Date | string | null;
  evidence_ref: string | null;
  recorded_at: Date | string;
  supersedes_work_id: string | null;
  actor: string;
  reason: string | null;
}

interface EnvelopeDbRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  raw_payload: unknown;
  raw_payload_hash: string;
  source_captured_at: Date | string;
  ingested_at: Date | string;
  connection: string;
  external_record_id: string;
  external_event_type: string;
  is_synthetic: boolean;
}

interface AuditDbRow extends QueryResultRow {
  id: string;
  entity_type: string;
  entity_id: string;
  actor: string;
  event_type: string | null;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  timestamp: Date | string;
  supersedes_record_id: string | null;
}

const iso = (v: Date | string): string => new Date(v).toISOString();

function toLead(r: LeadDbRow): Lead {
  return {
    id: r.id as LeadId,
    workspaceId: r.workspace_id,
    ...(r.customer_id !== null && { customerId: r.customer_id as Lead['customerId'] }),
    ...(r.conversation_source !== null && { conversationSource: r.conversation_source }),
    ...(r.acquisition_lineage !== null && { acquisitionLineage: r.acquisition_lineage }),
    attribution: (r.attribution as UnknownState) ?? UNKNOWN_SENTINEL,
    createdAt: iso(r.created_at),
    status: r.status as LeadStatus,
    displayName: r.display_name,
  };
}

function toHandoff(r: HandoffDbRow): Handoff {
  return {
    id: r.id as HandoffId,
    leadId: r.lead_id as LeadId,
    workspaceId: r.workspace_id,
    context: r.context,
    evidenceRefs: Array.isArray(r.evidence_refs) ? (r.evidence_refs as Handoff['evidenceRefs']) : [],
    proposedNextAction: (r.proposed_next_action as Handoff['proposedNextAction']) ?? undefined,
    createdAt: iso(r.created_at),
  };
}

function toOutcome(r: OutcomeDbRow): Outcome {
  return {
    id: r.id as OutcomeId,
    leadId: r.lead_id as LeadId,
    workspaceId: r.workspace_id,
    value: r.value as OutcomeValue,
    acquisitionMode: r.acquisition_mode as OutcomeAcquisitionMode,
    assertionStatus: r.assertion_status as Outcome['assertionStatus'],
    actor: r.actor,
    timestamp: iso(r.timestamp),
    ...(r.reason !== null && { reason: r.reason }),
    ...(r.supersedes_outcome_id !== null && { supersedesOutcomeId: r.supersedes_outcome_id as OutcomeId }),
  };
}

function toWork(r: WorkDbRow): WorkItem {
  return {
    id: r.id,
    leadId: r.lead_id as LeadId,
    workspaceId: r.workspace_id,
    action: r.action,
    responsibleParty: r.responsible_party as ResponsibleParty,
    origin: r.origin as WorkOrigin,
    status: r.status as WorkStatus,
    completionEvidence: r.completion_evidence as CompletionEvidence,
    occurredAt: r.occurred_at,
    ...(r.due_at !== null && { dueAt: iso(r.due_at) }),
    ...(r.evidence_ref !== null && { evidenceRef: r.evidence_ref }),
    recordedAt: iso(r.recorded_at),
    ...(r.supersedes_work_id !== null && { supersedesWorkId: r.supersedes_work_id }),
    actor: r.actor,
    ...(r.reason !== null && { reason: r.reason }),
  };
}

function toEnvelope(r: EnvelopeDbRow): CommercialEnvelope {
  return {
    envelopeId: r.id as CommercialEnvelope['envelopeId'],
    schemaVersion: 1,
    workspaceId: r.workspace_id,
    connection: r.connection,
    externalRecordId: r.external_record_id,
    externalEventType: r.external_event_type,
    sourceCapturedAt: iso(r.source_captured_at),
    ingestedAt: iso(r.ingested_at),
    rawPayload: r.raw_payload,
    rawPayloadHash: r.raw_payload_hash,
    mappingStatus: 'mapped',
    isSynthetic: r.is_synthetic,
  };
}
