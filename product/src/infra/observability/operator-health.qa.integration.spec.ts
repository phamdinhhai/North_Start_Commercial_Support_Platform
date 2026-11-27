import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PgOperatorSyncHealthReader } from './pg-operator-sync-health.reader';
import { OperatorSyncHealthQuery } from '../../application/operator-sync-health';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('independent operator health PostgreSQL acceptance', () => {
  let db: PostgresService, reader: PgOperatorSyncHealthReader;
  const workspaceId = 'health-qa-' + randomUUID(), foreign = 'health-foreign-' + randomUUID();
  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up();
    for (const w of [workspaceId, foreign]) await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)', [w]);
    // Explicit fabricated setup; this test measures only bounded operational read projection.
    for (const [w, count] of [[workspaceId, 101], [foreign, 1]] as const) {
      await db.query("INSERT INTO source_connection(id,workspace_id,provider,route,page_id,status) SELECT gen_random_uuid(),$1,'pancake','pancake-synthetic','fabricated-page-'||n,'active' FROM generate_series(1,$2) n", [w, count]);
      await db.query("INSERT INTO sync_stream(id,workspace_id,connection_id,provider,account_id,capability,mode,status,cursor) SELECT gen_random_uuid(),workspace_id,id,provider,page_id,'synthetic-messages','offline-synthetic','active','secret-cursor-must-stay-private' FROM source_connection WHERE workspace_id=$1", [w]);
    }
    reader = new PgOperatorSyncHealthReader(db);
  });
  afterAll(async () => db?.onModuleDestroy());
  it('clamps requested limit, exposes truncation and never reads cursors or lease secrets', async () => {
    const result = await reader.list(workspaceId, 500);
    expect(result.items).toHaveLength(100); expect(result.truncated).toBe(true);
    expect(result.items.every(row => row.workspaceId === workspaceId)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/secret-cursor|lease_token|leaseToken|"cursor"|rawPayload/);
    expect((await reader.list(foreign, 100)).items).toHaveLength(1);
  });
  it('projects current source revocation rather than stale active stream state', async () => {
    const before = (await reader.list(foreign, 100)).items[0];
    await db.query("UPDATE source_connection SET status='revoked',revoked_at=now() WHERE workspace_id=$1 AND id=$2", [foreign, before.connectionId]);
    expect((await reader.list(foreign, 100)).items[0].status).toBe('revoked');
    expect((await db.query('SELECT status FROM sync_stream WHERE workspace_id=$1 AND id=$2', [foreign, before.id])).rows[0].status).toBe('active');
  });
  it('lets manager inspect operational facts but denies manager control and Sales reads', async () => {
    let controlled = false;
    const service = new OperatorSyncHealthQuery(reader, { control: async () => { controlled = true; } }, true);
    const manager = { workspaceId, userId: 'qa-manager', role: 'manager' as const, isDemo: false };
    const result = await service.report(manager);
    expect(result.items).toHaveLength(100); expect(result.truncated).toBe(true);
    expect(result.items[0]).toMatchObject({ lag: 'UNKNOWN', completeness: 'UNKNOWN', state: 'SYNTHETIC_ONLY' });
    await expect(service.command(manager, result.items[0].streamId, 'pause')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(service.report({ ...manager, role: 'sales' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(controlled).toBe(false);
  });
});
