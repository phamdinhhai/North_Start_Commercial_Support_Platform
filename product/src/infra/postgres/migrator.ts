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

  private async ensureTable(): Promise<void> {
    await this.db.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         version TEXT PRIMARY KEY,
         applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
    );
  }

  async applied(): Promise<string[]> {
    await this.ensureTable();
    const result = await this.db.query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
    return result.rows.map((r) => r.version);
  }

  /** Áp dụng mọi migration chưa chạy, theo thứ tự. Trả về các version vừa áp dụng. */
  async up(): Promise<string[]> {
    const done = new Set(await this.applied());
    const ran: string[] = [];
    for (const m of this.migrations) {
      if (done.has(m.version)) continue;
      await this.db.withTransaction(async (tx) => {
        await tx.query(m.up);
        await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [m.version]);
      });
      ran.push(m.version);
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
        await tx.query(m.down);
        await tx.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
      });
      rolled.push(version);
    }
    return rolled;
  }
}
