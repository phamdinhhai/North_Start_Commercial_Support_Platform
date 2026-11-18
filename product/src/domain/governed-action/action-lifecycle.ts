import { hasEvidence, resolveProposalEvidence, type CommercialEventLookupResult } from './action-evidence';
import { argumentsIntact, canonicalJson, deepFreeze, freezeArguments, sha256Hex } from './canonical-json';
import { validateArguments, type CapabilityDefinition } from './capability-catalog';
import {
  GovernedActionError, type ActionConstraints, type ActionEvent, type ActionEventType, type ActionProposal,
  type ActionRefusal, type ActionState, type ProposalRefusal, type ActorRef, type ExecutorStatus, type JsonValue, type ObservedState,
  type PreviewChange, type ProposalEvidence, type TargetResource, type Transition, type Verification,
} from './governed-action.types';

export const MIN_PROPOSAL_TTL_MS = 60_000;
export const MAX_PROPOSAL_TTL_MS = 7 * 24 * 60 * 60_000;
export const MAX_APPROVAL_TTL_MS = 24 * 60 * 60_000;

/**
 * Authority as decided by the injected policy. `serviceGrant` must be explicitly true for a
 * `service` actor to trigger execution or verification (A-m2; default deny).
 */
export interface Authority {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly serviceGrant?: boolean;
}

/** Facts gathered by the application layer from ports; the domain makes the decision. */
export interface PolicyFacts {
  readonly authority: Authority;
  readonly capabilityEnabled: boolean;
  readonly killSwitch: { readonly engaged: boolean; readonly reason?: string };
  readonly constraintViolations: readonly string[];
}

export interface ExecutionFacts extends PolicyFacts {
  readonly executorEnabled: boolean;
  /** Fresh read-only observation taken at execute time (R2-I-14). */
  readonly currentState: ObservedState;
}

export interface ProposeInput {
  readonly id: string;
  readonly workspaceId: string;
  readonly requestKey: string;
  readonly capability: CapabilityDefinition;
  readonly target: TargetResource;
  readonly arguments: unknown;
  readonly proposer: ActorRef;
  readonly rationale: string;
  readonly constraints: ActionConstraints;
  readonly constraintViolations: readonly string[];
  readonly ttlMs: number;
  readonly leadId?: string;
  /** ADR-005 R2-P-01: cited CommercialEvent + evidence; required for AI proposers. */
  readonly commercialEventRef?: string;
  readonly evidenceRefs?: readonly unknown[];
  /** Facts about `commercialEventRef` gathered through the CommercialEventLookup port. */
  readonly commercialEvent?: CommercialEventLookupResult;
}

const fail = (code: ConstructorParameters<typeof GovernedActionError>[0], message: string, details: readonly string[] = []): never => {
  throw new GovernedActionError(code, message, details);
};

const ref = (actor: ActorRef): ActorRef => ({ kind: actor.kind, id: actor.id });
/** Event payloads are JSON; the domain records stored here are JSON-compatible by construction. */
const json = (value: unknown): JsonValue => value as JsonValue;

/** Stable Lead IDs are UUIDs (I-07); normalised to lower case. */
const LEAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function normalizeLeadId(leadId: string | undefined): string | undefined {
  if (leadId === undefined) return undefined;
  if (typeof leadId !== 'string' || !LEAD_ID.test(leadId)) fail('INVALID_INPUT', 'leadId must be a UUID');
  return leadId.toLowerCase();
}

/** Idempotency key of one execution attempt; retries of the SAME attempt reuse it (R2-I-15). */
export const attemptIdempotencyKey = (p: Pick<ActionProposal, 'idempotencyKey'>, attempt: number): string =>
  `${p.idempotencyKey}-${attempt}`;

function nonEmpty(value: string | undefined, name: string, max = 256): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) fail('INVALID_INPUT', `${name} is required (1..${max} chars)`);
  return value as string;
}

