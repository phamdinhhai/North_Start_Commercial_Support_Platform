import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PostgresService } from '../src/infra/postgres/postgres.service';
import { Migrator, loadMigrations } from '../src/infra/postgres/migrator';
import { MEMBERSHIP_STORE, type MembershipStore } from '../src/ports/auth';
import { OIDC_AUTHENTICATOR } from '../src/infra/auth/oidc-auth.module';
import { OidcAuthenticator } from '../src/infra/auth/oidc-authenticator';
import { OidcTokenVerifier } from '../src/infra/auth/oidc-token-verifier';
import { JwksKeyStore } from '../src/infra/auth/jwks-key-store';
import { createTestKey, mintToken, testConfig, TEST_AUDIENCE, TEST_ISSUER, type TestSigningKey } from '../src/infra/auth/oidc-test-kit';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('ADR-006 viewer read-only enforcement through signed OIDC HTTP and PostgreSQL', () => {
  let app: NestFastifyApplication;
  let db: PostgresService;
  let memberships: MembershipStore;
  let key: TestSigningKey;
  let origin: string;
  const prior = { ...process.env };
  const workspaceId = `qa-viewer-${randomUUID()}`;
  const subject = `actor-${randomUUID()}`;
  const intake = () => ({ displayName: 'Synthetic viewer regression', utterance: 'Please call back', speaker: 'customer', connection: 'manual', externalRecordId: randomUUID(), isSynthetic: true });
  const call = async (method: string, path: string, body?: object, actor = subject) => {
    const response = await fetch(`${origin}/v1/pilot/${path}`, { method, headers: { authorization: `Bearer ${await mintToken(key, { sub: actor })}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  beforeAll(async () => {
    for (const name of ['AUTH_DEV_UNSIGNED_TOKENS', 'DEMO_WORKSPACES', 'BOOTSTRAP_TOKEN', 'NODE_ENV']) delete process.env[name];
    Object.assign(process.env, { DATABASE_URL: process.env.TEST_DATABASE_URL, PILOT_STORE_MODE: 'postgres', DEPLOYMENT_MODE: 'test', AUTH_MODE: 'oidc', OIDC_ISSUER: TEST_ISSUER, OIDC_AUDIENCE: TEST_AUDIENCE, OIDC_JWKS_URI: 'https://idp.test.invalid/jwks' });
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace(id,name) VALUES ($1,$2)', [workspaceId, 'Synthetic QA']);
    key = await createTestKey(randomUUID());
    const keys = new JwksKeyStore(async () => ({ keys: [key.publicJwk] }), { cacheMaxAgeMs: 600000, refetchCooldownMs: 30000 });
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(OIDC_AUTHENTICATOR).useFactory({ inject: [MEMBERSHIP_STORE], factory: (store: MembershipStore) => new OidcAuthenticator(new OidcTokenVerifier(testConfig(), keys), store) }).compile();
    memberships = module.get<MembershipStore>(MEMBERSHIP_STORE);
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('v1');
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
  });
  afterAll(async () => {
    await app?.close();
    await db?.onModuleDestroy();
    for (const name of Object.keys(process.env)) if (!(name in prior)) delete process.env[name];
    Object.assign(process.env, prior);
  });
  it('denies viewer intake before recording a commercial audit entry', async () => {
    await memberships.grant({ workspaceId, issuer: TEST_ISSUER, subject, baseRole: 'viewer' });
    const before = await db.query('SELECT count(*) FROM audit_record WHERE workspace_id = $1', [workspaceId]);
    expect((await call('POST', 'scenarios', intake())).status).toBe(403);
    expect((await db.query('SELECT count(*) FROM audit_record WHERE workspace_id = $1', [workspaceId])).rows).toEqual(before.rows);
  });
  it('denies all mutation routes after sales owner demotion on the very next request', async () => {
    await memberships.revoke({ workspaceId, issuer: TEST_ISSUER, subject });
    const sales = await memberships.grant({ workspaceId, issuer: TEST_ISSUER, subject, baseRole: 'sales' });
    const created = await call('POST', 'scenarios', intake());
    expect(created.status).toBe(201);
    const leadId = created.body.leadId;
    const handoff = await call('POST', `leads/${leadId}/handoff`, { context: 'Synthetic context', proposedAction: 'Call', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: sales.userId });
    expect(handoff.status).toBe(201);
    const workId = handoff.body.workItemId;
    await memberships.changeRole({ workspaceId, membershipId: sales.id, baseRole: 'viewer' });
    expect((await call('GET', `leads/${leadId}`)).status).toBe(200);
    const auditBefore = await call('GET', `leads/${leadId}/audit`);
    const bodies: Record<string, object> = {
      handoff: { context: 'Synthetic', proposedAction: 'Call again', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: sales.userId },
      accept: { workId, reason: 'Synthetic' }, advance: { to: 'Contacting', reason: 'Synthetic' },
      complete: { workId, evidence: 'declared', declaration: 'Synthetic declaration', confirmed: true, occurredAt: '2026-11-19T00:00:00Z', reason: 'Synthetic' },
      reschedule: { workId, newDueAt: '2026-11-20T00:00:00Z', reason: 'Synthetic' }, unobserved: { workId }, outcome: { value: 'Unknown', reason: 'Synthetic' },
    };
    for (const [route, body] of Object.entries(bodies)) expect.soft((await call('POST', `leads/${leadId}/${route}`, body)).status, route).toBe(403);
    expect((await call('GET', `leads/${leadId}/audit`)).body).toEqual(auditBefore.body);
  });
  it('keeps an active handoff recipient viewer read-only without changing commercial audit', async () => {
    const owner = `owner-${randomUUID()}`;
    const viewer = `recipient-${randomUUID()}`;
    await memberships.grant({ workspaceId, issuer: TEST_ISSUER, subject: owner, baseRole: 'sales' });
    const viewerMembership = await memberships.grant({ workspaceId, issuer: TEST_ISSUER, subject: viewer, baseRole: 'viewer' });
    const viewerId = viewerMembership.userId;
    const created = await call('POST', 'scenarios', intake(), owner);
    expect(created.status).toBe(201);
    const leadId = created.body.leadId;
    const handoff = await call('POST', `leads/${leadId}/handoff`, { context: 'Synthetic recipient', proposedAction: 'Call', responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: viewerId }, owner);
    expect(handoff.status).toBe(201);
    expect((await call('GET', `leads/${leadId}`, undefined, viewer)).status).toBe(200);
    const before = await call('GET', `leads/${leadId}/audit`, undefined, viewer);
    expect((await call('POST', `leads/${leadId}/accept`, { workId: handoff.body.workItemId, reason: 'Synthetic' }, viewer)).status).toBe(403);
    expect((await call('POST', `leads/${leadId}/outcome`, { value: 'Unknown', reason: 'Synthetic' }, viewer)).status).toBe(403);
    expect((await call('GET', `leads/${leadId}/audit`, undefined, viewer)).body).toEqual(before.body);
  });
});
