import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SourceIntegrationController } from './source-integration.controller';
import { SourceIntegrationService } from '../application/source-integration/source-integration.service';
import { SourceFixtureIntake } from '../application/source-integration/fixture-intake';
import { AUTH_CONTEXT_RESOLVER, type AuthContext } from '../ports/auth';
import { SOURCE_SYNTHETIC_MODE } from '../ports/source-fixture-decoder';
import { SourceIntegrationError, type SourceIntegrationStore } from '../ports/source-observation';

describe('source HTTP authorization and errors', () => {
  let app: NestFastifyApplication;
  const id = '00000000-0000-4000-8000-000000000001';
  const admin: AuthContext = { workspaceId: 'local-a', userId: 'admin', role: 'admin', isDemo: false };
  const connection = { id, workspaceId: 'local-a', provider: 'pancake' as const, route: 'pancake-synthetic' as const, pageId: 'p', status: 'active' as const, health: 'SYNTHETIC_ONLY' as const };
  async function setup(ctx: AuthContext | null = admin, enabled = true) {
    const store = { listConnections: vi.fn().mockResolvedValue([connection]), createConnection: vi.fn().mockResolvedValue(connection),
      revokeConnection: vi.fn(), intake: vi.fn(), evidence: vi.fn() } satisfies SourceIntegrationStore;
    const authorize = vi.fn().mockRejectedValue(new SourceIntegrationError('LEAD_NOT_FOUND', 404));
    const service = new SourceIntegrationService(store, authorize, enabled);
    const decoder = { decode: vi.fn(() => { throw new Error('private token raw details'); }), example: () => ({ synthetic: true }) };
    const fixture = new SourceFixtureIntake(service, decoder);
    const module = await Test.createTestingModule({ controllers: [SourceIntegrationController], providers: [
      { provide: AUTH_CONTEXT_RESOLVER, useValue: { resolve: () => ctx } }, { provide: SourceIntegrationService, useValue: service },
      { provide: SourceFixtureIntake, useValue: fixture }, { provide: SOURCE_SYNTHETIC_MODE, useValue: enabled },
    ] }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
    app.setGlobalPrefix('v1'); await app.init(); await app.getHttpAdapter().getInstance().ready();
    return { store, decoder, authorize };
  }
  afterEach(async () => { await app?.close(); });
  it.each([{ ctx: null, enabled: true, status: 401 }, { ctx: admin, enabled: false, status: 404 },
    ...(['sales', 'viewer', 'manager'] as const).map(role => ({ ctx: { ...admin, role }, enabled: true, status: 403 }))])('denies before decoder/storage %j', async ({ ctx, enabled, status }) => {
      const { store, decoder } = await setup(ctx, enabled);
      const res = await app.inject({ method: 'POST', url: '/v1/source-integrations/connections/' + id + '/observations', payload: { fixture: {}, claimResponsibility: false } });
      expect(res.statusCode).toBe(status); expect(decoder.decode).not.toHaveBeenCalled(); expect(store.intake).not.toHaveBeenCalled();
    });
  it('returns scoped bounded list, sanitized schema errors and no-store', async () => {
    const { store } = await setup();
    const list = await app.inject({ method: 'GET', url: '/v1/source-integrations/connections' });
    expect(list.statusCode).toBe(200); expect(list.headers['cache-control']).toBe('no-store'); expect(list.json()).toMatchObject({ items: [{ health: 'SYNTHETIC_ONLY' }], completeness: 'UNKNOWN' });
    const bad = await app.inject({ method: 'POST', url: '/v1/source-integrations/connections/' + id + '/observations', payload: { fixture: {}, claimResponsibility: false } });
    expect(bad.statusCode).toBe(400); expect(bad.json()).toMatchObject({ code: 'SOURCE_SCHEMA_INVALID' }); expect(bad.body).not.toContain('private'); expect(store.intake).not.toHaveBeenCalled();
  });
  it('denies foreign connection and lead before exposing fixture or evidence', async () => {
    const { decoder, store } = await setup();
    const foreign = await app.inject({ method: 'GET', url: '/v1/source-integrations/connections/00000000-0000-4000-8000-000000000002/example' });
    expect(foreign.statusCode).toBe(404); expect(decoder.decode).not.toHaveBeenCalled();
    const lead = await app.inject({ method: 'GET', url: '/v1/source-integrations/leads/' + id + '/evidence' });
    expect(lead.statusCode).toBe(404); expect(store.evidence).not.toHaveBeenCalled();
  });
  it('refuses forged workspace and unexpected request fields', async () => {
    const { store } = await setup();
    const res = await app.inject({ method: 'POST', url: '/v1/source-integrations/connections', payload: { provider: 'pancake', route: 'pancake-synthetic', pageId: 'p', workspaceId: 'foreign' } });
    expect(res.statusCode).toBe(400); expect(store.createConnection).not.toHaveBeenCalled();
  });
});