function transition(
  p: ActionProposal, patch: Partial<ActionProposal>, type: ActionEventType, actor: ActorRef,
  now: Date, reason: string, data: ActionEvent['data'] = {},
): Transition {
  const proposal = deepFreeze({ ...p, ...patch, version: p.version + 1 });
  const event: ActionEvent = deepFreeze({
    proposalId: p.id, workspaceId: p.workspaceId, sequence: proposal.version, type,
    fromState: p.state, toState: proposal.state, actor: ref(actor), at: now.toISOString(), reason, data,
  });
  return { proposal, event };
}

function requireState(p: ActionProposal, allowed: readonly ActionState[], command: string): void {
  if (!allowed.includes(p.state)) fail('INVALID_TRANSITION', `${command} is not allowed from ${p.state}`);
}

function requireNotExpired(p: ActionProposal, now: Date): void {
  if (now.getTime() >= Date.parse(p.expiresAt)) fail('PROPOSAL_EXPIRED', 'proposal has expired');
}

function requireIntact(p: ActionProposal): void {
  if (!argumentsIntact(p)) fail('DIGEST_MISMATCH', 'stored arguments no longer match the frozen digest');
}

function requireGates(facts: PolicyFacts): void {
  if (!facts.capabilityEnabled) fail('CAPABILITY_DISABLED', 'capability is not enabled for this workspace');
  if (facts.killSwitch.engaged) fail('KILL_SWITCH_ENGAGED', facts.killSwitch.reason ?? 'kill switch engaged');
  if (facts.constraintViolations.length > 0) fail('CONSTRAINT_VIOLATION', 'constraints violated', facts.constraintViolations);
}

/** I-03 + A-m2: AI never; service only with an explicit policy grant; humans with authority. */
export function requireRunAuthority(actor: ActorRef, authority: Authority, what: string): void {
  if (actor.kind === 'ai') fail('AI_CANNOT_EXECUTE', `AI actors cannot ${what} (I-03)`);
  if (actor.kind === 'system') fail('ACTOR_NOT_AUTHORIZED', `system housekeeping cannot ${what}`);
  if (!authority.allowed) fail('ACTOR_NOT_AUTHORIZED', authority.reason ?? `actor may not ${what}`);
  if (actor.kind === 'service' && authority.serviceGrant !== true) {
    fail('ACTOR_NOT_AUTHORIZED', `service actors need an explicit policy grant to ${what}`);
  }
}

/** True when the externally observed baseline is no longer the one the approver reviewed. */
export function baselineChanged(reviewed: ObservedState, current: ObservedState): boolean {
  if (reviewed.status !== current.status) return true;
  return reviewed.status === 'OBSERVED' && current.status === 'OBSERVED' && canonicalJson(reviewed.value) !== canonicalJson(current.value);
}

/**
 * PROPOSE — any authorised actor, including AI. AI proposals are drafts only (I-03) and must
 * cite a draft inferred CommercialEvent with evidence (ADR-005 R2-P-01, EVIDENCE_REQUIRED).
 */
