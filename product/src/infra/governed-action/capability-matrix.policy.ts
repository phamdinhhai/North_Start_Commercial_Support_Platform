import { isBaseRole, matrixVerdict, type BaseRole, type MatrixCommand } from '../../domain/governed-action/capability-matrix';
import type { ActionActor, ActionConstraints } from '../../domain/governed-action/governed-action.types';
import type {
  ActionHousekeepingCommand, ActionPolicy, ActionPolicyContext, ActionReadCommand, LeadAccessPort, PolicyDecision,
  WorkspaceRoleLookup,
} from '../../ports/governed-action';

export interface CapabilityMatrixPolicyDeps {
  /** Base role from server-side membership; never from IdP claims (ADR-006). */
  readonly roles: WorkspaceRoleLookup;
  /** I-09 lead scope (RBAC canAccessLead via RbacLeadAccessAdapter). */
  readonly leads: LeadAccessPort;
  /** Policy-supplied constraints (never proposer-supplied). */
  readonly constraints: ActionConstraints | ((ctx: ActionPolicyContext) => ActionConstraints | Promise<ActionConstraints>);
}

const deny = (reason: string): PolicyDecision => ({ allowed: false, reason });
const ALLOW: PolicyDecision = Object.freeze({ allowed: true });

/**
 * ADR-006 (resolves PM-1) production ActionPolicy — the governed-action rows of the capability
 * matrix (see domain/governed-action/capability-matrix.ts). Deny-by-default:
 * - humans: base role re-read from membership on every decision; sales/viewer are additionally
 *   lead-scoped through LeadAccessPort (assigned or active recipient), even if the caller skipped
 *   the hook; manager scope = whole workspace in LVP (narrowed when Team exists, ADR-006 ¹);
 * - AI: may draft and handle only its own drafts (ADR-005 evidence is enforced by the domain);
 *   never authorize / execute / verify / read / housekeep / kill switch (I-03);
 * - service principals: nothing (no `serviceGrant` is ever issued).
 * Separation of duties and approval expiry stay in the lifecycle.
 */
export class CapabilityMatrixActionPolicy implements ActionPolicy {
  constructor(private readonly deps: CapabilityMatrixPolicyDeps) {}

  async constraintsFor(ctx: ActionPolicyContext): Promise<ActionConstraints> {
    const c = typeof this.deps.constraints === 'function' ? await this.deps.constraints(ctx) : this.deps.constraints;
    return { ...c, protectedAccountIds: [...c.protectedAccountIds] };
  }

  async mayPropose(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision> {
    if (actor.workspaceId !== ctx.workspaceId) return deny('workspace mismatch');
    if (actor.kind === 'ai') return ownDraftOrNew(actor, ctx) ? ALLOW : deny('AI may only handle its own drafts');
    return this.human(actor, ctx, 'propose');
  }

  async mayApprove(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision> {
    return this.human(actor, ctx, 'authorize');
  }

  async mayTriggerExecution(actor: ActionActor, ctx: ActionPolicyContext): Promise<PolicyDecision> {
    return this.human(actor, ctx, 'execute');
  }

  async mayRead(actor: ActionActor, ctx: ActionPolicyContext, _command: ActionReadCommand): Promise<PolicyDecision> {
    return this.human(actor, ctx, 'read');
  }

  async mayHousekeep(actor: ActionActor, ctx: ActionPolicyContext, _command: ActionHousekeepingCommand): Promise<PolicyDecision> {
    return this.human(actor, ctx, 'housekeep');
  }

  async mayOperateKillSwitch(actor: ActionActor, ctx: { readonly workspaceId: string; readonly capabilityId?: string }): Promise<PolicyDecision> {
    if (actor.kind !== 'human' || actor.workspaceId !== ctx.workspaceId) return deny('kill switch is admin only');
    const role = await this.roleOf(actor);
    return role && matrixVerdict({ role, command: 'kill_switch', leadLinked: false }) === 'allow' ? ALLOW : deny('kill switch is admin only');
  }

  async mayAccessLead(actor: ActionActor, ctx: ActionPolicyContext & { readonly leadId: string }): Promise<PolicyDecision> {
    if (actor.workspaceId !== ctx.workspaceId) return deny('workspace mismatch');
    // AI reaches a lead only for its own drafts; for a new draft the domain then requires a
    // CommercialEvent on that same lead (ADR-005), which proves the lead exists in the workspace.
    if (actor.kind === 'ai') return ownDraftOrNew(actor, ctx) ? ALLOW : deny('lead outside AI scope');
    if (actor.kind !== 'human') return deny('lead outside actor scope');
    const role = await this.roleOf(actor);
    if (!role) return deny('not a workspace member');
    return (await this.leadAllowed(actor, role, ctx.leadId)) ? ALLOW : deny('lead outside actor scope');
  }

  private async human(actor: ActionActor, ctx: ActionPolicyContext, command: MatrixCommand): Promise<PolicyDecision> {
    if (actor.workspaceId !== ctx.workspaceId) return deny('workspace mismatch');
    if (actor.kind !== 'human') return deny(`${actor.kind} actors may not ${command} (ADR-006)`);
    const role = await this.roleOf(actor);
    if (!role) return deny('not a workspace member');
    const verdict = matrixVerdict({ role, command, riskClass: ctx.riskClass, leadLinked: !!ctx.leadId });
    if (verdict === 'allow') return ALLOW;
    if (verdict === 'lead_scoped' && ctx.leadId && await this.leadAllowed(actor, role, ctx.leadId)) return ALLOW;
    return deny(`role ${role} may not ${command} this action (ADR-006)`);
  }

  private async roleOf(actor: ActionActor): Promise<BaseRole | undefined> {
    try {
      const role = await this.deps.roles.baseRoleOf(actor.workspaceId, actor.id);
      return isBaseRole(role) ? role : undefined;
    } catch {
      return undefined;
    }
  }

  private async leadAllowed(actor: ActionActor, role: BaseRole, leadId: string): Promise<boolean> {
    try {
      return (await this.deps.leads.canAccessLead({ workspaceId: actor.workspaceId, userId: actor.id, baseRole: role }, leadId)) === true;
    } catch {
      return false;
    }
  }
}

function ownDraftOrNew(actor: ActionActor, ctx: ActionPolicyContext): boolean {
  return !ctx.proposer || (ctx.proposer.kind === 'ai' && ctx.proposer.id === actor.id);
}
