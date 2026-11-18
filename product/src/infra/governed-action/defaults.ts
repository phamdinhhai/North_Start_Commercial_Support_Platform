import type { ActionActor, ActionConstraints } from '../../domain/governed-action/governed-action.types';
import type {
  ActionExecutionResult, ActionExecutor, ActionKillSwitch, ActionPolicy, ActionPolicyContext, CapabilityEnablement, KillSwitchStatus,
  PolicyDecision,
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
  readonly executors: readonly string[];
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
    return allow(actor, ctx, this.config.executors.includes(actor.id), 'not a configured executor');
  }
}

function allow(actor: ActionActor, ctx: ActionPolicyContext, ok: boolean, reason: string): PolicyDecision {
  if (actor.workspaceId !== ctx.workspaceId) return { allowed: false, reason: 'workspace mismatch' };
  return ok ? { allowed: true } : { allowed: false, reason };
}
