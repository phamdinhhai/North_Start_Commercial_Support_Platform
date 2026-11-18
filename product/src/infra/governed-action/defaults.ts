import type { ActionActor, ActionConstraints, ActionPrincipal } from '../../domain/governed-action/governed-action.types';
import type {
  ActionExecutionResult, ActionExecutor, ActionHousekeepingCommand, ActionKillSwitch, ActionPolicy, ActionPolicyContext,
  ActionReadCommand, ActorResolver, CapabilityEnablement,
  KillSwitchStatus, PolicyDecision,
} from '../../ports/governed-action';

/**
 * Safe defaults. Composing the runtime with these yields a system that can record
 * proposals/previews but can never authorize or execute anything.
 */

/** The default executor. Execution is refused before dispatch; calling it directly throws. */
export class DisabledExecutor implements ActionExecutor {
  readonly mode = 'disabled' as const;
  async execute(): Promise<ActionExecutionResult> {
    throw new Error('DisabledExecutor: no executor is enabled; live provider writes do not exist in this build');
  }
}

/**
 * OPEN: PM-1 — no capability matrix is canonical, so the default policy denies every
 * proposal, approval and execution, and returns the most restrictive constraints.
 */
export class DenyAllActionPolicy implements ActionPolicy {
  private static readonly DENY: PolicyDecision = { allowed: false, reason: 'PM-1 open: no action authority is granted by default' };
  async constraintsFor(): Promise<ActionConstraints> {
    return { maxBudgetDeltaPercent: 0, protectedAccountIds: [], approvalTtlMs: 60_000 };
  }
  async mayPropose(): Promise<PolicyDecision> { return DenyAllActionPolicy.DENY; }
  async mayApprove(): Promise<PolicyDecision> { return DenyAllActionPolicy.DENY; }
  async mayTriggerExecution(): Promise<PolicyDecision> { return DenyAllActionPolicy.DENY; }
  async mayRead(): Promise<PolicyDecision> { return DenyAllActionPolicy.DENY; }
  async mayHousekeep(): Promise<PolicyDecision> { return DenyAllActionPolicy.DENY; }
  async mayAccessLead(): Promise<PolicyDecision> { return DenyAllActionPolicy.DENY; }
}

/** Default actor resolver: resolves nobody, so every command is refused (fail closed). */
export class DenyAllActorResolver implements ActorResolver {
  async resolve(): Promise<ActionActor | undefined> { return undefined; }
}

/**
 * Explicit actor directory for synthetic/local runs and tests: the kind of each (workspace, id)
 * is configured server-side, never read from the caller (A-m2).
 * OPEN: PM-1 — a production resolver maps credential types to kinds at the identity seam.
 */
export class StaticActorResolver implements ActorResolver {
  private readonly kinds = new Map<string, ActionActor['kind']>();
  constructor(actors: readonly ActionActor[]) {
    for (const a of actors) this.kinds.set(`${a.workspaceId}\u0000${a.id}`, a.kind);
  }
  async resolve(principal: ActionPrincipal): Promise<ActionActor | undefined> {
    const kind = this.kinds.get(`${principal.workspaceId}\u0000${principal.id}`);
    return kind ? { kind, id: principal.id, workspaceId: principal.workspaceId } : undefined;
  }
}

/** Static kill switch: engaged globally unless explicitly released. */
export class StaticKillSwitch implements ActionKillSwitch {
  private global: boolean;
  private readonly capabilities = new Set<string>();
  constructor(options: { globalEngaged?: boolean; engagedCapabilities?: readonly string[] } = {}) {
    this.global = options.globalEngaged ?? true;
    for (const c of options.engagedCapabilities ?? []) this.capabilities.add(c);
  }
  engageGlobal(): void { this.global = true; }
  releaseGlobal(): void { this.global = false; }
  engageCapability(capabilityId: string): void { this.capabilities.add(capabilityId); }
  releaseCapability(capabilityId: string): void { this.capabilities.delete(capabilityId); }
  async status(ctx: { capabilityId: string }): Promise<KillSwitchStatus> {
    if (this.global) return { engaged: true, scope: 'global', reason: 'global kill switch engaged' };
    if (this.capabilities.has(ctx.capabilityId)) return { engaged: true, scope: 'capability', reason: `kill switch engaged for ${ctx.capabilityId}` };
    return { engaged: false };
  }
}

