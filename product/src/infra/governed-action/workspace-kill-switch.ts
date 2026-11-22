import { deepFreeze } from '../../domain/governed-action/canonical-json';
import type { ActorRef } from '../../domain/governed-action/governed-action.types';
import type { ActionKillSwitch, ActionKillSwitchControl, KillSwitchStatus } from '../../ports/governed-action';

export interface KillSwitchOperation {
  readonly workspaceId: string;
  readonly capabilityId?: string;
  readonly engaged: boolean;
  readonly actor: ActorRef;
  readonly reason: string;
  readonly at: string;
}

/**
 * In-process, workspace-scoped kill switch (ADR-006: operated by admins through the service).
 * Workspace-wide or per-capability; every operation is kept in an append-only list. A workspace
 * admin can never affect another workspace. Not durable: a multi-instance deployment needs a
 * shared store behind the same two ports.
 */
export class WorkspaceKillSwitch implements ActionKillSwitch, ActionKillSwitchControl {
  private readonly engaged = new Set<string>();
  private readonly log: KillSwitchOperation[] = [];

  async status(ctx: { readonly workspaceId: string; readonly capabilityId: string }): Promise<KillSwitchStatus> {
    if (this.engaged.has(`${ctx.workspaceId}\u0000*`)) return { engaged: true, scope: 'global', reason: 'workspace kill switch engaged' };
    if (this.engaged.has(`${ctx.workspaceId}\u0000${ctx.capabilityId}`)) {
      return { engaged: true, scope: 'capability', reason: `kill switch engaged for ${ctx.capabilityId}` };
    }
    return { engaged: false };
  }

  async set(input: KillSwitchOperation): Promise<void> {
    const k = `${input.workspaceId}\u0000${input.capabilityId ?? '*'}`;
    if (input.engaged) this.engaged.add(k);
    else this.engaged.delete(k);
    this.log.push(deepFreeze({ ...input, actor: { kind: input.actor.kind, id: input.actor.id } }));
  }

  operations(workspaceId: string): KillSwitchOperation[] {
    return this.log.filter((o) => o.workspaceId === workspaceId);
  }
}
