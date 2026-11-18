import { randomUUID } from 'node:crypto';
import { evaluateConstraints, type ConstraintStage } from '../../domain/governed-action/action-constraints';
import {
  authorize, beginExecution, cancel, expire, markStaleExecution, preview, propose, recordExecutionResult,
  recordRefusal, recordVerification, reject, type ExecutionFacts, type PolicyFacts,
} from '../../domain/governed-action/action-lifecycle';
import { findCapability, type CapabilityDefinition } from '../../domain/governed-action/capability-catalog';
import {
  GovernedActionError, isGovernedActionError, type ActionActor, type ActionEvent, type ActionProposal,
  type JsonValue, type ObservedState, type TargetResource, type Transition, type Verification,
} from '../../domain/governed-action/governed-action.types';
import type {
  ActionExecutionResult, ActionExecutor, ActionKillSwitch, ActionPolicy, ActionPolicyContext, ActionRequest,
  ActionStore, ActionVerifier, CapabilityEnablement, GovernedActionClock, KillSwitchStatus, PolicyDecision,
} from '../../ports/governed-action';
import { withDeadline } from './deadline';

export interface GovernedActionDeps {
  readonly store: ActionStore;
  readonly policy: ActionPolicy;
  readonly executor: ActionExecutor;
  readonly verifier: ActionVerifier;
  readonly killSwitch: ActionKillSwitch;
  readonly enablement: CapabilityEnablement;
  readonly clock?: GovernedActionClock;
  readonly newId?: () => string;
  readonly executionTimeoutMs?: number;
  readonly readbackTimeoutMs?: number;
  readonly executionLeaseMs?: number;
}

export interface ProposeCommand {
  readonly requestKey: string;
  readonly capabilityId: string;
  readonly target: TargetResource;
  readonly arguments: unknown;
  readonly rationale: string;
  readonly ttlMs?: number;
  readonly leadId?: string;
}

export interface AuthorizeCommand {
  readonly reviewedArgumentDigest: string;
  readonly reviewedPreviewDigest: string;
  readonly reason: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60_000;
const DENY_UNAVAILABLE: PolicyDecision = { allowed: false, reason: 'POLICY_UNAVAILABLE' };

/**
 * Governed Commercial Action runtime: Propose → Preview → Authorize → Execute → Verify → Audit.
 * Not wired to HTTP in this round. Every command is workspace scoped from the authenticated
 * actor; every state change and every in-workspace refusal is appended to the event log.
 */
export class GovernedActionService {
  private readonly clock: GovernedActionClock;
  private readonly newId: () => string;
  private readonly executionTimeoutMs: number;
  private readonly readbackTimeoutMs: number;
  private readonly executionLeaseMs: number;

  constructor(private readonly deps: GovernedActionDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
    this.newId = deps.newId ?? randomUUID;
    this.executionTimeoutMs = deps.executionTimeoutMs ?? 10_000;
    this.readbackTimeoutMs = deps.readbackTimeoutMs ?? 10_000;
    this.executionLeaseMs = deps.executionLeaseMs ?? 5 * 60_000;
  }

  async propose(actor: ActionActor, command: ProposeCommand): Promise<ActionProposal> {
    const capability = this.capability(command.capabilityId);
    const ctx: ActionPolicyContext = {
      workspaceId: actor.workspaceId, capabilityId: capability.id, riskClass: capability.riskClass,
      target: command.target, ...(command.leadId ? { leadId: command.leadId } : {}),
    };
    const decision = await this.decide(() => this.deps.policy.mayPropose(actor, ctx));
    if (!decision.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason);
    const constraints = await this.constraints(ctx);
    const t = propose({
      id: this.newId(), workspaceId: actor.workspaceId, requestKey: command.requestKey, capability,
      target: command.target, arguments: command.arguments, proposer: actor, rationale: command.rationale,
      constraints, ttlMs: command.ttlMs ?? DEFAULT_TTL_MS, ...(command.leadId ? { leadId: command.leadId } : {}),
      constraintViolations: evaluateConstraints({
        capability, target: command.target, arguments: command.arguments as JsonValue, constraints, stage: 'propose',
      }),
    }, this.clock.now());
    const result = await this.deps.store.create(t);
    if (!result.created) {
      const existing = result.proposal;
      if (existing.argumentDigest !== t.proposal.argumentDigest || existing.capabilityId !== capability.id ||
          !sameTarget(existing.target, t.proposal.target)) {
        throw new GovernedActionError('REQUEST_KEY_CONFLICT', 'requestKey already used for a different action');
      }
    }
    return result.proposal;
  }

