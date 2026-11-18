import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Body, Controller, Get, HttpException, Inject, Module, Param, Post } from '@nestjs/common';
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpMetrics, MAX_SERIES } from './http-metrics';
import { MetricsReporter, RequestContextInterceptor, registerHttpObservability, type HookHost } from './http-observability';
import { JsonLogger, resolveLogLevels } from './json-logger';
import { AlsRequestAnnotator } from './request-context';

const lines: string[] = [];
const logger = new JsonLogger((line) => lines.push(line), resolveLogLevels('verbose'));
const annotator = new AlsRequestAnnotator();
const UUID = '0b8f4f2e-1d2c-4b5a-9e8f-7a6b5c4d3e2f';
const PII = { email: 'tran.thi.b@example.com', phone: '0987654321', token: 'tok_secret_abc', cookie: 'sid=cookie-secret' };

@Controller('probe')
class ProbeController {
  constructor(@Inject(JsonLogger) private readonly log: JsonLogger) {}

  @Get('leads/:id')
  lead(@Param('id') id: string) {
    annotator.annotateWorkspace('ws-alpha');
    this.log.log({ event: 'probe.lead' }, 'ProbeController');
    return { ok: id.length > 0 };
  }

  @Post('echo')
  async echo(@Body() body: unknown) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    this.log.log({ event: 'probe.echo' }, 'ProbeController');
    return { received: typeof body };
  }

  @Get('fail')
  fail() { throw new HttpException({ code: 'X' }, 503); }
}

@Module({
  controllers: [ProbeController],
  providers: [{ provide: JsonLogger, useValue: logger }, { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor }],
})
class ProbeModule {}

const parsed = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
const accessLines = () => parsed().filter((line) => line.event === 'http.request');

