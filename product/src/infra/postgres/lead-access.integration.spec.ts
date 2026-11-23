import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from './postgres.service';
import { Migrator, loadMigrations } from './migrator';
import { PgPilotStore } from './pg-pilot.store';
import { InMemoryPilotStore } from '../pilot/in-memory-pilot.store';
import { AuditStore } from '../audit/audit-store';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
import { PilotLoopController } from '../../api/pilot-loop.controller';
import { RbacService } from '../rbac/rbac.service';
import type { AuthContext } from '../../ports/auth';
import type { PilotLoopState, WorkStatus, WorkItem } from '../../ports/pilot-loop.types';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;
integration('I-09 real PG lead access parity and replay refusal', () => {
  const workspaceId = `security-${randomUUID()}`;
  const foreignId = `security-foreign-${randomUUID()}`;
  let db: PostgresService;
  let pg: PgPilotStore;
  beforeAll(async () => {
    db = new PostgresService({ connectionString: databaseUrl, max: 2 });
    await new Migrator(db, loadMigrations()).up();
    pg = new PgPilotStore(db);
  });
  afterAll(async () => {
    if (!db) return;
    await db.query('DELETE FROM workspace WHERE id = ANY($1::text[])', [[workspaceId, foreignId]]);
    await db.onModuleDestroy();
  });

  const scenario = (externalRecordId: string) => ({ workspaceId, ownerUserId: 'owner',
    displayName: 'synthetic access fixture', utterance: 'please call', speaker: 'customer' as const,
    connection: 'manual', externalRecordId, isSynthetic: true });

  it('matches memory for active versus historical recipients, all statuses, paging, reassignment and workspace isolation', async () => {
    const memory = new InMemoryPilotStore(new AuditStore());
    const loop = new PilotLoopService(pg, new ManualAdapter());
    const statuses: WorkStatus[] = ['proposed', 'accepted', 'open', 'awaiting-external', 'completed', 'cancelled', 'rescheduled'];
    const states: PilotLoopState[] = [];
    for (const [index, status] of statuses.entries()) {
      const initial = await loop.ingestScenario(scenario(`queue-${index}`));
      await memory.save({ ...initial, version: undefined }, []);
      const work = (actor: string, workStatus: WorkStatus): WorkItem => ({ id: randomUUID(), leadId: initial.lead.id,
        workspaceId, action: `${index}-${actor}`, responsibleParty: 'internal', origin: 'explicit-request', status: workStatus,
        completionEvidence: 'absent', occurredAt: 'unknown', recordedAt: '2026-01-01T00:00:00.000Z', actor });
      const fixture = { ...initial, workItems: [work('recipient', status), work('other', 'completed')] };
      states.push(await pg.save(fixture, []));
      await memory.save(fixture, []);
    }
    for (const actorId of ['owner', 'recipient', 'other', 'unassigned']) {
      for (const actorRole of ['sales', 'viewer', 'manager', 'admin'] as const) {
        for (const status of [undefined, ...statuses]) {
          const query = { workspaceId, actorId, actorRole, status, classification: 'all' as const, limit: 100 };
          const actual = await pg.queue(query);
          const expected = await memory.queue(query);
          expect(actual.items.map(w => w.id)).toEqual(expected.items.map(w => w.id));
          if (actorRole === 'sales' && actorId === 'recipient' && !status) expect(actual.items).toHaveLength(8);
          if (actorRole === 'sales' && actorId === 'other') expect(actual.items).toHaveLength(0);
        }
      }
    }
    const query = { workspaceId, actorId: 'recipient', actorRole: 'sales' as const, classification: 'all' as const, limit: 2 };
    const first = await pg.queue(query);
    expect(first.nextCursor).toBeDefined();
    expect((await pg.queue({ ...query, cursor: first.nextCursor })).items.map(w => w.id))
      .toEqual((await memory.queue({ ...query, cursor: first.nextCursor })).items.map(w => w.id));
    // Closed historical actor cannot retain access; ownership transfer revokes former owner.
    for (const state of states) {
      const revoked = { ...state, ownerUserId: 'new-owner', workItems: state.workItems.map(w => ({ ...w, status: 'cancelled' as const })) };
      await pg.save(revoked, []);
      await memory.save(revoked, []);
    }
    for (const actorId of ['owner', 'recipient']) {
      expect((await pg.queue({ workspaceId, actorId, actorRole: 'sales' })).items).toEqual([]);
      expect((await memory.queue({ workspaceId, actorId, actorRole: 'sales' })).items).toEqual([]);
    }
    for (const actorRole of ['sales', 'admin'] as const) {
      expect((await pg.queue({ workspaceId: foreignId, actorId: 'new-owner', actorRole })).items).toEqual([]);
      expect((await memory.queue({ workspaceId: foreignId, actorId: 'new-owner', actorRole })).items).toEqual([]);
    }
  });

  it('refuses unauthorized intake replay without appending any durable row or audit', async () => {
    const loop = new PilotLoopService(pg, new ManualAdapter());
    const input = scenario('replay');
    const initial = await loop.ingestScenario(input);
    const ctx: AuthContext = { workspaceId, userId: 'unassigned', role: 'sales', isDemo: false };
    const controller = new PilotLoopController({ resolve: () => ctx }, new RbacService(), loop);
    const counts = async () => Promise.all(['lead', 'commercial_envelope', 'pilot_ingest_command', 'audit_record'].map(async table => {
      // Table names are fixed test constants; production queries remain parameterized.
      const where = table === 'pilot_ingest_command' ? 'lead_id = $1' : 'workspace_id = $1';
      const result = await db.query(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`, [table === 'pilot_ingest_command' ? initial.lead.id : workspaceId]);
      return result.rows[0].count;
    }));
    const before = await counts();
    for (const utterance of [input.utterance, 'conflicting secret payload']) {
      await expect(controller.intake({}, { ...input, utterance })).rejects.toMatchObject({ status: 403 });
    }
    // Force the initial lookup to miss: the durable idempotency winner must still be authorized.
    const lookup = vi.spyOn(pg, 'loadIngest').mockResolvedValueOnce(undefined);
    try {
      const racing = new PilotLoopController({ resolve: () => ctx }, new RbacService(), new PilotLoopService(pg, new ManualAdapter()));
      await expect(racing.intake({}, input)).rejects.toMatchObject({ status: 403 });
    } finally {
      lookup.mockRestore();
    }
    expect(await counts()).toEqual(before);
    expect((await pg.load(initial.lead.id))?.ownerUserId).toBe('owner');
    expect(await pg.history(initial.lead.id)).toHaveLength(1);
  });
});