export function propose(input: ProposeInput, now: Date): Transition {
  nonEmpty(input.id, 'id', 64);
  nonEmpty(input.workspaceId, 'workspaceId', 128);
  nonEmpty(input.requestKey, 'requestKey', 128);
  nonEmpty(input.rationale, 'rationale', 2000);
  nonEmpty(input.proposer.id, 'proposer.id');
  if (input.proposer.kind === 'system') fail('INVALID_INPUT', 'system cannot propose actions');
  for (const key of ['provider', 'accountId', 'resourceType', 'resourceId'] as const) nonEmpty(input.target?.[key], `target.${key}`, 128);
  if (input.target.resourceType !== input.capability.resourceType) {
    fail('INVALID_INPUT', `capability targets ${input.capability.resourceType}, not ${input.target.resourceType}`);
  }
  if (!Number.isInteger(input.ttlMs) || input.ttlMs < MIN_PROPOSAL_TTL_MS || input.ttlMs > MAX_PROPOSAL_TTL_MS) {
    fail('INVALID_INPUT', 'ttlMs out of bounds');
  }
  const leadId = normalizeLeadId(input.leadId);
  const evidence = resolveProposalEvidence({
    workspaceId: input.workspaceId, proposer: input.proposer, ...(leadId ? { leadId } : {}),
    ...(input.commercialEventRef !== undefined ? { commercialEventRef: input.commercialEventRef } : {}),
    evidenceRefs: input.evidenceRefs, commercialEvent: input.commercialEvent,
  });
  const frozen = freezeArguments(input.arguments);
  const violations = validateArguments(input.capability, frozen.arguments);
  if (violations.length > 0) fail('INVALID_ARGUMENTS', 'arguments do not match capability schema', violations);
  if (input.constraintViolations.length > 0) fail('CONSTRAINT_VIOLATION', 'constraints violated', input.constraintViolations);

  const proposal: ActionProposal = deepFreeze({
    id: input.id, workspaceId: input.workspaceId, requestKey: input.requestKey,
    capabilityId: input.capability.id, riskClass: input.capability.riskClass,
    target: { ...input.target }, arguments: frozen.arguments, canonicalArguments: frozen.canonical,
    argumentDigest: frozen.digest, proposer: ref(input.proposer), rationale: input.rationale,
    constraints: { ...input.constraints, protectedAccountIds: [...input.constraints.protectedAccountIds] },
    ...(leadId ? { leadId } : {}),
    ...(evidence.commercialEventRef ? { commercialEventRef: evidence.commercialEventRef } : {}),
    evidenceRefs: [...evidence.evidenceRefs],
    idempotencyKey: `ga-${input.id}`, createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.ttlMs).toISOString(),
    state: 'PROPOSED', version: 1, attempts: 0,
  });
  const event: ActionEvent = deepFreeze({
    proposalId: proposal.id, workspaceId: proposal.workspaceId, sequence: 1, type: 'PROPOSED',
    fromState: null, toState: 'PROPOSED', actor: ref(input.proposer), at: proposal.createdAt,
    reason: input.rationale,
    data: {
      capabilityId: proposal.capabilityId, argumentDigest: proposal.argumentDigest, draft: input.proposer.kind === 'ai',
      leadId: leadId ?? null, commercialEventRef: evidence.commercialEventRef ?? null, evidenceRefs: [...evidence.evidenceRefs],
    },
  });
  return { proposal, event };
}

/** Derive the human-readable change list from frozen arguments and an observed baseline. */
export function deriveChanges(args: JsonValue, before: ObservedState): PreviewChange[] {
  const record = (args && typeof args === 'object' && !Array.isArray(args)) ? args as { readonly [k: string]: JsonValue } : {};
  const baseline = before.status === 'OBSERVED' && before.value && typeof before.value === 'object' && !Array.isArray(before.value)
    ? before.value as { readonly [k: string]: JsonValue } : undefined;
  return Object.keys(record).sort().map((path) => {
    const known = baseline !== undefined && path in baseline;
    return { path, after: record[path], before: known ? baseline[path] : null, beforeKnown: known };
  });
}

/**
 * The preview digest binds the frozen argument digest, the observed baseline, the change list
 * and — when the proposal cites any — the evidence shown to the approver (ADR-005).
 */
export function previewDigestOf(
  argumentDigest: string, beforeState: ObservedState, changes: readonly PreviewChange[], evidence?: ProposalEvidence,
): string {
  if (!hasEvidence(evidence)) return sha256Hex(canonicalJson({ argumentDigest, beforeState, changes }));
  return sha256Hex(canonicalJson({ argumentDigest, beforeState, changes, evidence: evidenceJson(evidence) }));
}

/** Evidence as plain JSON (stable shape for digests and event data). */
export function evidenceJson(e: ProposalEvidence): { readonly [k: string]: JsonValue } {
  return { commercialEventRef: e.commercialEventRef ?? null, evidenceRefs: [...e.evidenceRefs] };
}

const proposalEvidence = (p: ActionProposal): ProposalEvidence | undefined => {
  const e: ProposalEvidence = { ...(p.commercialEventRef ? { commercialEventRef: p.commercialEventRef } : {}), evidenceRefs: p.evidenceRefs ?? [] };
  return hasEvidence(e) ? e : undefined;
};