describe('HTTP observability hooks (real Nest + Fastify)', () => {
  let app: NestFastifyApplication;
  const metrics = new HttpMetrics();

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(ProbeModule, new FastifyAdapter({ bodyLimit: 1024 }), { logger: false });
    registerHttpObservability(app.getHttpAdapter().getInstance() as unknown as HookHost, logger, metrics);
    app.setGlobalPrefix('v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(() => { lines.length = 0; });

  const inject = (opts: Record<string, unknown>) => app.getHttpAdapter().getInstance().inject(opts as never);

  it('echoes a valid inbound x-request-id and uses it in every log line of the request', async () => {
    const res = await inject({ method: 'GET', url: `/v1/probe/leads/lead-123?email=${PII.email}&phone=${PII.phone}`, headers: { 'x-request-id': UUID } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBe(UUID);
    const handler = parsed().find((line) => line.event === 'probe.lead');
    expect(handler).toMatchObject({ requestId: UUID, workspaceId: 'ws-alpha', context: 'ProbeController' });
    expect(accessLines()[0]).toMatchObject({
      event: 'http.request', requestId: UUID, workspaceId: 'ws-alpha', method: 'GET', route: '/v1/probe/leads/:id', status: 200,
    });
    expect(accessLines()[0].durationMs).toEqual(expect.any(Number));
    expect(lines.join('\n')).not.toMatch(/lead-123|example\.com|0987654321|\?/);
  });

  it('replaces an invalid inbound id with a generated UUID and keeps context across body parsing', async () => {
    const res = await inject({
      method: 'POST', url: '/v1/probe/echo',
      headers: { 'x-request-id': `evil ${PII.email}`, authorization: `Bearer ${PII.token}`, cookie: PII.cookie, 'content-type': 'application/json' },
      payload: JSON.stringify({ message: 'xin chao', email: PII.email, phone: PII.phone }),
    });
    expect(res.statusCode).toBe(201);
    const id = res.headers['x-request-id'] as string;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parsed().find((line) => line.event === 'probe.echo')?.requestId).toBe(id);
    expect(accessLines()[0]).toMatchObject({ requestId: id, route: '/v1/probe/echo', status: 201 });
    expect(accessLines()[0]).not.toHaveProperty('workspaceId');
    const all = lines.join('\n');
    for (const secret of [PII.email, PII.phone, PII.token, PII.cookie, 'Bearer', 'xin chao', 'authorization', 'cookie']) expect(all).not.toContain(secret);
  });

  it('logs unmatched routes without the raw path and still returns a request id', async () => {
    const res = await inject({ method: 'GET', url: `/v1/nothing/${PII.phone}` });
    expect(res.statusCode).toBe(404);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(accessLines()[0]).toMatchObject({ route: '(unmatched)', status: 404, level: 'warn' });
    expect(lines.join('\n')).not.toContain(PII.phone);
  });

  it('counts parser-level 413 and handler 503 responses and logs 5xx as error', async () => {
    const big = await inject({ method: 'POST', url: '/v1/probe/echo', headers: { 'content-type': 'application/json' }, payload: JSON.stringify({ a: 'x'.repeat(2048) }) });
    expect(big.statusCode).toBe(413);
    expect(big.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const fail = await inject({ method: 'GET', url: '/v1/probe/fail' });
    expect(fail.statusCode).toBe(503);
    expect(accessLines().map((line) => line.level)).toEqual(['warn', 'error']);
    const snap = metrics.snapshot();
    expect(snap.requests['POST /v1/probe/echo 413']).toBe(1);
    expect(snap.requests['GET /v1/probe/fail 503']).toBe(1);
    expect(Object.keys(snap.requests).join(' ')).not.toMatch(/lead-123|0987654321/);
  });
});

describe('HttpMetrics', () => {
  it('tracks auth failures and intake 409/413/503 by route template only', () => {
    const m = new HttpMetrics();
    m.record('POST', '/v1/integration/observations', 409);
    m.record('POST', '/v1/integration/observations', 409);
    m.record('POST', '/v1/integration/observations', 413);
    m.record('POST', '/v1/integration/enroll', 503);
    m.record('POST', '/v1/integration/enroll', 401);
    m.record('GET', '/v1/integration/health', 503);
    m.record('BREW', '', 999);
    const snap = m.snapshot();
    expect(snap.intakeRejections).toEqual({
      'POST /v1/integration/observations 409': 2, 'POST /v1/integration/observations 413': 1, 'POST /v1/integration/enroll 503': 1,
    });
    expect(snap.authFailures).toEqual({ 'POST /v1/integration/enroll 401': 1 });
    expect(snap.requests['OTHER (unmatched) 500']).toBe(1);
  });

  it('caps series count and records overflow instead of growing unbounded', () => {
    const m = new HttpMetrics();
    for (let i = 0; i < MAX_SERIES + 10; i++) m.record('GET', `/v1/r${i}`, 200);
    const snap = m.snapshot();
    expect(Object.keys(snap.requests)).toHaveLength(MAX_SERIES);
    expect(snap.droppedSeries).toBe(10);
  });

  it('MetricsReporter emits an allowlisted snapshot line and stops cleanly', () => {
    vi.useFakeTimers();
    try {
      const out: string[] = [];
      const m = new HttpMetrics();
      m.record('POST', '/v1/integration/observations', 409);
      const reporter = new MetricsReporter(new JsonLogger((line) => out.push(line)), m);
      reporter.start(1000);
      reporter.start(1000); // idempotent
      vi.advanceTimersByTime(2500);
      expect(out).toHaveLength(2);
      expect(JSON.parse(out[0])).toMatchObject({ event: 'metrics.snapshot', intervalMs: 1000, intakeRejections: { 'POST /v1/integration/observations 409': 1 } });
      reporter.onModuleDestroy();
      vi.advanceTimersByTime(5000);
      expect(out).toHaveLength(2);
      reporter.start(0);
      expect(MetricsReporter.intervalFrom(undefined)).toBe(60_000);
      expect(MetricsReporter.intervalFrom('0')).toBe(0);
      expect(MetricsReporter.intervalFrom('abc')).toBe(60_000);
    } finally {
      vi.useRealTimers();
    }
  });
});
