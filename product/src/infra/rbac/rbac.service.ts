import { Injectable } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.service';

/**
 * RBAC — PH3 T3-04 (I-09 lead-scoped, deny-by-default).
 * // OPEN: PM-1 — Manager/Admin capability matrix chi tiết chờ RFC (QA-30/32/58).
 * Hiện enforce frozen boundary: workspace-scoped + lead assignment.
 */
export type Resource = { workspaceId: string; assignedTo?: string; id: string };

@Injectable()
export class RbacService {
  /** Sales chỉ được assigned lead trong workspace của mình (I-09). */
  canAccessLead(ctx: AuthContext, lead: Resource): boolean {
    if (ctx.workspaceId !== lead.workspaceId) return false; // cross-workspace → invisible (404)
    if (ctx.role === 'admin' || ctx.role === 'manager') return true; // workspace-wide — QA-58 thu hẹp ở RFC sau, hiện allow
    // sales / viewer: phải được assign
    return lead.assignedTo === ctx.userId;
  }

  /** Capability riêng: export/delete — chỉ admin/capability-gated (QA-31). */
  canExport(ctx: AuthContext): boolean {
    return ctx.role === 'admin';
  }
  canDelete(ctx: AuthContext): boolean {
    return ctx.role === 'admin';
  }
}
