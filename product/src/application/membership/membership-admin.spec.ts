import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContext, MembershipStore } from '../../ports/auth';
import { InMemoryMembershipStore } from '../../infra/membership/in-memory-membership.store';
import { MembershipAdminService } from './membership-admin';

const ISSUER = 'https://idp.test.invalid/realms/north';
const ADMIN_ID = '0b6f2a8e-1c1d-4c39-9d43-6a7f7c2b9a01';
const ctx = (role: AuthContext['role'], over: Partial<AuthContext> = {}): AuthContext =>
  ({ workspaceId: 'ws-a', userId: ADMIN_ID, role, isDemo: false, ...over });

function mockStore(): MembershipStore & Record<string, ReturnType<typeof vi.fn>> {
  return {
    resolveUserId: vi.fn(), listActive: vi.fn(), grant: vi.fn(), revoke: vi.fn(), get: vi.fn(),
    revokeById: vi.fn(), changeRole: vi.fn(), list: vi.fn().mockResolvedValue([]),
  } as never;
}

describe('MembershipAdminService — ADR-006 admin membership API (security-critical)', () => {
  it('denies unauthenticated (401), manager/sales/viewer/demo (403) and non-internal admins before touching the store', async () => {
    const store = mockStore();
    const svc = new MembershipAdminService(store, { issuers: [ISSUER] });
    const grant = { issuer: ISSUER, subject: 'new-user', baseRole: 'sales' };
    await expect(svc.grant(null, grant)).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    for (const denied of [ctx('manager'), ctx('sales'), ctx('viewer'), ctx('admin', { isDemo: true })]) {
      await expect(svc.grant(denied, grant)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
      await expect(svc.list(denied, {})).rejects.toMatchObject({ status: 403 });
      await expect(svc.revoke(denied, ADMIN_ID)).rejects.toMatchObject({ status: 403 });
      await expect(svc.changeRole(denied, ADMIN_ID, { baseRole: 'viewer' })).rejects.toMatchObject({ status: 403 });
    }
    // Legacy bootstrap admin (`bootstrap-admin`) is not an internal principal → cannot be an audited actor.
    await expect(svc.grant(ctx('admin', { userId: 'bootstrap-admin' }), grant)).rejects.toMatchObject({ status: 403, code: 'INTERNAL_PRINCIPAL_REQUIRED' });
    for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
  });

  it('disabled configuration (legacy AUTH_MODE) answers 404 for every route', async () => {
    const svc = new MembershipAdminService(mockStore(), null);
    await expect(svc.list(ctx('admin'), {})).rejects.toMatchObject({ status: 404, code: 'MEMBERSHIP_API_DISABLED' });
    await expect(svc.grant(ctx('admin'), {})).rejects.toMatchObject({ status: 404 });
  });

  it('grant validates the body strictly; workspace never comes from the body', async () => {
    const store = mockStore();
    const svc = new MembershipAdminService(store, { issuers: [ISSUER] });
    const admin = ctx('admin');
    await expect(svc.grant(admin, { issuer: ISSUER, subject: 's', baseRole: 'sales', workspaceId: 'ws-b' }))
      .rejects.toMatchObject({ status: 400, code: 'WORKSPACE_FROM_CONTEXT' });
    for (const body of [null, [], 'x', { issuer: ISSUER, subject: 's' }, { issuer: ISSUER, subject: 's', baseRole: 'owner' },
      { issuer: ISSUER, subject: 's', baseRole: 'sales', extra: 1 }, { issuer: ISSUER, subject: '', baseRole: 'sales' },
      { issuer: ISSUER, subject: 'a\nb', baseRole: 'sales' }, { issuer: ISSUER, subject: 'x'.repeat(256), baseRole: 'sales' }]) {
      await expect(svc.grant(admin, body)).rejects.toMatchObject({ status: 400 });
    }
    await expect(svc.grant(admin, { issuer: 'https://evil.invalid', subject: 's', baseRole: 'admin' }))
      .rejects.toMatchObject({ status: 400, code: 'ISSUER_NOT_ACCEPTED' });
    expect(store.grant).not.toHaveBeenCalled();
  });

  it('revoke/role routes validate ids and the list status filter', async () => {
    const svc = new MembershipAdminService(mockStore(), { issuers: [ISSUER] });
    await expect(svc.revoke(ctx('admin'), 'not-a-uuid')).rejects.toMatchObject({ status: 400 });
    await expect(svc.changeRole(ctx('admin'), ADMIN_ID, { baseRole: 'root' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.changeRole(ctx('admin'), ADMIN_ID, { baseRole: 'sales', workspaceId: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(svc.list(ctx('admin'), { status: 'deleted' })).rejects.toMatchObject({ status: 400 });
  });
});

describe('MembershipAdminService + InMemoryMembershipStore — lifecycle', () => {
  let store: InMemoryMembershipStore;
  let svc: MembershipAdminService;
  let admin: AuthContext;

  beforeEach(async () => {
    store = new InMemoryMembershipStore();
    svc = new MembershipAdminService(store, { issuers: [ISSUER] });
    const seeded = await store.grant({ workspaceId: 'ws-a', issuer: ISSUER, subject: 'root-admin', baseRole: 'admin' });
    admin = { workspaceId: 'ws-a', userId: seeded.userId, role: 'admin', isDemo: false };
  });

  it('grant provisions user + identity link, attributes the acting admin and lists in the admin workspace only', async () => {
    const granted = await svc.grant(admin, { issuer: ISSUER, subject: 'carol', baseRole: 'sales' });
    expect(granted).toMatchObject({ workspaceId: 'ws-a', baseRole: 'sales', status: 'active', revokedAt: null });
    expect(granted.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await store.resolveUserId(ISSUER, 'carol')).toBe(granted.userId);
    expect(store.auditLog().at(-1)).toMatchObject({ operation: 'grant', membershipId: granted.id, actor: admin.userId });
    const listed = await svc.list(admin, {});
    expect(listed.map((m) => m.id)).toContain(granted.id);
    expect(listed.find((m) => m.id === granted.id)?.identity).toEqual({ issuer: ISSUER, subject: 'carol' });
    await expect(svc.grant(admin, { issuer: ISSUER, subject: 'carol', baseRole: 'viewer' })).rejects.toMatchObject({ status: 409, code: 'MEMBERSHIP_EXISTS' });
    const otherAdmin = { ...admin, workspaceId: 'ws-b' };
    expect(await svc.list(otherAdmin, {})).toEqual([]);
    await expect(svc.revoke(otherAdmin, granted.id)).rejects.toMatchObject({ status: 404 });
  });

  it('revoke is terminal; re-grant creates a NEW row; role change = revoke + grant; self-change refused', async () => {
    const first = await svc.grant(admin, { issuer: ISSUER, subject: 'dave', baseRole: 'viewer' });
    const revoked = await svc.revoke(admin, first.id);
    expect(revoked).toMatchObject({ id: first.id, status: 'revoked' });
    await expect(svc.revoke(admin, first.id)).rejects.toMatchObject({ status: 409, code: 'MEMBERSHIP_NOT_ACTIVE' });
    await expect(svc.changeRole(admin, first.id, { baseRole: 'sales' })).rejects.toMatchObject({ status: 409 });
    const regrant = await svc.grant(admin, { issuer: ISSUER, subject: 'dave', baseRole: 'viewer' });
    expect(regrant.id).not.toBe(first.id);
    expect(regrant.userId).toBe(first.userId);
    const changed = await svc.changeRole(admin, regrant.id, { baseRole: 'manager' });
    expect(changed.revoked).toMatchObject({ id: regrant.id, status: 'revoked', baseRole: 'viewer' });
    expect(changed.granted).toMatchObject({ status: 'active', baseRole: 'manager', userId: first.userId });
    await expect(svc.changeRole(admin, changed.granted.id, { baseRole: 'manager' })).rejects.toMatchObject({ status: 409, code: 'ROLE_UNCHANGED' });
    expect((await svc.list(admin, { status: 'active' })).filter((m) => m.userId === first.userId)).toHaveLength(1);
    expect((await svc.list(admin, {})).filter((m) => m.userId === first.userId)).toHaveLength(3);
    const own = (await store.listActive(admin.userId))[0];
    await expect(svc.revoke(admin, own.id)).rejects.toMatchObject({ status: 409, code: 'SELF_MEMBERSHIP_CHANGE' });
    await expect(svc.changeRole(admin, own.id, { baseRole: 'viewer' })).rejects.toMatchObject({ status: 409, code: 'SELF_MEMBERSHIP_CHANGE' });
  });

  it('tenant isolation: a workspace lists only the identity its own grant used; USER_DISABLED never enumerates other workspaces', async () => {
    const inA = await svc.grant(admin, { issuer: ISSUER, subject: 'pat', baseRole: 'sales' });
    store.linkIdentity(inA.userId, 'https://second-idp.invalid', 'pat-b');
    const adminB = await store.grant({ workspaceId: 'ws-b', issuer: ISSUER, subject: 'root-b', baseRole: 'admin' });
    const ctxB: AuthContext = { workspaceId: 'ws-b', userId: adminB.userId, role: 'admin', isDemo: false };
    const svcB = new MembershipAdminService(store, { issuers: [ISSUER, 'https://second-idp.invalid'] });
    const inB = await svcB.grant(ctxB, { issuer: 'https://second-idp.invalid', subject: 'pat-b', baseRole: 'viewer' });
    expect(inB.userId).toBe(inA.userId);
    expect((await svc.list(admin, {})).find((m) => m.id === inA.id)?.identity).toEqual({ issuer: ISSUER, subject: 'pat' });
    expect(JSON.stringify(await svc.list(admin, {}))).not.toContain('pat-b');
    expect((await svcB.list(ctxB, {})).find((m) => m.id === inB.id)?.identity).toEqual({ issuer: 'https://second-idp.invalid', subject: 'pat-b' });
    store.setUserStatus(inA.userId, 'disabled');
    const fresh = await store.grant({ workspaceId: 'ws-c', issuer: ISSUER, subject: 'root-c', baseRole: 'admin' });
    const ctxC: AuthContext = { workspaceId: 'ws-c', userId: fresh.userId, role: 'admin', isDemo: false };
    await expect(svc.grant(ctxC, { issuer: ISSUER, subject: 'pat', baseRole: 'viewer' })).resolves.toMatchObject({ status: 'active', workspaceId: 'ws-c' });
    await svc.revoke(admin, inA.id);
    await expect(svc.grant(admin, { issuer: ISSUER, subject: 'pat', baseRole: 'sales' })).rejects.toMatchObject({ status: 409, code: 'USER_DISABLED' });
  });

  it('LAST_ADMIN: two admins revoking each other concurrently — exactly one succeeds', async () => {
    const second = await svc.grant(admin, { issuer: ISSUER, subject: 'co-admin', baseRole: 'admin' });
    const own = (await store.listActive(admin.userId))[0];
    const ctx2: AuthContext = { workspaceId: 'ws-a', userId: second.userId, role: 'admin', isDemo: false };
    const results = await Promise.allSettled([svc.revoke(admin, second.id), svc.revoke(ctx2, own.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'LAST_ADMIN', status: 409 } });
    expect((await svc.list(admin, { status: 'active' })).filter((m) => m.baseRole === 'admin')).toHaveLength(1);
    const remaining = (await svc.list(admin, { status: 'active' })).find((m) => m.baseRole === 'admin')!;
    await expect(store.changeRole({ workspaceId: 'ws-a', membershipId: remaining.id, baseRole: 'viewer' })).rejects.toMatchObject({ code: 'LAST_ADMIN' });
    await expect(store.revokeById({ workspaceId: 'ws-a', membershipId: remaining.id })).rejects.toMatchObject({ code: 'LAST_ADMIN' });
  });
});
