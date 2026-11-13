import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

let app: NestFastifyApplication;
const previousMode = process.env.PILOT_STORE_MODE;
const previousDeployment = process.env.DEPLOYMENT_MODE;
const previousUnsigned = process.env.AUTH_DEV_UNSIGNED_TOKENS;
const previousDemo = process.env.DEMO_WORKSPACES;

describe('HTTP compatibility smoke suite', () => {
  beforeAll(async () => {
    process.env.DEPLOYMENT_MODE = 'test';
    process.env.PILOT_STORE_MODE = 'memory';
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    process.env.DEMO_WORKSPACES = 'false';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/readiness', 'v1/health', 'v1/health/readiness'] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      if (previousMode === undefined) delete process.env.PILOT_STORE_MODE;
      else process.env.PILOT_STORE_MODE = previousMode;
      if (previousDeployment === undefined) delete process.env.DEPLOYMENT_MODE;
      else process.env.DEPLOYMENT_MODE = previousDeployment;
      if (previousUnsigned === undefined) delete process.env.AUTH_DEV_UNSIGNED_TOKENS;
      else process.env.AUTH_DEV_UNSIGNED_TOKENS = previousUnsigned;
      if (previousDemo === undefined) delete process.env.DEMO_WORKSPACES;
      else process.env.DEMO_WORKSPACES = previousDemo;
    }
  });

  it('preserves the unauthenticated health route contract', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.json()).toMatchObject({ status: 'ok', version: expect.any(String) });
    expect(response.json().timestamp).toEqual(expect.any(String));
  });

  it('reports explicit memory readiness without claiming durability', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/health/readiness' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      checks: { store: { mode: 'memory', durable: false }, database: { status: 'not_applicable' } },
    });
  });

  it('resolves auth ports and refuses unauthenticated pilot intake', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'POST', url: '/v1/pilot/scenarios',
      payload: { displayName: 'Synthetic case', utterance: 'Please follow up', speaker: 'customer', connection: 'manual', externalRecordId: 'unauthenticated' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('wires pilot application and memory store with workspace-scoped reads', async () => {
    const token = (workspaceId: string) => `Bearer ${Buffer.from(JSON.stringify({ workspaceId, userId: 'operator', role: 'sales' })).toString('base64')}`;
    const server = app.getHttpAdapter().getInstance();
    const created = await server.inject({
      method: 'POST', url: '/v1/pilot/scenarios',
      headers: { authorization: token('e2e-workspace') },
      payload: { displayName: 'Synthetic case', utterance: 'Please follow up', speaker: 'customer', connection: 'manual', externalRecordId: 'wiring-case', isSynthetic: true },
    });
    expect(created.statusCode).toBe(201);
    const leadId = created.json().leadId;
    expect(leadId).toEqual(expect.any(String));
    const own = await server.inject({ method: 'GET', url: `/v1/pilot/leads/${leadId}`, headers: { authorization: token('e2e-workspace') } });
    expect(own.statusCode).toBe(200);
    expect(own.json().lead).toMatchObject({ id: leadId, workspaceId: 'e2e-workspace', owner: 'operator' });
    const foreign = await server.inject({ method: 'GET', url: `/v1/pilot/leads/${leadId}`, headers: { authorization: token('other-workspace') } });
    expect(foreign.statusCode).toBe(404);
  });

  it('serves the operator client without exposing application payloads', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({ method: 'GET', url: '/v1/operator' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.body).toContain('North Star Operator');
    expect(response.body).toContain('/v1/pilot/queue');
    expect(response.body).not.toContain('rawPayload');
  });

  it('serves the queue projection through authenticated HTTP with redaction and pagination', async () => {
    const token = (workspaceId: string, userId = 'operator') => `Bearer ${Buffer.from(JSON.stringify({ workspaceId, userId, role: 'sales' })).toString('base64')}`;
    const server = app.getHttpAdapter().getInstance();
    const intake = await server.inject({
      method: 'POST', url: '/v1/pilot/scenarios', headers: { authorization: token('queue-e2e') },
      payload: { displayName: 'Queue case', utterance: 'Follow up', speaker: 'customer', connection: 'manual', externalRecordId: 'queue-e2e', isSynthetic: true },
    });
    const leadId = intake.json().leadId;
    await server.inject({
      method: 'POST', url: `/v1/pilot/leads/${leadId}/handoff`, headers: { authorization: token('queue-e2e') },
      payload: { context: 'redacted context', proposedAction: 'Call back', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'operator' },
    });
    const page = await server.inject({ method: 'GET', url: '/v1/pilot/queue?limit=1', headers: { authorization: token('queue-e2e') } });
    expect(page.statusCode).toBe(200);
    expect(page.json().items[0]).toMatchObject({ leadId, action: 'Call back', status: 'proposed' });
    expect(JSON.stringify(page.json())).not.toContain('rawPayload');
    expect(JSON.stringify(page.json())).not.toContain('redacted context');
  });

  it('preserves the versioned route boundary', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/v1/health',
    });

    expect(response.statusCode).toBe(404);
  });
});
