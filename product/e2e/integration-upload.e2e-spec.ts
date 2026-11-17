import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { request as httpRequest } from 'node:http';
import { AppModule } from '../src/app.module';
import { PostgresService } from '../src/infra/postgres/postgres.service';
import { Migrator, loadMigrations } from '../src/infra/postgres/migrator';

// Explicit database opt-in: this suite never falls back to an ambient database.
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('synthetic companion upload through real HTTP and PostgreSQL', () => {
  let app: NestFastifyApplication;
  let db: PostgresService;
  let origin: string;
  let api: any;
  const prior = { ...process.env };
  const issuer = 'synthetic-qa-issuer-'.repeat(3);
  const scope = { workspaceId: 'qa-synthetic', connectionId: 'qa-connection', accountId: 'qa-account', providerSurface: 'pancake-conversations', pageId: 'qa-page' };
  const request = async (route: string, body: unknown, token?: string, issuerHeader?: string) => {
    const response = await fetch(`${origin}${route}`, { method: 'POST', headers: {
      'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(issuerHeader ? { 'x-integration-issuer': issuerHeader } : {}),
    }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() as any };
  };
  const enroll = async () => {
    const r = await request('/v1/integration/enroll', {}, undefined, issuer);
    expect(r.status).toBe(201);
    return r.body;
  };
  const observation = (captureId: string) => ({
    captureId, scope: { workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: scope.providerSurface },
    sourceRevision: 'synthetic-v1', externalEventId: null, externalObjectId: null,
    eventType: 'synthetic-update', method: 'browser-websocket', evidenceType: 'client-observed',
    authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null,
    observedAt: '2026-11-16T00:00:00.000Z', payloadHash: 'a'.repeat(64),
  });
  const start = async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/readiness', 'v1/health', 'v1/health/readiness'] });
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  };
  beforeAll(async () => {
    Object.assign(process.env, { DATABASE_URL: process.env.TEST_DATABASE_URL, PILOT_STORE_MODE: 'postgres', DEPLOYMENT_MODE: 'test',
      AUTH_DEV_UNSIGNED_TOKENS: 'true', DEMO_WORKSPACES: 'false', AIL_RESEARCH_ENABLED: 'true', AIL_ISSUER_SECRET: issuer,
      AIL_SIGNING_SECRET: 'synthetic-qa-signing-'.repeat(3), AIL_WORKSPACE_ID: scope.workspaceId,
      AIL_CONNECTION_ID: scope.connectionId, AIL_ACCOUNT_ID: scope.accountId, AIL_PAGE_ID: scope.pageId });
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up();
    api = await import(pathToFileURL(resolve('src/adapters/browser-companion/upload.mjs')).href);
    await start();
  });
  afterAll(async () => {
    await app?.close();
    await db?.onModuleDestroy();
    for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key];
    Object.assign(process.env, prior);
  });
  it('retries the identical persisted request after committed ACK loss and server restart', async () => {
    const e = await enroll();
    let state = api.configureUpload({ outbox: [], session: null }, { origin: 'https://synthetic.invalid', enrollment: e });
    state.outbox.push(observation('lost-ack'));
    state = api.reserveUpload(state);
    const persisted = JSON.parse(JSON.stringify(state));
    const first = await request('/v1/integration/observations', state.upload.pending, e.token);
    expect(first.status).toBe(201);
    // Deliberately discard ACK; close the complete application and its pool.
    await app.close();
    await start();
    const restored = api.reserveUpload(persisted);
    expect(restored.upload.pending).toEqual(state.upload.pending);
    const retry = await request('/v1/integration/observations', restored.upload.pending, e.token);
    expect(retry.status).toBe(201);
    expect(retry.body).toMatchObject({ disposition: 'duplicate', receiptId: first.body.receiptId, continuity: 'UNKNOWN', checkpoint: 1 });
    for (const patch of [{ enrollmentId: 'foreign' }, { captureId: 'foreign' }, { sequence: 2 }, { continuity: 'COMPLETE' }, { receiptId: '' }]) {
      expect(api.applyUploadResponse(restored, retry.status, { ...retry.body, ...patch }).outbox).toEqual(restored.outbox);
    }
    expect(api.applyUploadResponse(restored, retry.status, retry.body).outbox).toEqual([]);
    const conflicting = { ...restored.upload.pending, observation: { ...restored.upload.pending.observation, payloadHash: 'b'.repeat(64) } };
    expect((await request('/v1/integration/observations', conflicting, e.token)).status).toBe(409);
    expect((await db.query('SELECT id FROM integration_receipt WHERE enrollment_id=$1', [e.enrollmentId])).rows).toHaveLength(1);
    expect((await db.query("SELECT operation FROM integration_audit WHERE enrollment_id=$1 ORDER BY operation", [e.enrollmentId])).rows.map(r => r.operation)).toEqual(['enroll', 'receipt']);
    expect(JSON.stringify(api.exportMetadata(restored))).not.toContain(e.token);
  });
  it('rejects untrusted scope, token tampering, raw payload, missing auth and oversized HTTP bodies', async () => {
    const e = await enroll();
    const body = { captureId: 'negative', sequence: 1, pageId: scope.pageId, observation: observation('negative') };
    expect((await request('/v1/integration/observations', body)).status).toBe(401);
    expect((await request('/v1/integration/observations', body, `${e.token}x`)).status).toBe(401);
    expect((await request('/v1/integration/observations', { ...body, observation: { ...body.observation, scope: { ...body.observation.scope, workspaceId: 'foreign' } } }, e.token)).status).toBe(403);
    expect((await request('/v1/integration/observations', { ...body, observation: { ...body.observation, rawPayload: 'private-text' } }, e.token)).status).toBe(400);
    expect((await request('/v1/integration/observations', { ...body, padding: 'x'.repeat(20000) }, e.token)).status).toBe(413);
    const chunkedStatus = await new Promise<number>((accept, reject) => {
      const req = httpRequest(`${origin}/v1/integration/observations`, { method: 'POST', headers: {
        'content-type': 'application/json', authorization: `Bearer ${e.token}`, 'transfer-encoding': 'chunked',
      } }, res => { res.resume(); res.on('end', () => accept(res.statusCode!)); });
      req.on('error', reject);
      req.write('{"padding":"');
      req.write('x'.repeat(10000));
      req.end('"}');
    });
    expect(chunkedStatus).toBe(413);
    expect((await request('/integration/enroll', {}, undefined, issuer)).status).toBe(404);
    expect((await db.query('SELECT id FROM integration_receipt WHERE enrollment_id=$1', [e.enrollmentId])).rows).toHaveLength(0);
  });
  it('serializes concurrent retries and revoke then preserves local evidence on rejection', async () => {
    const e = await enroll();
    let state = api.configureUpload({ outbox: [], session: null }, { origin: 'https://synthetic.invalid', enrollment: e });
    state.outbox.push(observation('concurrent'));
    state = api.reserveUpload(state);
    const responses = await Promise.all([request('/v1/integration/observations', state.upload.pending, e.token), request('/v1/integration/observations', state.upload.pending, e.token)]);
    expect(responses.map(r => r.status)).toEqual([201, 201]);
    expect(responses.map(r => r.body.disposition).sort()).toEqual(['duplicate', 'stored']);
    expect(responses[0].body.receiptId).toBe(responses[1].body.receiptId);
    expect((await request('/v1/integration/revoke', { enrollmentId: e.enrollmentId }, undefined, issuer)).status).toBe(201);
    const rejected = await request('/v1/integration/observations', state.upload.pending, e.token);
    expect(rejected.status).toBe(401);
    const retained = api.applyUploadResponse(state, rejected.status, rejected.body);
    expect(retained.outbox).toEqual(state.outbox);
    expect(retained.upload.token).toBeNull();
    expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.enrollmentId])).rows[0].checkpoint).toBe('1');
  });
  it('keeps the research endpoint disabled unless explicitly opted in', async () => {
    delete process.env.AIL_RESEARCH_ENABLED;
    try { expect((await request('/v1/integration/enroll', {}, undefined, issuer)).status).toBe(404); }
    finally { process.env.AIL_RESEARCH_ENABLED = 'true'; }
  });
  it('rolls back HTTP receipt and checkpoint when the final audit write fails', async () => {
    const e = await enroll();
    // Disposable test database only: force the last SQL statement to fail for this enrollment.
    await db.query(`CREATE OR REPLACE FUNCTION qa_receipt_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.enrollment_id = '${e.enrollmentId}'::uuid AND NEW.operation = 'receipt'
      THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$`);
    await db.query('CREATE TRIGGER qa_receipt_audit_failure BEFORE INSERT ON integration_audit FOR EACH ROW EXECUTE FUNCTION qa_receipt_audit_failure()');
    const body = { captureId: 'atomic-failure', sequence: 1, pageId: scope.pageId, observation: observation('atomic-failure') };
    try {
      expect((await request('/v1/integration/observations', body, e.token)).status).toBe(503);
      expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.enrollmentId])).rows[0].checkpoint).toBe('0');
      expect((await db.query('SELECT id FROM integration_receipt WHERE enrollment_id=$1', [e.enrollmentId])).rows).toHaveLength(0);
    } finally {
      await db.query('DROP TRIGGER qa_receipt_audit_failure ON integration_audit');
      await db.query('DROP FUNCTION qa_receipt_audit_failure()');
    }
    expect((await request('/v1/integration/observations', body, e.token)).status).toBe(201);
  });
  it('refuses sequence gaps and accepts a bound late duplicate ACK at a later checkpoint', async () => {
    const e = await enroll();
    let state = api.configureUpload({ outbox: [], session: null }, { origin: 'https://synthetic.invalid', enrollment: e });
    state.outbox.push(observation('sequence-one'));
    state = api.reserveUpload(state);
    const second = { captureId: 'sequence-two', sequence: 2, pageId: scope.pageId, observation: observation('sequence-two') };
    const gap = await request('/v1/integration/observations', second, e.token);
    expect(gap.status).toBe(409);
    expect(gap.body.code).toBe('SEQUENCE_GAP');
    expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.enrollmentId])).rows[0].checkpoint).toBe('0');
    expect((await request('/v1/integration/observations', state.upload.pending, e.token)).status).toBe(201);
    expect((await request('/v1/integration/observations', second, e.token)).status).toBe(201);
    const duplicate = await request('/v1/integration/observations', state.upload.pending, e.token);
    expect(duplicate.body).toMatchObject({ disposition: 'duplicate', sequence: 1, checkpoint: 2 });
    expect(api.applyUploadResponse(state, duplicate.status, duplicate.body).outbox).toEqual([]);
  });
});
