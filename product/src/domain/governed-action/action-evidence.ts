import {
  GovernedActionError, type ActorRef, type CommercialEventFacts, type ProposalEvidence,
} from './governed-action.types';

/**
 * ADR-005 R2-P-01 — what a proposal must cite.
 *
 * - AI (`ai`) proposals MUST reference a CommercialEvent that is `inferred`, still `draft`, not
 *   policy-rejected, in the same workspace (and the same lead when the action is lead-linked) and
 *   carries ≥1 evidence pointer. Cited evidence refs must be a subset of the CE's pointers (I-12:
 *   an AI cannot invent evidence); when none are given the CE's pointers are cited.
 * - Human proposals need a lead/context reference or a rationale (the rationale is always
 *   required by `propose`). Evidence is optional; a cited CE must still exist in the same
 *   workspace/lead. Evidence is shown to approvers in the preview.
 * Anything missing or unverifiable is refused with EVIDENCE_REQUIRED (no "UNKNOWN evidence" option).
 */
export const MAX_EVIDENCE_REFS = 20;
const EVIDENCE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/#@=-]{0,255}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `UNAVAILABLE` = the lookup failed; `undefined` = not found (or foreign: indistinguishable, I-09). */
export type CommercialEventLookupResult = CommercialEventFacts | 'UNAVAILABLE' | undefined;

export interface EvidenceInput {
  readonly workspaceId: string;
  readonly proposer: ActorRef;
  readonly leadId?: string;
  readonly commercialEventRef?: string;
  readonly evidenceRefs?: readonly unknown[];
  /** Facts for `commercialEventRef`, gathered by the application layer through a read port. */
  readonly commercialEvent?: CommercialEventLookupResult;
}

const required = (detail: string, message: string): never => {
  throw new GovernedActionError('EVIDENCE_REQUIRED', message, [detail]);
};

/** Normalise a CommercialEvent reference (UUID, lower case); undefined when absent. */
export function normalizeCommercialEventRef(ref: unknown): string | undefined {
  if (ref === undefined || ref === null) return undefined;
  if (typeof ref !== 'string' || !UUID.test(ref)) throw new GovernedActionError('INVALID_INPUT', 'commercialEventRef must be a UUID');
  return ref.toLowerCase();
}

/** Validate format, de-duplicate (order kept) and bound the cited evidence pointers. */
export function normalizeEvidenceRefs(refs: readonly unknown[] | undefined): string[] {
  if (refs === undefined || refs === null) return [];
  if (!Array.isArray(refs)) throw new GovernedActionError('INVALID_INPUT', 'evidenceRefs must be an array');
  const out: string[] = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !EVIDENCE_REF.test(ref)) throw new GovernedActionError('INVALID_INPUT', 'evidence ref is not a valid pointer');
    if (!out.includes(ref)) out.push(ref);
  }
  if (out.length > MAX_EVIDENCE_REFS) throw new GovernedActionError('INVALID_INPUT', `at most ${MAX_EVIDENCE_REFS} evidence refs`);
  return out;
}

/** Resolve and enforce the evidence a proposal cites. Throws EVIDENCE_REQUIRED / INVALID_INPUT. */
export function resolveProposalEvidence(input: EvidenceInput): ProposalEvidence {
  const commercialEventRef = normalizeCommercialEventRef(input.commercialEventRef);
  const cited = normalizeEvidenceRefs(input.evidenceRefs);
  const isAi = input.proposer.kind === 'ai';
  if (!commercialEventRef) {
    if (isAi) required('COMMERCIAL_EVENT_REF_MISSING', 'AI proposals must cite a draft CommercialEvent (ADR-005)');
    return Object.freeze({ evidenceRefs: Object.freeze(cited) });
  }
  const ce = input.commercialEvent;
  if (ce === 'UNAVAILABLE') required('COMMERCIAL_EVENT_LOOKUP_UNAVAILABLE', 'commercial event could not be verified');
  const facts = ce as CommercialEventFacts | undefined;
  if (!facts || facts.id?.toLowerCase() !== commercialEventRef || facts.workspaceId !== input.workspaceId) {
    required('COMMERCIAL_EVENT_NOT_FOUND', 'cited commercial event not found');
  }
  const f = facts as CommercialEventFacts;
  if (input.leadId && f.leadId?.toLowerCase() !== input.leadId) required('COMMERCIAL_EVENT_LEAD_MISMATCH', 'cited commercial event belongs to another lead');
  const pointers = normalizeEvidenceRefs((f.evidencePointers ?? []).filter((p) => typeof p === 'string' && EVIDENCE_REF.test(p)).slice(0, MAX_EVIDENCE_REFS));
  if (isAi) {
    if (f.acquisitionMode !== 'inferred') required('COMMERCIAL_EVENT_NOT_INFERRED', 'AI proposals must cite an inferred CommercialEvent');
    if (f.assertionStatus !== 'draft') required('COMMERCIAL_EVENT_NOT_DRAFT', 'AI proposals must cite a draft CommercialEvent');
    if (f.policyCheck === 'rejected') required('COMMERCIAL_EVENT_REJECTED', 'cited CommercialEvent was rejected by policy');
    if (pointers.length === 0) required('COMMERCIAL_EVENT_NO_EVIDENCE', 'cited CommercialEvent has no evidence pointer');
    if (cited.some((r) => !pointers.includes(r))) required('EVIDENCE_REF_NOT_IN_COMMERCIAL_EVENT', 'AI may cite only the CommercialEvent evidence');
  }
  const evidenceRefs = cited.length > 0 ? cited : pointers;
  return Object.freeze({ commercialEventRef, evidenceRefs: Object.freeze([...evidenceRefs]) });
}

/** True when the proposal cites anything an approver should see. */
export function hasEvidence(e: ProposalEvidence | undefined): e is ProposalEvidence {
  return !!e && (e.commercialEventRef !== undefined || e.evidenceRefs.length > 0);
}
