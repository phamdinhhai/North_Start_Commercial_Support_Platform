import { describe, it, expect } from 'vitest';
import { Migrator, loadMigrations, type MigrationFile, type TransactionRunner } from './migrator';
import type { QueryResult, QueryResultRow } from 'pg';
import type { SqlExecutor } from './postgres.service';

class FakeDb implements SqlExecutor, TransactionRunner {
  readonly queries: string[] = [];
  readonly appliedVersions = new Set<string>();
  /**
   * Serialized transaction tail. Postgres serializes two migrators racing the SAME version
   * through `pg_advisory_xact_lock`; the fake approximates that by running one transaction at
   * a time, which is what distinguishes "re-check inside the transaction" (correct) from the
   * old "read the pending set once, outside" (double DDL under concurrency).
   */
  private tail: Promise<unknown> = Promise.resolve();

  async query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.queries.push(text);
    if (text.startsWith('SELECT version FROM schema_migrations WHERE version')) {
      const hit = this.appliedVersions.has(String(params?.[0]));
      const rows = hit ? [{ version: String(params?.[0]) }] : [];
      return { rows: rows as unknown as T[], rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] };
    }
    if (text.startsWith('SELECT version')) {
      return { rows: [...this.appliedVersions].map((version) => ({ version })) as unknown as T[], rowCount: this.appliedVersions.size, command: 'SELECT', oid: 0, fields: [] };
    }
    if (text.startsWith('INSERT INTO schema_migrations')) {
      this.appliedVersions.add(String(params?.[0]));
    }
    if (text.startsWith('DELETE FROM schema_migrations')) {
      this.appliedVersions.delete(String(params?.[0]));
    }
    return { rows: [], rowCount: 0, command: 'OK', oid: 0, fields: [] };
  }

  async withTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const run = this.tail.then(() => fn(this));
    // keep the chain alive even if a transaction rejects
    this.tail = run.catch(() => undefined);
    return run;
  }
}

const migrations: MigrationFile[] = [
  { version: '001_domain', up: 'CREATE TABLE domain;', down: 'DROP TABLE domain;' },
  { version: '002_telemetry_feedback', up: 'CREATE TABLE telemetry;', down: 'DROP TABLE telemetry;' },
];

describe('Migrator — PH3 T3-08', () => {
  it('loads ordered migration pairs from product/migrations', () => {
    const files = loadMigrations();
    expect(files.map((m) => m.version)).toEqual([
      '001_domain',
      '002_telemetry_feedback',
      '003_pilot_loop',
      '004_envelope_workspace_scope',
      '005_workspace_consistency',
      '006_pilot_ingest_command',
      '007_evidence_acquisition',
    ]);
    expect(files.every((m) => m.up.length > 0 && m.down.length > 0)).toBe(true);

    const consistency = files.find((m) => m.version === '005_workspace_consistency');
    expect(consistency?.up).toContain('workspace_consistency_quarantine');
    expect(consistency?.up.toLowerCase()).toContain('refusing to guess');
    expect(consistency?.up).toContain('ON DELETE SET NULL (lead_id) NOT VALID');
    expect(consistency?.up.match(/FOREIGN KEY \(lead_id, workspace_id\)/g)).toHaveLength(5);
    expect(consistency?.up.match(/\bNOT VALID;/g)).toHaveLength(5);
    expect(consistency?.up).not.toMatch(/\bDELETE\s+FROM\s+(?:commercial_event|handoff|pilot_work_item|outcome|feedback|audit_record)\b/i);
    expect(consistency?.down).not.toMatch(/\b(?:DELETE|INSERT)\s+(?:FROM|INTO)\s+(?:commercial_event|handoff|pilot_work_item|outcome|feedback|audit_record)\b/i);
  });

  it('applies pending migrations in order and becomes idempotent', async () => {
    const db = new FakeDb();
    const migrator = new Migrator(db, migrations);
    expect(await migrator.up()).toEqual(['001_domain', '002_telemetry_feedback']);
    expect(await migrator.up()).toEqual([]);
    expect(db.appliedVersions).toEqual(new Set(['001_domain', '002_telemetry_feedback']));
  });

  it('rolls back latest migration first and can re-apply', async () => {
    const db = new FakeDb();
    const migrator = new Migrator(db, migrations);
    await migrator.up();
    expect(await migrator.down()).toEqual(['002_telemetry_feedback']);
    expect(await migrator.up()).toEqual(['002_telemetry_feedback']);
  });

  it('supports rolling back multiple migrations in reverse order', async () => {
    const db = new FakeDb();
    const migrator = new Migrator(db, migrations);
    await migrator.up();
    expect(await migrator.down(2)).toEqual(['002_telemetry_feedback', '001_domain']);
    expect(db.appliedVersions.size).toBe(0);
  });

  it('re-checks the version INSIDE the transaction and takes an advisory lock — concurrent migrators cannot both apply it', async () => {
    // Two spec files share one dev DB and run in parallel: without a lock + in-transaction
    // re-check, both see "pending", both ALTER, and the loser rolls back mid-schema.
    const db = new FakeDb();
    const a = new Migrator(db, migrations);
    const b = new Migrator(db, migrations);
    const [ranA, ranB] = await Promise.all([a.up(), b.up()]);

    expect(ranA).toEqual(['001_domain', '002_telemetry_feedback']);
    expect(ranB).toEqual([]); // second caller sees the bookkeeping row and skips

    // migration DDL (not the schema_migrations bootstrap) runs exactly once per version
    const ddl = db.queries.filter((q) => q.startsWith('CREATE TABLE domain') || q.startsWith('CREATE TABLE telemetry'));
    expect(ddl).toHaveLength(2); // each migration DDL exactly once, despite two migrators
    expect(db.queries.filter((q) => q.includes('pg_advisory_xact_lock')).length).toBeGreaterThanOrEqual(4); // 2 versions × 2 callers
    // the pending-check must happen after the lock is held, in the same transaction
    const order = db.queries.findIndex((q) => q.includes('pg_advisory_xact_lock'));
    const check = db.queries.findIndex((q) => q.startsWith('SELECT version FROM schema_migrations WHERE version'));
    expect(check).toBeGreaterThan(order);
  });

  it('down also locks the version it rolls back', async () => {
    const db = new FakeDb();
    const migrator = new Migrator(db, migrations);
    await migrator.up();
    db.queries.length = 0;
    await migrator.down(1);
    expect(db.queries[0]).toContain('pg_advisory_xact_lock');
  });
});
