/**
 * Governed Commercial Action — domain vocabulary (framework-independent).
 *
 * Propose → Preview → Authorize → Execute → Verify → Audit.
 *
 * Invariants enforced by this module:
 * - I-03: AI actors may only PROPOSE (drafts). They can never authorize or trigger execution.
 * - I-05: every transition is an append-only {@link ActionEvent} with actor, time and reason.
 * - I-08: an execution whose effect cannot be proven is UNKNOWN and stays visible; it is
 *   never retried until a readback proves it did not take effect.
 * - I-09: every proposal is workspace scoped; cross-workspace reads behave as "not found".
 * - I-10/I-11: provider capability ids are data; adapters own transport, not semantics.
 *
 * OPEN: PM-1 — who holds approval authority is NOT decided here; it is delegated to an
 * injected ActionPolicy port whose default implementation denies everything.
 * OPEN: CE-1 / CE-2 — a governed action is NOT a Commercial Event and does not move
 * Commercial State; linking action outcomes to CE/state is deferred to Gate #A.
 */

export type ActionState =
  | 'PROPOSED'
  | 'PREVIEWED'
  | 'AUTHORIZED'
  | 'EXECUTING'
  | 'SUCCEEDED_VERIFIED'
  | 'FAILED_VERIFIED'
  | 'UNKNOWN'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export const ACTION_STATES: readonly ActionState[] = Object.freeze([
  'PROPOSED', 'PREVIEWED', 'AUTHORIZED', 'EXECUTING', 'SUCCEEDED_VERIFIED',
  'FAILED_VERIFIED', 'UNKNOWN', 'REJECTED', 'EXPIRED', 'CANCELLED',
]);

export const TERMINAL_STATES: readonly ActionState[] = Object.freeze([
  'SUCCEEDED_VERIFIED', 'REJECTED', 'EXPIRED', 'CANCELLED',
]);

export type RiskClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export const RISK_CLASSES: readonly RiskClass[] = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/** Who initiated a command. `system` is reserved for lifecycle housekeeping (expiry, lease). */
export type ActorKind = 'human' | 'ai' | 'service' | 'system';

export interface ActorRef {
  readonly kind: ActorKind;
  readonly id: string;
}

/** An authenticated caller; the workspace comes from the auth context, never from a body. */
export interface ActionActor extends ActorRef {
  readonly kind: 'human' | 'ai' | 'service';
  readonly workspaceId: string;
}

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** External resource addressed by an action. IDs are opaque strings (never display names). */
export interface TargetResource {
  readonly provider: string;
  readonly accountId: string;
  readonly resourceType: string;
  readonly resourceId: string;
}

/** Constraints are policy-supplied, never proposer-supplied. */
export interface ActionConstraints {
  /** Maximum absolute change, in percent of the observed baseline, for budget capabilities. */
  readonly maxBudgetDeltaPercent?: number;
  readonly protectedAccountIds: readonly string[];
  /** Approval validity window in ms (bounded by the domain). */
  readonly approvalTtlMs: number;
}

/** Observed external state. UNKNOWN is first-class (I-08) — never replaced by a guess. */
export type ObservedState =
  | { readonly status: 'OBSERVED'; readonly value: JsonValue; readonly synthetic: boolean }
  | { readonly status: 'UNKNOWN'; readonly reason: string };

export interface PreviewChange {
  readonly path: string;
  readonly after: JsonValue;
  /** `null` with `beforeKnown=false` means the prior value is UNKNOWN, not empty. */
  readonly before: JsonValue;
  readonly beforeKnown: boolean;
}

export interface ActionPreview {
  readonly beforeState: ObservedState;
  readonly changes: readonly PreviewChange[];
  readonly previewDigest: string;
  readonly previewedAt: string;
  readonly previewedBy: ActorRef;
}

export interface ActionApproval {
  readonly approver: ActorRef;
  readonly argumentDigest: string;
  readonly previewDigest: string;
  readonly approvedAt: string;
  readonly expiresAt: string;
  readonly reason: string;
  /** Single use: consumed when an execution attempt starts. */
  readonly consumed: boolean;
}

export type ExecutorStatus = 'APPLIED' | 'NOT_APPLIED' | 'UNKNOWN';
export type VerificationObservation = 'EXECUTED' | 'NOT_EXECUTED' | 'UNKNOWN';