/** PREVIEW — read-only; re-preview is how a FAILED_VERIFIED action becomes re-authorizable. */
export function preview(p: ActionProposal, input: { actor: ActorRef; beforeState: ObservedState }, now: Date): Transition {
  requireState(p, ['PROPOSED', 'PREVIEWED', 'FAILED_VERIFIED'], 'preview');
  requireNotExpired(p, now);
  requireIntact(p);
  const changes = deriveChanges(p.arguments, input.beforeState);
  const evidence = proposalEvidence(p);
  const previewDigest = previewDigestOf(p.argumentDigest, input.beforeState, changes, evidence);
  // A-M1: the event carries the full reviewed content, so the digest can be re-derived from history.
  // ADR-005: cited evidence is part of what the approver reviews.
  return transition(p, {
    state: 'PREVIEWED',
    approval: undefined,
    preview: { beforeState: input.beforeState, changes, previewDigest, previewedAt: now.toISOString(), previewedBy: ref(input.actor),
      ...(evidence ? { evidence } : {}) },
  }, 'PREVIEWED', input.actor, now, 'preview generated', {
    previewDigest, argumentDigest: p.argumentDigest, beforeState: json(input.beforeState), changes: json(changes),
    ...(evidence ? { evidence: evidenceJson(evidence) } : {}),
  });
}

export interface AuthorizeInput {
  readonly approver: ActorRef;
  readonly reviewedArgumentDigest: string;
  readonly reviewedPreviewDigest: string;
  readonly reason: string;
  readonly facts: PolicyFacts;
}

/**
 * AUTHORIZE — distinct human with authority. The approval binds the argument digest and
 * preview digest the human actually reviewed, and expires.
 * ADR-006 — authority is an injected policy fact (capability matrix); nothing here grants a role.
 */
export function authorize(p: ActionProposal, input: AuthorizeInput, now: Date): Transition {
  if (input.approver.kind === 'ai') fail('AI_CANNOT_AUTHORIZE', 'AI actors produce drafts only and can never authorize (I-03)');
  if (input.approver.kind !== 'human') fail('HUMAN_APPROVER_REQUIRED', 'only a human may authorize an action');
  if (input.approver.id === p.proposer.id) fail('SELF_APPROVAL_DENIED', 'proposer and approver must be different people');
  requireState(p, ['PREVIEWED'], 'authorize');
  requireNotExpired(p, now);
  nonEmpty(input.reason, 'reason', 2000);
  if (!input.facts.authority.allowed) fail('ACTOR_NOT_AUTHORIZED', input.facts.authority.reason ?? 'approver lacks authority');
  requireIntact(p);
  if (input.reviewedArgumentDigest !== p.argumentDigest) fail('DIGEST_MISMATCH', 'reviewed arguments differ from the proposal');
  if (!p.preview || input.reviewedPreviewDigest !== p.preview.previewDigest) fail('PREVIEW_STALE', 'reviewed preview is not the current preview');
  requireGates(input.facts);
  const ttl = Math.min(Math.max(0, p.constraints.approvalTtlMs), MAX_APPROVAL_TTL_MS);
  if (ttl <= 0) fail('INVALID_INPUT', 'approval TTL must be positive');
  const expiresAt = new Date(Math.min(now.getTime() + ttl, Date.parse(p.expiresAt))).toISOString();
  return transition(p, {
    state: 'AUTHORIZED',
    approval: {
      approver: ref(input.approver), argumentDigest: p.argumentDigest, previewDigest: p.preview!.previewDigest,
      approvedAt: now.toISOString(), expiresAt, reason: input.reason, consumed: false,
    },
  }, 'AUTHORIZED', input.approver, now, input.reason, {
    argumentDigest: p.argumentDigest, previewDigest: p.preview!.previewDigest, approvalExpiresAt: expiresAt,
  });
}