  async preview(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'preview', async () => {
      const decision = await this.decide(() => this.deps.policy.mayPropose(actor, this.ctx(p)));
      if (!decision.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason);
      const beforeState = await this.readCurrentState(p);
      return preview(p, { actor, beforeState }, this.clock.now());
    });
  }

  async authorize(actor: ActionActor, proposalId: string, command: AuthorizeCommand): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'authorize', async () => {
      const facts = await this.policyFacts(p, 'authorize', () => this.deps.policy.mayApprove(actor, this.ctx(p)));
      return authorize(p, { approver: actor, ...command, facts }, this.clock.now());
    });
  }

  async reject(actor: ActionActor, proposalId: string, reason: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'reject', async () => {
      const decision = await this.decide(() => this.deps.policy.mayApprove(actor, this.ctx(p)));
      return reject(p, { actor, reason, authorityAllowed: decision.allowed }, this.clock.now());
    });
  }

  async cancel(actor: ActionActor, proposalId: string, reason: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'cancel', async () => {
      const decision = await this.decide(() => this.deps.policy.mayApprove(actor, this.ctx(p)));
      return cancel(p, { actor, reason, authorityAllowed: decision.allowed }, this.clock.now());
    });
  }

  /** Housekeeping: move an elapsed proposal/approval to EXPIRED. */
  async expire(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'expire', async () => expire(p, this.clock.now()));
  }

  async execute(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    let begun: Transition;
    try {
      const policyFacts = await this.policyFacts(p, 'execute', () => this.deps.policy.mayTriggerExecution(actor, this.ctx(p)));
      const facts: ExecutionFacts = { ...policyFacts, executorEnabled: this.deps.executor.mode === 'synthetic' };
      begun = beginExecution(p, { actor, facts }, this.clock.now());
    } catch (error) {
      if (isGovernedActionError(error) && error.code === 'APPROVAL_EXPIRED') {
        await this.deps.store.transition(p.version, expire(p, this.clock.now())).catch(() => undefined);
        throw error;
      }
      throw await this.audited(p, actor, 'execute', error);
    }
    // Compare-and-set: of N concurrent callers exactly one reaches the executor.
    await this.deps.store.transition(p.version, begun);
    const running = begun.proposal;
    const request = this.request(running);

    let result: ActionExecutionResult;
    let verification: Verification | undefined;
    const lastLook = await this.killStatus(running);
    if (lastLook.engaged) {
      const reason = 'KILL_SWITCH_ENGAGED_BEFORE_DISPATCH';
      result = { status: 'NOT_APPLIED', reason };
      verification = { observation: 'NOT_EXECUTED', evidence: { dispatched: false }, observedAt: this.clock.now().toISOString(), reason };
    } else {
      const outcome = await withDeadline((signal) => this.deps.executor.execute(request, signal), this.executionTimeoutMs);
      result = outcome.ok ? sanitizeResult(outcome.value)
        : { status: 'UNKNOWN', reason: outcome.timedOut ? 'EXECUTOR_TIMEOUT' : 'EXECUTOR_ERROR' };
      if (result.status !== 'UNKNOWN') verification = await this.readback(request);
    }
    const done = recordExecutionResult(running, {
      executorStatus: result.status, reason: result.reason ?? result.status, verification,
      ...(result.status === 'APPLIED' && result.providerReference ? { providerReference: result.providerReference } : {}),
    }, this.clock.now());
    await this.deps.store.transition(running.version, done);
    return done.proposal;
  }

  /** Resolve an UNKNOWN outcome strictly from readback evidence. Never re-executes. */
  async verify(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'verify', async () => {
      if (p.state !== 'UNKNOWN') throw new GovernedActionError('INVALID_TRANSITION', `verify is not allowed from ${p.state}`);
      if (actor.kind === 'ai') throw new GovernedActionError('AI_CANNOT_EXECUTE', 'AI actors cannot resolve action outcomes');
      const decision = await this.decide(() => this.deps.policy.mayTriggerExecution(actor, this.ctx(p)));
      if (!decision.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason);
      const verification = await this.readback(this.request(p));
      return recordVerification(p, { actor, verification }, this.clock.now());
    });
  }

  /** Crash recovery: EXECUTING past its lease becomes UNKNOWN (then verify). */
  async recoverStaleExecution(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    const p = await this.load(actor, proposalId);
    return this.guard(p, actor, 'recover', async () => markStaleExecution(p, this.executionLeaseMs, this.clock.now()));
  }

  async history(actor: ActionActor, proposalId: string): Promise<ActionEvent[]> {
    await this.load(actor, proposalId);
    return this.deps.store.events(actor.workspaceId, proposalId);
  }

  async get(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    return this.load(actor, proposalId);
  }

  // ---------------------------------------------------------------- helpers

  private capability(id: string): CapabilityDefinition {
    const capability = findCapability(id);
    if (!capability) throw new GovernedActionError('UNKNOWN_CAPABILITY', `unknown capability: ${id}`);
    return capability;
  }

  private async load(actor: ActionActor, proposalId: string): Promise<ActionProposal> {
    if (!actor?.workspaceId) throw new GovernedActionError('INVALID_INPUT', 'actor workspace is required');
    const p = await this.deps.store.get(actor.workspaceId, proposalId);
    // Foreign-workspace proposals are indistinguishable from missing ones (I-09).
    if (!p || p.workspaceId !== actor.workspaceId) throw new GovernedActionError('NOT_FOUND', 'proposal not found');
    return p;
  }

  private ctx(p: ActionProposal): ActionPolicyContext {
    return { workspaceId: p.workspaceId, capabilityId: p.capabilityId, riskClass: p.riskClass, target: p.target,
      ...(p.leadId ? { leadId: p.leadId } : {}) };
  }

  private request(p: ActionProposal): ActionRequest {
    return { workspaceId: p.workspaceId, proposalId: p.id, capabilityId: p.capabilityId, target: p.target,
      arguments: p.arguments, canonicalArguments: p.canonicalArguments, argumentDigest: p.argumentDigest,
      idempotencyKey: p.idempotencyKey, attempt: Math.max(1, p.attempts) };
  }

  /** Run a domain command; persist its transition, or audit the refusal and rethrow. */
  private async guard(p: ActionProposal, actor: ActionActor, command: string, run: () => Promise<Transition>): Promise<ActionProposal> {
    let t: Transition;
    try {
      t = await run();
    } catch (error) {
      throw await this.audited(p, actor, command, error);
    }
    await this.deps.store.transition(p.version, t);
    return t.proposal;
  }

  private async audited(p: ActionProposal, actor: ActionActor, command: string, error: unknown): Promise<unknown> {
    if (isGovernedActionError(error) && error.code !== 'CONCURRENT_MODIFICATION') {
      // Best effort: a lost race on the refusal record must not mask the original refusal.
      await this.deps.store.transition(p.version, recordRefusal(p, actor, command, error, this.clock.now())).catch(() => undefined);
    }
    return error;
  }

  private async decide(fn: () => Promise<PolicyDecision>): Promise<PolicyDecision> {
    try {
      const d = await fn();
      return d && d.allowed === true ? d : { allowed: false, reason: (d as { reason?: string })?.reason ?? 'DENIED' };
    } catch {
      return DENY_UNAVAILABLE;
    }
  }

  private async constraints(ctx: ActionPolicyContext) {
    try {
      return await this.deps.policy.constraintsFor(ctx);
    } catch {
      throw new GovernedActionError('POLICY_UNAVAILABLE', 'constraint policy unavailable');
    }
  }

  private async killStatus(p: ActionProposal): Promise<KillSwitchStatus> {
    try {
      const s = await this.deps.killSwitch.status({ workspaceId: p.workspaceId, capabilityId: p.capabilityId });
      return s && s.engaged === false ? s : { engaged: true, reason: s?.reason ?? 'kill switch engaged' };
    } catch {
      return { engaged: true, reason: 'kill switch unavailable (fail closed)' };
    }
  }

  private async enabled(p: ActionProposal): Promise<boolean> {
    try {
      return (await this.deps.enablement.isEnabled(p.workspaceId, p.capabilityId)) === true;
    } catch {
      return false;
    }
  }

  private async policyFacts(p: ActionProposal, stage: ConstraintStage,
    authority: () => Promise<PolicyDecision>): Promise<PolicyFacts> {
    const [decision, capabilityEnabled, killSwitch, constraints] = await Promise.all([
      this.decide(authority), this.enabled(p), this.killStatus(p), this.constraints(this.ctx(p)),
    ]);
    const constraintViolations = evaluateConstraints({
      capability: this.capability(p.capabilityId), target: p.target, arguments: p.arguments,
      constraints, stage, ...(p.preview ? { beforeState: p.preview.beforeState } : {}),
    });
    return { authority: decision, capabilityEnabled, killSwitch, constraintViolations };
  }

  private async readCurrentState(p: ActionProposal): Promise<ObservedState> {
    const full = this.request(p);
    const request: Omit<ActionRequest, 'attempt'> = {
      workspaceId: full.workspaceId, proposalId: full.proposalId, capabilityId: full.capabilityId, target: full.target,
      arguments: full.arguments, canonicalArguments: full.canonicalArguments, argumentDigest: full.argumentDigest,
      idempotencyKey: full.idempotencyKey,
    };
    const r = await withDeadline((signal) => this.deps.verifier.readCurrentState(request, signal), this.readbackTimeoutMs);
    if (!r.ok) return { status: 'UNKNOWN', reason: r.timedOut ? 'READBACK_TIMEOUT' : 'READBACK_UNAVAILABLE' };
    const s = r.value;
    return s && (s.status === 'OBSERVED' || s.status === 'UNKNOWN') ? s : { status: 'UNKNOWN', reason: 'READBACK_MALFORMED' };
  }

  private async readback(request: ActionRequest): Promise<Verification> {
    const r = await withDeadline((signal) => this.deps.verifier.readback(request, signal), this.readbackTimeoutMs);
    const observedAt = this.clock.now().toISOString();
    if (!r.ok) return { observation: 'UNKNOWN', evidence: null, observedAt, reason: r.timedOut ? 'READBACK_TIMEOUT' : 'READBACK_UNAVAILABLE' };
    const v = r.value;
    if (!v || !['EXECUTED', 'NOT_EXECUTED', 'UNKNOWN'].includes(v.observation)) {
      return { observation: 'UNKNOWN', evidence: null, observedAt, reason: 'READBACK_MALFORMED' };
    }
    return v;
  }
}

function sameTarget(a: TargetResource, b: TargetResource): boolean {
  return a.provider === b.provider && a.accountId === b.accountId && a.resourceType === b.resourceType && a.resourceId === b.resourceId;
}

function sanitizeResult(r: ActionExecutionResult | undefined): ActionExecutionResult {
  if (r && (r.status === 'APPLIED' || r.status === 'NOT_APPLIED' || r.status === 'UNKNOWN')) return r;
  return { status: 'UNKNOWN', reason: 'EXECUTOR_RESULT_MALFORMED' };
}
