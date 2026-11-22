import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
const dbName = `mig_lifecycle_${randomUUID().replace(/-/g, '')}`;
const baseUrl = new URL(databaseUrl ?? 'postgres://localhost:5432/postgres');
// Seventeen migrations plus rollback/reapply execute many DDL transactions.
// Bound each database wait independently of the complete round-trip budget.
const connectionLimits = {
  connectionTimeoutMillis: 5_000, query_timeout: 12_000,
  options: '-c statement_timeout=10000 -c lock_timeout=3000 -c idle_in_transaction_session_timeout=15000',
};

function databaseTarget(name: string): string {
  const target = new URL(baseUrl.toString());
  target.pathname = `/${name}`;
  return target.toString();
}

integration('migration lifecycle — upgrade, rollback, and reapply on a disposable database', () => {
  let admin: Client;
  let db: PostgresService;
  let created = false;
  const migrationVersions = loadMigrations().map((migration) => migration.version);
  async function phase<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const began = performance.now();
    console.info(`migration-lifecycle phase=${name} status=start`);
    try {
      const result = await operation();
      console.info(`migration-lifecycle phase=${name} status=pass elapsedMs=${Math.round(performance.now() - began)}`);
      return result;
    } catch (error) {
      console.info(`migration-lifecycle phase=${name} status=fail elapsedMs=${Math.round(performance.now() - began)}`);
      throw error;
    }
  }

  beforeAll(async () => {
    admin = new Client({ connectionString: databaseTarget('postgres'), ...connectionLimits });
    await admin.connect();
    await phase('create-database', () => admin.query(`CREATE DATABASE ${dbName}`));
    created = true;
    db = new PostgresService({ connectionString: databaseTarget(dbName), max: 2, ...connectionLimits });
  }, 30_000);

  afterAll(async () => {
    // Starting pool.end blocks new checkouts. Drop concurrently so a checked-out
    // client cannot prevent cleanup forever after a test deadline or SQL error.
    const results = await Promise.allSettled([
      db?.onModuleDestroy(),
      created ? phase('drop-database', () => admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`)) : Promise.resolve(),
    ]);
    if (admin) results.push(...await Promise.allSettled([admin.end()]));
    const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
    if (errors.length) throw new AggregateError(errors, 'Migration lifecycle cleanup failed');
  }, 30_000);

  it('applies every migration, rolls back the latest two, and reapplies them without loss', async () => {
    const migrator = new Migrator(db, loadMigrations());
    expect(await phase('apply-all', () => migrator.up())).toEqual(migrationVersions);
    expect(await migrator.applied()).toEqual(migrationVersions);

    const probeId = randomUUID();
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2)', [probeId, 'lifecycle probe']);
    expect((await db.query('SELECT id FROM workspace WHERE id = $1', [probeId])).rows).toEqual([{ id: probeId }]);

    expect(await phase('rollback-two', () => migrator.down(2))).toEqual(migrationVersions.slice(-2).reverse());
    expect(await migrator.applied()).toEqual(migrationVersions.slice(0, -2));
    // Rollback is metadata/schema-only for these migrations; the parent row remains intact.
    expect((await db.query('SELECT id, name FROM workspace WHERE id = $1', [probeId])).rows).toEqual([
      { id: probeId, name: 'lifecycle probe' },
    ]);

    expect(await phase('reapply-two', () => migrator.up())).toEqual(migrationVersions.slice(-2));
    expect(await migrator.applied()).toEqual(migrationVersions);
    expect((await db.query('SELECT id FROM workspace WHERE id = $1', [probeId])).rows).toEqual([{ id: probeId }]);
    await db.query('DELETE FROM workspace WHERE id = $1', [probeId]);
  }, 60_000);

  it('bounds server statement and lock waits and recovers the pool after cancellation', async () => {
    expect((await db.query(`SELECT current_setting('statement_timeout') AS statement,
      current_setting('lock_timeout') AS lock, current_setting('idle_in_transaction_session_timeout') AS idle`)).rows)
      .toEqual([{ statement: '10s', lock: '3s', idle: '15s' }]);
    await expect(db.withTransaction(async tx => {
      await tx.query("SET LOCAL statement_timeout = '100ms'");
      await tx.query('SELECT pg_sleep(1)');
    })).rejects.toMatchObject({ code: '57014' });
    const blocker = new Client({ connectionString: databaseTarget(dbName), ...connectionLimits });
    await blocker.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE workspace IN ACCESS EXCLUSIVE MODE');
      await expect(db.withTransaction(async tx => {
        await tx.query("SET LOCAL lock_timeout = '100ms'");
        await tx.query('SELECT * FROM workspace');
      })).rejects.toMatchObject({ code: '55P03' });
    } finally {
      try { await blocker.query('ROLLBACK'); } finally { await blocker.end(); }
    }
    expect((await db.query('SELECT 1 AS recovered')).rows).toEqual([{ recovered: 1 }]);
  });
});
