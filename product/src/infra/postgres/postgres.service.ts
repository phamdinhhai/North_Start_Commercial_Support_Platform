import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { Pool, type PoolClient, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

/** DI token cho PoolConfig tùy chọn — tránh Nest resolve interface thành `Object`. */
export const PG_POOL_CONFIG = Symbol('PG_POOL_CONFIG');

export type DeploymentMode = 'production' | 'pilot' | 'local' | 'demo' | 'test';
export type PilotStoreMode = 'postgres' | 'memory';

/** Resolve deployment explicitly, while retaining the existing test/local defaults. */
export function resolveDeploymentMode(env: NodeJS.ProcessEnv = process.env): DeploymentMode {
  const raw = (env.DEPLOYMENT_MODE ?? env.APP_MODE ?? env.NODE_ENV ?? 'local').trim().toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'production';
  if (raw === 'pilot') return 'pilot';
  if (raw === 'demo') return 'demo';
  if (raw === 'test') return 'test';
  if (raw === 'local' || raw === 'development' || raw === 'dev') return 'local';
  throw new Error(`Unsupported deployment mode: ${raw}`);
}

export function hasPostgresConfiguration(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.DATABASE_URL?.trim() || env.POSTGRES_HOST?.trim() || env.POSTGRES_PORT?.trim() || env.POSTGRES_DB?.trim() || env.POSTGRES_USER?.trim() || env.POSTGRES_PASSWORD?.trim());
}

/** Never silently downgrade durable deployments to memory, including local with DB settings. */
export function resolvePilotStoreMode(env: NodeJS.ProcessEnv = process.env): PilotStoreMode {
  const deployment = resolveDeploymentMode(env);
  const raw = (env.PILOT_STORE_MODE ?? env.STORE_MODE ?? '').trim().toLowerCase();
  if (raw === 'memory' || raw === 'in-memory' || raw === 'inmemory') {
    if (deployment === 'production' || deployment === 'pilot') {
      throw new Error(`In-memory pilot store is not allowed in ${deployment} mode`);
    }
    return 'memory';
  }
  if (raw && raw !== 'postgres' && raw !== 'postgresql' && raw !== 'pg') {
    throw new Error(`Unsupported pilot store mode: ${raw}`);
  }
  if (raw || hasPostgresConfiguration(env) || deployment === 'production' || deployment === 'pilot') {
    if (!hasPostgresConfiguration(env)) {
      throw new Error('PostgreSQL is not configured; set DATABASE_URL or POSTGRES_* variables');
    }
    return 'postgres';
  }
  throw new Error('Select PILOT_STORE_MODE=memory for local/demo/test without PostgreSQL');
}

export function resolvePoolConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig | undefined {
  const url = env.DATABASE_URL?.trim();
  if (url) return { connectionString: url, ...poolTuning(env) };
  if (!hasPostgresConfiguration(env)) return undefined;
  const user = encodeURIComponent(env.POSTGRES_USER?.trim() || 'north_star');
  const password = encodeURIComponent(env.POSTGRES_PASSWORD ?? 'north_star');
  const host = env.POSTGRES_HOST?.trim() || 'localhost';
  const port = env.POSTGRES_PORT?.trim() || '5432';
  const database = encodeURIComponent(env.POSTGRES_DB?.trim() || 'north_star');
  return { connectionString: `postgres://${user}:${password}@${host}:${port}/${database}`, ...poolTuning(env) };
}

function poolTuning(env: NodeJS.ProcessEnv): Pick<PoolConfig, 'max' | 'idleTimeoutMillis' | 'connectionTimeoutMillis'> {
  return {
    max: Number(env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  };
}

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

  isConfigured(): boolean {
    return Boolean(this.config?.connectionString || resolvePoolConfig());
  }

  getPool(): Pool {
    if (!this.pool) {
      const cfg = this.config ?? resolvePoolConfig();
      if (!cfg?.connectionString) {
        throw new Error('PostgreSQL is not configured; set DATABASE_URL or POSTGRES_* variables');
      }
      this.pool = new Pool(cfg);
      this.pool.on('error', (err) => this.logger.error(`pg pool error: ${err.name}`));
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
