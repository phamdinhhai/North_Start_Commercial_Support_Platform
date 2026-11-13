/**
 * Pilot-loop types — shared by service, repository and API.
 *
 * Q3 candidate axes (responsibleParty × origin × status × completionEvidence) are
 * VALIDATION constructs for RFC-005 Q3 (still Draft) — not canonical entities.
 * No `Journey` / `Obligation` / `Contact` / `Organization` is introduced here.
 */
import type { Lead, LeadId } from '../domain/lead/lead';
import type { Handoff } from '../domain/handoff/handoff';
import type { Outcome } from '../domain/outcome/outcome';
import type { CommercialEnvelope, EvidenceAcquisitionMode, EvidenceAcquisitionSource } from '../domain/envelope/envelope';

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

export interface PilotQueueQuery {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly actorRole: 'admin' | 'manager' | 'sales' | 'viewer';
  readonly status?: WorkStatus;
  readonly dueBefore?: string;
  readonly dueAfter?: string;
  readonly ownerUserId?: string;
  readonly recipientUserId?: string;
  /** Opaque cursor returned by the previous page. */
  readonly cursor?: string;
  readonly limit?: number;
}

/** Redacted operator projection: no raw payloads, evidence contents, or evidence pointers. */
export interface PilotQueueItem {
  readonly id: string;
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly action: string;
  readonly responsibleParty: ResponsibleParty;
  readonly origin: WorkOrigin;
  readonly status: WorkStatus;
  readonly completionEvidence: CompletionEvidence;
  readonly occurredAt: string;
  readonly dueAt?: string;
  readonly recordedAt: string;
  readonly supersedesWorkId?: string;
  readonly actor: string;
  readonly lead: { readonly status: Lead['status']; readonly displayName: string };
  readonly handoff?: { readonly recipientUserId: string };
}

export interface PilotQueuePage {
  readonly items: readonly PilotQueueItem[];
  readonly nextCursor?: string;
}

export interface PilotQueueCursor {
  readonly version: 1;
  readonly scope: string;
  readonly dueAt: string | null;
  readonly recordedAt: string;
  readonly id: string;
}

export function queueCursorScope(query: PilotQueueQuery): string {
  return JSON.stringify([
    query.workspaceId,
    query.actorId,
    query.actorRole,
    query.status ?? null,
    query.dueBefore ?? null,
    query.dueAfter ?? null,
    query.ownerUserId ?? null,
    query.recipientUserId ?? null,
  ]);
}

export function encodePilotQueueCursor(query: PilotQueueQuery, item: PilotQueueItem): string {
  return Buffer.from(JSON.stringify({
    version: 1,
    scope: queueCursorScope(query),
    dueAt: item.dueAt ?? null,
    recordedAt: item.recordedAt,
    id: item.id,
  } satisfies PilotQueueCursor), 'utf8').toString('base64url');
}

export function decodePilotQueueCursor(query: PilotQueueQuery, value?: string): PilotQueueCursor | undefined {
  if (!value) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<PilotQueueCursor>;
    if (decoded.version !== 1 || decoded.scope !== queueCursorScope(query)
      || (decoded.dueAt !== null && typeof decoded.dueAt !== 'string')
      || typeof decoded.recordedAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id) {
      throw new Error('cursor scope mismatch');
    }
    return decoded as PilotQueueCursor;
  } catch {
    throw new PilotDomainError('INPUT_INVALID', 400, 'cursor is invalid or does not match the requested queue');
  }
}

export function isAfterPilotQueueCursor(item: PilotQueueItem, cursor?: PilotQueueCursor): boolean {
  if (!cursor) return true;
  const dueOrder = compareQueueDue(item.dueAt ?? null, cursor.dueAt);
  if (dueOrder !== 0) return dueOrder > 0;
  return item.recordedAt > cursor.recordedAt || (item.recordedAt === cursor.recordedAt && item.id > cursor.id);
}

export function compareQueueDue(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

export interface PilotLoopState {
  readonly lead: Lead;
  /** Optimistic-concurrency revision. Undefined only for a brand-new aggregate. */
  readonly version?: number;
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
  readonly acquisitionMode?: EvidenceAcquisitionMode;
  readonly acquisitionSource?: EvidenceAcquisitionSource;
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

/**
 * Read-only metadata for the audit projection. `trust` describes the durability of
 * the audit observation, not the business truth of the value it records. Raw payloads
 * and evidence contents are deliberately not projected here (I-12).
 */
export interface AuditReadMetadata {
  readonly trust: 'recorded';
  readonly provenance: 'audit_record';
  /** Fields that are not established by this read model and must remain UNKNOWN. */
  readonly unknown: readonly string[];
}

/** Read-only audit history entry returned by durable stores (I-05 history visible). */
export interface AuditHistoryEntry {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly workspaceId: string;
  readonly actor: string;
  readonly eventType: string;
  readonly previousValue: string | null;
  readonly newValue: string;
  readonly reason: string | null;
  readonly timestamp: string;
  readonly supersedesRecordId: string | null;
  readonly metadata: AuditReadMetadata;
}

/** Machine-readable business refusal codes — mapped to HTTP status at the API boundary. */
export type PilotErrorCode =
  | 'EVIDENCE_POINTER_REQUIRED'
  | 'INFERRED_CANNOT_CLOSE'
  | 'EVIDENCE_INSUFFICIENT_TO_CLOSE'
  | 'EVIDENCE_NOT_ACTION_PROOF'
  | 'WORK_NOT_ASSIGNED_TO_ACTOR'
  | 'NOT_ASSIGNED_RECIPIENT'
  | 'EXTERNAL_NOT_DECLAREABLE'
  | 'WORK_ALREADY_CLOSED'
  | 'WORK_ALREADY_COMPLETED'
  | 'WORK_SUPERSEDED'
  | 'CE1_BOUNDARY'
  | 'NOT_OWNER'
  | 'WORK_NOT_FOUND'
  | 'OUTCOME_NOT_FOUND'
  | 'LEAD_NOT_FOUND'
  | 'NOT_EXTERNAL_EXPECTATION'
  | 'ALREADY_OBSERVED'
  | 'EVIDENCE_NOT_FOUND'
  | 'EVIDENCE_OUT_OF_SCOPE'
  | 'EVIDENCE_NOT_RELATED'
  | 'INPUT_REQUIRED'
  | 'INPUT_INVALID'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STALE_VERSION';

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

/** Optimistic-concurrency refusal; callers should reload and retry from the returned version. */
export class PilotStaleVersionError extends PilotDomainError {
  constructor(readonly leadId: string, readonly expectedVersion: number | undefined, readonly actualVersion: number) {
    super(
      'STALE_VERSION',
      409,
      `lead ${leadId} was changed concurrently; expected version ${expectedVersion ?? 'new'}, actual version ${actualVersion}`,
      { leadId, expectedVersion: expectedVersion ?? null, actualVersion },
    );
    this.name = 'PilotStaleVersionError';
  }
}
