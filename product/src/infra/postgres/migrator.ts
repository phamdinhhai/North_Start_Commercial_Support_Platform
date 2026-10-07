import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SqlExecutor } from './postgres.service';

/** Một migration gồm cặp file `<version>.up.sql` / `<version>.down.sql` (T3-02, T3-08). */
export interface MigrationFile {
  readonly version: string;
  readonly up: string;
  readonly down: string;
}

/** Transaction runner — PostgresService.withTransaction thỏa interface này. */
export interface TransactionRunner {
  withTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export const DEFAULT_MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', '..', 'migrations');

/** Đọc migrations theo thứ tự version; thiếu `.down.sql` → lỗi (rollback bắt buộc — change seam #5). */
export function loadMigrations(dir: string = DEFAULT_MIGRATIONS_DIR): MigrationFile[] {
  const ups = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
  return ups.map((file) => {
    const version = file.slice(0, -'.up.sql'.length);
    const downPath = path.join(dir, `${version}.down.sql`);
    if (!fs.existsSync(downPath)) {
      throw new Error(`Migration ${version} is missing ${version}.down.sql`);
    }
    return {
      version,
      up: fs.readFileSync(path.join(dir, file), 'utf8'),
      down: fs.readFileSync(downPath, 'utf8'),
    };
  });
}

/**
 * Forward/rollback migrator. Mỗi version chạy trong transaction riêng cùng bookkeeping
 * `schema_migrations` — lỗi giữa chừng → rollback, không để schema nửa vời.
 */
export class Migrator {
  constructor(
    private readonly db: TransactionRunner & SqlExecutor,
    private readonly migrations: readonly MigrationFile[],
  ) {}

  /**
   * `schema_migrations` bootstrap — also serialized: two processes running
   * `CREATE TABLE IF NOT EXISTS` concurrently can still collide on the catalog, so the
   * statement runs inside a transaction holding an advisory lock on the table name.
   */
  private async ensureTable(): Promise<void> {
    await this.db.withTransaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['schema_migrations']);
      await tx.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           version TEXT PRIMARY KEY,
           applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )`,
      );
    });
  }

  async applied(): Promise<string[]> {
    await this.ensureTable();
    const result = await this.db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
    return result.rows.map((r) => r.version);
  }

  /**
   * Áp dụng mọi migration chưa chạy, theo thứ tự. Trả về các version vừa áp dụng.
   *
   * Mỗi version chạy trong MỘT transaction cùng `pg_advisory_xact_lock(version)`:
   * vitest chạy các integration spec file SONG SONG trên cùng một dev DB, nên hai
   * migrator có thể cùng thấy "chưa chạy" và cùng ALTER — một bên nhận
   * `column/table already exists` hoặc unique violation trên `schema_migrations`,
   * transaction rollback và để lại schema nửa vời. Advisory lock + re-check BÊN TRONG
   * lock đảm bảo đúng một bên apply, bên kia thấy row bookkeeping đã có → skip.
   */
  async up(): Promise<string[]> {
    await this.ensureTable();
    const ran: string[] = [];
    for (const m of this.migrations) {
      const applied = await this.db.withTransaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [m.version]);
        const already = await tx.query<{ version: string }>('SELECT version FROM schema_migrations WHERE version = $1', [m.version]);
        if (already.rows.length > 0) return false;
        await tx.query(m.up);
        await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
        return true;
      });
      if (applied) ran.push(m.version);
    }
    return ran;
  }

  /** Rollback `steps` migration gần nhất (mặc định 1). Trả về các version đã rollback. */
  async down(steps = 1): Promise<string[]> {
    const done = await this.applied();
    const targets = done.slice(-steps).reverse();
    const rolled: string[] = [];
    for (const version of targets) {
      const m = this.migrations.find((x) => x.version === version);
      if (!m) throw new Error(`No migration file for applied version ${version}`);
      await this.db.withTransaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [version]);
        await tx.query(m.down);
        await tx.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
      });
      rolled.push(version);
    }
    return rolled;
  }
}
