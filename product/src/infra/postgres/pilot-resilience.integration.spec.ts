import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from './postgres.service';
import { Migrator, loadMigrations } from './migrator';
import { PgPilotStore } from './pg-pilot.store';
import { PilotClosureService } from '../../application/pilot/pilot-closure.service';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { RbacService } from '../rbac/rbac.service';
import { configuredContentDigester } from '../crypto/configured-content-digester';
import { createLead } from '../../domain/lead/lead';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('R4.7 bounded PostgreSQL failure recovery (fabricated data)', () => {
  let db: PostgresService;
  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL, max: 2,
      connectionTimeoutMillis: 300, statement_timeout: 1000, idle_in_transaction_session_timeout: 2000 });
    await new Migrator(db, loadMigrations()).up();
  });
  afterAll(async () => { await db?.onModuleDestroy(); });

  it('bounds saturated pool acquisition and recovers without queued mutation', async () => {
    const held = await Promise.all([db.getPool().connect(), db.getPool().connect()]);
    try {
      const start = performance.now();
      await expect(db.withTransaction(tx => tx.query('SELECT 1'))).rejects.toThrow(/timeout/i);
      expect(performance.now() - start).toBeLessThan(1500);
      expect(db.getPool().waitingCount).toBe(0);
    } finally { held.forEach(c => c.release()); }
    expect((await db.healthCheck()).ok).toBe(true);
    expect((await db.withTransaction(tx => tx.query('SELECT 42 AS n'))).rows[0].n).toBe(42);
  });

  it('rolls back an interrupted server session and reconnects with no partial write', async () => {
    const id = `rel-${randomUUID()}`;
    // Terminate only our checked-out transaction backend. This is a session fault,
    // not an OS process restart or a PostgreSQL service outage claim.
    await expect(db.withTransaction(async tx => {
      await tx.query('INSERT INTO workspace(id,name) VALUES($1,$2)', [id, 'fabricated rollback']);
      const pid = (await tx.query<{pid:number}>('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await db.query('SELECT pg_terminate_backend($1)', [pid]);
      await tx.query('SELECT 1');
    })).rejects.toThrow();
    expect((await db.query('SELECT id FROM workspace WHERE id=$1', [id])).rows).toEqual([]);
    expect((await db.healthCheck()).ok).toBe(true);
    await db.withTransaction(tx => tx.query('INSERT INTO workspace(id,name) VALUES($1,$2)', [id, 'recovered']));
    expect((await db.query('SELECT id FROM workspace WHERE id=$1', [id])).rowCount).toBe(1);
  });

  it('preserves the original business error while rolling back and reusing a healthy connection', async () => {
    const id = `rel-${randomUUID()}`;
    const failure = new Error('fabricated business refusal');
    await expect(db.withTransaction(async tx => {
      await tx.query('INSERT INTO workspace(id,name) VALUES($1,$2)', [id, 'must rollback']);
      throw failure;
    })).rejects.toBe(failure);
    expect((await db.query('SELECT id FROM workspace WHERE id=$1', [id])).rows).toEqual([]);
    expect((await db.healthCheck()).ok).toBe(true);
  });

  it('failed migration rolls back DDL and bookkeeping, then accepts a corrected retry', async () => {
    const version = `z_rel_${randomUUID().replaceAll('-', '')}`;
    const table = `rel_${randomUUID().replaceAll('-', '')}`;
    const failed = new Migrator(db, [{version, up:`CREATE TABLE ${table}(id integer); SELECT 1/0;`, down:`DROP TABLE ${table}`}]);
    await expect(failed.up()).rejects.toThrow();
    expect((await db.query('SELECT to_regclass($1) AS name', [table])).rows[0].name).toBeNull();
    expect((await failed.applied()).includes(version)).toBe(false);
    const corrected = new Migrator(db, [{version, up:`CREATE TABLE ${table}(id integer)`, down:`DROP TABLE ${table}`}]);
    expect(await corrected.up()).toEqual([version]);
    expect(await corrected.down()).toEqual([version]);
  });

  it('missing evidence stays empty; fabricated private fields are omitted and access remains audited', async () => {
    const workspaceId = `rel-${randomUUID()}`;
    const actor = {workspaceId, userId:'owner', role:'sales' as const, isDemo:false};
    const store = new PgPilotStore(db);
    const service = new PilotClosureService(store, new RbacService(), configuredContentDigester({NODE_ENV:'test'}));
    const lead = createLead({workspaceId, displayName:'fabricated missing evidence'});
    await store.save({lead, ownerUserId:'owner', workItems:[], outcomes:[]}, []);
    expect(await service.evidence(actor, lead.id)).toMatchObject({items:[], isSynthetic:null, accessRecorded:true});
    const loop = new PilotLoopService(store, new ManualAdapter());
    const fixture = await loop.ingestScenario({workspaceId, ownerUserId:'owner', displayName:'fabricated filtered evidence',
      utterance:'fabricated visible statement', speaker:'customer', connection:'manual', externalRecordId:randomUUID(), isSynthetic:true});
    // New synthetic accepted envelope fixture; never rewrite immutable accepted rows.
    const fixture2 = {...fixture, version:undefined, sourceEnvelopeId:undefined, lead:createLead({workspaceId, displayName:'fabricated extra fields'}),
      envelope:{...fixture.envelope!, envelopeId:randomUUID() as NonNullable<typeof fixture.envelope>['envelopeId'], externalRecordId:randomUUID(),
        rawPayload:{utterance:'fabricated visible statement', speaker:'customer', privateToken:'FABRICATED_DO_NOT_RENDER', nested:{secret:'FABRICATED_DO_NOT_RENDER'}}}};
    await store.save(fixture2, []);
    const result = await service.evidence(actor, fixture2.lead.id);
    expect(result.items[0].rawPayload).toEqual({utterance:'fabricated visible statement',speaker:'customer'});
    expect(JSON.stringify(result)).not.toContain('FABRICATED_DO_NOT_RENDER');
    expect((await store.history(fixture2.lead.id)).filter(e => e.eventType === 'evidence_accessed')).toHaveLength(1);
    expect((await db.query('SELECT raw_payload FROM commercial_envelope WHERE id=$1', [fixture2.envelope.envelopeId])).rows[0].raw_payload).toHaveProperty('privateToken');
  });
});



