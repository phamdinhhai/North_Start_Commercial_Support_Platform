import type { AuthContext } from './auth';

export type Resource = { workspaceId: string; assignedTo?: string; recipients?: readonly string[]; id: string };

export interface LeadAccessPolicy {
  canAccessLead(ctx: AuthContext, lead: Resource): boolean;
}

export const LEAD_ACCESS_POLICY = Symbol('LEAD_ACCESS_POLICY');