/** REJECT — human with authority, not the proposer (who would simply cancel). */
export function reject(p: ActionProposal, input: { actor: ActorRef; reason: string; authorityAllowed: boolean }, now: Date): Transition {
  if (input.actor.kind !== 'human') fail(input.actor.kind === 'ai' ? 'AI_CANNOT_AUTHORIZE' : 'HUMAN_APPROVER_REQUIRED', 'only a human may reject');
  requireState(p, ['PROPOSED', 'PREVIEWED', 'AUTHORIZED'], 'reject');
  if (!input.authorityAllowed) fail('ACTOR_NOT_AUTHORIZED', 'actor lacks authority to reject');
  return transition(p, { state: 'REJECTED' }, 'REJECTED', input.actor, now, nonEmpty(input.reason, 'reason', 2000));
}

/** CANCEL — the proposer (human or AI withdrawing its own draft) or a human with authority. */
export function cancel(p: ActionProposal, input: { actor: ActorRef; reason: string; authorityAllowed: boolean }, now: Date): Transition {
  requireState(p, ['PROPOSED', 'PREVIEWED', 'AUTHORIZED', 'FAILED_VERIFIED'], 'cancel');
  const isProposer = input.actor.id === p.proposer.id && input.actor.kind === p.proposer.kind;
  if (!isProposer && !(input.actor.kind === 'human' && input.authorityAllowed)) fail('ACTOR_NOT_AUTHORIZED', 'actor may not cancel this proposal');
  return transition(p, { state: 'CANCELLED' }, 'CANCELLED', input.actor, now, nonEmpty(input.reason, 'reason', 2000));
}

export interface HousekeepingInput {
  /** The real triggering actor; `system` only for a genuinely system-initiated sweep (A-m3). */
  readonly actor: ActorRef;
  readonly authorityAllowed: boolean;
  /** What caused the housekeeping: an explicit command, an expired approval seen at execute, or a sweep. */
  readonly trigger: 'command' | 'execute' | 'sweep';
}

/** Housekeeping (expire / stale recovery): never AI; otherwise needs housekeeping authority. */
function requireHousekeeping(input: HousekeepingInput, what: string): void {
  if (input.actor.kind === 'ai') fail('ACTOR_NOT_AUTHORIZED', `AI actors cannot ${what} (I-03)`);
  if (input.actor.kind !== 'system' && !input.authorityAllowed) fail('ACTOR_NOT_AUTHORIZED', `actor may not ${what}`);
}

/** EXPIRE — housekeeping when the proposal or its approval window has elapsed. */
export function expire(p: ActionProposal, input: HousekeepingInput, now: Date): Transition {
  requireHousekeeping(input, 'expire proposals');
  requireState(p, ['PROPOSED', 'PREVIEWED', 'AUTHORIZED'], 'expire');
  const proposalExpired = now.getTime() >= Date.parse(p.expiresAt);
  const approvalExpired = p.state === 'AUTHORIZED' && !!p.approval && now.getTime() >= Date.parse(p.approval.expiresAt);
  if (!proposalExpired && !approvalExpired) fail('INVALID_TRANSITION', 'nothing has expired');
  return transition(p, { state: 'EXPIRED' }, 'EXPIRED', input.actor, now,
    approvalExpired && !proposalExpired ? 'approval expired before execution' : 'proposal expired', { trigger: input.trigger });
}

/**
 * EXECUTE (start) — refuses UNKNOWN outcomes outright: a consequential action whose effect is
 * unknown is never retried until readback proves it did not execute. Consumes the approval.
 */
