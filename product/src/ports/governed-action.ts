import type { AssertionEnvelope } from '../domain/commercial-event/commercial-event';
import type {
  ActionActor, ActionConstraints, ActionEvent, ActionPrincipal, ActionProposal, ActionRefusal, ActorRef, CommercialEventFacts,
  JsonValue, ObservedState, ProposalRefusal, RiskClass, TargetResource, Transition, Verification,
} from '../domain/governed-action/governed-action.types';
import type { AuthRole } from './auth';

/**
 * Ports for the Governed Commercial Action runtime.
 *
 * No live provider implementation of ActionExecutor/ActionVerifier exists in this
 * codebase. `ActionExecutor.mode` is deliberately typed to 'disabled' | 'synthetic' so a
 * live executor cannot be plugged in without a reviewed type change (Human Gate).
 */

/**
 * `serviceGrant: true` is the explicit grant a `service` actor needs to trigger execution or
 * verification (A-m2). Absent ⇒ service actors are denied even when `allowed` is true.
 */
export type PolicyDecision =
  | { readonly allowed: true; readonly serviceGrant?: boolean }
  | { readonly allowed: false; readonly reason: string };

export type ActionReadCommand = 'get' | 'history' | 'refusals';
export type ActionHousekeepingCommand = 'expire' | 'recover';

export interface ActionPolicyContext {
  readonly workspaceId: string;
  readonly capabilityId: string;
  readonly riskClass: RiskClass;
  readonly target: TargetResource;
  readonly leadId?: string;
  /** Proposer of an EXISTING proposal (absent while proposing), so a policy can scope AI to its own drafts. */
  readonly proposer?: ActorRef;
}

/**
 * Authority + constraints. Unavailable/throwing policy is treated as DENY (fail closed).
 * ADR-006 — production implementation: CapabilityMatrixActionPolicy (capability matrix with
 * risk tiers; sales lead-scoped; AI draft-only; service none). Implementations must never widen
 * I-09 lead access.
 */
