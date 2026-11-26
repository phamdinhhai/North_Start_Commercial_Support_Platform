import { randomUUID } from 'node:crypto';
import { evaluateConstraints, type ConstraintStage } from '../../domain/governed-action/action-constraints';
import { normalizeCommercialEventRef, type CommercialEventLookupResult } from '../../domain/governed-action/action-evidence';
import {
  authorize, beginExecution, cancel, expire, markStaleExecution, normalizeLeadId, preview, propose, recordExecutionResult,
  recordProposalRefusal, recordRefusal, recordVerification, reject, requireRunAuthority, type ExecutionFacts, type PolicyFacts,
} from '../../domain/governed-action/action-lifecycle';
import { digestReadbackEvidence, observedOutcomeAssertion, verifiedOutcomeEvidence } from '../../domain/governed-action/action-outcome-assertion';
import { PRODUCTION_CAPABILITY_CATALOG, type CapabilityCatalog, type CapabilityDefinition } from '../../domain/governed-action/capability-catalog';
import {
  GovernedActionError, isGovernedActionError, type ActionActor, type ActionEvent, type ActionPrincipal, type ActionProposal,
  type ActionRefusal, type JsonValue, type ObservedState, type TargetResource, type Transition, type Verification,
} from '../../domain/governed-action/governed-action.types';
import type { ContentDigester } from '../../ports/content-digester';
import { contentDigester } from '../../ports/content-digester-runtime';
import type {
  ActionExecutionResult, ActionExecutor, ActionHousekeepingCommand, ActionKillSwitch, ActionKillSwitchControl, ActionPolicy,
  ActionPolicyContext, ActionReadCommand, ActionRequest, ActionStore, ActionVerifier, ActorResolver, AssertionSink,
  CapabilityEnablement, CommercialEventLookup, GovernedActionClock, KillSwitchStatus, PolicyDecision,
} from '../../ports/governed-action';
import { withDeadline } from './deadline';

export interface GovernedActionDeps {
  readonly store: ActionStore;
  readonly policy: ActionPolicy;
  /** Server-side actor-kind resolution (A-m2). Required: there is no trusting default. */
  readonly actors: ActorResolver;
  readonly executor: ActionExecutor;
  readonly verifier: ActionVerifier;
  readonly killSwitch: ActionKillSwitch;
  readonly enablement: CapabilityEnablement;
  /** ADR-005 R2-P-01: verifies the CommercialEvent an AI proposal cites. Required (no trusting default). */
  readonly commercialEvents: CommercialEventLookup;
  /** ADR-005 R2-P-02: receives observed assertions for verified outcomes. Required. */
  readonly assertions: AssertionSink;
  /** ADR-006: kill-switch control (admin only). Absent => operateKillSwitch is refused. */
  readonly killSwitchControl?: ActionKillSwitchControl;
  /** ADR-009 (A-02): server-held workspace/purpose-keyed HMAC digester; defaults to the composition-root runtime binding. */
  readonly digester?: ContentDigester;
  /** Defaults to the production catalog, which is empty (deny-all; ADR-007). */
  readonly catalog?: CapabilityCatalog;
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
  /** ADR-005 R2-P-01: required for AI proposers; optional (but shown to approvers) for humans. */
  readonly commercialEventRef?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface KillSwitchCommand {
  readonly engaged: boolean;
  /** Absent => the whole workspace. */
  readonly capabilityId?: string;
  readonly reason: string;
}

export interface AuthorizeCommand {
  readonly reviewedArgumentDigest: string;
  readonly reviewedPreviewDigest: string;
  readonly reason: string;
}

const DEFAULT_TTL_MS = 24 * 60 * 60_000;
const DENY_UNAVAILABLE: PolicyDecision = { allowed: false, reason: 'POLICY_UNAVAILABLE' };
const ACTOR_KINDS = new Set(['human', 'ai', 'service']);

/**
 * Governed Commercial Action runtime: Propose → Preview → Authorize → Execute → Verify → Audit.
 * Not wired to HTTP in this round. Every command is workspace scoped from the authenticated
 * principal, whose kind is resolved server-side; every state change is appended to the event
 * log and every in-workspace refusal to the separate refusal log (no version bump).
 */
export class GovernedActionService {
  private readonly clock: GovernedActionClock;
  private readonly newId: () => string;
  private readonly catalog: CapabilityCatalog;
  private readonly executionTimeoutMs: number;
  private readonly readbackTimeoutMs: number;
  private readonly executionLeaseMs: number;