export function beginExecution(p: ActionProposal, input: { actor: ActorRef; facts: ExecutionFacts }, now: Date): Transition {
  if (p.state === 'UNKNOWN') fail('OUTCOME_UNKNOWN_RETRY_REFUSED', 'previous outcome is UNKNOWN; verify by readback before any retry');
  if (p.state === 'EXECUTING') fail('EXECUTION_IN_FLIGHT', 'an execution attempt is already in flight');
  if (p.state === 'SUCCEEDED_VERIFIED') fail('ALREADY_EXECUTED', 'action already executed and verified');
  if (p.state === 'FAILED_VERIFIED') fail('REAUTHORIZATION_REQUIRED', 're-preview and re-authorize before another attempt');
  requireState(p, ['AUTHORIZED'], 'execute');
  requireRunAuthority(input.actor, input.facts.authority, 'trigger execution');
  const approval = p.approval;
  if (!approval || approval.consumed) fail('REAUTHORIZATION_REQUIRED', 'no unused approval');
  if (now.getTime() >= Date.parse(approval!.expiresAt)) fail('APPROVAL_EXPIRED', 'approval has expired');
  requireNotExpired(p, now);
  requireIntact(p);
  if (approval!.argumentDigest !== p.argumentDigest || approval!.previewDigest !== p.preview?.previewDigest) {
    fail('DIGEST_MISMATCH', 'approval is not bound to the current arguments/preview');
  }
  if (!input.facts.executorEnabled) fail('EXECUTOR_DISABLED', 'no executor is enabled');
  // R2-I-14: the approver reviewed a specific baseline; if it moved, the approval no longer applies.
  if (baselineChanged(p.preview!.beforeState, input.facts.currentState)) {
    fail('PREVIEW_STALE', 'external state changed since the reviewed preview; re-preview and re-authorize');
  }
  requireGates(input.facts);
  const attempt = p.attempts + 1;
  const idempotencyKey = attemptIdempotencyKey(p, attempt);
  return transition(p, {
    state: 'EXECUTING', attempts: attempt, approval: { ...approval!, consumed: true }, outcome: undefined,
    execution: { attempt, idempotencyKey, startedAt: now.toISOString(), startedBy: ref(input.actor) },
  }, 'EXECUTION_STARTED', input.actor, now, 'execution attempt started', {
    attempt, idempotencyKey, approvedPreviewDigest: approval!.previewDigest, currentState: json(input.facts.currentState),
  });
}

export interface ExecutionResultInput {
  readonly executorStatus: ExecutorStatus;
  readonly reason: string;
  readonly providerReference?: string;
  readonly verification?: Verification;
  /** False when nothing reached the provider (kill switch before dispatch). Default true. */
  readonly dispatched?: boolean;
}

/** Outcome is VERIFIED only when the executor claim and an independent readback agree. */
export function recordExecutionResult(p: ActionProposal, input: ExecutionResultInput, now: Date): Transition {
  requireState(p, ['EXECUTING'], 'record outcome');
  const obs = input.verification?.observation;
  const state = input.executorStatus === 'APPLIED' && obs === 'EXECUTED' ? 'SUCCEEDED_VERIFIED'
    : input.executorStatus === 'NOT_APPLIED' && obs === 'NOT_EXECUTED' ? 'FAILED_VERIFIED' : 'UNKNOWN';
  const reason = state === 'UNKNOWN' && input.executorStatus !== 'UNKNOWN'
    ? `executor reported ${input.executorStatus} but readback was ${obs ?? 'unavailable'}` : input.reason;
  return transition(p, {
    state,
    execution: { ...p.execution!, finishedAt: now.toISOString(), executorStatus: input.executorStatus,
      ...(input.providerReference ? { providerReference: input.providerReference } : {}) },
    outcome: { state, reason, recordedAt: now.toISOString(), ...(input.verification ? { verification: input.verification } : {}) },
  }, 'OUTCOME_RECORDED', { kind: 'system', id: 'governed-action-runtime' }, now, reason, {
    // A-M1: everything needed to reconstruct this attempt from history alone.
    source: 'executor', outcome: state, attempt: p.attempts, executorStatus: input.executorStatus,
    executorReason: input.reason, providerReference: input.providerReference ?? null,
    readback: obs ?? 'UNAVAILABLE', verification: json(input.verification ?? null), dispatched: input.dispatched !== false,
    triggeredBy: json(p.execution ? ref(p.execution.startedBy) : null),
  });
}

