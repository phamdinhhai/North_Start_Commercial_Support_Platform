import { describe, it, expect } from 'vitest';
import { Migrator, loadMigrations, type MigrationFile, type TransactionRunner } from './migrator';
import type { QueryResult, QueryResultRow } from 'pg';
import type { SqlExecutor } from './postgres.service';

class FakeDb implements SqlExecutor, TransactionRunner {
  readonly queries: string[] = [];
  readonly appliedVersions = new Set<string>();

  async query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.queries.push(text);
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
    return fn(this);
  }
}

const migrations: MigrationFile[] = [
  { version: '001_domain', up: 'CREATE TABLE domain;', down: 'DROP TABLE domain;' },
  { version: '002_telemetry_feedback', up: 'CREATE TABLE telemetry;', down: 'DROP TABLE telemetry;' },
];

describe('Migrator — PH3 T3-08', () => {
  it('loads ordered migration pairs from product/migrations', () => {
    const files = loadMigrations();
    expect(files.map((m) => m.version)).toEqual(['001_domain', '002_telemetry_feedback', '003_pilot_loop']);
    expect(files.every((m) => m.up.length > 0 && m.down.length > 0)).toBe(true);
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
});
