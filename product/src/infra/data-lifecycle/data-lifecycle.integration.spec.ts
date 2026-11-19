import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { loadMigrations, Migrator } from '../postgres/migrator';
import { PgDataLifecycleStore } from './pg-data-lifecycle.store';
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('data lifecycle metadata planning PostgreSQL', () => {
  let db: PostgresService; let store: PgDataLifecycleStore;
  const ws = `lifecycle-${randomUUID()}`, foreign = `foreign-${randomUUID()}`;
  const input = { dataClass: 'accepted_evidence' as const, retentionSeconds: 60, approvalRef: 'SYNTHETIC-REVIEW', expectedRevision: 0 };
  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up(); store = new PgDataLifecycleStore(db);
    await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1),($2,$2)', [ws, foreign]);
    await db.query(`INSERT INTO commercial_envelope(connection,external_record_id,external_event_type,source_captured_at,ingested_at,raw_payload,raw_payload_hash,workspace_id,is_synthetic)
      VALUES ($1,'old','fixture',now(),now()-interval '2 minutes','{"synthetic":"private fixture"}','fixture',$1,true),
      ($2,'old','fixture',now(),now()-interval '2 minutes','{}','fixture',$2,true)`, [ws, foreign]);
  });
  afterAll(async () => { await db?.onModuleDestroy(); });
  it('requires policy and isolates workspace', async () => {
    await expect(store.preview(ws, 'actor', 'accepted_evidence')).rejects.toMatchObject({ code: 'POLICY_REQUIRED' });
    await store.configure(ws, 'actor', input);
    await expect(store.preview(foreign, 'actor', 'accepted_evidence')).rejects.toMatchObject({ code: 'POLICY_REQUIRED' });
    const result = await store.preview(ws, 'actor', 'accepted_evidence');
    expect(result).toMatchObject({ eligibleCount: 1, disposition: 'BLOCKED_IMMUTABLE_HISTORY', executionAvailable: false });
    expect(JSON.stringify(result)).not.toContain('private fixture');
    expect((await db.query('SELECT id FROM commercial_envelope WHERE workspace_id=$1', [ws])).rows).toHaveLength(1);
  });
  it('serializes revision races and retains preview snapshot revision', async () => {
    const race = await Promise.allSettled([store.configure(ws, 'actor', { ...input, expectedRevision: 1 }), store.configure(ws, 'actor', { ...input, expectedRevision: 1 })]);
    expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter(r => r.status === 'rejected')).toHaveLength(1);
    const previews = await Promise.all([store.preview(ws, 'actor', 'accepted_evidence'), store.preview(ws, 'actor', 'accepted_evidence')]);
    expect(previews.map(p => p.policyRevision)).toEqual([2, 2]);
    expect(previews[0].id).not.toBe(previews[1].id);
  });
  it('rolls back policy and preview on audit failure then recovers', async () => {
    await db.query(`CREATE FUNCTION fail_lifecycle_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='data-lifecycle' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER fail_lifecycle_test BEFORE INSERT ON audit_record FOR EACH ROW EXECUTE FUNCTION fail_lifecycle_test()');
    const before = (await db.query('SELECT id FROM data_lifecycle_preview WHERE workspace_id=$1', [ws])).rows.length;
    try {
      await expect(store.configure(ws, 'actor', { ...input, expectedRevision: 2 })).rejects.toThrow('audit unavailable');
      await expect(store.preview(ws, 'actor', 'accepted_evidence')).rejects.toThrow('audit unavailable');
    } finally { await db.query('DROP TRIGGER fail_lifecycle_test ON audit_record'); await db.query('DROP FUNCTION fail_lifecycle_test()'); }
    expect((await db.query('SELECT id FROM data_lifecycle_preview WHERE workspace_id=$1', [ws])).rows).toHaveLength(before);
    expect(await store.configure(ws, 'actor', { ...input, expectedRevision: 2 })).toMatchObject({ revision: 3 });
    expect(await store.preview(ws, 'actor', 'accepted_evidence')).toMatchObject({ policyRevision: 3 });
  });
  it('protects planning history and refuses destructive downgrade', async () => {
    await expect(db.query('DELETE FROM data_lifecycle_policy WHERE workspace_id=$1', [ws])).rejects.toThrow('append-only');
    await expect(db.query('UPDATE data_lifecycle_preview SET eligible_count=0 WHERE workspace_id=$1', [ws])).rejects.toThrow('append-only');
    const down = loadMigrations().find(m => m.version === '015_data_lifecycle')!.down;
    await expect(db.withTransaction(tx => tx.query(down))).rejects.toThrow('cannot roll back nonempty lifecycle history');
  });
});
