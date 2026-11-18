import type {
  ActionActor, ActionConstraints, ActionEvent, ActionProposal, JsonValue, ObservedState, RiskClass,
  TargetResource, Transition, Verification,
} from '../domain/governed-action/governed-action.types';

/**
 * Ports for the Governed Commercial Action runtime.
 *
 * No live provider implementation of ActionExecutor/ActionVerifier exists in this
 * codebase. `ActionExecutor.mode` is deliberately typed to 'disabled' | 'synthetic' so a
 * live executor cannot be plugged in without a reviewed type change (Human Gate).
 */

export type PolicyDecision = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

export interface ActionPolicyContext {
  readonly workspaceId: string;
  readonly capabilityId: string;
  readonly riskClass: RiskClass;
  readonly target: TargetResource;
  readonly leadId?: string;
}

/**
 * Authority + constraints. Unavailable/throwing policy is treated as DENY (fail closed).
 * OPEN: PM-1 — the capability matrix (which roles may propose/approve/execute which
 * capability) is not canonical; implementations must not widen existing access.
 * OPEN: PM-1 — lead-scoped action authority (I-09) for lead-linked actions is undecided.
 */
export interface ActionPolicy {
  constraintsFor(ctx: ActionPolicyContext): Promise<ActionConstraints>;
  mayPropose(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision>;
  mayApprove(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision>;
  mayTriggerExecution(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision>;
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
 * All reads are workspace scoped; a foreign workspace sees nothing (I-09).
 */
export interface ActionStore {
  create(transition: Transition): Promise<CreateResult>;
  get(workspaceId: string, proposalId: string): Promise<ActionProposal | undefined>;
  transition(expectedVersion: number, transition: Transition): Promise<void>;
  events(workspaceId: string, proposalId: string): Promise<ActionEvent[]>;
}

export interface GovernedActionClock {
  now(): Date;
}
