import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { PgMembershipStore } from './pg-membership.store';
import { JwksKeyStore } from '../auth/jwks-key-store';
import { OidcAuthenticator, oidcUserId } from '../auth/oidc-authenticator';
import { OidcTokenVerifier } from '../auth/oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_ISSUER } from '../auth/oidc-test-kit';

/**
 * Runs directly in the TEST_DATABASE_URL database (no extra databases are created); fixtures use
 * a per-run suffix so reruns on the same disposable database are independent.
 * Skips ONLY when TEST_DATABASE_URL is absent (CI forbids that; see ci-integration.mjs).
 */
const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const run = randomUUID().slice(0, 8);
const WS_A = `ws-a-${run}`;
const WS_B = `ws-b-${run}`;
const MIGRATION_010 = '010_workspace_membership';
const migration010 = () => {
  const m = loadMigrations().find((x) => x.version === MIGRATION_010);
  if (!m) throw new Error('migration 010 missing');
  return m;
};

class Rollback extends Error {}

integration('migration 010 + PgMembershipStore (PostgreSQL)', () => {
  let db: PostgresService;
  let store: PgMembershipStore;
  const issuer = `${TEST_ISSUER}/${run}`;

  beforeAll(async () => {
    db = new PostgresService({ connectionString: databaseUrl, max: 2 });
    await new Migrator(db, loadMigrations().filter((m) => m.version <= MIGRATION_010)).up();
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2), ($3, $4)', [WS_A, 'A', WS_B, 'B']);
    store = new PgMembershipStore(db);
  });

  afterAll(async () => {
    await db?.onModuleDestroy().catch(() => undefined);
  });

  it('grants and lists only active memberships for the exact (issuer, subject)', async () => {
    const row = await store.grant({ workspaceId: WS_A, issuer, subject: 'alice', baseRole: 'sales' });
    expect(row).toMatchObject({ workspaceId: WS_A, issuer, subject: 'alice', baseRole: 'sales', status: 'active', revokedAt: null });
    await store.grant({ workspaceId: WS_B, issuer: 'https://other.invalid', subject: 'alice', baseRole: 'admin' });
    const active = await store.listActive(issuer, 'alice');
    expect(active.map((m) => [m.workspaceId, m.baseRole])).toEqual([[WS_A, 'sales']]);
    expect(await store.listActive(issuer, 'ALICE')).toEqual([]);
  });

  it('enforces uniqueness, base-role, workspace FK and demo-prefix constraints in the database', async () => {
    await expect(db.query("INSERT INTO memberships(workspace_id, issuer, subject, base_role) VALUES ($2,$1,'alice','viewer')", [issuer, WS_A]))
      .rejects.toMatchObject({ code: '23505' });
    await expect(db.query("INSERT INTO memberships(workspace_id, issuer, subject, base_role) VALUES ($2,$1,'eve','owner')", [issuer, WS_A]))
      .rejects.toMatchObject({ code: '23514' });
    const demoWs = `demo:${run}`;
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2)', [demoWs, 'demo sandbox']);
    await expect(db.query("INSERT INTO memberships(workspace_id, issuer, subject, base_role) VALUES ($2,$1,'eve','viewer')", [issuer, demoWs]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(db.query("INSERT INTO memberships(workspace_id, issuer, subject, base_role) VALUES ('ws-missing',$1,'eve','viewer')", [issuer]))
      .rejects.toMatchObject({ code: '23503' });
    await expect(db.query("INSERT INTO memberships(workspace_id, issuer, subject, base_role, status) VALUES ($2,$1,'eve','viewer','revoked')", [issuer, WS_A]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('revocation is immediate, one-way, and identity/role columns are immutable', async () => {
    await store.grant({ workspaceId: WS_B, issuer, subject: 'bob', baseRole: 'manager' });
    expect(await store.listActive(issuer, 'bob')).toHaveLength(1);
    expect(await store.revoke({ workspaceId: WS_B, issuer, subject: 'bob' })).toBe(true);
    expect(await store.listActive(issuer, 'bob')).toEqual([]);
    expect(await store.revoke({ workspaceId: WS_B, issuer, subject: 'bob' })).toBe(false);
    await expect(db.query("UPDATE memberships SET status='active', revoked_at=NULL WHERE subject='bob' AND issuer=$1", [issuer]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(db.query("UPDATE memberships SET base_role='admin' WHERE subject='alice' AND issuer=$1", [issuer]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(db.query("UPDATE memberships SET workspace_id=$2 WHERE subject='alice' AND issuer=$1", [issuer, WS_B]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(store.grant({ workspaceId: WS_B, issuer, subject: 'bob', baseRole: 'manager' })).rejects.toMatchObject({ code: '23505' });
  });

  it('A-m4: DELETE and TRUNCATE are refused, so revoke cannot be bypassed by delete + re-insert', async () => {
    await store.grant({ workspaceId: WS_A, issuer, subject: 'gina', baseRole: 'viewer' });
    await expect(db.query("DELETE FROM memberships WHERE subject='gina' AND issuer=$1", [issuer])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('TRUNCATE memberships CASCADE')).rejects.toMatchObject({ code: '23001' });
    expect(await store.listActive(issuer, 'gina')).toHaveLength(1);
    await store.revoke({ workspaceId: WS_A, issuer, subject: 'gina' });
    await expect(db.query("DELETE FROM memberships WHERE subject='gina' AND issuer=$1", [issuer])).rejects.toMatchObject({ code: '23001' });
    // Re-grant after revoke stays refused (PM-1 R2-P-06 decides the lifecycle, not this code).
    await expect(store.grant({ workspaceId: WS_A, issuer, subject: 'gina', baseRole: 'viewer' })).rejects.toMatchObject({ code: '23505' });
  });

  it('A-m4: grant and revoke are recorded in append-only membership_audit with an actor', async () => {
    await store.grant({ workspaceId: WS_B, issuer, subject: 'hank', baseRole: 'manager' });
    await db.withTransaction(async (tx) => {
      await tx.query("SELECT set_config('north.membership_actor', 'ops:runbook-test', true)");
      await new PgMembershipStore(tx).revoke({ workspaceId: WS_B, issuer, subject: 'hank' });
    });
    const rows = await db.query<{ operation: string; workspace_id: string; base_role: string; actor: string; membership_id: string; effective_at: Date }>(
      `SELECT a.operation, a.workspace_id, a.base_role, a.actor, a.membership_id, a.effective_at FROM membership_audit a
         JOIN memberships m ON m.id = a.membership_id WHERE m.issuer = $1 AND m.subject = 'hank' ORDER BY a.id`, [issuer]);
    expect(rows.rows.map((r) => [r.operation, r.workspace_id, r.base_role])).toEqual([['grant', WS_B, 'manager'], ['revoke', WS_B, 'manager']]);
    expect(rows.rows[0].actor).toMatch(/^db:/);
    expect(rows.rows[1].actor).toBe('ops:runbook-test');
    // No-op revoke (already revoked) writes nothing more.
    expect(await store.revoke({ workspaceId: WS_B, issuer, subject: 'hank' })).toBe(false);
    const count = await db.query("SELECT count(*)::int AS n FROM membership_audit a JOIN memberships m ON m.id=a.membership_id WHERE m.issuer=$1 AND m.subject='hank'", [issuer]);
    expect(count.rows[0].n).toBe(2);
    const id = rows.rows[0].membership_id;
    await expect(db.query("UPDATE membership_audit SET actor='forged' WHERE membership_id=$1", [id])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('DELETE FROM membership_audit WHERE membership_id=$1', [id])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('TRUNCATE membership_audit')).rejects.toMatchObject({ code: '23001' });
  });

  it('end to end: verified token + PostgreSQL membership; revocation denies the next request', async () => {
    const key = await createTestKey('kid-pg');
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const auth = new OidcAuthenticator(new OidcTokenVerifier(testConfig({ issuer }), keys), store);
    await store.grant({ workspaceId: WS_A, issuer, subject: 'dana', baseRole: 'viewer' });
    const headers = { authorization: `Bearer ${await mintToken(key, { sub: 'dana', iss: issuer })}` };
    expect(await auth.authenticate(headers)).toEqual({ kind: 'authenticated', context: { workspaceId: WS_A, userId: oidcUserId(issuer, 'dana'), role: 'viewer', isDemo: false } });
    expect(await auth.authenticate({ ...headers, 'x-workspace-id': WS_B })).toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
    await store.revoke({ workspaceId: WS_A, issuer, subject: 'dana' });
    expect(await auth.authenticate(headers)).toEqual({ kind: 'unauthenticated', reason: 'no_membership' });
  });

  it('migration 010 down/up SQL round-trips (inside a rolled-back transaction)', async () => {
    const m = migration010();
    await expect(db.withTransaction(async (tx) => {
      await tx.query(m.down);
      const gone = await tx.query<{ t: string | null }>("SELECT to_regclass('public.memberships')::text AS t");
      expect(gone.rows[0].t).toBeNull();
      const fn = await tx.query("SELECT 1 FROM pg_proc WHERE proname IN ('memberships_guard_update', 'memberships_guard_delete', 'memberships_audit_write', 'membership_audit_append_only')");
      expect(fn.rowCount).toBe(0);
      const audit = await tx.query<{ t: string | null }>("SELECT to_regclass('public.membership_audit')::text AS t");
      expect(audit.rows[0].t).toBeNull();
      await tx.query(m.up);
      await tx.query("INSERT INTO memberships(workspace_id, issuer, subject, base_role) VALUES ($1,$2,'fresh','viewer')", [WS_A, issuer]);
      const rows = await tx.query("SELECT 1 FROM memberships WHERE subject = 'alice'");
      expect(rows.rowCount).toBe(0); // down dropped rows; re-up starts empty (documented)
      await tx.query('SAVEPOINT guard_delete');
      await expect(tx.query("DELETE FROM memberships WHERE subject='fresh' AND issuer=$1", [issuer])).rejects.toMatchObject({ code: '23001' });
      await tx.query('ROLLBACK TO SAVEPOINT guard_delete');
      const audited = await tx.query("SELECT operation FROM membership_audit a JOIN memberships m ON m.id=a.membership_id WHERE m.subject='fresh' AND m.issuer=$1", [issuer]);
      expect(audited.rows).toEqual([{ operation: 'grant' }]);
      await expect(tx.query("UPDATE memberships SET base_role='admin' WHERE subject='fresh' AND issuer=$1", [issuer])).rejects.toMatchObject({ code: '23514' });
      throw new Rollback('leave the shared disposable database unchanged');
    })).rejects.toBeInstanceOf(Rollback);
    expect(await store.listActive(issuer, 'alice')).toHaveLength(1);
  });
});
