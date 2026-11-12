import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../../ports/auth';
import type { LeadAccessPolicy, Resource } from '../../ports/rbac';
export type { Resource } from '../../ports/rbac';

/**
 * RBAC — PH3 T3-04 (I-09 lead-scoped, deny-by-default).
 * // OPEN: PM-1 — Manager/Admin capability matrix chi tiết chờ RFC (QA-30/32/58).
 * Hiện enforce frozen boundary: workspace-scoped + lead assignment.
 */
const PRIVILEGED_ROLES = new Set<AuthContext['role']>(['admin', 'manager']);
const SCOPED_ROLES = new Set<AuthContext['role']>(['sales', 'viewer']);

function hasIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isUsableContext(ctx: AuthContext): boolean {
  if (!ctx || !hasIdentity(ctx.workspaceId) || !hasIdentity(ctx.userId)) return false;
  if (!PRIVILEGED_ROLES.has(ctx.role) && !SCOPED_ROLES.has(ctx.role)) return false;
  // A demo context is always a viewer in a sandbox. This protects callers that construct
  // contexts directly from accidentally upgrading a demo identity.
  return !ctx.isDemo || (ctx.role === 'viewer' && ctx.workspaceId.startsWith('demo:'));
}

@Injectable()
export class RbacService implements LeadAccessPolicy {
  /** Sales chỉ được assigned lead trong workspace của mình (I-09). */
  canAccessLead(ctx: AuthContext, lead: Resource): boolean {
    if (!isUsableContext(ctx) || !lead || !hasIdentity(lead.workspaceId) || !hasIdentity(lead.id)) return false;
    if (ctx.workspaceId !== lead.workspaceId) return false; // cross-workspace → invisible (404)
    if (PRIVILEGED_ROLES.has(ctx.role)) return true; // workspace-wide — QA-58 thu hẹp ở RFC sau, hiện allow
    // sales / viewer: phải được assign (owner) hoặc được bàn giao tới (recipient)
    if (lead.assignedTo === ctx.userId) return true;
    // Recipient có item đang actionable (proposed/accepted/open/awaiting-external) giữ quyền
    // XEM + NHẬN gói addressed to them (derived từ workItems — P1-2, I-09 lead-scoped,
    // deny-by-default). // OPEN: PM-1 — capability matrix đầy đủ cho manager/admin chờ RFC.
    return lead.recipients?.includes(ctx.userId) ?? false;
  }

  /** Capability riêng: export/delete — chỉ admin/capability-gated (QA-31). */
  canExport(ctx: AuthContext): boolean {
    return isUsableContext(ctx) && ctx.role === 'admin';
  }
  canDelete(ctx: AuthContext): boolean {
    return isUsableContext(ctx) && ctx.role === 'admin';
  }
}