/** Explicit allow-list of (workspace, capability). Empty by default ⇒ everything disabled. */
export class StaticCapabilityEnablement implements CapabilityEnablement {
  private readonly enabled: ReadonlySet<string>;
  constructor(pairs: readonly { workspaceId: string; capabilityId: string }[] = []) {
    this.enabled = new Set(pairs.map((p) => `${p.workspaceId}\u0000${p.capabilityId}`));
  }
  async isEnabled(workspaceId: string, capabilityId: string): Promise<boolean> {
    return this.enabled.has(`${workspaceId}\u0000${capabilityId}`);
  }
}

export interface StaticActionPolicyConfig {
  readonly constraints: ActionConstraints;
  /** Actor ids allowed to propose; '*' allows any authenticated actor of the workspace. */
  readonly proposers: readonly string[] | '*';
  readonly approvers: readonly string[];
  /** Human/other non-service actor ids that may trigger execution / verification. */
  readonly executors: readonly string[];
  /** Service actor ids explicitly granted execution / verification (A-m2). Default: none. */
  readonly serviceExecutors?: readonly string[];
  /** Actor ids allowed to read proposals, history and refusals; '*' = any. Default: none. */
  readonly readers?: readonly string[] | '*';
  /** Actor ids allowed to expire / recover. Default: none. AI is refused regardless. */
  readonly housekeepers?: readonly string[];
  /** Explicit lead grants: leadId → actor ids. Default: no lead access (I-09). */
  readonly leadAccess?: { readonly [leadId: string]: readonly string[] };
}

/**
 * Explicit allow-list policy for synthetic/local runs and tests. It is NOT a resolution of
 * PM-1: it grants nothing beyond the ids it is configured with, and never across workspaces.
 */
export class StaticActionPolicy implements ActionPolicy {
  constructor(private readonly config: StaticActionPolicyConfig) {}
  async constraintsFor(): Promise<ActionConstraints> {
    return { ...this.config.constraints, protectedAccountIds: [...this.config.constraints.protectedAccountIds] };
  }
  async mayPropose(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision> {
    return allow(actor, ctx, this.config.proposers === '*' || this.config.proposers.includes(actor.id), 'not a configured proposer');
  }
  async mayApprove(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision> {
    return allow(actor, ctx, this.config.approvers.includes(actor.id), 'not a configured approver');
  }
  async mayTriggerExecution(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision> {
    if (actor.kind === 'service') {
      const granted = (this.config.serviceExecutors ?? []).includes(actor.id);
      const d = allow(actor, ctx, granted, 'service actor has no explicit execution grant');
      return d.allowed ? { allowed: true, serviceGrant: true } : d;
    }
    return allow(actor, ctx, this.config.executors.includes(actor.id), 'not a configured executor');
  }
  async mayRead(actor: ActionActor, ctx: ActionPolicyContext, _command?: ActionReadCommand): Promise<PolicyDecision> {
    const readers = this.config.readers ?? [];
    return allow(actor, ctx, readers === '*' || readers.includes(actor.id), 'not a configured reader');
  }
  async mayHousekeep(actor: ActionActor, ctx: ActionPolicyContext, _command?: ActionHousekeepingCommand): Promise<PolicyDecision> {
    return allow(actor, ctx, actor.kind !== 'ai' && (this.config.housekeepers ?? []).includes(actor.id), 'not a configured housekeeper');
  }
  async mayAccessLead(actor: ActionActor, ctx: ActionPolicyContext & { leadId: string }): Promise<PolicyDecision> {
    const grants = this.config.leadAccess ?? {};
    const ids = Object.prototype.hasOwnProperty.call(grants, ctx.leadId) ? grants[ctx.leadId] : [];
    return allow(actor, ctx, ids.includes(actor.id), 'lead outside actor scope');
  }
}

function allow(actor: ActionActor, ctx: ActionPolicyContext, ok: boolean, reason: string): PolicyDecision {
  if (actor.workspaceId !== ctx.workspaceId) return { allowed: false, reason: 'workspace mismatch' };
  return ok ? { allowed: true } : { allowed: false, reason };
}