  constructor(private readonly deps: GovernedActionDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
    this.newId = deps.newId ?? randomUUID;
    this.catalog = deps.catalog ?? PRODUCTION_CAPABILITY_CATALOG;
    this.executionTimeoutMs = deps.executionTimeoutMs ?? 10_000;
    this.readbackTimeoutMs = deps.readbackTimeoutMs ?? 10_000;
    this.executionLeaseMs = deps.executionLeaseMs ?? 5 * 60_000;
  }

  private digesterOf(): ContentDigester { return this.deps.digester ?? contentDigester(); }

  async propose(principal: ActionPrincipal, command: ProposeCommand): Promise<ActionProposal> {
    const actor = await this.resolveActor(principal);
    try {
      return await this.proposeAs(actor, command);
    } catch (error) {
      // ADR-005 R2-P-01: refused proposals (e.g. EVIDENCE_REQUIRED) are logged; nothing is stored.
      if (isGovernedActionError(error) && error.code !== 'CONCURRENT_MODIFICATION') {
        // The workspace always comes from the resolved actor, never from the command (I-09).
        const refusal = recordProposalRefusal({ requestKey: command?.requestKey, capabilityId: command?.capabilityId,
          leadId: command?.leadId, commercialEventRef: command?.commercialEventRef, workspaceId: actor.workspaceId }, actor, error, this.clock.now());
        await this.deps.store.appendProposalRefusal(refusal).catch(() => undefined);
      }
      throw error;
    }
  }

  private async proposeAs(actor: ActionActor, command: ProposeCommand): Promise<ActionProposal> {
    const capability = this.capability(command?.capabilityId);
    const leadId = normalizeLeadId(command.leadId);
    const ctx: ActionPolicyContext = {
      workspaceId: actor.workspaceId, capabilityId: capability.id, riskClass: capability.riskClass,
      target: command.target, ...(leadId ? { leadId } : {}),
    };
    if (leadId) {
      const lead = await this.decide(() => this.deps.policy.mayAccessLead(actor, { ...ctx, leadId }));
      if (!lead.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', 'lead is outside the actor scope');
    }
    const decision = await this.decide(() => this.deps.policy.mayPropose(actor, ctx));
    if (!decision.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason);
    const constraints = await this.constraints(ctx);
    const commercialEventRef = normalizeCommercialEventRef(command.commercialEventRef);
    const commercialEvent = commercialEventRef ? await this.lookupCommercialEvent(actor.workspaceId, commercialEventRef) : undefined;
    const t = propose({
      id: this.newId(), workspaceId: actor.workspaceId, requestKey: command.requestKey, capability,
      target: command.target, arguments: command.arguments, proposer: actor, rationale: command.rationale,
      constraints, ttlMs: command.ttlMs ?? DEFAULT_TTL_MS, ...(leadId ? { leadId } : {}),
      ...(commercialEventRef ? { commercialEventRef } : {}), evidenceRefs: command.evidenceRefs, commercialEvent,
      digester: this.digesterOf(),
      constraintViolations: evaluateConstraints({
        capability, target: command.target, arguments: command.arguments as JsonValue, constraints, stage: 'propose',
      }),
    }, this.clock.now());
    const result = await this.deps.store.create(t);
    if (!result.created) {
      const existing = result.proposal;
      if (existing.canonicalArguments !== t.proposal.canonicalArguments || existing.capabilityId !== capability.id ||
          !sameTarget(existing.target, t.proposal.target) || existing.leadId !== t.proposal.leadId ||
          existing.commercialEventRef !== t.proposal.commercialEventRef ||
          JSON.stringify(existing.evidenceRefs ?? []) !== JSON.stringify(t.proposal.evidenceRefs)) {
        throw new GovernedActionError('REQUEST_KEY_CONFLICT', 'requestKey already used for a different action');
      }
    }
    return result.proposal;
  }

  async preview(principal: ActionPrincipal, proposalId: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'preview');
    return this.guard(p, actor, 'preview', async () => {
      const decision = await this.decide(() => this.deps.policy.mayPropose(actor, this.ctx(p)));
      if (!decision.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason);
      const beforeState = await this.readCurrentState(p);
      return preview(p, { actor, beforeState, digester: this.digesterOf() }, this.clock.now());
    });
  }

