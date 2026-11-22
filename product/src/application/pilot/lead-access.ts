import type { AuthContext } from '../../ports/auth';
import type { LeadAccessPolicy } from '../../ports/rbac';
import { PilotDomainError, type PilotLoopState } from '../../ports/pilot-loop.types';
import { activeWorkRecipients } from './work-mutation-policy';

/** Shared application boundary: reuse existing roles; PM-1 remains OPEN. */
export function canViewPilotLead(ctx: AuthContext, state: PilotLoopState, policy: LeadAccessPolicy): boolean {
  return policy.canAccessLead(ctx, {
    id: state.lead.id, workspaceId: state.lead.workspaceId,
    assignedTo: state.ownerUserId, recipients: activeWorkRecipients(state),
  });
}

export function requirePilotLeadAccess(ctx: AuthContext, state: PilotLoopState | undefined, policy: LeadAccessPolicy): void {
  if (!state || state.lead.workspaceId !== ctx.workspaceId) {
    throw new PilotDomainError('LEAD_NOT_FOUND', 404, 'lead not found');
  }
  if (!canViewPilotLead(ctx, state, policy)) throw new PilotDomainError('LEAD_ACCESS_DENIED', 403, 'forbidden');
}
