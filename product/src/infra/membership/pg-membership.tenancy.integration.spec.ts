import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { PgMembershipStore } from './pg-membership.store';
import { MembershipAdminService } from '../../application/membership/membership-admin';
import type { AuthContext } from '../../ports/auth';
import { TEST_ISSUER } from '../auth/oidc-test-kit';

/**
 * R3 review fixes (tenant isolation + last-admin) against PostgreSQL. Runs directly in
 * TEST_DATABASE_URL with per-run fixtures; skips ONLY when TEST_DATABASE_URL is absent (CI forbids that).
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const run = randomUUID().slice(0, 8);
const WS_A = `ten-a-${run}`;
const WS_B = `ten-b-${run}`;
const WS_C = `ten-c-${run}`;
const WS_D = `ten-d-${run}`;

integration('membership tenant isolation and last-admin protection (PostgreSQL, ADR-006)', () => {
  let db: PostgresService;
  let store: PgMembershipStore;
  const issuer = `${TEST_ISSUER}/tenancy/${run}`;
  const otherIssuer = `https://second-idp.invalid/${run}`;
  const admins: Record<string, AuthContext> = {};
  const service = () => new MembershipAdminService(store, { issuers: [issuer, otherIssuer] });

  beforeAll(async () => {
    db = new PostgresService({ connectionString: databaseUrl, max: 4 });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace(id, name) VALUES ($1,$1), ($2,$2), ($3,$3), ($4,$4)', [WS_A, WS_B, WS_C, WS_D]);
    store = new PgMembershipStore(db);
    for (const ws of [WS_A, WS_B]) {
      const m = await store.grant({ workspaceId: ws, issuer, subject: `admin-${ws}`, baseRole: 'admin' });
      admins[ws] = { workspaceId: ws, userId: m.userId, role: 'admin', isDemo: false };
    }
  });
  afterAll(async () => {
    await db?.onModuleDestroy().catch(() => undefined);
  });

  it('two workspaces: each admin lists only the identity its own grant used, never links created for another workspace', async () => {
    const inA = await service().grant(admins[WS_A], { issuer, subject: 'pat', baseRole: 'sales' });
    // Operator links a second IdP identity to the same platform user (e.g. a tenant-specific IdP);
    // workspace B then grants the user through THAT identity.
    await db.query('INSERT INTO external_identity(issuer, subject, user_id) VALUES ($1, $2, $3)', [otherIssuer, 'pat-b', inA.userId]);
    const inB = await service().grant(admins[WS_B], { issuer: otherIssuer, subject: 'pat-b', baseRole: 'viewer' });
    expect(inB.userId).toBe(inA.userId);
    const listA = (await service().list(admins[WS_A], {})).find((m) => m.id === inA.id)!;
    const listB = (await service().list(admins[WS_B], {})).find((m) => m.id === inB.id)!;
    expect(listA.identity).toEqual({ issuer, subject: 'pat' });
    expect(listB.identity).toEqual({ issuer: otherIssuer, subject: 'pat-b' });
    expect(JSON.stringify(await service().list(admins[WS_A], {}))).not.toContain('pat-b');
    expect(JSON.stringify(await service().list(admins[WS_B], {}))).not.toContain(`"subject":"pat"`);
    // A role change keeps the membership's own granting identity.
    const changed = await service().changeRole(admins[WS_B], inB.id, { baseRole: 'sales' });
    expect((await service().list(admins[WS_B], { status: 'active' })).find((m) => m.id === changed.granted.id)?.identity)
      .toEqual({ issuer: otherIssuer, subject: 'pat-b' });
    // The database refuses a membership whose granting identity belongs to another user.
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) SELECT $1, $2, id, 'viewer' FROM external_identity WHERE issuer=$3 AND subject=$4",
      [WS_C, admins[WS_A].userId, issuer, 'pat'])).rejects.toMatchObject({ code: '23514' });
  });

  it('USER_DISABLED does not enumerate across workspaces: a workspace without any relationship gets a normal grant', async () => {
    const inA = await service().grant(admins[WS_A], { issuer, subject: 'quinn', baseRole: 'sales' });
    await db.query("UPDATE platform_user SET status='disabled' WHERE id=$1", [inA.userId]);
    // Workspace B never had a membership for this user → indistinguishable from any other grant.
    const inB = await service().grant(admins[WS_B], { issuer, subject: 'quinn', baseRole: 'viewer' });
    expect(inB).toMatchObject({ status: 'active', baseRole: 'viewer', workspaceId: WS_B });
    expect(await store.resolveUserId(issuer, 'quinn')).toBeNull(); // still cannot log in anywhere
    // Workspace A already has a relationship (active or historical) → the state may be stated.
    await service().revoke(admins[WS_A], inA.id);
    await expect(service().grant(admins[WS_A], { issuer, subject: 'quinn', baseRole: 'sales' })).rejects.toMatchObject({ status: 409, code: 'USER_DISABLED' });
    await db.query("UPDATE platform_user SET status='active' WHERE id=$1", [inA.userId]);
  });

  it('LAST_ADMIN: the only active admin cannot be revoked or demoted', async () => {
    const only = await store.grant({ workspaceId: WS_C, issuer, subject: 'solo', baseRole: 'admin' });
    await expect(store.revokeById({ workspaceId: WS_C, membershipId: only.id })).rejects.toMatchObject({ code: 'LAST_ADMIN', status: 409 });
    await expect(store.changeRole({ workspaceId: WS_C, membershipId: only.id, baseRole: 'manager' })).rejects.toMatchObject({ code: 'LAST_ADMIN', status: 409 });
    expect((await store.get(WS_C, only.id))?.status).toBe('active');
    const second = await store.grant({ workspaceId: WS_C, issuer, subject: 'duo', baseRole: 'admin' });
    expect(await store.changeRole({ workspaceId: WS_C, membershipId: only.id, baseRole: 'manager' })).toMatchObject({ granted: { baseRole: 'manager' } });
    await expect(store.revokeById({ workspaceId: WS_C, membershipId: second.id })).rejects.toMatchObject({ code: 'LAST_ADMIN' });
  });

  it('LAST_ADMIN is race-safe: a revocation waiting on an uncommitted one sees the committed state', async () => {
    const x = await store.grant({ workspaceId: WS_D, issuer, subject: 'race-x', baseRole: 'admin' });
    const y = await store.grant({ workspaceId: WS_D, issuer, subject: 'race-y', baseRole: 'admin' });
    let revokedInTx1!: () => void;
    let releaseTx1!: () => void;
    const tx1Revoked = new Promise<void>((r) => { revokedInTx1 = r; });
    const tx1Gate = new Promise<void>((r) => { releaseTx1 = r; });
    const tx1 = db.withTransaction(async (tx) => {
      await new PgMembershipStore(tx).revokeById({ workspaceId: WS_D, membershipId: x.id });
      revokedInTx1();
      await tx1Gate;
    });
    await tx1Revoked;
    const tx2 = store.revokeById({ workspaceId: WS_D, membershipId: y.id }).then(() => 'revoked', (e: { code?: string }) => e.code);
    const early = await Promise.race([tx2, new Promise((r) => setTimeout(() => r('blocked'), 300))]);
    expect(early).toBe('blocked'); // tx2 waits for the workspace lock held by tx1
    releaseTx1();
    await tx1;
    expect(await tx2).toBe('LAST_ADMIN');
    const active = await db.query("SELECT count(*)::int AS n FROM memberships WHERE workspace_id=$1 AND status='active' AND base_role='admin'", [WS_D]);
    expect(active.rows[0].n).toBe(1);
  });

  it('LAST_ADMIN under two concurrent admin-API revocations of each other: exactly one succeeds', async () => {
    const ws = `ten-e-${run}`;
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $1)', [ws]);
    const a = await store.grant({ workspaceId: ws, issuer, subject: 'mutual-a', baseRole: 'admin' });
    const b = await store.grant({ workspaceId: ws, issuer, subject: 'mutual-b', baseRole: 'admin' });
    const ctx = (userId: string): AuthContext => ({ workspaceId: ws, userId, role: 'admin', isDemo: false });
    const results = await Promise.allSettled([service().revoke(ctx(a.userId), b.id), service().revoke(ctx(b.userId), a.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: { code: 'LAST_ADMIN', status: 409 } });
    const active = await db.query("SELECT count(*)::int AS n FROM memberships WHERE workspace_id=$1 AND status='active' AND base_role='admin'", [ws]);
    expect(active.rows[0].n).toBe(1);
  });
});
