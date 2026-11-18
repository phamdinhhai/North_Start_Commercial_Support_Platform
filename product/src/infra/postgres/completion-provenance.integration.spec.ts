import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';
import { PgPilotStore } from './pg-pilot.store';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { createLead, type LeadId } from '../../domain/lead/lead';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

// Run this migration lifecycle suite on a disposable database, independently of
// other suites: down deliberately drops projection columns (never audit rows).
integration('completion provenance PostgreSQL migration and restart', () => {
  let db: PostgresService;
  const workspaceId = `provenance-${randomUUID()}`;
  const schema = `completion_${randomUUID().replace(/-/g, '')}`;
  const config = { connectionString: databaseUrl, max: 2, options: `-c search_path=${schema}` };
  let legacyLeadId: LeadId;
  const legacyWorkId = randomUUID();
  const migrations = loadMigrations();
  const migration = migrations.find((m) => m.version === '009_work_completion_provenance')!;
  // Pin to <= 009 so later, unrelated migrations do not change what `down()` reverts.
  const through009 = migrations.filter((m) => m.version <= migration.version);

  beforeAll(async () => {
    const admin = new PostgresService({ connectionString: databaseUrl, max: 1 });
    try { await admin.query(`CREATE SCHEMA ${schema}`); } finally { await admin.onModuleDestroy(); }
    db = new PostgresService(config);
    await new Migrator(db, migrations.filter((m) => m.version < migration.version)).up();
    const service = new PilotLoopService(new PgPilotStore(db), new ManualAdapter());
    const legacy = await service.ingestScenario({ workspaceId, displayName: 'legacy', utterance: 'request',
      speaker: 'customer', connection: 'test', externalRecordId: randomUUID(), ownerUserId: 'marketing' });
    legacyLeadId = legacy.lead.id;
    await db.query(`INSERT INTO pilot_work_item
      (id,lead_id,workspace_id,action,responsible_party,origin,status,completion_evidence,actor,reason)
      VALUES ($1,$2,$3,'call','internal','explicit-request','completed','declared','sales','legacy reason')`,
    [legacyWorkId, legacyLeadId, workspaceId]);
    await new Migrator(db, through009).up();
  });

  afterAll(async () => {
    if (db) {
      await db.query(`DROP SCHEMA ${schema} CASCADE`);
      await db.onModuleDestroy();
    }
  });

  it('upgrade keeps missing legacy declaration and confirmation unknown', async () => {
    const work = (await new PgPilotStore(db).load(legacyLeadId))!.workItems[0];
    expect(work.completionEvidence).toBe('declared');
    expect(work.occurredAt).toBe('unknown');
    expect(work).not.toHaveProperty('declaration');
    expect(work).not.toHaveProperty('confirmed');
    const row = await db.query('SELECT declaration,confirmed FROM pilot_work_item WHERE id=$1', [legacyWorkId]);
    expect(row.rows[0]).toEqual({ declaration: null, confirmed: null });
  });

  it('human declaration and observed proof survive fresh pools without fabricating human fields', async () => {
    const service = new PilotLoopService(new PgPilotStore(db), new ManualAdapter());
    // System observation fixture enters through the persistence boundary;
    // manual intake intentionally forces imported_record/manual provenance.
    const envelope = new ManualAdapter().ingest({ workspaceId, connection: 'system',
      externalRecordId: randomUUID(), externalEventType: 'action', rawPayload: { utterance: 'call completed', speaker: 'staff' },
      acquisitionMode: 'automatic_observation', acquisitionSource: 'system', isSynthetic: true });
    const proof = await new PgPilotStore(db).save({
      lead: createLead({ workspaceId, displayName: 'system proof' }), envelope,
      workItems: [], outcomes: [], ownerUserId: 'system-fixture',
    }, []);
    const completed = [];
    for (const basis of ['declared', 'observed'] as const) {
      const state = await service.ingestScenario({ workspaceId, displayName: basis, utterance: 'please call',
        speaker: 'customer', connection: 'test', externalRecordId: randomUUID(), ownerUserId: 'marketing' });
      const handoff = await service.handoffToSales(state.lead.id, { context: 'call request', proposedAction: 'call',
        responsibleParty: 'internal', origin: 'explicit-request', actor: 'marketing', recipientUserId: 'sales',
        ...(basis === 'observed' && { evidenceRef: proof.sourceEnvelopeId! }) });
      const workId = handoff.workItems[0].id;
      await service.salesAccept(state.lead.id, { workId, actor: 'sales', reason: 'accepted responsibility' });
      const result = await service.completeWork(state.lead.id, { workId, actor: 'sales', evidence: basis,
        ...(basis === 'declared' ? { declaration: '  I called the customer.\nCustomer requested tomorrow.  ', confirmed: true }
          : { evidenceRef: proof.sourceEnvelopeId! }) });
      completed.push(result);
    }
    await db.onModuleDestroy();
    db = new PostgresService(config);
    const store = new PgPilotStore(db);
    for (const original of completed) {
      const reloaded = (await store.load(original.lead.id))!;
      expect(reloaded.workItems).toEqual(original.workItems);
      expect(reloaded.workItems[0].occurredAt).toBe('unknown');
      const audit = (await store.history(original.lead.id)).find((a) => a.eventType === 'work_completed')!;
      const value = JSON.parse(audit.newValue);
      expect(value.evidence).toBe(original.workItems[0].completionEvidence);
      if (value.evidence === 'declared') {
        expect(value.declaration).toBe(original.workItems[0].declaration);
        expect(value.confirmed).toBe(true);
      } else {
        expect(reloaded.workItems[0]).not.toHaveProperty('declaration');
        expect(reloaded.workItems[0]).not.toHaveProperty('confirmed');
        expect(value.evidenceRef).toBe(proof.sourceEnvelopeId);
        expect(value.evidenceHash).toBe(proof.envelope!.rawPayloadHash);
      }
    }
    const original = completed[0];
    const historyBefore = await store.history(original.lead.id);
    const migrator = new Migrator(db, through009);
    expect(await migrator.down()).toEqual([migration.version]);
    expect(await migrator.up()).toEqual([migration.version]);
    const after = (await store.load(original.lead.id))!.workItems[0];
    expect(after).not.toHaveProperty('declaration');
    expect(after).not.toHaveProperty('confirmed');
    expect(after.status).toBe('completed');
    expect(after.occurredAt).toBe('unknown');
    expect(await store.history(original.lead.id)).toEqual(historyBefore);
  });
});
