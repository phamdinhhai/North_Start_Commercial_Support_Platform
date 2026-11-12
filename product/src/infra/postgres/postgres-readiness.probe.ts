import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PostgresService, resolvePilotStoreMode } from './postgres.service';
import type { ReadinessProbe, ReadinessResponse } from '../../ports/readiness';

const REQUIRED_MIGRATIONS = [
  '001_domain',
  '002_telemetry_feedback',
  '003_pilot_loop',
  '004_envelope_workspace_scope',
  '005_workspace_consistency',
  '006_pilot_ingest_command',
  '007_evidence_acquisition',
] as const;

@Injectable()
export class PostgresReadinessProbe implements ReadinessProbe {
  constructor(@Inject(PostgresService) private readonly postgres: PostgresService) {}

  async readiness(): Promise<ReadinessResponse> {
    const timestamp = new Date().toISOString();
    const version = process.env.npm_package_version ?? '0.1.0';
    let mode: 'postgres' | 'memory';
    try {
      mode = resolvePilotStoreMode();
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready', version, timestamp,
        checks: {
          store: { status: 'not_ready', mode: null, durable: false },
          database: { status: 'not_ready' }, migrations: { status: 'not_ready' },
        },
      });
    }
    const store = { status: 'ok' as const, mode, durable: mode === 'postgres' };
    if (mode === 'memory') {
      return { status: 'ok', version, timestamp, checks: { store, database: { status: 'not_applicable' }, migrations: { status: 'not_applicable' } } };
    }
    const checks: ReadinessResponse['checks'] = { store, database: { status: 'not_ready' }, migrations: { status: 'not_ready' } };
    try {
      const check = await this.withTimeout(this.postgres.healthCheck(), 1_000);
      checks.database = { status: 'ok', latencyMs: check.latencyMs };
      const versions = await this.withTimeout(
        this.postgres.query<{ version: string }>('SELECT version FROM schema_migrations WHERE version = ANY($1::text[])', [REQUIRED_MIGRATIONS]),
        1_000,
      );
      if (REQUIRED_MIGRATIONS.every((version) => versions.rows.some((row) => row.version === version))) {
        checks.migrations = { status: 'ok' };
        return { status: 'ok', version, timestamp, checks };
      }
    } catch {
      // A missing migrations table, unavailable database or timeout is not ready.
    }
    throw new ServiceUnavailableException({ status: 'not_ready', version, timestamp, checks });
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('readiness timeout')), timeoutMs); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
