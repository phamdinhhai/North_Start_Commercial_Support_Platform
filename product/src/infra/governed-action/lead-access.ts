import type { LeadAccessPort, LeadAccessSubject, WorkspaceRoleLookup } from '../../ports/governed-action';
import type { AuthRole } from '../../ports/auth';
import type { LeadAccessPolicy, Resource } from '../../ports/rbac';

/** Loads the lead's access facts (workspace, owner, active recipients) — e.g. from the pilot store. */
export type LeadResourceLoader = (workspaceId: string, leadId: string) => Promise<Resource | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ADR-006 lead-scope hook adapter (I-09). Wraps an injected lead loader and the existing lead
 * access policy — the composition root passes `RbacService` (its `canAccessLead`), so the same
 * rule that guards lead reads guards governed actions. Missing / foreign / failing ⇒ deny.
 */
export class RbacLeadAccessAdapter implements LeadAccessPort {
  constructor(
    private readonly loadLead: LeadResourceLoader,
    private readonly policy: Pick<LeadAccessPolicy, 'canAccessLead'>,
  ) {}

  async canAccessLead(subject: LeadAccessSubject, leadId: string): Promise<boolean> {
    try {
      if (!subject?.workspaceId || !subject.userId || typeof leadId !== 'string' || !UUID.test(leadId)) return false;
      const id = leadId.toLowerCase();
      const lead = await this.loadLead(subject.workspaceId, id);
      if (!lead || lead.workspaceId !== subject.workspaceId || String(lead.id).toLowerCase() !== id) return false;
      return this.policy.canAccessLead(
        { workspaceId: subject.workspaceId, userId: subject.userId, role: subject.baseRole, isDemo: false }, lead,
      ) === true;
    } catch {
      return false;
    }
  }
}

/** Fixed membership directory (tests / synthetic runs). Production backs the port with membership. */
export class StaticWorkspaceRoleLookup implements WorkspaceRoleLookup {
  private readonly roles = new Map<string, AuthRole>();
  constructor(entries: readonly { workspaceId: string; userId: string; role: AuthRole }[]) {
    for (const e of entries) this.roles.set(`${e.workspaceId}\u0000${e.userId}`, e.role);
  }
  async baseRoleOf(workspaceId: string, userId: string): Promise<AuthRole | undefined> {
    return this.roles.get(`${workspaceId}\u0000${userId}`);
  }
}
