import type { LeadId } from '../lead/lead';

/** Handoff ID — stable, immutable (I-07). */
export type HandoffId = string & { readonly __brand: 'HandoffId' };

/** Reference tới raw evidence (I-12) — raw payload preserved, immutable. */
export interface EvidenceRef {
  readonly envelopeId: string;
  readonly rawPayloadHash: string;
  readonly capturedAt: string;
}

/** Proposed next action — draft-only (I-03, I-10). */
export type ProposedNextAction = {
  readonly kind: 'call' | 'follow-up' | 'demo' | 'send-info';
  readonly summary: string;
  readonly dueAt?: string;
};

/**
 * Handoff = Marketing→Sales context package (R-11).
 * Gồm: lead context, evidence refs, proposed next action.
 * Lead ID stable (I-07) — handoff reference lead, không bao giờ tự tạo lead mới.
 */
export interface Handoff {
  readonly id: HandoffId;
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly context: string;
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly proposedNextAction?: ProposedNextAction;
  /** Reference to the audit record created when handoff was created (I-05, R-11 acceptance). */
  readonly auditRef?: string;
  readonly createdAt: string;
}

export interface CreateHandoffInput {
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly context: string;
  readonly evidenceRefs?: readonly EvidenceRef[];
  readonly proposedNextAction?: ProposedNextAction;
  readonly auditRef?: string;
}

/**
 * Tạo handoff package. Lead ID bắt buộc — handoff luôn gắn với 1 lead (I-07).
 * Evidence refs optional tại PH1 (manual/synthetic); bắt buộc khi có adapter evidence.
 */
export function createHandoff(input: CreateHandoffInput): Handoff {
  return {
    id: crypto.randomUUID() as HandoffId,
    workspaceId: input.workspaceId,
    leadId: input.leadId,
    context: input.context,
    evidenceRefs: input.evidenceRefs ?? [],
    proposedNextAction: input.proposedNextAction,
    ...(input.auditRef !== undefined && { auditRef: input.auditRef }),
    createdAt: new Date().toISOString(),
  };
}

/** Kiểm tra handoff cùng lead (I-07): hai handoff của cùng lead thì leadId giống. */
export function sameHandoffLead(a: Handoff, b: Handoff): boolean {
  return a.leadId === b.leadId;
}
