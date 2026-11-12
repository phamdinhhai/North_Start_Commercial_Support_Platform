import type { QueryResultRow } from 'pg';
import type { Lead, LeadId, LeadStatus } from '../../../domain/lead/lead';
import type { Handoff, HandoffId } from '../../../domain/handoff/handoff';
import type { Outcome, OutcomeId, OutcomeAcquisitionMode, OutcomeValue } from '../../../domain/outcome/outcome';
import type { CommercialEnvelope } from '../../../domain/envelope/envelope';
import { UNKNOWN_SENTINEL, type UnknownState } from '../../../domain/unknown-states/unknown-states';
import type { CompletionEvidence, ResponsibleParty, WorkItem, WorkOrigin, WorkStatus } from '../../../ports/pilot-loop.types';

export interface LeadDbRow extends QueryResultRow {
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
  version: number;
}

export interface HandoffDbRow extends QueryResultRow {
  id: string;
  lead_id: string;
  workspace_id: string;
  context: string;
  evidence_refs: unknown;
  proposed_next_action: unknown;
  created_at: Date | string;
  recipient_user_id: string | null;
}

export interface OutcomeDbRow extends QueryResultRow {
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

export interface WorkDbRow extends QueryResultRow {
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

export interface EnvelopeDbRow extends QueryResultRow {
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
  mapping_status: string;
  mapping_error: string | null;
  canonical_projection: unknown;
  acquisition_mode: string;
  acquisition_source: string;
}

export interface AuditDbRow extends QueryResultRow {
  id: string;
  entity_type: string;
  entity_id: string;
  workspace_id: string;
  actor: string;
  event_type: string | null;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  timestamp: Date | string;
  supersedes_record_id: string | null;
}

export const iso = (value: Date | string): string => new Date(value).toISOString();

export function toLead(r: LeadDbRow): Lead {
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

export function toHandoff(r: HandoffDbRow): Handoff {
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

export function toOutcome(r: OutcomeDbRow): Outcome {
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

export function toWork(r: WorkDbRow): WorkItem {
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

export function toEnvelope(r: EnvelopeDbRow): CommercialEnvelope {
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
    mappingStatus: r.mapping_status as CommercialEnvelope['mappingStatus'],
    ...(r.mapping_error !== null && { mappingError: r.mapping_error }),
    ...(r.canonical_projection !== null && { canonicalProjection: r.canonical_projection }),
    isSynthetic: r.is_synthetic,
    acquisitionMode: (r.acquisition_mode ?? 'imported_record') as CommercialEnvelope['acquisitionMode'],
    acquisitionSource: (r.acquisition_source ?? 'manual') as CommercialEnvelope['acquisitionSource'],
  };
}
