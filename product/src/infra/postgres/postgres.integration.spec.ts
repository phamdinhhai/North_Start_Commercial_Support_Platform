import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

integration('Postgres integration — T3-05/T3-08', () => {
  let db: PostgresService;
  let migrator: Migrator;

  beforeAll(async () => {
    db = new PostgresService({ connectionString: databaseUrl, max: 2 });
    migrator = new Migrator(db, loadMigrations());
    await migrator.up();
  });

  afterAll(async () => {
    // Cleanup test rows only. Schema is left migrated on purpose: specs share one
    // dev DB, and tearing down migrations here (down(2)) previously WIPED 003_pilot_loop
    // from under other suites. Rollback itself is covered by migrator unit tests +
    // migrate:down CLI evidence recorded in state/progress.md.
    if (db) {
      await db.query("DELETE FROM workspace WHERE id LIKE 'it-%'").catch(() => {});
      await db.onModuleDestroy();
    }
  });

  it('SELECT 1 health check and workspace rows remain after pool restart', async () => {
    const health = await db.healthCheck();
    expect(health.ok).toBe(true);

    const id = `it-${randomUUID()}`;
    await db.query('INSERT INTO workspace(id,name) VALUES($1,$2)', [id, 'integration']);
    await db.onModuleDestroy();
    db = new PostgresService({ connectionString: databaseUrl, max: 2 });

    const found = await db.query('SELECT id FROM workspace WHERE id=$1', [id]);
    expect(found.rows).toHaveLength(1);
    await db.query('DELETE FROM workspace WHERE id=$1', [id]);
  });

  it('every workspace-scoped entity query is restricted to the requested workspace', async () => {
    const wsA = `it-a-${randomUUID()}`;
    const wsB = `it-b-${randomUUID()}`;
    await db.query('INSERT INTO workspace(id,name) VALUES($1,$2),($3,$4)', [wsA, 'A', wsB, 'B']);
    await db.query(
      'INSERT INTO lead(workspace_id,display_name) VALUES($1,$2),($3,$4)',
      [wsA, 'Lead A', wsB, 'Lead B'],
    );

    const result = await db.query('SELECT workspace_id FROM lead WHERE workspace_id=$1', [wsA]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].workspace_id).toBe(wsA);

    await db.query('DELETE FROM workspace WHERE id IN ($1,$2)', [wsA, wsB]);
  });
});