/** VERIFY — resolves UNKNOWN only from readback evidence; never by re-executing. */
export function recordVerification(
  p: ActionProposal, input: { actor: ActorRef; verification: Verification; authority: Authority }, now: Date,
): Transition {
  requireState(p, ['UNKNOWN'], 'verify');
  requireRunAuthority(input.actor, input.authority, 'resolve action outcomes');
  const obs = input.verification.observation;
  const state: ActionState = obs === 'EXECUTED' ? 'SUCCEEDED_VERIFIED' : obs === 'NOT_EXECUTED' ? 'FAILED_VERIFIED' : 'UNKNOWN';
  return transition(p, {
    state,
    outcome: { state: state as 'SUCCEEDED_VERIFIED' | 'FAILED_VERIFIED' | 'UNKNOWN', reason: input.verification.reason,
      recordedAt: now.toISOString(), verification: input.verification },
  }, 'VERIFICATION_RECORDED', input.actor, now, input.verification.reason, {
    observation: obs, outcome: state, attempt: p.attempts, verification: json(input.verification),
  });
}

/** A crashed/abandoned EXECUTING attempt becomes UNKNOWN after its lease — never re-executed. */
export function markStaleExecution(p: ActionProposal, input: HousekeepingInput & { leaseMs: number }, now: Date): Transition {
  requireHousekeeping(input, 'recover stale executions');
  requireState(p, ['EXECUTING'], 'mark stale');
  if (!p.execution || now.getTime() < Date.parse(p.execution.startedAt) + input.leaseMs) fail('EXECUTION_IN_FLIGHT', 'execution lease still active');
  return transition(p, {
    state: 'UNKNOWN',
    outcome: { state: 'UNKNOWN', reason: 'EXECUTION_LEASE_EXPIRED', recordedAt: now.toISOString() },
  }, 'OUTCOME_RECORDED', input.actor, now, 'EXECUTION_LEASE_EXPIRED', {
    source: 'lease-expired', outcome: 'UNKNOWN', attempt: p.attempts, leaseMs: input.leaseMs, trigger: input.trigger,
  });
}

/**
 * Audit a refused command (I-05: refusals are inspectable too). Returns a record for the
 * separate append-only refusal log; it never bumps the proposal version (A-m1, R2-I-01).
 */
export function recordRefusal(p: ActionProposal, actor: ActorRef, command: string, error: GovernedActionError, now: Date): ActionRefusal {
  return deepFreeze({
    proposalId: p.id, workspaceId: p.workspaceId, proposalVersion: p.version, command: command.slice(0, 64),
    code: error.code, actor: ref(actor), at: now.toISOString(), reason: error.message.slice(0, 2000), details: [...error.details],
  });
}

const UUID_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const label = (value: unknown, max: number): string => {
  const text = typeof value === 'string' ? value.trim().slice(0, max) : '';
  return text.length > 0 ? text : '-';
};

/**
 * Audit a refused PROPOSE (ADR-005 R2-P-01: e.g. EVIDENCE_REQUIRED). No proposal exists, so the
 * record is keyed by workspace + request key in a separate append-only log (I-05).
 */
export function recordProposalRefusal(
  input: { readonly workspaceId: string; readonly requestKey?: unknown; readonly capabilityId?: unknown; readonly leadId?: unknown;
    readonly commercialEventRef?: unknown },
  actor: ActorRef, error: GovernedActionError, now: Date,
): ProposalRefusal {
  const uuid = (v: unknown) => (typeof v === 'string' && UUID_REF.test(v) ? v.toLowerCase() : undefined);
  const leadId = uuid(input.leadId);
  const commercialEventRef = uuid(input.commercialEventRef);
  return deepFreeze({
    workspaceId: input.workspaceId, requestKey: label(input.requestKey, 128), capabilityId: label(input.capabilityId, 128),
    ...(leadId ? { leadId } : {}), ...(commercialEventRef ? { commercialEventRef } : {}),
    code: error.code, actor: ref(actor), at: now.toISOString(), reason: error.message.slice(0, 2000), details: [...error.details],
  });
}
