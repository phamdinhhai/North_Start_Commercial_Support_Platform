import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { request as httpRequest } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PostgresService } from '../src/infra/postgres/postgres.service';
import { Migrator, loadMigrations } from '../src/infra/postgres/migrator';
import { AuthService } from '../src/infra/auth/auth.service';
import { AUTH_CONTEXT_RESOLVER, MEMBERSHIP_STORE, type AuthContext, type AuthRequestLike, type MembershipStore } from '../src/ports/auth';
import { OIDC_AUTHENTICATOR } from '../src/infra/auth/oidc-auth.module';
import { OidcAuthenticator, oidcUserId } from '../src/infra/auth/oidc-authenticator';
import { OidcTokenVerifier } from '../src/infra/auth/oidc-token-verifier';
import { JwksKeyStore } from '../src/infra/auth/jwks-key-store';
import { createTestKey, mintToken, testConfig, TEST_AUDIENCE, TEST_ISSUER, type TestSigningKey } from '../src/infra/auth/oidc-test-kit';

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
  // Stand-in for a signed-credential resolver (OIDC is owned elsewhere): opaque random bearer
  // credentials map to privileged principals; anything else uses the real AuthService, whose
  // unsigned dev tokens can only yield sales/viewer.
  const principals = new Map<string, AuthContext>();
  const principal = (workspaceId: string, role: AuthContext['role']) => {
    const credential = randomBytes(24).toString('hex');
    principals.set(credential, { workspaceId, userId: `${role}@${workspaceId}`, role, isDemo: false });
    return credential;
  };
  const realAuth = new AuthService();
  const resolver = { resolve: (req: AuthRequestLike) => principals.get(String(req.headers.authorization ?? '').slice(7)) ?? realAuth.resolve(req) };
  const devToken = (workspaceId: string, role: string) => Buffer.from(JSON.stringify({ workspaceId, userId: `${role}-dev`, role })).toString('base64');
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
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AUTH_CONTEXT_RESOLVER).useValue(resolver).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/readiness', 'v1/health', 'v1/health/readiness'] });
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  };
  beforeAll(async () => {
    Object.assign(process.env, { DATABASE_URL: process.env.TEST_DATABASE_URL, PILOT_STORE_MODE: 'postgres', DEPLOYMENT_MODE: 'test',
      AUTH_DEV_UNSIGNED_TOKENS: 'true', DEMO_WORKSPACES: 'false', AIL_RESEARCH_ENABLED: 'true', AIL_ISSUER_SECRET_ENABLED: 'true', AIL_ISSUER_SECRET: issuer,
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

  // --- R2: principal-authenticated issuance and signing-key rotation -----------------------
  const other = { workspaceId: 'qa-other', connectionId: 'qa-other-connection', accountId: 'qa-other-account', pageId: 'qa-other-page' };
  const allowlist = [{ workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, pageId: scope.pageId }, other];
  const [k1, k2] = [randomBytes(32).toString('base64url'), randomBytes(32).toString('base64url')];
  const keyring = (...keys: unknown[]) => JSON.stringify(keys);
  const withEnv = async (patch: Record<string, string | undefined>, fn: () => Promise<void>) => {
    const saved = Object.fromEntries(Object.keys(patch).map((k) => [k, process.env[k]]));
    const apply = (values: Record<string, string | undefined>) => { for (const [k, v] of Object.entries(values)) if (v === undefined) delete process.env[k]; else process.env[k] = v; };
    apply(patch);
    try { await fn(); } finally { apply(saved); }
  };
  const r2 = { AIL_WORKSPACE_ID: undefined, AIL_CONNECTION_ID: undefined, AIL_ACCOUNT_ID: undefined, AIL_PAGE_ID: undefined, AIL_SIGNING_SECRET: undefined,
    AIL_SCOPE_ALLOWLIST: JSON.stringify(allowlist), AIL_SIGNING_KEYS: keyring({ kid: 'k1', secret: k1, state: 'active' }) };
  const kidOf = (token: string) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).kid;
  const upload = (captureId: string, sequence = 1) => ({ captureId, sequence, pageId: scope.pageId, observation: observation(captureId) });

  it('issues enrollment only to manager/admin of the resolved workspace within the server allowlist and audits the actor', async () => {
    await withEnv(r2, async () => {
      const manager = principal(scope.workspaceId, 'manager');
      expect((await request('/v1/integration/enrollments', {})).status).toBe(401);
      expect((await request('/v1/integration/enrollments', {}, devToken(scope.workspaceId, 'sales'))).status).toBe(403);
      expect((await request('/v1/integration/enrollments', {}, devToken(scope.workspaceId, 'viewer'))).status).toBe(403);
      expect((await request('/v1/integration/enrollments', { pageId: scope.pageId }, principal(other.workspaceId, 'manager'))).status).toBe(403);
      expect((await request('/v1/integration/enrollments', { pageId: 'qa-unlisted-page' }, manager)).status).toBe(403);
      const smuggled = await request('/v1/integration/enrollments', { workspaceId: other.workspaceId }, manager);
      expect(smuggled).toMatchObject({ status: 400, body: { code: 'WORKSPACE_FROM_CONTEXT' } });
      expect((await request('/v1/integration/enrollments', { padding: 'x'.repeat(20000) }, manager)).status).toBe(413);
      const issued = await request('/v1/integration/enrollments', { pageId: scope.pageId }, manager);
      expect(issued.status).toBe(201);
      expect(issued.body.scope).toEqual(scope);
      expect(kidOf(issued.body.token)).toBe('k1');
      const e = issued.body;
      expect((await request('/v1/integration/observations', upload('principal-1'), e.token)).status).toBe(201);
      const audit = await db.query("SELECT actor, workspace_id, event_type, new_value FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$1 ORDER BY timestamp", [e.enrollmentId]);
      expect(audit.rows).toEqual([{ actor: `manager@${scope.workspaceId}`, workspace_id: scope.workspaceId, event_type: 'integration.enrollment.issued',
        new_value: { issuance: 'principal', role: 'manager', scope, kid: 'k1', capability: 'observation:append', expiresAt: e.expiresAt } }]);
      // Revocation by an admin of another workspace looks like a missing enrollment.
      expect((await request('/v1/integration/enrollments/revoke', { enrollmentId: e.enrollmentId }, principal(other.workspaceId, 'admin'))).status).toBe(404);
      expect((await request('/v1/integration/enrollments/revoke', { enrollmentId: e.enrollmentId }, devToken(scope.workspaceId, 'sales'))).status).toBe(403);
      expect((await request('/v1/integration/enrollments/revoke', { enrollmentId: e.enrollmentId }, principal(scope.workspaceId, 'admin'))).status).toBe(201);
      expect((await request('/v1/integration/observations', upload('principal-2', 2), e.token)).status).toBe(401);
      const rows = await db.query('SELECT a.*, i.operation FROM audit_record a JOIN integration_audit i ON i.enrollment_id::text = a.entity_id WHERE a.entity_id=$1', [e.enrollmentId]);
      const dump = JSON.stringify(rows.rows);
      expect(rows.rows.length).toBeGreaterThan(0);
      for (const part of e.token.split('.')) expect(dump).not.toContain(part);
      expect(dump).not.toContain(k1);
      const otherIssued = await request('/v1/integration/enrollments', {}, principal(other.workspaceId, 'admin'));
      expect(otherIssued.body.scope).toEqual({ ...other, providerSurface: 'pancake-conversations' });
    });
  });

  it('rotates signing keys without invalidating unexpired tokens and rejects retired, unknown and tampered kids', async () => {
    await withEnv(r2, async () => {
      const manager = principal(scope.workspaceId, 'manager');
      const old = (await request('/v1/integration/enrollments', {}, manager)).body;
      expect(kidOf(old.token)).toBe('k1');
      process.env.AIL_SIGNING_KEYS = keyring({ kid: 'k2', secret: k2, state: 'active' }, { kid: 'k1', secret: k1, state: 'verify' });
      expect((await request('/v1/integration/observations', upload('rotation-1'), old.token)).status).toBe(201);
      const fresh = (await request('/v1/integration/enrollments', {}, manager)).body;
      expect(kidOf(fresh.token)).toBe('k2');
      expect((await request('/v1/integration/observations', upload('rotation-fresh'), fresh.token)).status).toBe(201);
      const [h, p, sig] = old.token.split('.');
      const header = (kid: string) => Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'AIL-ENROLLMENT', kid })).toString('base64url');
      expect(h).toBe(header('k1'));
      expect((await request('/v1/integration/observations', upload('rotation-2', 2), `${header('k2')}.${p}.${sig}`)).status).toBe(401);
      expect((await request('/v1/integration/observations', upload('rotation-2', 2), `${header('unknown')}.${p}.${sig}`)).status).toBe(401);
      process.env.AIL_SIGNING_KEYS = keyring({ kid: 'k2', secret: k2, state: 'active' }, { kid: 'k1', state: 'retired' });
      expect((await request('/v1/integration/observations', upload('rotation-2', 2), old.token)).status).toBe(401);
      expect((await request('/v1/integration/observations', upload('rotation-fresh-2', 2), fresh.token)).status).toBe(201);
      process.env.AIL_SIGNING_KEYS = keyring({ kid: 'k2', secret: k2, state: 'active' });
      expect((await request('/v1/integration/observations', upload('rotation-2', 2), old.token)).status).toBe(401);
      expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [old.enrollmentId])).rows[0].checkpoint).toBe('1');
      const kids = await db.query("SELECT new_value->>'kid' AS kid FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id = ANY($1::text[]) ORDER BY timestamp", [[old.enrollmentId, fresh.enrollmentId]]);
      expect(kids.rows.map((r) => r.kid)).toEqual(['k1', 'k2']);
    });
  });

  it('disables the deprecated issuer-secret path by configuration while principal issuance continues', async () => {
    await withEnv({ ...r2, AIL_ISSUER_SECRET_ENABLED: 'false' }, async () => {
      expect((await request('/v1/integration/enroll', {}, undefined, issuer)).status).toBe(404);
      expect((await request('/v1/integration/revoke', { enrollmentId: '00000000-0000-4000-8000-000000000000' }, undefined, issuer)).status).toBe(404);
      expect((await request('/v1/integration/enrollments', {}, principal(scope.workspaceId, 'admin'))).status).toBe(201);
    });
    await withEnv({ ...r2, AIL_ISSUER_SECRET_ENABLED: 'true', AIL_ISSUER_SECRET: undefined }, async () => {
      expect((await request('/v1/integration/enroll', {}, undefined, issuer)).status).toBe(503);
    });
    // A-m6: explicit opt-in — a configured secret alone no longer enables the deprecated path.
    await withEnv({ AIL_ISSUER_SECRET_ENABLED: undefined }, async () => {
      expect((await request('/v1/integration/enroll', {}, undefined, issuer)).status).toBe(404);
      expect((await request('/v1/integration/revoke', { enrollmentId: '00000000-0000-4000-8000-000000000000' }, undefined, issuer)).status).toBe(404);
    });
  });

  it('A-m6: issuer-secret revoke is bound to the allowlisted workspace and cannot revoke another workspace', async () => {
    let foreign = '';
    await withEnv(r2, async () => {
      foreign = (await request('/v1/integration/enrollments', {}, principal(other.workspaceId, 'manager'))).body.enrollmentId;
      // Allowlist spanning two workspaces: the shared secret cannot be bound to one → refused.
      expect((await request('/v1/integration/revoke', { enrollmentId: foreign }, undefined, issuer))).toMatchObject({ status: 400, body: { code: 'SCOPE_AMBIGUOUS' } });
    });
    // Legacy single-scope allowlist (qa-synthetic): the qa-other enrollment looks missing.
    expect((await request('/v1/integration/revoke', { enrollmentId: foreign }, undefined, issuer)).status).toBe(404);
    const row = await db.query('SELECT revoked_at FROM integration_enrollment WHERE id=$1', [foreign]);
    expect(row.rows[0].revoked_at).toBeNull();
    const own = await enroll();
    expect((await request('/v1/integration/revoke', { enrollmentId: own.enrollmentId }, undefined, issuer)).status).toBe(201);
    const audit = await db.query("SELECT actor, workspace_id FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$1 AND event_type='integration.enrollment.revoked'", [own.enrollmentId]);
    expect(audit.rows).toEqual([{ actor: 'issuer-secret', workspace_id: scope.workspaceId }]);
  });
});

