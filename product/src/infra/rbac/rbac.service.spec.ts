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

  it('rejects invalid or incomplete contexts instead of trusting spoofed identity', () => {
    const lead = { workspaceId: 'ws-1', assignedTo: 'sales-1', id: 'l1' };
    expect(svc.canAccessLead(ctx({ workspaceId: '', role: 'admin' }), lead)).toBe(false);
    expect(svc.canAccessLead(ctx({ role: 'not-a-role' as AuthContext['role'] }), lead)).toBe(false);
    expect(svc.canAccessLead(ctx({ isDemo: true, role: 'admin', workspaceId: 'demo:ws' }), lead)).toBe(false);
    expect(svc.canExport(ctx({ workspaceId: '', role: 'admin' }))).toBe(false);
    expect(svc.canDelete(ctx({ isDemo: true, role: 'admin', workspaceId: 'demo:ws' }))).toBe(false);
  });

  it('demo viewer remains limited to its sandbox and assignment', () => {
    const demo = ctx({ workspaceId: 'demo:ws', userId: 'demo:ws:viewer', role: 'viewer', isDemo: true });
    expect(svc.canAccessLead(demo, { workspaceId: 'demo:ws', assignedTo: 'demo:ws:viewer', id: 'l1' })).toBe(true);
    expect(svc.canAccessLead(demo, { workspaceId: 'ws-1', assignedTo: 'demo:ws:viewer', id: 'l2' })).toBe(false);
  });
});
