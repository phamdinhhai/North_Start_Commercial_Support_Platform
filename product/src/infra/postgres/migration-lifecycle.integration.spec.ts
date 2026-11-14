import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const dbName = `mig_lifecycle_${randomUUID().replace(/-/g, '')}`;
const baseUrl = new URL(databaseUrl ?? 'postgres://localhost:5432/postgres');

function databaseTarget(name: string): string {
  const target = new URL(baseUrl.toString());
  target.pathname = `/${name}`;
  return target.toString();
}

integration('migration lifecycle — upgrade, rollback, and reapply on a disposable database', () => {
  let admin: Client;
  let db: PostgresService;
  const migrationVersions = loadMigrations().map((migration) => migration.version);

  beforeAll(async () => {
    admin = new Client({ connectionString: databaseTarget('postgres'), connectionTimeoutMillis: 5_000 });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    db = new PostgresService({ connectionString: databaseTarget(dbName), max: 2 });
  });

  afterAll(async () => {
    await db?.onModuleDestroy().catch(() => undefined);
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() => undefined);
    await admin?.end().catch(() => undefined);
  });

  it('applies every migration, rolls back the latest two, and reapplies them without loss', async () => {
    const migrator = new Migrator(db, loadMigrations());
    expect(await migrator.up()).toEqual(migrationVersions);
    expect(await migrator.applied()).toEqual(migrationVersions);

    const probeId = randomUUID();
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2)', [probeId, 'lifecycle probe']);
    expect((await db.query('SELECT id FROM workspace WHERE id = $1', [probeId])).rows).toEqual([{ id: probeId }]);

    expect(await migrator.down(2)).toEqual(['007_evidence_acquisition', '006_pilot_ingest_command']);
    expect(await migrator.applied()).toEqual(migrationVersions.slice(0, -2));
    // Rollback is metadata/schema-only for these migrations; the parent row remains intact.
    expect((await db.query('SELECT id, name FROM workspace WHERE id = $1', [probeId])).rows).toEqual([
      { id: probeId, name: 'lifecycle probe' },
    ]);

    expect(await migrator.up()).toEqual(['006_pilot_ingest_command', '007_evidence_acquisition']);
    expect(await migrator.applied()).toEqual(migrationVersions);
    expect((await db.query('SELECT id FROM workspace WHERE id = $1', [probeId])).rows).toEqual([{ id: probeId }]);
    await db.query('DELETE FROM workspace WHERE id = $1', [probeId]);
  });
});