  async authorize(principal: ActionPrincipal, proposalId: string, command: AuthorizeCommand): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'authorize');
    return this.guard(p, actor, 'authorize', async () => {
      const facts = await this.policyFacts(p, 'authorize', () => this.deps.policy.mayApprove(actor, this.ctx(p)));
      return authorize(p, { approver: actor, ...command, facts, digester: this.digesterOf() }, this.clock.now());
    });
  }

  async reject(principal: ActionPrincipal, proposalId: string, reason: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'reject');
    return this.guard(p, actor, 'reject', async () => {
      const decision = await this.decide(() => this.deps.policy.mayApprove(actor, this.ctx(p)));
      return reject(p, { actor, reason, authorityAllowed: decision.allowed }, this.clock.now());
    });
  }

  async cancel(principal: ActionPrincipal, proposalId: string, reason: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'cancel');
    return this.guard(p, actor, 'cancel', async () => {
      const decision = await this.decide(() => this.deps.policy.mayApprove(actor, this.ctx(p)));
      return cancel(p, { actor, reason, authorityAllowed: decision.allowed }, this.clock.now());
    });
  }

  /** Housekeeping: move an elapsed proposal/approval to EXPIRED. Policy-gated; never AI (A-M4, A-m3). */
  async expire(principal: ActionPrincipal, proposalId: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'expire');
    return this.guard(p, actor, 'expire', async () => {
      const allowed = await this.housekeeping(actor, p, 'expire');
      return expire(p, { actor, authorityAllowed: allowed, trigger: 'command' }, this.clock.now());
    });
  }

  async execute(principal: ActionPrincipal, proposalId: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'execute');
    let begun: Transition;
    try {
      // R2-I-14: constraints are evaluated against a fresh read, not only the preview baseline.
      const currentState: ObservedState = p.state === 'AUTHORIZED' ? await this.readCurrentState(p)
        : p.preview?.beforeState ?? { status: 'UNKNOWN', reason: 'NOT_READ' };
      const policyFacts = await this.policyFacts(p, 'execute', () => this.deps.policy.mayTriggerExecution(actor, this.ctx(p)), currentState);
      const facts: ExecutionFacts = { ...policyFacts, executorEnabled: this.deps.executor.mode === 'synthetic', currentState };
      begun = beginExecution(p, { actor, facts, digester: this.digesterOf() }, this.clock.now());
    } catch (error) {
      if (isGovernedActionError(error) && error.code === 'APPROVAL_EXPIRED') {
        // Reached only after execution authority was established; the caller is the recorded trigger (A-m3).
        const expired = expire(p, { actor, authorityAllowed: true, trigger: 'execute' }, this.clock.now());
        await this.deps.store.transition(p.version, expired).catch(() => undefined);
      }
      throw await this.audited(p, actor, 'execute', error);
    }
    // Compare-and-set: of N concurrent callers exactly one reaches the executor.
    await this.deps.store.transition(p.version, begun);
    const running = begun.proposal;
    const request = this.request(running);

    let result: ActionExecutionResult;
    let verification: Verification | undefined;
    let dispatched = true;
    const lastLook = await this.killStatus(running);
    if (lastLook.engaged) {
      dispatched = false;
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
      executorStatus: result.status, reason: result.reason ?? result.status, verification, dispatched,
      ...(result.status === 'APPLIED' && result.providerReference ? { providerReference: result.providerReference } : {}),
    }, this.clock.now());
    await this.persistTransition(running.version, done);
    await this.emitObservedOutcome(done);
    return done.proposal;
  }

  /** Resolve an UNKNOWN outcome strictly from readback evidence. Never re-executes. */
  async verify(principal: ActionPrincipal, proposalId: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'verify');
    const t = await this.guardTransition(p, actor, 'verify', async () => {
      if (p.state !== 'UNKNOWN') throw new GovernedActionError('INVALID_TRANSITION', `verify is not allowed from ${p.state}`);
      if (actor.kind === 'ai') throw new GovernedActionError('AI_CANNOT_EXECUTE', 'AI actors cannot resolve action outcomes');
      const authority = await this.decide(() => this.deps.policy.mayTriggerExecution(actor, this.ctx(p)));
      requireRunAuthority(actor, authority, 'resolve action outcomes');
      const verification = await this.readback(this.request(p));
      return recordVerification(p, { actor, verification, authority }, this.clock.now());
    });
    await this.emitObservedOutcome(t);
    return t.proposal;
  }

  /** ADR-006: engage/release the workspace (or one capability) kill switch. Humans with authority only. */
  async operateKillSwitch(principal: ActionPrincipal, command: KillSwitchCommand): Promise<void> {
    const actor = await this.resolveActor(principal);
    const reason = typeof command?.reason === 'string' ? command.reason.trim() : '';
    const capabilityId = command?.capabilityId;
    if (typeof command?.engaged !== 'boolean' || !reason || reason.length > 2000 ||
        (capabilityId !== undefined && (typeof capabilityId !== 'string' || !capabilityId || capabilityId.length > 128))) {
      throw new GovernedActionError('INVALID_INPUT', 'engaged, reason (1..2000) and an optional capabilityId are required');
    }
    if (actor.kind !== 'human') throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', 'only a human may operate the kill switch');
    const decision = await this.decide(() => this.deps.policy.mayOperateKillSwitch(actor,
      { workspaceId: actor.workspaceId, ...(capabilityId ? { capabilityId } : {}) }));
    if (!decision.allowed) throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason);
    if (!this.deps.killSwitchControl) throw new GovernedActionError('POLICY_UNAVAILABLE', 'no kill-switch control is configured');
    await this.deps.killSwitchControl.set({ workspaceId: actor.workspaceId, ...(capabilityId ? { capabilityId } : {}),
      engaged: command.engaged, actor: { kind: actor.kind, id: actor.id }, reason, at: this.clock.now().toISOString() });
  }

  /** Crash recovery: EXECUTING past its lease becomes UNKNOWN (then verify). Policy-gated; never AI. */
  async recoverStaleExecution(principal: ActionPrincipal, proposalId: string): Promise<ActionProposal> {
    const { actor, p } = await this.load(principal, proposalId, 'recover');
    return this.guard(p, actor, 'recover', async () => {
      const allowed = await this.housekeeping(actor, p, 'recover');
      return markStaleExecution(p, { actor, authorityAllowed: allowed, trigger: 'command', leaseMs: this.executionLeaseMs }, this.clock.now());
    });
  }

  async history(principal: ActionPrincipal, proposalId: string): Promise<ActionEvent[]> {
    const { p } = await this.readable(principal, proposalId, 'history');
    return this.deps.store.events(p.workspaceId, p.id);
  }

  async refusals(principal: ActionPrincipal, proposalId: string): Promise<ActionRefusal[]> {
    const { p } = await this.readable(principal, proposalId, 'refusals');
    return this.deps.store.refusals(p.workspaceId, p.id);
  }

  async get(principal: ActionPrincipal, proposalId: string): Promise<ActionProposal> {
    return (await this.readable(principal, proposalId, 'get')).p;
  }

  // ---------------------------------------------------------------- helpers

  private capability(id: string): CapabilityDefinition {
    const capability = this.catalog.find(id);
    if (!capability) throw new GovernedActionError('UNKNOWN_CAPABILITY', `unknown capability: ${id}`);
    return capability;
  }

  /** A-m2: the kind comes from the resolver, never from the caller-supplied object. */
  private async resolveActor(principal: ActionPrincipal): Promise<ActionActor> {
    if (!principal?.workspaceId || !principal.id) throw new GovernedActionError('INVALID_INPUT', 'actor workspace is required');
    const claim: ActionPrincipal = { id: principal.id, workspaceId: principal.workspaceId };
    let resolved: ActionActor | undefined;
    try {
      resolved = await this.deps.actors.resolve(claim);
    } catch {
      resolved = undefined;
    }
    if (!resolved || resolved.id !== claim.id || resolved.workspaceId !== claim.workspaceId || !ACTOR_KINDS.has(resolved.kind)) {
      throw new GovernedActionError('ACTOR_NOT_AUTHORIZED', 'actor identity could not be resolved');
    }
    return Object.freeze({ kind: resolved.kind, id: resolved.id, workspaceId: resolved.workspaceId });
  }

  /** Workspace isolation + lead scope (I-09). Foreign or out-of-scope proposals look missing. */
  private async load(principal: ActionPrincipal, proposalId: string, command: string): Promise<{ actor: ActionActor; p: ActionProposal }> {
    const actor = await this.resolveActor(principal);
    const p = await this.deps.store.get(actor.workspaceId, proposalId);
    if (!p || p.workspaceId !== actor.workspaceId) throw new GovernedActionError('NOT_FOUND', 'proposal not found');
    if (p.leadId) {
      // ADR-006 — lead scope (I-09) is the policy hook (RBAC canAccessLead); no role is assumed here.
      const lead = await this.decide(() => this.deps.policy.mayAccessLead(actor, { ...this.ctx(p), leadId: p.leadId! }));
      if (!lead.allowed) {
        throw await this.audited(p, actor, command, new GovernedActionError('NOT_FOUND', 'proposal not found', ['LEAD_SCOPE_DENIED']));
      }
    }
    return { actor, p };
  }

  private async readable(principal: ActionPrincipal, proposalId: string, command: ActionReadCommand) {
    const loaded = await this.load(principal, proposalId, command);
    const decision = await this.decide(() => this.deps.policy.mayRead(loaded.actor, this.ctx(loaded.p), command));
    if (!decision.allowed) {
      throw await this.audited(loaded.p, loaded.actor, command, new GovernedActionError('ACTOR_NOT_AUTHORIZED', decision.reason));
    }
    return loaded;
  }

  private async housekeeping(actor: ActionActor, p: ActionProposal, command: ActionHousekeepingCommand): Promise<boolean> {
    if (actor.kind === 'ai') return false; // the domain refuses AI housekeeping (I-03)
    return (await this.decide(() => this.deps.policy.mayHousekeep(actor, this.ctx(p), command))).allowed;
  }

  private ctx(p: ActionProposal): ActionPolicyContext {
    return { workspaceId: p.workspaceId, capabilityId: p.capabilityId, riskClass: p.riskClass, target: p.target,
      ...(p.leadId ? { leadId: p.leadId } : {}), proposer: { kind: p.proposer.kind, id: p.proposer.id } };
  }

  private request(p: ActionProposal): ActionRequest {
    return { workspaceId: p.workspaceId, proposalId: p.id, capabilityId: p.capabilityId, target: p.target,
      arguments: p.arguments, canonicalArguments: p.canonicalArguments, argumentDigest: p.argumentDigest,
      idempotencyKey: p.execution?.idempotencyKey ?? p.idempotencyKey, attempt: p.execution?.attempt ?? Math.max(1, p.attempts) };
  }

  /** Run a domain command; persist its transition, or log the refusal (no CAS) and rethrow. */
  private async guard(p: ActionProposal, actor: ActionActor, command: string, run: () => Promise<Transition>): Promise<ActionProposal> {
    return (await this.guardTransition(p, actor, command, run)).proposal;
  }

  private async guardTransition(p: ActionProposal, actor: ActionActor, command: string, run: () => Promise<Transition>): Promise<Transition> {
    let t: Transition;
    try {
      t = await run();
    } catch (error) {
      throw await this.audited(p, actor, command, error);
    }
    await this.persistTransition(p.version, t);
    return t;
  }

  /** ADR-005 R2-P-01: facts for a cited CE; a lookup failure is reported, never guessed. */
  private async lookupCommercialEvent(workspaceId: string, ref: string): Promise<CommercialEventLookupResult> {
    try { return await this.deps.commercialEvents.find(workspaceId, ref); } catch { return 'UNAVAILABLE'; }
  }

  /**
   * ADR-005 R2-P-02 + ADR-009 (A-02): a provider-observed verified outcome becomes an `observed` AssertionEnvelope
   * with a server-derived workspace/purpose-keyed HMAC digest. OPEN: CE-1 — evidence only; never moves Commercial State.
   */
  private buildObservedOutcomeAssertion(t: Transition) {
    const verification = verifiedOutcomeEvidence(t.proposal, t.event);
    if (!verification) return undefined;
    const evidenceDigest = digestReadbackEvidence(t.proposal.workspaceId, verification.evidence, this.digesterOf());
    return observedOutcomeAssertion(t.proposal, t.event, this.clock.now(), { evidenceDigest });
  }

  private async persistTransition(version: number, t: Transition): Promise<void> {
    const assertion = this.deps.store.durableAssertions ? this.buildObservedOutcomeAssertion(t) : undefined;
    await this.deps.store.transition(version, t, assertion);
  }

  private async emitObservedOutcome(t: Transition): Promise<void> {
    if (this.deps.store.durableAssertions) return; // PostgreSQL worker owns durable delivery.
    const envelope = this.buildObservedOutcomeAssertion(t);
    if (envelope) await this.deps.assertions.emit(envelope).catch(() => undefined);
  }

  /** A-m1 / R2-I-01: refusals go to the append-only refusal log and never bump the version. */
  private async audited(p: ActionProposal, actor: ActionActor, command: string, error: unknown): Promise<unknown> {
    if (isGovernedActionError(error) && error.code !== 'CONCURRENT_MODIFICATION') {
      // Best effort: a failed refusal write must not mask the original refusal.
      await this.deps.store.appendRefusal(recordRefusal(p, actor, command, error, this.clock.now())).catch(() => undefined);
    }
    return error;
  }

  private async decide(fn: () => Promise<PolicyDecision>): Promise<PolicyDecision> {
    try {
      const d = await fn();
      if (d && d.allowed === true) return d.serviceGrant === true ? { allowed: true, serviceGrant: true } : { allowed: true };
      return { allowed: false, reason: (d as { reason?: string })?.reason ?? 'DENIED' };
    } catch {
      return DENY_UNAVAILABLE;
    }
  }

  private async constraints(ctx: ActionPolicyContext) {
    try { return await this.deps.policy.constraintsFor(ctx); }
    catch { throw new GovernedActionError('POLICY_UNAVAILABLE', 'constraint policy unavailable'); }
  }

  private async killStatus(p: ActionProposal): Promise<KillSwitchStatus> {
    try {
      const s = await this.deps.killSwitch.status({ workspaceId: p.workspaceId, capabilityId: p.capabilityId });
      return s && s.engaged === false ? s : { engaged: true, reason: s?.reason ?? 'kill switch engaged' };
    } catch { return { engaged: true, reason: 'kill switch unavailable (fail closed)' }; }
  }

  private async enabled(p: ActionProposal): Promise<boolean> {
    try { return (await this.deps.enablement.isEnabled(p.workspaceId, p.capabilityId)) === true; } catch { return false; }
  }

  private async policyFacts(p: ActionProposal, stage: ConstraintStage,
    authority: () => Promise<PolicyDecision>, baseline?: ObservedState): Promise<PolicyFacts> {
    const [decision, capabilityEnabled, killSwitch, constraints] = await Promise.all([
      this.decide(authority), this.enabled(p), this.killStatus(p), this.constraints(this.ctx(p)),
    ]);
    const beforeState = baseline ?? p.preview?.beforeState;
    const constraintViolations = evaluateConstraints({
      capability: this.capability(p.capabilityId), target: p.target, arguments: p.arguments,
      constraints, stage, ...(beforeState ? { beforeState } : {}),
    });
    return { authority: decision, capabilityEnabled, killSwitch, constraintViolations };
  }

  private async readCurrentState(p: ActionProposal): Promise<ObservedState> {
    const request: Omit<ActionRequest, 'attempt'> = {
      workspaceId: p.workspaceId, proposalId: p.id, capabilityId: p.capabilityId, target: p.target,
      arguments: p.arguments, canonicalArguments: p.canonicalArguments, argumentDigest: p.argumentDigest,
      idempotencyKey: p.idempotencyKey,
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
