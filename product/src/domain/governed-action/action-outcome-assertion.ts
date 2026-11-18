import { createAssertion, type AssertionEnvelope, type AssertionId } from '../commercial-event/commercial-event';
import { canonicalJson, sha256Hex } from './canonical-json';
import type { ActionEvent, ActionProposal, Verification } from './governed-action.types';

/**
 * ADR-005 R2-P-02 — a verified governed-action outcome becomes an `observed` AssertionEnvelope
 * that can be cited as evidence. It is NEVER a Commercial State or Outcome change.
 * OPEN: CE-1 — moving Commercial State stays with human action / the CE-1 transition policy.
 *
 * Emitted only when a provider readback actually observed the result (SUCCEEDED_VERIFIED with
 * EXECUTED, FAILED_VERIFIED with NOT_EXECUTED after a dispatch). Nothing is emitted for UNKNOWN or
 * for a kill switch that stopped the attempt before dispatch (no provider observation exists).
 */
export const OBSERVED_OUTCOME_SOURCE_ACTOR = 'governed-action-readback';
export const OBSERVED_OUTCOME_CREATED_BY = 'governed-action-runtime';

/** UUID-shaped id derived from the outcome event, so re-emission is idempotent for a sink. */
export function observedAssertionId(workspaceId: string, proposalId: string, sequence: number): AssertionId {
  const h = sha256Hex(`governed-action-observed-outcome\u0000${workspaceId}\u0000${proposalId}\u0000${sequence}`);
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}` as AssertionId;
}

function verifiedFrom(event: ActionEvent): Verification | undefined {
  if (event.type !== 'OUTCOME_RECORDED' && event.type !== 'VERIFICATION_RECORDED') return undefined;
  if (event.type === 'OUTCOME_RECORDED' && (event.data.source !== 'executor' || event.data.dispatched === false)) return undefined;
  const v = event.data.verification as unknown as Verification | null | undefined;
  if (!v || typeof v !== 'object') return undefined;
  if (event.toState === 'SUCCEEDED_VERIFIED' && v.observation === 'EXECUTED') return v;
  if (event.toState === 'FAILED_VERIFIED' && v.observation === 'NOT_EXECUTED') return v;
  return undefined;
}

/**
 * Build the observed assertion for an outcome event of `proposal`, or `undefined` when the event
 * is not a provider-observed verified outcome. Pure and deterministic except for `ingestedAt`.
 */
export function observedOutcomeAssertion(proposal: ActionProposal, event: ActionEvent, now: Date): AssertionEnvelope | undefined {
  if (event.proposalId !== proposal.id || event.workspaceId !== proposal.workspaceId) return undefined;
  const verification = verifiedFrom(event);
  if (!verification) return undefined;
  const t = proposal.target;
  const providerReference = typeof event.data.providerReference === 'string' ? event.data.providerReference
    : proposal.execution?.providerReference;
  const executorStatus = typeof event.data.executorStatus === 'string' ? event.data.executorStatus
    : proposal.execution?.executorStatus ?? null;
  return createAssertion({
    assertionId: observedAssertionId(proposal.workspaceId, proposal.id, event.sequence),
    workspaceId: proposal.workspaceId,
    ...(proposal.leadId
      ? { subjectType: 'lead' as const, subjectId: proposal.leadId }
      : { subjectType: 'external_resource' as const, subjectId: `${t.provider}/${t.accountId}/${t.resourceType}/${t.resourceId}` }),
    eventType: 'ACTION_OUTCOME_OBSERVED',
    value: verification.observation,
    acquisitionMode: 'observed',
    // Conservative: a readback is the provider's claim; corroboration is a separate, policy-driven step.
    assertionStatus: 'claimed',
    sourceSystem: t.provider,
    ...(providerReference ? { sourceRecordId: providerReference } : {}),
    sourceActor: OBSERVED_OUTCOME_SOURCE_ACTOR,
    createdBy: OBSERVED_OUTCOME_CREATED_BY,
    capturedAt: verification.observedAt,
    ingestedAt: now.toISOString(),
    rawEvidencePointer: `governed_action_event:${proposal.id}#${event.sequence}`,
    rawPayloadHash: sha256Hex(canonicalJson(verification.evidence ?? null)),
    evidenceSummary: {
      proposalId: proposal.id, capabilityId: proposal.capabilityId, attempt: proposal.attempts, outcome: event.toState,
      observation: verification.observation, reason: verification.reason.slice(0, 256), observedAt: verification.observedAt,
      executorStatus, targetProvider: t.provider, targetAccountId: t.accountId, targetResourceType: t.resourceType,
      targetResourceId: t.resourceId, commercialEventRef: proposal.commercialEventRef ?? null,
    },
  });
}
