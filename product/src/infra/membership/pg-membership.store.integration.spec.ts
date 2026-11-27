import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { PgMembershipStore } from './pg-membership.store';
import { JwksKeyStore } from '../auth/jwks-key-store';
import { OidcAuthenticator } from '../auth/oidc-authenticator';
import { OidcTokenVerifier } from '../auth/oidc-token-verifier';
import { createTestKey, mintToken, testConfig, TEST_ISSUER } from '../auth/oidc-test-kit';

/**
 * Uses owned schemas in TEST_DATABASE_URL, never downgrading shared tables.
 * Migration 010 round-trips only in a schema containing migrations 001–010.
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

integration('migration 010 + PgMembershipStore (PostgreSQL, ADR-006)', () => {
  let db: PostgresService;
  let store: PgMembershipStore;
  let adminId: string;
  const schema = `membership_${randomUUID().replace(/-/g, '')}`;
  const latestSchema = `membership_latest_${randomUUID().replace(/-/g, '')}`;
  let latest: PostgresService;
  const issuer = `${TEST_ISSUER}/${run}`;
  const audit = (subject: string) => db.query<{ operation: string; workspace_id: string; base_role: string; actor: string; actor_user_id: string | null; transaction_id: string; membership_id: string }>(
    `SELECT a.operation, a.workspace_id, a.base_role, a.actor, a.actor_user_id, a.transaction_id, a.membership_id FROM membership_audit a
       JOIN external_identity i ON i.user_id = a.user_id WHERE i.issuer = $1 AND i.subject = $2 ORDER BY a.id`, [issuer, subject]);

  beforeAll(async () => {
    const admin = new PostgresService({ connectionString: databaseUrl, max: 1 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await admin.query(`CREATE SCHEMA ${latestSchema}`);
    } finally { await admin.onModuleDestroy(); }
    db = new PostgresService({ connectionString: databaseUrl, max: 2, options: `-c search_path=${schema}` });
    latest = new PostgresService({ connectionString: databaseUrl, max: 1, options: `-c search_path=${latestSchema}` });
    await new Migrator(latest, loadMigrations()).up();
    await new Migrator(db, loadMigrations().filter((m) => m.version <= MIGRATION_010)).up();
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2), ($3, $4)', [WS_A, 'A', WS_B, 'B']);
    store = new PgMembershipStore(db);
    adminId = (await store.grant({ workspaceId: WS_A, issuer, subject: 'root-admin', baseRole: 'admin' })).userId;
  });

  afterAll(async () => {
    await latest?.onModuleDestroy().catch(() => undefined);
    await db?.onModuleDestroy().catch(() => undefined);
    const admin = new PostgresService({ connectionString: databaseUrl, max: 1 });
    try {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.query(`DROP SCHEMA IF EXISTS ${latestSchema} CASCADE`);
    } finally { await admin.onModuleDestroy(); }
  });

  it('grant provisions platform_user + external_identity; resolution is exact and never provisions', async () => {
    const row = await store.grant({ workspaceId: WS_A, issuer, subject: 'alice', baseRole: 'sales' }, { userId: adminId });
    expect(row).toMatchObject({ workspaceId: WS_A, baseRole: 'sales', status: 'active', revokedAt: null });
    expect(row.userId).toMatch(/^[0-9a-f-]{36}$/);
    expect(await store.resolveUserId(issuer, 'alice')).toBe(row.userId);
    expect(await store.resolveUserId(issuer, 'ALICE')).toBeNull();
    expect(await store.resolveUserId(issuer, 'nobody')).toBeNull();
    expect((await db.query('SELECT 1 FROM external_identity WHERE issuer=$1 AND subject=$2', [issuer, 'nobody'])).rowCount).toBe(0);
    const foreign = await store.grant({ workspaceId: WS_B, issuer: `https://other.invalid/${run}`, subject: 'alice', baseRole: 'admin' });
    expect(foreign.userId).not.toBe(row.userId);
    expect((await store.listActive(row.userId)).map((m) => [m.workspaceId, m.baseRole])).toEqual([[WS_A, 'sales']]);
    // Same identity in another workspace reuses the same internal user.
    expect((await store.grant({ workspaceId: WS_B, issuer, subject: 'alice', baseRole: 'viewer' })).userId).toBe(row.userId);
  });

  it('enforces partial-unique active membership, identity uniqueness, base-role, workspace FK and demo-prefix in the database', async () => {
    const userId = (await store.resolveUserId(issuer, 'alice'))!;
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) VALUES ($1,$2,(SELECT id FROM external_identity WHERE user_id=$2 LIMIT 1),'viewer')", [WS_A, userId]))
      .rejects.toMatchObject({ code: '23505', constraint: 'memberships_active_unique' });
    await expect(store.grant({ workspaceId: WS_A, issuer, subject: 'alice', baseRole: 'viewer' })).rejects.toMatchObject({ code: 'MEMBERSHIP_EXISTS', status: 409 });
    await expect(db.query('INSERT INTO external_identity(issuer, subject, user_id) VALUES ($1, $2, $3)', [issuer, 'alice', adminId]))
      .rejects.toMatchObject({ code: '23505' });
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) VALUES ($1,$2,(SELECT id FROM external_identity WHERE user_id=$2 LIMIT 1),'owner')", [WS_A, adminId]))
      .rejects.toMatchObject({ code: '23514' });
    const demoWs = `demo:${run}`;
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2)', [demoWs, 'demo sandbox']);
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) VALUES ($1,$2,(SELECT id FROM external_identity WHERE user_id=$2 LIMIT 1),'viewer')", [demoWs, userId]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) VALUES ('ws-missing',$1,(SELECT id FROM external_identity WHERE user_id=$1 LIMIT 1),'viewer')", [userId]))
      .rejects.toMatchObject({ code: '23503' });
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) VALUES ($1,$2,(SELECT id FROM external_identity WHERE user_id=$2 LIMIT 1),'viewer')", [WS_B, randomUUID()]))
      .rejects.toMatchObject({ code: '23514' }); // no identity link of that user → refused before the FK
    await expect(db.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role, status) VALUES ($1,$2,(SELECT id FROM external_identity WHERE user_id=$2 LIMIT 1),'viewer','revoked')", [WS_B, adminId]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('revoke is terminal and immutable; re-grant creates a NEW row for the same user', async () => {
    const first = await store.grant({ workspaceId: WS_B, issuer, subject: 'bob', baseRole: 'manager' }, { userId: adminId });
    const revoked = await store.revokeById({ workspaceId: WS_B, membershipId: first.id }, { userId: adminId });
    expect(revoked).toMatchObject({ id: first.id, status: 'revoked' });
    expect(await store.listActive(first.userId)).toEqual([]);
    expect(await store.revokeById({ workspaceId: WS_B, membershipId: first.id }, { userId: adminId })).toBeNull();
    await expect(db.query("UPDATE memberships SET status='active', revoked_at=NULL WHERE id=$1", [first.id])).rejects.toMatchObject({ code: '23514' });
    await expect(db.query("UPDATE memberships SET base_role='admin' WHERE id=$1", [first.id])).rejects.toMatchObject({ code: '23514' });
    await expect(db.query('UPDATE memberships SET user_id=$2 WHERE id=$1', [first.id, adminId])).rejects.toMatchObject({ code: '23514' });
    const again = await store.grant({ workspaceId: WS_B, issuer, subject: 'bob', baseRole: 'manager' }, { userId: adminId });
    expect(again.id).not.toBe(first.id);
    expect(again.userId).toBe(first.userId);
    expect((await store.get(WS_B, first.id))?.status).toBe('revoked');
    // Foreign-workspace id is invisible.
    expect(await store.get(WS_A, again.id)).toBeNull();
    expect(await store.revokeById({ workspaceId: WS_A, membershipId: again.id }, { userId: adminId })).toBeNull();
  });

  it('DELETE/TRUNCATE are refused on memberships, platform_user and external_identity; identity links are immutable', async () => {
    const row = await store.grant({ workspaceId: WS_A, issuer, subject: 'gina', baseRole: 'viewer' });
    await expect(db.query('DELETE FROM memberships WHERE id=$1', [row.id])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('TRUNCATE memberships CASCADE')).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('DELETE FROM platform_user WHERE id=$1', [row.userId])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('TRUNCATE platform_user CASCADE')).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('DELETE FROM external_identity WHERE user_id=$1', [row.userId])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('UPDATE external_identity SET user_id=$2 WHERE user_id=$1', [row.userId, adminId])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('TRUNCATE external_identity CASCADE')).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('UPDATE platform_user SET id=$2 WHERE id=$1', [row.userId, randomUUID()])).rejects.toMatchObject({ code: '23514' });
    expect(await store.listActive(row.userId)).toHaveLength(1);
  });

  it('ADR-006 audit: actor = acting admin internal id via transaction-local setting; seed path = db role; append-only', async () => {
    const row = await store.grant({ workspaceId: WS_B, issuer, subject: 'hank', baseRole: 'manager' }, { userId: adminId });
    await store.revokeById({ workspaceId: WS_B, membershipId: row.id }, { userId: adminId });
    const seeded = await store.grant({ workspaceId: WS_A, issuer, subject: 'hank', baseRole: 'sales' });
    const rows = (await audit('hank')).rows;
    expect(rows.map((r) => [r.operation, r.workspace_id, r.base_role, r.actor, r.actor_user_id])).toEqual([
      ['grant', WS_B, 'manager', adminId, adminId], ['revoke', WS_B, 'manager', adminId, adminId], ['grant', WS_A, 'sales', expect.stringMatching(/^db:/), null],
    ]);
    // The setting is transaction-local: it never leaks into the next pooled statement.
    expect((await db.query<{ v: string | null }>("SELECT current_setting('north.membership_actor', true) AS v")).rows[0].v ?? '').toBe('');
    // A non-UUID or unknown actor cannot be recorded: the whole change fails (fail closed).
    await expect(db.withTransaction(async (tx) => {
      await tx.query("SELECT set_config('north.membership_actor', 'ops:forged', true)");
      await new PgMembershipStore(tx).revokeById({ workspaceId: WS_A, membershipId: seeded.id });
    })).rejects.toMatchObject({ code: '22P02' });
    await expect(store.revokeById({ workspaceId: WS_A, membershipId: seeded.id }, { userId: randomUUID() })).rejects.toMatchObject({ code: '23503' });
    expect((await store.get(WS_A, seeded.id))?.status).toBe('active');
    const id = rows[0].membership_id;
    await expect(db.query("UPDATE membership_audit SET actor='forged' WHERE membership_id=$1", [id])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('DELETE FROM membership_audit WHERE membership_id=$1', [id])).rejects.toMatchObject({ code: '23001' });
    await expect(db.query('TRUNCATE membership_audit')).rejects.toMatchObject({ code: '23001' });
  });

  it('role change = revoke + grant in ONE transaction (shared transaction id); a failure rolls both back', async () => {
    const row = await store.grant({ workspaceId: WS_A, issuer, subject: 'ivy', baseRole: 'viewer' }, { userId: adminId });
    // Unknown actor → audit FK fails on the revoke → nothing changes.
    await expect(store.changeRole({ workspaceId: WS_A, membershipId: row.id, baseRole: 'sales' }, { userId: randomUUID() })).rejects.toMatchObject({ code: '23503' });
    expect((await store.listActive(row.userId)).map((m) => [m.id, m.baseRole])).toEqual([[row.id, 'viewer']]);
    const changed = await store.changeRole({ workspaceId: WS_A, membershipId: row.id, baseRole: 'sales' }, { userId: adminId });
    expect(changed?.revoked).toMatchObject({ id: row.id, status: 'revoked', baseRole: 'viewer' });
    expect(changed?.granted).toMatchObject({ status: 'active', baseRole: 'sales', userId: row.userId });
    const rows = (await audit('ivy')).rows;
    expect(rows.map((r) => r.operation)).toEqual(['grant', 'revoke', 'grant']);
    expect(rows[1].transaction_id).toBe(rows[2].transaction_id);
    expect(rows[0].transaction_id).not.toBe(rows[1].transaction_id);
    expect(await store.changeRole({ workspaceId: WS_B, membershipId: changed!.granted.id, baseRole: 'admin' }, { userId: adminId })).toBeNull();
    const listed = await store.list(WS_A);
    const ivy = listed.filter((m) => m.userId === row.userId);
    expect(ivy.map((m) => m.status)).toEqual(['active', 'revoked']);
    expect(ivy[0].identity).toEqual({ issuer, subject: 'ivy' });
    expect((await store.list(WS_A, { status: 'revoked' })).every((m) => m.status === 'revoked')).toBe(true);
  });

  it('end to end: verified token → internal user → PostgreSQL membership; disabled user and revocation deny the next request', async () => {
    const key = await createTestKey('kid-pg');
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const auth = new OidcAuthenticator(new OidcTokenVerifier(testConfig({ issuer }), keys), store);
    const row = await store.grant({ workspaceId: WS_A, issuer, subject: 'dana', baseRole: 'viewer' }, { userId: adminId });
    const headers = { authorization: `Bearer ${await mintToken(key, { sub: 'dana', iss: issuer })}` };
    expect(await auth.authenticate(headers)).toEqual({ kind: 'authenticated', context: { workspaceId: WS_A, userId: row.userId, role: 'viewer', isDemo: false } });
    expect(await auth.authenticate({ ...headers, 'x-workspace-id': WS_B })).toEqual({ kind: 'forbidden', reason: 'workspace_not_member' });
    const stranger = { authorization: `Bearer ${await mintToken(key, { sub: 'stranger', iss: issuer })}` };
    expect(await auth.authenticate(stranger)).toEqual({ kind: 'unauthenticated', reason: 'unknown_identity' });
    await db.query("UPDATE platform_user SET status='disabled' WHERE id=$1", [row.userId]);
    expect(await auth.authenticate(headers)).toEqual({ kind: 'unauthenticated', reason: 'unknown_identity' });
    await db.query("UPDATE platform_user SET status='active' WHERE id=$1", [row.userId]);
    expect(await store.revoke({ workspaceId: WS_A, issuer, subject: 'dana' }, { userId: adminId })).toBe(true);
    expect(await auth.authenticate(headers)).toEqual({ kind: 'unauthenticated', reason: 'no_membership' });
  });

  it('migration 010 down/up SQL round-trips (inside a rolled-back transaction)', async () => {
    const m = migration010();
    // Regression: newest migrations and their FK must already exist elsewhere.
    const latestVersions = await new Migrator(latest, loadMigrations()).applied();
    expect(latestVersions).toContain('017_assertion_ops');
    const dependency = () => latest.query(`SELECT 1 FROM pg_constraint WHERE
      conrelid = 'assertion_delivery_audit'::regclass AND confrelid = 'platform_user'::regclass AND contype = 'f'`);
    expect((await dependency()).rowCount).toBe(1);
    const principal = randomUUID();
    await latest.query('INSERT INTO platform_user(id) VALUES ($1)', [principal]);
    await expect(db.withTransaction(async (tx) => {
      await tx.query(m.down);
      for (const table of ['memberships', 'membership_audit', 'platform_user', 'external_identity']) {
        const gone = await tx.query<{ t: string | null }>('SELECT to_regclass($1)::text AS t', [`${schema}.${table}`]);
        expect(gone.rows[0].t).toBeNull();
      }
      const fn = await tx.query(`SELECT 1 FROM pg_proc WHERE proname IN ('memberships_guard_update', 'memberships_guard_delete',
        'memberships_audit_write', 'membership_audit_append_only', 'platform_user_guard_update', 'principal_guard_immutable',
        'memberships_check_identity') AND pronamespace = current_schema()::regnamespace`);
      expect(fn.rowCount).toBe(0);
      await tx.query(m.up);
      const fresh = await new PgMembershipStore(tx).grant({ workspaceId: WS_A, issuer, subject: 'fresh', baseRole: 'viewer' });
      const rows = await tx.query('SELECT 1 FROM external_identity WHERE subject = $1', ['alice']);
      expect(rows.rowCount).toBe(0); // down dropped rows; re-up starts empty (documented)
      await tx.query('SAVEPOINT guard_delete');
      await expect(tx.query('DELETE FROM memberships WHERE id=$1', [fresh.id])).rejects.toMatchObject({ code: '23001' });
      await tx.query('ROLLBACK TO SAVEPOINT guard_delete');
      const audited = await tx.query('SELECT operation FROM membership_audit WHERE membership_id=$1', [fresh.id]);
      expect(audited.rows).toEqual([{ operation: 'grant' }]);
      await tx.query('SAVEPOINT partial_unique');
      await expect(tx.query("INSERT INTO memberships(workspace_id, user_id, identity_id, base_role) VALUES ($1,$2,(SELECT id FROM external_identity WHERE user_id=$2 LIMIT 1),'admin')", [WS_A, fresh.userId])).rejects.toMatchObject({ code: '23505' });
      await tx.query('ROLLBACK TO SAVEPOINT partial_unique');
      throw new Rollback('leave the shared disposable database unchanged');
    })).rejects.toBeInstanceOf(Rollback);
    expect(await store.resolveUserId(issuer, 'alice')).not.toBeNull();
    expect((await dependency()).rowCount).toBe(1);
    expect((await latest.query('SELECT id FROM platform_user WHERE id=$1', [principal])).rows).toEqual([{ id: principal }]);
    expect(await new Migrator(latest, loadMigrations()).applied()).toEqual(latestVersions);
  });
});