export interface Verification {
  readonly observation: VerificationObservation;
  readonly evidence: JsonValue;
  readonly observedAt: string;
  readonly reason: string;
}

export interface ActionExecution {
  readonly attempt: number;
  readonly idempotencyKey: string;
  readonly startedAt: string;
  readonly startedBy: ActorRef;
  readonly finishedAt?: string;
  readonly executorStatus?: ExecutorStatus;
  readonly providerReference?: string;
}

export type OutcomeState = 'SUCCEEDED_VERIFIED' | 'FAILED_VERIFIED' | 'UNKNOWN';

export interface ActionOutcome {
  readonly state: OutcomeState;
  readonly reason: string;
  readonly recordedAt: string;
  readonly verification?: Verification;
}

export interface ActionProposal {
  readonly id: string;
  readonly workspaceId: string;
  /** Client de-duplication key; unique per workspace. */
  readonly requestKey: string;
  readonly capabilityId: string;
  readonly riskClass: RiskClass;
  readonly target: TargetResource;
  /** Deep-frozen JSON arguments; authoritative serialized form is `canonicalArguments`. */
  readonly arguments: JsonValue;
  readonly canonicalArguments: string;
  /** SHA-256 hex of `canonicalArguments`, frozen at proposal time. */
  readonly argumentDigest: string;
  readonly proposer: ActorRef;
  readonly rationale: string;
  readonly constraints: ActionConstraints;
  readonly leadId?: string;
  /** Stable per proposal; passed to the executor on every attempt so providers can dedupe. */
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly state: ActionState;
  /** Optimistic concurrency version; equals the sequence of the latest event. */
  readonly version: number;
  readonly attempts: number;
  readonly preview?: ActionPreview;
  readonly approval?: ActionApproval;
  readonly execution?: ActionExecution;
  readonly outcome?: ActionOutcome;
}

export type ActionEventType =
  | 'PROPOSED'
  | 'PREVIEWED'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'EXECUTION_STARTED'
  | 'OUTCOME_RECORDED'
  | 'VERIFICATION_RECORDED'
  | 'COMMAND_REFUSED';

/** Append-only audit record (I-05). `sequence` is 1-based and contiguous per proposal. */
export interface ActionEvent {
  readonly proposalId: string;
  readonly workspaceId: string;
  readonly sequence: number;
  readonly type: ActionEventType;
  readonly fromState: ActionState | null;
  readonly toState: ActionState;
  readonly actor: ActorRef;
  readonly at: string;
  readonly reason: string;
  readonly data: { readonly [key: string]: JsonValue };
}

export interface Transition {
  readonly proposal: ActionProposal;
  readonly event: ActionEvent;
}

export type GovernedActionErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_ARGUMENTS'
  | 'UNKNOWN_CAPABILITY'
  | 'INVALID_TRANSITION'
  | 'PROPOSAL_EXPIRED'
  | 'AI_CANNOT_AUTHORIZE'
  | 'AI_CANNOT_EXECUTE'
  | 'HUMAN_APPROVER_REQUIRED'
  | 'SELF_APPROVAL_DENIED'
  | 'ACTOR_NOT_AUTHORIZED'
  | 'APPROVAL_EXPIRED'
  | 'REAUTHORIZATION_REQUIRED'
  | 'DIGEST_MISMATCH'
  | 'PREVIEW_STALE'
  | 'KILL_SWITCH_ENGAGED'
  | 'CAPABILITY_DISABLED'
  | 'EXECUTOR_DISABLED'
  | 'CONSTRAINT_VIOLATION'
  | 'OUTCOME_UNKNOWN_RETRY_REFUSED'
  | 'EXECUTION_IN_FLIGHT'
  | 'ALREADY_EXECUTED'
  | 'CONCURRENT_MODIFICATION'
  | 'REQUEST_KEY_CONFLICT'
  | 'POLICY_UNAVAILABLE';

export class GovernedActionError extends Error {
  constructor(
    readonly code: GovernedActionErrorCode,
    message: string,
    readonly details: readonly string[] = [],
  ) {
    super(message);
    this.name = 'GovernedActionError';
  }
}

export function isGovernedActionError(error: unknown): error is GovernedActionError {
  return error instanceof GovernedActionError;
}
