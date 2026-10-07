import { describe, it, expect } from 'vitest';
import { RbacService } from './rbac.service';
import type { AuthContext } from '../auth/auth.service';

function ctx(overrides: Partial<AuthContext> = {}): AuthContext {
  return { workspaceId: 'ws-1', userId: 'sales-1', role: 'sales', isDemo: false, ...overrides };
}

describe('RbacService — PH3 T3-04 (I-09 lead-scoped, deny-by-default, OPEN: PM-1)', () => {
  const svc = new RbacService();

  it('same workspace + assigned → allow', () => {
    expect(svc.canAccessLead(ctx(), { workspaceId: 'ws-1', assignedTo: 'sales-1', id: 'l1' })).toBe(true);
  });

  it('same workspace + not assigned → deny', () => {
    expect(svc.canAccessLead(ctx(), { workspaceId: 'ws-1', assignedTo: 'sales-2', id: 'l2' })).toBe(false);
  });

  it('cross-workspace → deny (404 invisible)', () => {
    expect(svc.canAccessLead(ctx(), { workspaceId: 'ws-2', assignedTo: 'sales-1', id: 'l1' })).toBe(false);
  });

  it('admin can access any lead in workspace', () => {
    expect(svc.canAccessLead(ctx({ role: 'admin' }), { workspaceId: 'ws-1', assignedTo: 'sales-99', id: 'l1' })).toBe(true);
  });

  it('canExport/canDelete only admin (QA-31)', () => {
    expect(svc.canExport(ctx())).toBe(false);
    expect(svc.canExport(ctx({ role: 'admin' }))).toBe(true);
    expect(svc.canDelete(ctx())).toBe(false);
    expect(svc.canDelete(ctx({ role: 'admin' }))).toBe(true);
  });
});
