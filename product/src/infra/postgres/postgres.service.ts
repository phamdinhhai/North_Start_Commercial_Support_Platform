import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

/** DI token cho PoolConfig tùy chọn — tránh Nest resolve interface thành `Object`. */
export const PG_POOL_CONFIG = Symbol('PG_POOL_CONFIG');

/** Executor tối thiểu dùng chung cho pool và transaction client. */
export interface SqlExecutor {
  query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/**
 * PostgreSQL pool (C-03, R-18). Pool tạo lazy — không mở kết nối cho tới query đầu tiên.
 * Mọi mutation quan trọng đi kèm audit trong cùng transaction (QA-35: audit fail → rollback).
 */
@Injectable()
export class PostgresService implements OnModuleDestroy, SqlExecutor {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool | null = null;

  constructor(@Optional() @Inject(PG_POOL_CONFIG) private readonly config?: PoolConfig) {}

  getPool(): Pool {
    if (!this.pool) {
      const cfg: PoolConfig = this.config ?? {
        connectionString:
          process.env.DATABASE_URL ??
          `postgres://${process.env.POSTGRES_USER ?? 'north_star'}:${process.env.POSTGRES_PASSWORD ?? 'north_star'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5432'}/${process.env.POSTGRES_DB ?? 'north_star'}`,
        max: Number(process.env.PG_POOL_MAX ?? 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      };
      this.pool = new Pool(cfg);
      this.pool.on('error', (err) => this.logger.error(`pg pool error: ${err.message}`));
    }
    return this.pool;
  }

  async query<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return this.getPool().query<T>(text, params);
  }

  /** Chạy `fn` trong một transaction; lỗi bất kỳ → ROLLBACK và ném lại (fail closed). */
  async withTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number }> {
    const start = Date.now();
    await this.query('SELECT 1 AS ok');
    return { ok: true, latencyMs: Date.now() - start };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