// A-M5: the real OIDC path (no stand-in resolver) — Fastify hook → PgMembershipStore → AuthService
// → IntegrationController → PgIntegrationStore. Only the JWKS source is in-memory (runtime keys).
suite('AUTH_MODE=oidc principal enrollment through real HTTP and PostgreSQL membership', () => {
  let app: NestFastifyApplication;
  let db: PostgresService;
  let key: TestSigningKey;
  let memberships: MembershipStore;
  const prior = { ...process.env };
  const run = randomUUID().slice(0, 8);
  const workspaceId = `qa-oidc-${run}`;
  const scope = { workspaceId, connectionId: 'qa-oidc-connection', accountId: 'qa-oidc-account', pageId: 'qa-oidc-page' };
  const [manager, sales] = [`mgr-${run}`, `sales-${run}`];
  const inject = async (url: string, body: unknown, headers: Record<string, string>) => {
    const res = await app.getHttpAdapter().getInstance().inject({ method: 'POST', url, payload: body as object, headers: { 'content-type': 'application/json', ...headers } });
    return { status: res.statusCode, body: res.json() as any };
  };
  const bearer = async (sub: string) => ({ authorization: `Bearer ${await mintToken(key, { sub })}` });
  const upload = (captureId: string, sequence = 1) => ({ captureId, sequence, pageId: scope.pageId, observation: {
    captureId, scope: { workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: 'pancake-conversations' },
    sourceRevision: 'synthetic-v1', externalEventId: null, externalObjectId: null, eventType: 'synthetic-update', method: 'browser-websocket',
    evidenceType: 'client-observed', authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null, observedAt: '2026-11-18T00:00:00.000Z', payloadHash: 'c'.repeat(64) } });

  beforeAll(async () => {
    for (const k of ['AIL_WORKSPACE_ID', 'AIL_CONNECTION_ID', 'AIL_ACCOUNT_ID', 'AIL_PAGE_ID', 'AIL_SIGNING_SECRET', 'AIL_ISSUER_SECRET', 'AIL_ISSUER_SECRET_ENABLED',
      'AUTH_DEV_UNSIGNED_TOKENS', 'BOOTSTRAP_TOKEN', 'DEMO_WORKSPACES', 'NODE_ENV']) delete process.env[k];
    Object.assign(process.env, { DATABASE_URL: process.env.TEST_DATABASE_URL, PILOT_STORE_MODE: 'postgres', DEPLOYMENT_MODE: 'test',
      AUTH_MODE: 'oidc', OIDC_ISSUER: TEST_ISSUER, OIDC_AUDIENCE: TEST_AUDIENCE, OIDC_JWKS_URI: 'https://idp.test.invalid/jwks',
      AIL_RESEARCH_ENABLED: 'true', AIL_SCOPE_ALLOWLIST: JSON.stringify([scope]),
      AIL_SIGNING_KEYS: JSON.stringify([{ kid: 'oidc-k1', secret: randomBytes(32).toString('base64url'), state: 'active' }]) });
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2)', [workspaceId, 'qa oidc']);
    key = await createTestKey(`kid-${run}`);
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600_000, refetchCooldownMs: 30_000 });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OIDC_AUTHENTICATOR).useFactory({ inject: [MEMBERSHIP_STORE], factory: (store: MembershipStore) => new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), store) })
      .compile();
    memberships = module.get<MembershipStore>(MEMBERSHIP_STORE);
    await memberships.grant({ workspaceId, issuer: TEST_ISSUER, subject: manager, baseRole: 'manager' });
    await memberships.grant({ workspaceId, issuer: TEST_ISSUER, subject: sales, baseRole: 'sales' });
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('v1', { exclude: ['health', 'health/readiness', 'v1/health', 'v1/health/readiness'] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
    await db?.onModuleDestroy();
    for (const k of Object.keys(process.env)) if (!(k in prior)) delete process.env[k];
    Object.assign(process.env, prior);
  });

  it('manager membership issues and revokes; sales gets 403; membership revocation denies the next request', async () => {
    expect((await inject('/v1/integration/enrollments', {}, await bearer(sales))).status).toBe(403);
    expect((await inject('/v1/integration/enrollments', {}, await bearer(`nobody-${run}`))).status).toBe(401);
    const issued = await inject('/v1/integration/enrollments', {}, await bearer(manager));
    expect(issued.status).toBe(201);
    expect(issued.body.scope).toEqual({ ...scope, providerSurface: 'pancake-conversations' });
    const e = issued.body;
    expect((await inject('/v1/integration/observations', upload('oidc-1'), { authorization: `Bearer ${e.token}` })).status).toBe(201);
    const actor = oidcUserId(TEST_ISSUER, manager);
    const issuedAudit = await db.query("SELECT actor, workspace_id FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$1 AND event_type='integration.enrollment.issued'", [e.enrollmentId]);
    expect(issuedAudit.rows).toEqual([{ actor, workspace_id: workspaceId }]);
    expect((await inject('/v1/integration/enrollments/revoke', { enrollmentId: e.enrollmentId }, await bearer(sales))).status).toBe(403);
    expect((await inject('/v1/integration/enrollments/revoke', { enrollmentId: e.enrollmentId }, { ...(await bearer(manager)), 'x-workspace-id': workspaceId })).status).toBe(201);
    expect((await inject('/v1/integration/observations', upload('oidc-2', 2), { authorization: `Bearer ${e.token}` })).status).toBe(401);
    const revokedAudit = await db.query("SELECT actor FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$1 AND event_type='integration.enrollment.revoked'", [e.enrollmentId]);
    expect(revokedAudit.rows).toEqual([{ actor }]);
    // Deprecated issuer-secret path is off by default (A-m6).
    expect((await inject('/v1/integration/enroll', {}, { 'x-integration-issuer': 'x'.repeat(40) })).status).toBe(404);
    // Revoking the membership denies the very next enrollment request; history is audited (A-m4).
    expect(await memberships.revoke({ workspaceId, issuer: TEST_ISSUER, subject: manager })).toBe(true);
    expect((await inject('/v1/integration/enrollments', {}, await bearer(manager))).status).toBe(401);
    const history = await db.query("SELECT a.operation FROM membership_audit a JOIN memberships m ON m.id=a.membership_id WHERE m.issuer=$1 AND m.subject=$2 ORDER BY a.id", [TEST_ISSUER, manager]);
    expect(history.rows.map((r) => r.operation)).toEqual(['grant', 'revoke']);
  });
});
