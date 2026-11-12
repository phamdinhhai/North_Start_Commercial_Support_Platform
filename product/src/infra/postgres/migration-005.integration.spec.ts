import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const dbName = `mig005_${randomUUID().replace(/-/g, '')}`;
const url = new URL(databaseUrl ?? 'postgres://localhost:5432/postgres');

function targetUrl(path: string): string {
  const target = new URL(url.toString());
  target.pathname = path;
  return target.toString();
}

async function maintenance(): Promise<Client> {
  const client = new Client({ connectionString: targetUrl('/postgres'), connectionTimeoutMillis: 5_000 });
  await client.connect();
  return client;
}

integration('migration 005 — parent/child workspace consistency', () => {
  let admin: Client;
  let db: PostgresService;
  let dbUrl: string;
  const leadId = randomUUID();
  const ids = {
    commercial_event: randomUUID(),
    handoff: randomUUID(),
    pilot_work_item: randomUUID(),
    outcome: randomUUID(),
    feedback: randomUUID(),
    audit_record: randomUUID(),
  };
  const tables = Object.keys(ids) as (keyof typeof ids)[];

  beforeAll(async () => {
    admin = await maintenance();
    await admin.query(`CREATE DATABASE ${dbName}`);
    dbUrl = targetUrl(`/${dbName}`);
    db = new PostgresService({ connectionString: dbUrl, max: 2 });
    const migrations = loadMigrations();
    await new Migrator(db, migrations.filter((m) => m.version !== '005_workspace_consistency')).up();
  });

  afterAll(async () => {
    await db?.onModuleDestroy().catch(() => undefined);
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  });

  it('retains all historical contradictions live and snapshots them for inspection', async () => {
    await db.query("INSERT INTO workspace(id,name) VALUES ('ws-a','A'),('ws-b','B')");
    await db.query(
      `INSERT INTO lead(id,workspace_id,display_name,status,attribution)
       VALUES ($1,'ws-a','lead','New','unknown')`,
      [leadId],
    );
    await db.query(
      `INSERT INTO commercial_event(id,workspace_id,lead_id,event_type,inferred_meaning,confidence,source_actor,created_by,evidence_reason)
       VALUES ($1,'ws-b',$2,'message','unknown','{}'::jsonb,'actor','actor','unknown')`,
      [ids.commercial_event, leadId],
    );
    await db.query(
      `INSERT INTO handoff(id,lead_id,workspace_id,context) VALUES ($1,$2,'ws-b','contradictory')`,
      [ids.handoff, leadId],
    );
    await db.query(
      `INSERT INTO pilot_work_item(id,lead_id,workspace_id,action,responsible_party,origin,status,completion_evidence,actor)
       VALUES ($1,$2,'ws-b','action','internal','inferred','open','absent','actor')`,
      [ids.pilot_work_item, leadId],
    );
    await db.query(
      `INSERT INTO outcome(id,lead_id,workspace_id,value,actor) VALUES ($1,$2,'ws-b','Unknown','actor')`,
      [ids.outcome, leadId],
    );
    await db.query(
      `INSERT INTO feedback(id,workspace_id,lead_id,actor,rating) VALUES ($1,'ws-b',$2,'actor',3)`,
      [ids.feedback, leadId],
    );
    await db.query(
      `INSERT INTO audit_record(id,entity_type,entity_id,workspace_id,actor,new_value)
       VALUES ($1,'lead',$2,'ws-b','actor','{}'::jsonb)`,
      [ids.audit_record, leadId],
    );
    // The parent of a different audit entity type cannot be inferred.
    await db.query(
      `INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,new_value)
       VALUES ('external_record','not-a-uuid','ws-b','actor','{}'::jsonb)`,
    );

    const migration = loadMigrations().find((m) => m.version === '005_workspace_consistency');
    if (!migration) throw new Error('005 migration file not found');
    expect(await new Migrator(db, [migration]).up()).toEqual(['005_workspace_consistency']);

    const quarantined = await db.query<{
      source_table: string; source_id: string; row_data: { workspace_id: string; lead_id?: string; entity_id?: string };
    }>('SELECT source_table, source_id, row_data FROM workspace_consistency_quarantine ORDER BY source_table');
    expect(quarantined.rows).toHaveLength(tables.length);
    expect(quarantined.rows.map((row) => row.source_table)).toEqual([...tables].sort());
    for (const row of quarantined.rows) {
      const table = row.source_table as keyof typeof ids;
      expect(row.source_id).toBe(ids[table]);
      expect(row.row_data.workspace_id).toBe('ws-b');
      expect(row.row_data.lead_id ?? row.row_data.entity_id).toBe(leadId);
      const live = await db.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM ${table} WHERE id = $1`,
        [row.source_id],
      );
      expect(live.rows).toEqual([{ workspace_id: 'ws-b' }]);
    }
    const unrelatedAudit = await db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM audit_record WHERE entity_type = 'external_record'`,
    );
    expect(unrelatedAudit.rows[0]?.count).toBe('1');
  });

  it('rejects fresh mismatches in every typed child while accepting matched writes', async () => {
    const writes: Record<Exclude<keyof typeof ids, 'audit_record'>, (workspace: string) => Promise<unknown>> = {
      commercial_event: (workspace) => db.query(
        `INSERT INTO commercial_event(id,workspace_id,lead_id,event_type,inferred_meaning,confidence,source_actor,created_by,evidence_reason)
         VALUES ($1,$2,$3,'message','unknown','{}'::jsonb,'actor','actor','unknown')`,
        [randomUUID(), workspace, leadId],
      ),
      handoff: (workspace) => db.query(
        `INSERT INTO handoff(id,lead_id,workspace_id,context) VALUES ($1,$2,$3,'new')`, [randomUUID(), leadId, workspace],
      ),
      pilot_work_item: (workspace) => db.query(
        `INSERT INTO pilot_work_item(id,lead_id,workspace_id,action,responsible_party,origin,status,completion_evidence,actor)
         VALUES ($1,$2,$3,'action','internal','inferred','open','absent','actor')`,
        [randomUUID(), leadId, workspace],
      ),
      outcome: (workspace) => db.query(
        `INSERT INTO outcome(id,lead_id,workspace_id,value,actor) VALUES ($1,$2,$3,'Unknown','actor')`,
        [randomUUID(), leadId, workspace],
      ),
      feedback: (workspace) => db.query(
        `INSERT INTO feedback(id,workspace_id,lead_id,actor,rating) VALUES ($1,$2,$3,'actor',3)`,
        [randomUUID(), workspace, leadId],
      ),
    };
    for (const write of Object.values(writes)) {
      await expect(write('ws-b')).rejects.toMatchObject({ code: '23503' });
      await expect(write('ws-a')).resolves.toBeDefined();
    }
    // No lead is valid for a feedback row and preserves its original nullable link.
    await expect(db.query(
      `INSERT INTO feedback(workspace_id,actor,rating) VALUES ('ws-b','actor',3)`,
    )).resolves.toBeDefined();
    await expect(db.query(
      `INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,new_value)
       VALUES ('lead',$1,'ws-b','actor','{}'::jsonb)`,
      [leadId],
    )).rejects.toThrow(/workspace/);
    await expect(db.query(
      `INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,new_value)
       VALUES ('lead','not-a-uuid','ws-b','actor','{}'::jsonb)`,
    )).rejects.toThrow(/UUID/);
    await expect(db.query(
      `INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,new_value)
       VALUES ('external_record','not-a-uuid','ws-b','actor','{}'::jsonb)`,
    )).resolves.toBeDefined();
    // Changing an unrelated column on a legacy contradictory audit does not hide it.
    await db.query('UPDATE audit_record SET reason = $1 WHERE id = $2', ['still visible', ids.audit_record]);
    expect((await db.query<{ reason: string }>(
      'SELECT reason FROM audit_record WHERE id = $1', [ids.audit_record],
    )).rows[0]?.reason).toBe('still visible');
  });

  it('retains feedback but clears its lead_id on lead deletion', async () => {
    const feedbackLead = randomUUID();
    const feedback = randomUUID();
    await db.query(
      `INSERT INTO lead(id,workspace_id,display_name) VALUES ($1,'ws-a','feedback lead')`,
      [feedbackLead],
    );
    await db.query(
      `INSERT INTO feedback(id,workspace_id,lead_id,actor,rating) VALUES ($1,'ws-a',$2,'actor',4)`,
      [feedback, feedbackLead],
    );
    await db.query('DELETE FROM lead WHERE id = $1', [feedbackLead]);
    const retained = await db.query<{ workspace_id: string; lead_id: string | null }>(
      'SELECT workspace_id, lead_id FROM feedback WHERE id = $1', [feedback],
    );
    expect(retained.rows).toEqual([{ workspace_id: 'ws-a', lead_id: null }]);
  });

  it('rolls back and reapplies without changing live rows or dropping quarantine evidence', async () => {
    const allMigrations = loadMigrations();
    const migration = allMigrations.find((m) => m.version === '005_workspace_consistency');
    if (!migration) throw new Error('005 migration file not found');
    // The database also has 006 applied by beforeAll; Migrator must know every
    // applied version so rollback bookkeeping remains ordered and complete.
    const migrator = new Migrator(db, allMigrations);
    expect(await migrator.down(3)).toEqual(['007_evidence_acquisition', '006_pilot_ingest_command', '005_workspace_consistency']);
    for (const table of tables) {
      const live = await db.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM ${table} WHERE id = $1`, [ids[table]],
      );
      expect(live.rows).toEqual([{ workspace_id: 'ws-b' }]);
    }
    const quarantineCount = async () => (await db.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM workspace_consistency_quarantine',
    )).rows[0]?.count;
    expect(await quarantineCount()).toBe('6');
    // Down restores the old write contract; reapply hardens it again.
    await db.query(`INSERT INTO handoff(id,lead_id,workspace_id,context) VALUES ($1,$2,'ws-b','during rollback')`, [randomUUID(), leadId]);
    expect(await migrator.up()).toEqual(['005_workspace_consistency', '006_pilot_ingest_command', '007_evidence_acquisition']);
    expect(await quarantineCount()).toBe('7');
    for (const table of tables) {
      const live = await db.query<{ workspace_id: string }>(
        `SELECT workspace_id FROM ${table} WHERE id = $1`, [ids[table]],
      );
      expect(live.rows).toEqual([{ workspace_id: 'ws-b' }]);
    }
    await expect(db.query(
      `INSERT INTO handoff(id,lead_id,workspace_id,context) VALUES ($1,$2,'ws-b','blocked again')`, [randomUUID(), leadId],
    )).rejects.toMatchObject({ code: '23503' });
  });
});