export interface ActionPolicy {
  constraintsFor(ctx: ActionPolicyContext): Promise<ActionConstraints>;
  mayPropose(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision>;
  mayApprove(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision>;
  mayTriggerExecution(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision>;
  /** Reads of a proposal, its history and its refusal log (I-09; A-M4). Default deny. */
  mayRead(actor: ActionActor, ctx: ActionPolicyContext, command: ActionReadCommand): Promise<PolicyDecision>;
  /** Housekeeping: expire / stale-execution recovery (A-M4). AI is refused before this. Default deny. */
  mayHousekeep(actor: ActionActor, ctx: ActionPolicyContext, command: ActionHousekeepingCommand): Promise<PolicyDecision>;
  /**
   * Lead-scoped access hook (I-09), consulted for EVERY command on a lead-linked proposal in
   * addition to the command decision. Implementations should back it with the lead store /
   * lead RBAC (existence + workspace + assignment). Default deny.
   * ADR-006 — backed by LeadAccessPort (RBAC canAccessLead); no role is invented here.
   */
  mayAccessLead(actor: ActionActor, ctx: ActionPolicyContext & { readonly leadId: string }): Promise<PolicyDecision>;
  /** ADR-006 — engaging/releasing the kill switch: admin only. Default deny. */
  mayOperateKillSwitch(actor: ActionActor, ctx: { readonly workspaceId: string; readonly capabilityId?: string }): Promise<PolicyDecision>;
}

/** ADR-006 — base role from server-side membership (never from IdP claims, headers or bodies). */
export interface WorkspaceRoleLookup {
  baseRoleOf(workspaceId: string, userId: string): Promise<AuthRole | undefined>;
}

/** Who asks for lead access, with the membership base role. */
export interface LeadAccessSubject {
  readonly workspaceId: string;
  readonly userId: string;
  readonly baseRole: AuthRole;
}

/**
 * I-09 lead-scope hook (ADR-006). Production composition backs it with the lead store +
 * RbacService.canAccessLead (see infra/governed-action/lead-access.ts). Errors ⇒ deny.
 */
export interface LeadAccessPort {
  canAccessLead(subject: LeadAccessSubject, leadId: string): Promise<boolean>;
}

/**
 * ADR-005 R2-P-01 — read-only lookup of a cited CommercialEvent, workspace scoped. A foreign or
 * missing event is `undefined` (indistinguishable, I-09).
 */
export interface CommercialEventLookup {
  find(workspaceId: string, commercialEventId: string): Promise<CommercialEventFacts | undefined>;
}

/**
 * ADR-005 R2-P-02 — receives `observed` AssertionEnvelopes for verified action outcomes. Must be
 * idempotent on `assertionId`. It records evidence only and must never change Commercial State.
 */
export interface AssertionSink {
  emit(envelope: AssertionEnvelope): Promise<void>;
}

/** ADR-006 — workspace-scoped kill-switch control (admin only, audited by the implementation). */
export interface ActionKillSwitchControl {
  set(input: {
    readonly workspaceId: string; readonly capabilityId?: string; readonly engaged: boolean;
    readonly actor: ActorRef; readonly reason: string; readonly at: string;
  }): Promise<void>;
}

/**
 * Resolves the caller's actor KIND (human / ai / service) server-side from the identity or
 * credential source (A-m2). The kind is never taken from the caller. `undefined` ⇒ refused.
 * ADR-006 — production: AuthContextActorResolver (members ⇒ human via membership; a server-side
 * registry of service/AI principals).
 */
export interface ActorResolver {
  resolve(principal: ActionPrincipal): Promise<ActionActor | undefined>;
}

export interface KillSwitchStatus {
  readonly engaged: boolean;
  readonly scope?: 'global' | 'capability';
  readonly reason?: string;
}

/** Global + per-capability kill switch; checked at authorize AND execute. Errors ⇒ engaged. */
export interface ActionKillSwitch {
  status(ctx: { readonly workspaceId: string; readonly capabilityId: string }): Promise<KillSwitchStatus>;
}

/** Capabilities are disabled by default; enablement is explicit and workspace scoped. */
export interface CapabilityEnablement {
  isEnabled(workspaceId: string, capabilityId: string): Promise<boolean>;
}

export interface ActionRequest {
  readonly workspaceId: string;
  readonly proposalId: string;
  readonly capabilityId: string;
  readonly target: TargetResource;
  readonly arguments: JsonValue;
  readonly canonicalArguments: string;
  readonly argumentDigest: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
}

export type ActionExecutionResult =
  | { readonly status: 'APPLIED'; readonly providerReference?: string; readonly reason?: string }
  | { readonly status: 'NOT_APPLIED'; readonly reason: string }
  | { readonly status: 'UNKNOWN'; readonly reason: string };

export interface ActionExecutor {
  readonly mode: 'disabled' | 'synthetic';
  /** Must honour `idempotencyKey`; the runtime aborts `signal` on timeout and records UNKNOWN. */
  execute(request: ActionRequest, signal: AbortSignal): Promise<ActionExecutionResult>;
}

/** Independent readback. Never mutates the provider. */
export interface ActionVerifier {
  readCurrentState(request: Omit<ActionRequest, 'attempt'>, signal: AbortSignal): Promise<ObservedState>;
  readback(request: ActionRequest, signal: AbortSignal): Promise<Verification>;
}

export interface CreateResult {
  readonly created: boolean;
  /** The stored proposal (the pre-existing one when `created` is false). */
  readonly proposal: ActionProposal;
}

/**
 * Persistence. `transition` is compare-and-set on `expectedVersion` and appends the event
 * atomically; a lost race throws GovernedActionError('CONCURRENT_MODIFICATION').
 * Refusals are appended to a separate append-only log that never touches the proposal
 * version (A-m1). All reads are workspace scoped; a foreign workspace sees nothing (I-09).
 */
export interface ActionStore {
  create(transition: Transition): Promise<CreateResult>;
  get(workspaceId: string, proposalId: string): Promise<ActionProposal | undefined>;
  transition(expectedVersion: number, transition: Transition): Promise<void>;
  events(workspaceId: string, proposalId: string): Promise<ActionEvent[]>;
  appendRefusal(refusal: ActionRefusal): Promise<void>;
  refusals(workspaceId: string, proposalId: string): Promise<ActionRefusal[]>;
  /** Refused PROPOSE commands (no proposal exists), append-only (ADR-005 R2-P-01). */
  appendProposalRefusal(refusal: ProposalRefusal): Promise<void>;
  proposalRefusals(workspaceId: string): Promise<ProposalRefusal[]>;
}

export interface GovernedActionClock {
  now(): Date;
}
