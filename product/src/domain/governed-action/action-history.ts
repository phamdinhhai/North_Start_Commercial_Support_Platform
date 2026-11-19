import { previewDigestOf } from './action-lifecycle';
import {
  GovernedActionError, type ActionApproval, type ActionEvent, type ActionExecution, type ActionOutcome, type ActionPreview,
  type ActionState, type ExecutorStatus, type JsonValue, type ObservedState, type OutcomeState, type PreviewChange, type ProposalEvidence,
  type Verification,
} from './governed-action.types';

/**
 * Rebuild the mutable lifecycle projection of a proposal from its append-only events alone
 * (A-M1, I-05/I-12). The projection stored next to the proposal is only a cache: everything a
 * reviewer needs — every reviewed preview, every approval, every attempt's executor claim,
 * provider reference and readback evidence — is recoverable from history.
 */
export interface LifecycleProjection {
  readonly state: ActionState;
  readonly version: number;
  readonly attempts: number;
  readonly preview?: ActionPreview;
  readonly approval?: ActionApproval;
  readonly execution?: ActionExecution;
  readonly outcome?: ActionOutcome;
}

type Data = ActionEvent['data'];
const str = (d: Data, k: string): string => d[k] as string;
const num = (d: Data, k: string): number => d[k] as number;
const verificationOf = (d: Data): Verification | undefined =>
  d.verification === null || d.verification === undefined ? undefined : d.verification as unknown as Verification;

/** ADR-005: evidence shown to the approver, as recorded in the PREVIEWED event. */
const evidenceOf = (d: Data): ProposalEvidence | undefined => {
  const raw = d.evidence as { readonly commercialEventRef?: JsonValue; readonly evidenceRefs?: JsonValue } | null | undefined;
  if (!raw || typeof raw !== 'object') return undefined;
  const refs = Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs.filter((r): r is string => typeof r === 'string') : [];
  return { ...(typeof raw.commercialEventRef === 'string' ? { commercialEventRef: raw.commercialEventRef } : {}), evidenceRefs: refs };
};

const corrupt = (e: ActionEvent, why: string): never => {
  throw new GovernedActionError('INVALID_INPUT', `history event ${e.sequence} (${e.type}) is not reconstructable: ${why}`);
};

export function replayLifecycle(events: readonly ActionEvent[]): LifecycleProjection {
  if (events.length === 0 || events[0].type !== 'PROPOSED') throw new GovernedActionError('INVALID_INPUT', 'history must start with PROPOSED');
  let s: { -readonly [K in keyof LifecycleProjection]: LifecycleProjection[K] } = { state: 'PROPOSED', version: 0, attempts: 0 };
  for (const [index, e] of events.entries()) {
    if (e.sequence !== index + 1) corrupt(e, 'sequence is not contiguous');
    if (index > 0 && e.fromState !== s.state) corrupt(e, `fromState ${e.fromState} != ${s.state}`);
    const d = e.data;
    switch (e.type) {
      case 'PREVIEWED': {
        const beforeState = d.beforeState as unknown as ObservedState;
        const changes = d.changes as unknown as PreviewChange[];
        if (!beforeState || !Array.isArray(changes)) corrupt(e, 'preview content missing');
        const evidence = evidenceOf(d);
        if (previewDigestOf(str(d, 'argumentDigest'), beforeState, changes, evidence, e.workspaceId, str(d, 'previewDigest')) !== str(d, 'previewDigest')) corrupt(e, 'preview digest mismatch');
        s = { ...s, approval: undefined,
          preview: { beforeState, changes, previewDigest: str(d, 'previewDigest'), previewedAt: e.at, previewedBy: e.actor,
            ...(evidence ? { evidence } : {}) } };
        break;
      }
      case 'AUTHORIZED':
        if (s.preview?.previewDigest !== str(d, 'previewDigest')) corrupt(e, 'approval does not bind the latest preview');
        s = { ...s, approval: { approver: e.actor, argumentDigest: str(d, 'argumentDigest'), previewDigest: str(d, 'previewDigest'),
          approvedAt: e.at, expiresAt: str(d, 'approvalExpiresAt'), reason: e.reason, consumed: false } };
        break;
      case 'EXECUTION_STARTED':
        if (!s.approval) corrupt(e, 'execution without approval');
        s = { ...s, attempts: num(d, 'attempt'), approval: { ...s.approval!, consumed: true }, outcome: undefined,
          execution: { attempt: num(d, 'attempt'), idempotencyKey: str(d, 'idempotencyKey'), startedAt: e.at, startedBy: e.actor } };
        break;
      case 'OUTCOME_RECORDED': {
        const outcome = d.outcome as OutcomeState;
        if (d.source === 'lease-expired') {
          s = { ...s, outcome: { state: outcome, reason: e.reason, recordedAt: e.at } };
          break;
        }
        if (!s.execution) corrupt(e, 'outcome without execution');
        const verification = verificationOf(d);
        const providerReference = d.providerReference as JsonValue;
        s = { ...s,
          execution: { ...s.execution!, finishedAt: e.at, executorStatus: d.executorStatus as ExecutorStatus,
            ...(typeof providerReference === 'string' ? { providerReference } : {}) },
          outcome: { state: outcome, reason: e.reason, recordedAt: e.at, ...(verification ? { verification } : {}) } };
        break;
      }
      case 'VERIFICATION_RECORDED': {
        const verification = verificationOf(d);
        if (!verification) corrupt(e, 'verification evidence missing');
        s = { ...s, outcome: { state: d.outcome as OutcomeState, reason: e.reason, recordedAt: e.at, verification } };
        break;
      }
      default:
        break; // PROPOSED, REJECTED, CANCELLED, EXPIRED change state only.
    }
    s = { ...s, state: e.toState, version: e.sequence };
  }
  return s;
}

/** Per-attempt evidence, in order, recovered from history (one entry per EXECUTION_STARTED). */
export interface AttemptRecord {
  readonly attempt: number;
  readonly idempotencyKey: string;
  readonly approvedPreviewDigest: string;
  readonly executorStatus?: ExecutorStatus;
  readonly executorReason?: string;
  readonly providerReference?: string;
  readonly verifications: readonly Verification[];
  readonly outcomes: readonly OutcomeState[];
}

export function attemptHistory(events: readonly ActionEvent[]): AttemptRecord[] {
  const attempts: { -readonly [K in keyof AttemptRecord]: AttemptRecord[K] }[] = [];
  for (const e of events) {
    const d = e.data;
    if (e.type === 'EXECUTION_STARTED') {
      attempts.push({ attempt: num(d, 'attempt'), idempotencyKey: str(d, 'idempotencyKey'),
        approvedPreviewDigest: str(d, 'approvedPreviewDigest'), verifications: [], outcomes: [] });
      continue;
    }
    const current = attempts[attempts.length - 1];
    if (!current || (e.type !== 'OUTCOME_RECORDED' && e.type !== 'VERIFICATION_RECORDED')) continue;
    const verification = verificationOf(d);
    if (verification) current.verifications = [...current.verifications, verification];
    current.outcomes = [...current.outcomes, d.outcome as OutcomeState];
    if (e.type === 'OUTCOME_RECORDED' && d.source === 'executor') {
      current.executorStatus = d.executorStatus as ExecutorStatus;
      current.executorReason = str(d, 'executorReason');
      if (typeof d.providerReference === 'string') current.providerReference = d.providerReference;
    }
  }
  return attempts;
}
