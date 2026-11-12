import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import { PostgresReadinessProbe } from '../infra/postgres/postgres-readiness.probe';

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

const db = {
  healthCheck: vi.fn(async () => ({ ok: true, latencyMs: 3 })),
  query: vi.fn(async () => ({ rows: [
      { version: '001_domain' },
      { version: '002_telemetry_feedback' },
      { version: '003_pilot_loop' },
      { version: '004_envelope_workspace_scope' },
      { version: '005_workspace_consistency' },
      { version: '006_pilot_ingest_command' },
      { version: '007_evidence_acquisition' },
  ] })),
};
const controller = new HealthController(new PostgresReadinessProbe(db as never));

describe('HealthController', () => {
  afterEach(() => vi.clearAllMocks());

  it('GET /health preserves its response shape without a database', () => {
    const res = controller.health();
    expect(res.status).toBe('ok');
    expect(res.version).toEqual(expect.any(String));
    expect(res.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new Date(res.timestamp).getTime()).not.toBeNaN();
    expect(res).toEqual({ status: 'ok', version: res.version, timestamp: res.timestamp });
  });

  it('is not ready without a selected store', async () => {
    process.env = { DEPLOYMENT_MODE: 'local' };
    await expect(controller.readiness()).rejects.toMatchObject({ status: 503 });
    expect(db.healthCheck).not.toHaveBeenCalled();
  });

  it('reports explicit memory mode ready without claiming database durability', async () => {
    process.env = { DEPLOYMENT_MODE: 'demo', PILOT_STORE_MODE: 'memory' };
    const ready = await controller.readiness();
    expect(ready.status).toBe('ok');
    expect(ready.checks).toEqual({
      store: { status: 'ok', mode: 'memory', durable: false },
      database: { status: 'not_applicable' },
      migrations: { status: 'not_applicable' },
    });
    expect(db.healthCheck).not.toHaveBeenCalled();
  });

  it('checks PostgreSQL connectivity and all seven required migration versions', async () => {
    process.env = { DEPLOYMENT_MODE: 'pilot', DATABASE_URL: 'postgres://local/db' };
    const ready = await controller.readiness();
    expect(ready.checks).toEqual({
      store: { status: 'ok', mode: 'postgres', durable: true },
      database: { status: 'ok', latencyMs: 3 },
      migrations: { status: 'ok' },
    });
    expect(db.query).toHaveBeenCalledWith(
      'SELECT version FROM schema_migrations WHERE version = ANY($1::text[])',
      [[
        '001_domain', '002_telemetry_feedback', '003_pilot_loop',
        '004_envelope_workspace_scope', '005_workspace_consistency',
        '006_pilot_ingest_command', '007_evidence_acquisition',
      ]],
    );
  });

  it('returns 503 when a required migration is missing', async () => {
    process.env = { DEPLOYMENT_MODE: 'pilot', DATABASE_URL: 'postgres://local/db' };
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(controller.readiness()).rejects.toMatchObject({
      status: 503,
      response: { checks: { database: { status: 'ok' }, migrations: { status: 'not_ready' } } },
    });
  });

  it('does not accept the latest migration marker without its prerequisites', async () => {
    process.env = { DEPLOYMENT_MODE: 'pilot', DATABASE_URL: 'postgres://local/db' };
    db.query.mockResolvedValueOnce({ rows: [{ version: '007_evidence_acquisition' }] });
    await expect(controller.readiness()).rejects.toMatchObject({
      status: 503,
      response: { checks: { migrations: { status: 'not_ready' } } },
    });
  });

  it('returns 503 when schema_migrations is absent', async () => {
    process.env = { DEPLOYMENT_MODE: 'pilot', DATABASE_URL: 'postgres://local/db' };
    db.query.mockRejectedValueOnce(new Error('relation "schema_migrations" does not exist'));
    await expect(controller.readiness()).rejects.toMatchObject({ status: 503 });
  });

  it('returns 503 when the database is unreachable', async () => {
    process.env = { DEPLOYMENT_MODE: 'pilot', DATABASE_URL: 'postgres://local/db' };
    db.healthCheck.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(controller.readiness()).rejects.toMatchObject({ status: 503 });
    expect(db.query).not.toHaveBeenCalled();
  });
});
