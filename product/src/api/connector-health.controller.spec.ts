import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConnectorHealthController } from './connector-health.controller';
import { CONNECTOR_HEALTH_LIMIT, ConnectorHealthQuery } from '../application/observability/connector-health';
import { AUTH_CONTEXT_RESOLVER, type AuthContext, type AuthContextResolver } from '../ports/auth';
import type { ConnectorHealthReader, EnrollmentHealthRow } from '../ports/connector-health';
import { REQUEST_ANNOTATOR, type RequestAnnotator } from '../ports/request-context';
import { InMemoryConnectorHealthReader } from '../infra/observability/in-memory-connector-health.reader';

const NOW = new Date('2026-11-18T10:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);
const row = (over: Partial<EnrollmentHealthRow>): EnrollmentHealthRow => ({
  enrollmentId: '00000000-0000-4000-8000-000000000001', workspaceId: 'ws-alpha', connectionId: 'conn-a',
  providerSurface: 'pancake-conversations', enrolledAt: minutes(-10), expiresAt: minutes(5), revokedAt: null,
  checkpoint: 3, checkpointAdvancedAt: minutes(-2), lastReceiptAt: minutes(-2), receiptCount: 3,
  lastAuditOperation: 'receipt', lastAuditAt: minutes(-2), ...over,
});

const ctxFor = (role: AuthContext['role'], workspaceId = 'ws-alpha', isDemo = false): AuthContext => ({ workspaceId, userId: `${role}-1`, role, isDemo });

describe('ConnectorHealthController', () => {
  let reader: InMemoryConnectorHealthReader;
  let current: AuthContext | null;
  const annotator: RequestAnnotator = { annotateWorkspace: vi.fn() };
  const resolver: AuthContextResolver = { resolve: () => current };
  let env: NodeJS.ProcessEnv;
  const controller = () => new ConnectorHealthController(new ConnectorHealthQuery(reader, env), resolver, annotator);

  beforeEach(() => {
    env = { AIL_RESEARCH_ENABLED: 'true' };
    current = ctxFor('manager');
    vi.mocked(annotator.annotateWorkspace).mockClear();
    reader = new InMemoryConnectorHealthReader([
      row({}),
      row({ enrollmentId: '00000000-0000-4000-8000-000000000002', revokedAt: minutes(-1), lastAuditOperation: 'revoke' }),
      row({ enrollmentId: '00000000-0000-4000-8000-000000000003', expiresAt: minutes(-1), checkpoint: 0, checkpointAdvancedAt: null, lastReceiptAt: null, receiptCount: 0, enrolledAt: minutes(-20), lastAuditOperation: 'enroll' }),
      row({ enrollmentId: '00000000-0000-4000-8000-0000000000ff', workspaceId: 'ws-beta', connectionId: 'conn-beta-secret' }),
    ], () => NOW);
  });

  it('returns 404 AIL_DISABLED when the integration flag is off, before authentication', async () => {
    env = {};
    current = null;
    await expect(controller().health({})).rejects.toMatchObject({ status: 404, response: { code: 'AIL_DISABLED' } });
    env = { AIL_RESEARCH_ENABLED: '1' };
    await expect(controller().health({})).rejects.toMatchObject({ status: 404 });
  });

  it('rejects unauthenticated callers with 401', async () => {
    current = null;
    await expect(controller().health({})).rejects.toMatchObject({ status: 401, response: { code: 'UNAUTHORIZED' } });
  });

  it.each([
    ['sales', ctxFor('sales')],
    ['viewer', ctxFor('viewer')],
    ['demo viewer', ctxFor('viewer', 'demo:x', true)],
    ['demo flagged admin', ctxFor('admin', 'ws-alpha', true)],
  ])('denies %s with 403 and does not read', async (_label, ctx) => {
    current = ctx;
    const spy = vi.spyOn(reader, 'listByWorkspace');
    await expect(controller().health({})).rejects.toMatchObject({ status: 403, response: { code: 'FORBIDDEN' } });
    expect(spy).not.toHaveBeenCalled();
    expect(annotator.annotateWorkspace).not.toHaveBeenCalled();
  });

  it('returns only the caller workspace enrollments with separate transport, delivery and completeness', async () => {
    const report = await controller().health({});
    expect(annotator.annotateWorkspace).toHaveBeenCalledWith('ws-alpha');
    expect(report.classification).toBe('OPERATIONAL_TELEMETRY_NOT_COMMERCIAL_EVIDENCE');
    expect(report.workspaceId).toBe('ws-alpha');
    expect(report.completeness).toBe('UNKNOWN');
    expect(report.enrollments.map((e) => e.transport.state).sort()).toEqual(['active', 'expired', 'revoked']);
    const active = report.enrollments.find((e) => e.transport.state === 'active')!;
    expect(active.delivery).toMatchObject({ receiptCount: 3, checkpoint: 3, checkpointAgeSeconds: 120, rejectedConflicts: { count: null, reason: 'NOT_PERSISTED' } });
    expect(active.completeness).toBe('UNKNOWN');
    const expired = report.enrollments.find((e) => e.transport.state === 'expired')!;
    expect(expired.delivery).toMatchObject({ checkpoint: 0, checkpointAdvancedAt: null, lastReceiptAt: null, checkpointAgeSeconds: 1200 });
    expect(JSON.stringify(report)).not.toContain('ws-beta');
    expect(JSON.stringify(report)).not.toContain('conn-beta-secret');
  });

  it('a foreign-workspace admin sees nothing from ws-alpha', async () => {
    current = ctxFor('admin', 'ws-gamma');
    const report = await controller().health({});
    expect(report).toMatchObject({ workspaceId: 'ws-gamma', enrollments: [], truncated: false, completeness: 'UNKNOWN' });
  });

  it('can never present a single healthy verdict, even with an active, contiguous, recent enrollment', async () => {
    reader = new InMemoryConnectorHealthReader([row({})], () => NOW);
    const report = await controller().health({});
    const json = JSON.stringify(report);
    expect(json).not.toMatch(/healthy|"status"|"ok"|complete"/i);
    expect(Object.keys(report).sort()).toEqual(['classification', 'completeness', 'enrollments', 'observedAt', 'truncated', 'workspaceId']);
    expect(Object.keys(report.enrollments[0]).sort()).toEqual(['completeness', 'completenessReason', 'connectionId', 'delivery', 'enrollmentId', 'providerSurface', 'transport']);
    expect(report.enrollments[0]).toMatchObject({ completeness: 'UNKNOWN', completenessReason: 'NO_RECONCILIATION' });
  });

  it('drops rows from another workspace even if a faulty adapter returns them', async () => {
    const leaky: ConnectorHealthReader = { listByWorkspace: async () => ({ observedAt: NOW, rows: [row({}), row({ workspaceId: 'ws-beta', enrollmentId: 'leak' })], truncated: false }) };
    const c = new ConnectorHealthController(new ConnectorHealthQuery(leaky, env), resolver, annotator);
    const report = await c.health({});
    expect(report.enrollments.map((e) => e.enrollmentId)).toEqual(['00000000-0000-4000-8000-000000000001']);
  });

  it('bounds the page and reports truncation', async () => {
    reader = new InMemoryConnectorHealthReader(Array.from({ length: CONNECTOR_HEALTH_LIMIT + 5 }, (_, i) => row({ enrollmentId: `e-${String(i).padStart(4, '0')}` })), () => NOW);
    const report = await controller().health({});
    expect(report.enrollments).toHaveLength(CONNECTOR_HEALTH_LIMIT);
    expect(report.truncated).toBe(true);
  });

  it('maps reader failures to 503 without leaking the error', async () => {
    const broken: ConnectorHealthReader = { listByWorkspace: async () => { throw new Error('password authentication failed for user north'); } };
    const c = new ConnectorHealthController(new ConnectorHealthQuery(broken, env), resolver, annotator);
    await expect(c.health({})).rejects.toMatchObject({ status: 503, response: { code: 'HEALTH_UNAVAILABLE' } });
  });

  it('maps unexpected resolver errors to 503', async () => {
    const throwing: AuthContextResolver = { resolve: () => { throw new Error('boom'); } };
    const c = new ConnectorHealthController(new ConnectorHealthQuery(reader, env), throwing, annotator);
    await expect(c.health({})).rejects.toMatchObject({ status: 503 });
  });
});

describe('GET /v1/integration/health routing (Nest + Fastify)', () => {
  let app: NestFastifyApplication;
  const prior = process.env.AIL_RESEARCH_ENABLED;
  const resolver: AuthContextResolver = {
    resolve: (req) => (req.headers['x-test-role'] ? ctxFor(req.headers['x-test-role'] as AuthContext['role'], req.headers['x-test-ws'] ?? 'ws-alpha') : null),
  };
  const reader = new InMemoryConnectorHealthReader([row({})], () => NOW);

  @Module({
    controllers: [ConnectorHealthController],
    providers: [
      { provide: ConnectorHealthQuery, useValue: new ConnectorHealthQuery(reader) },
      { provide: AUTH_CONTEXT_RESOLVER, useValue: resolver },
      { provide: REQUEST_ANNOTATOR, useValue: { annotateWorkspace: () => undefined } },
    ],
  })
  class TestModule {}

  beforeAll(async () => {
    process.env.AIL_RESEARCH_ENABLED = 'true';
    app = await NestFactory.create<NestFastifyApplication>(TestModule, new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/readiness', 'v1/health', 'v1/health/readiness'] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
    if (prior === undefined) delete process.env.AIL_RESEARCH_ENABLED; else process.env.AIL_RESEARCH_ENABLED = prior;
  });

  const get = (headers: Record<string, string>) => app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/v1/integration/health', headers });

  it('serves the read model with no-store caching for a manager', async () => {
    const res = await get({ 'x-test-role': 'manager' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.json()).toMatchObject({ workspaceId: 'ws-alpha', completeness: 'UNKNOWN', enrollments: [{ transport: { state: 'active' } }] });
  });

  it('denies sales/viewer and isolates a foreign admin', async () => {
    expect((await get({ 'x-test-role': 'sales' })).statusCode).toBe(403);
    expect((await get({ 'x-test-role': 'viewer' })).statusCode).toBe(403);
    expect((await get({})).statusCode).toBe(401);
    const foreign = await get({ 'x-test-role': 'admin', 'x-test-ws': 'ws-other' });
    expect(foreign.statusCode).toBe(200);
    expect(foreign.json().enrollments).toEqual([]);
  });

  it('is not exposed without the /v1 prefix', async () => {
    const res = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/integration/health', headers: { 'x-test-role': 'admin' } });
    expect(res.statusCode).toBe(404);
  });
});
