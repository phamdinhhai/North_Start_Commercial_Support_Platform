/**
 * Pilot-loop types — shared by service, repository and API.
 *
 * Q3 candidate axes (responsibleParty × origin × status × completionEvidence) are
 * VALIDATION constructs for RFC-005 Q3 (still Draft) — not canonical entities.
 * No `Journey` / `Obligation` / `Contact` / `Organization` is introduced here.
 */
import type { Lead, LeadId } from '../../domain/lead/lead';
import type { Handoff } from '../../domain/handoff/handoff';
import type { Outcome } from '../../domain/outcome/outcome';
import type { CommercialEnvelope } from '../../domain/envelope/envelope';

export type ResponsibleParty = 'internal' | 'external';
export type WorkOrigin = 'explicit-request' | 'explicit-commitment' | 'policy-sla' | 'inferred';
export type CompletionEvidence = 'observed' | 'declared' | 'inferred' | 'absent' | 'conflicted';
export type WorkStatus =
  | 'proposed'
  | 'accepted'
  | 'open'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'awaiting-external';

export interface WorkItem {
  readonly id: string;
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly action: string;
  readonly responsibleParty: ResponsibleParty;
  readonly origin: WorkOrigin;
  readonly status: WorkStatus;
  readonly completionEvidence: CompletionEvidence;
  /** ISO time or UNKNOWN_SENTINEL ('unknown') — never filled from recordedAt (Q4). */
  readonly occurredAt: string;
  readonly dueAt?: string;
  readonly evidenceRef?: string;
  readonly recordedAt: string;
  /** Set when this item supersedes an earlier one (reschedule/cancel) — no stale reminders (I-05). */
  readonly supersedesWorkId?: string;
  readonly actor: string;
  readonly reason?: string;
}

export interface PilotLoopState {
  readonly lead: Lead;
  readonly handoff?: Handoff;
  readonly workItems: readonly WorkItem[];
  readonly outcomes: readonly Outcome[];
  /**
   * Current lead owner (I-09). Set on intake; updated on salesAccept.
   * "Conversation assignment ≠ Sales ownership" (DOMAIN_MODEL §3.4).
   */
  readonly ownerUserId?: string;
  /** Raw envelope id holding the intake utterance (I-12). */
  readonly sourceEnvelopeId?: string;
  /** Sales user the handoff is addressed to — recipient before acceptance (Marketing A → Sales B). */
  readonly handoffRecipient?: string;
  /** Raw intake envelope, carried for durable re-insert (I-12). */
  readonly envelope?: CommercialEnvelope;
}

export interface ScenarioInput {
  readonly workspaceId: string;
  readonly displayName: string;
  readonly utterance: string;
  readonly speaker: 'customer' | 'staff';
  readonly connection: string;
  readonly externalRecordId: string;
  readonly conversationSource?: string;
  readonly isSynthetic?: boolean;
  /** Time asserted by evidence; omit or pass UNKNOWN_SENTINEL when unclear. */
  readonly occurredAt?: string;
  /** Server-derived operator (I-09) — never trusted from client body. */
  readonly ownerUserId?: string;
}

/** Audit append request handed to the repository (must share the mutation transaction — QA-35). */
export interface AuditDraft {
  readonly entityType: 'lead' | 'customer' | 'handoff' | 'outcome' | 'commercial-event';
  readonly entityId: string;
  readonly workspaceId: string;
  readonly actor: string;
  readonly previousValue?: string;
  readonly newValue: string;
  readonly reason?: string;
  readonly eventType: string;
  readonly supersedesRecordId?: string;
}

/** Read-only audit history entry returned by durable stores (I-05 history visible). */
export interface AuditHistoryEntry {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly actor: string;
  readonly eventType: string;
  readonly previousValue: string | null;
  readonly newValue: string;
  readonly reason: string | null;
  readonly timestamp: string;
  readonly supersedesRecordId: string | null;
}

/** Machine-readable business refusal codes — mapped to HTTP status at the API boundary. */
export type PilotErrorCode =
  | 'EVIDENCE_POINTER_REQUIRED'
  | 'INFERRED_CANNOT_CLOSE'
  | 'EXTERNAL_NOT_DECLAREABLE'
  | 'WORK_ALREADY_CLOSED'
  | 'WORK_ALREADY_COMPLETED'
  | 'WORK_SUPERSEDED'
  | 'CE1_BOUNDARY'
  | 'NOT_ASSIGNED_RECIPIENT'
  | 'NOT_OWNER'
  | 'WORK_NOT_FOUND'
  | 'OUTCOME_NOT_FOUND'
  | 'LEAD_NOT_FOUND'
  | 'NOT_EXTERNAL_EXPECTATION'
  | 'ALREADY_OBSERVED'
  | 'INPUT_REQUIRED';

/** Domain guardrail refusal — carries an intended HTTP status, mapped by the controller. */
export class PilotDomainError extends Error {
  constructor(
    readonly code: PilotErrorCode,
    readonly status: 400 | 403 | 404 | 409 | 422,
    message: string,
    /**
     * Machine-readable context surfaced verbatim in the 4xx body — e.g. `replacementId` so a
     * caller that tried to mutate a superseded work item can act on the live successor
     * instead of guessing which ID survived (P1-3).
     */
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PilotDomainError';
  }
}
