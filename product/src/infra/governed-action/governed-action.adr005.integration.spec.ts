import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import type { ActionActor } from '../../domain/governed-action/governed-action.types';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { PgActionStore } from './pg-action.store';
import { PgCommercialEventLookup } from './pg-commercial-event.lookup';
import { createSyntheticActionPorts } from './synthetic-runtime';

/** ADR-005 R2-P-01 on PostgreSQL: evidence refs persisted + frozen, AI rows need a CE, propose refusals logged. */
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const CAP = 'ads.campaign.budget.update';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });

suite('governed actions × ADR-005 on PostgreSQL (migration 011)', () => {
  let db: PostgresService;
  let store: PgActionStore;
  let lookup: PgCommercialEventLookup;
  const ws = `ga-adr5-${randomUUID()}`;
  const wsB = `ga-adr5-b-${randomUUID()}`;
  const leadId = randomUUID();
  const ceDraft = randomUUID();
  const ceNoProvenance = randomUUID();
  const ceForeign = randomUUID();
  const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: ws };
  const drafter: ActionActor = { kind: 'ai', id: 'drafter', workspaceId: ws };

  const runtime = () => {
    const ports = createSyntheticActionPorts({
      enabled: [{ workspaceId: ws, capabilityId: CAP }], clock: () => new Date(), store, actors: [alice, drafter],
      policy: { constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 },
        proposers: '*', approvers: [], executors: [], readers: '*', leadAccess: { [leadId]: ['alice', 'drafter'] } },
    });
    return new GovernedActionService({ ...ports, commercialEvents: lookup });
  };

  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL, max: 4 });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace (id, name) VALUES ($1, $1), ($2, $2)', [ws, wsB]);
    const leadB = randomUUID();
    await db.query("INSERT INTO lead (id, workspace_id, display_name) VALUES ($1, $2, 'L'), ($3, $4, 'LB')", [leadId, ws, leadB, wsB]);
    const insertCe = `INSERT INTO commercial_event (id, workspace_id, lead_id, event_type, inferred_meaning, confidence, evidence_ref,
      evidence_reason, source_actor, created_by, provenance) VALUES ($1,$2,$3,'BUYER_COMMITMENT','m','{"producer":"p","model":"m","version":"1","rationale":"r"}'::jsonb,$4,$5,'ai','ai',$6::jsonb)`;
    const prov = JSON.stringify({ acquisitionMode: 'inferred', assertionStatus: 'draft' });
    await db.query(insertCe, [ceDraft, ws, leadId, 'envelope:pg-1', null, prov]);
    await db.query(insertCe, [ceNoProvenance, ws, leadId, 'envelope:pg-2', null, null]);
    await db.query(insertCe, [ceForeign, wsB, leadB, 'envelope:pg-3', null, prov]);
    store = new PgActionStore(db);
    lookup = new PgCommercialEventLookup(db);
  });

  afterAll(async () => {
    await db?.onModuleDestroy();
  });

  it('PgCommercialEventLookup reads facts workspace-scoped; missing provenance is an honest unknown (I-08)', async () => {
    expect(await lookup.find(ws, ceDraft)).toEqual({ id: ceDraft, workspaceId: ws, leadId, acquisitionMode: 'inferred',
      assertionStatus: 'draft', policyCheck: 'pending', evidencePointers: ['envelope:pg-1'] });
    expect(await lookup.find(ws, ceNoProvenance)).toMatchObject({ assertionStatus: 'unknown', acquisitionMode: 'inferred' });
    expect(await lookup.find(ws, ceForeign)).toBeUndefined();
    expect(await lookup.find(ws, 'not-a-uuid')).toBeUndefined();
  });

  it('an AI proposal persists its CE + evidence refs, which are frozen at the database', async () => {
    const service = runtime();
    const p = await service.propose(drafter, { requestKey: randomUUID(), capabilityId: CAP, target, arguments: budget('110000'), rationale: 'ai', leadId, commercialEventRef: ceDraft });
    const fresh = await new PgActionStore(db).get(ws, p.id);
    expect(fresh).toMatchObject({ commercialEventRef: ceDraft, evidenceRefs: ['envelope:pg-1'], proposer: { kind: 'ai' } });
    const [proposed] = await store.events(ws, p.id);
    expect(proposed.data).toMatchObject({ commercialEventRef: ceDraft, evidenceRefs: ['envelope:pg-1'] });
    await expect(db.query(`UPDATE governed_action_proposal SET evidence_refs = '["x"]'::jsonb, version = version + 1 WHERE id = $1`, [p.id])).rejects.toThrow(/immutable/);
    await expect(db.query('UPDATE governed_action_proposal SET commercial_event_ref = NULL, version = version + 1 WHERE id = $1', [p.id])).rejects.toThrow(/immutable/);
    const human = await service.propose(alice, { requestKey: randomUUID(), capabilityId: CAP, target, arguments: budget('110000'), rationale: 'human' });
    expect((await store.get(ws, human.id))).toMatchObject({ evidenceRefs: [] });
    expect((await store.get(ws, human.id))?.commercialEventRef).toBeUndefined();
  });

  it('the database refuses an AI proposal row without a CE or evidence', async () => {
    const insert = (kind: string, ce: string | null, refs: string) => db.query(
      `INSERT INTO governed_action_proposal (id, workspace_id, request_key, capability_id, risk_class, target, arguments_canonical,
         argument_digest, proposer_kind, proposer_id, rationale, constraints, idempotency_key, created_at, expires_at, state, version,
         commercial_event_ref, evidence_refs, updated_at)
       VALUES ($1,$2,$3,'c','LOW','{}'::jsonb,'{}',repeat('a',64),$4,'x','r','{}'::jsonb,$5,now(),now()+interval '1 hour','PROPOSED',1,$6,$7::jsonb,now())`,
      [randomUUID(), ws, randomUUID(), kind, randomUUID(), ce, refs]);
    await expect(insert('ai', null, '["e"]')).rejects.toThrow(/check constraint/);
    await expect(insert('ai', ceDraft, '[]')).rejects.toThrow(/check constraint/);
    await expect(insert('human', null, '{"a":1}')).rejects.toThrow(/check constraint/);
    await expect(insert('human', null, JSON.stringify(Array.from({ length: 21 }, (_, i) => `r${i}`)))).rejects.toThrow(/check constraint/);
    await expect(insert('human', null, '[]')).resolves.toBeDefined();
  });

  it('EVIDENCE_REQUIRED refusals are logged without a proposal row, in an append-only log', async () => {
    const service = runtime();
    const key = randomUUID();
    for (const ref of [undefined, ceForeign, ceNoProvenance]) {
      await expect(service.propose(drafter, { requestKey: key, capabilityId: CAP, target, arguments: budget('110000'), rationale: 'ai', leadId,
        ...(ref ? { commercialEventRef: ref } : {}) })).rejects.toMatchObject({ code: 'EVIDENCE_REQUIRED' });
    }
    const rows = await db.query('SELECT count(*)::int AS n FROM governed_action_proposal WHERE workspace_id = $1 AND request_key = $2', [ws, key]);
    expect(rows.rows[0].n).toBe(0);
    const log = (await store.proposalRefusals(ws)).filter((r) => r.requestKey === key);
    expect(log.map((r) => [r.code, r.details[0], r.commercialEventRef ?? null, r.actor.kind, r.leadId])).toEqual([
      ['EVIDENCE_REQUIRED', 'COMMERCIAL_EVENT_REF_MISSING', null, 'ai', leadId],
      ['EVIDENCE_REQUIRED', 'COMMERCIAL_EVENT_NOT_FOUND', ceForeign, 'ai', leadId],
      ['EVIDENCE_REQUIRED', 'COMMERCIAL_EVENT_NOT_DRAFT', ceNoProvenance, 'ai', leadId],
    ]);
    expect(await store.proposalRefusals(wsB)).toEqual([]);
    await expect(db.query("UPDATE governed_action_propose_refusal SET reason = 'x' WHERE workspace_id = $1", [ws])).rejects.toThrow(/append-only/);
    await expect(db.query('DELETE FROM governed_action_propose_refusal WHERE workspace_id = $1', [ws])).rejects.toThrow(/append-only/);
    await expect(db.query('TRUNCATE governed_action_propose_refusal')).rejects.toThrow(/append-only/);
  });

  it('migration 011 down removes the propose-refusal log and up restores it (symmetric)', async () => {
    const migration = loadMigrations().find((m) => m.version === '011_governed_actions')!;
    const exists = async () => (await db.query<{ t: string | null }>("SELECT to_regclass('governed_action_propose_refusal')::text AS t")).rows[0].t;
    expect(await exists()).toBe('governed_action_propose_refusal');
    await db.withTransaction(async (tx) => {
      await tx.query(migration.down);
      const left = await tx.query("SELECT count(*)::int AS n FROM pg_proc WHERE proname LIKE 'governed_action_%'");
      expect(left.rows[0].n).toBe(0);
      expect((await tx.query<{ t: string | null }>("SELECT to_regclass('governed_action_propose_refusal')::text AS t")).rows[0].t).toBeNull();
      await tx.query(migration.up);
    });
    expect(await exists()).toBe('governed_action_propose_refusal');
  });
});
