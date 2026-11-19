import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import { preview } from '../../domain/governed-action/action-lifecycle';
import type { ActionActor } from '../../domain/governed-action/governed-action.types';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { PgActionStore } from './pg-action.store';
import { createSyntheticActionPorts } from './synthetic-runtime';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const CAP = 'ads.campaign.budget.update';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });

suite('governed actions on PostgreSQL (migration 011)', () => {
  let db: PostgresService;
  let store: PgActionStore;
  const wsA = `ga-a-${randomUUID()}`;
  const wsB = `ga-b-${randomUUID()}`;
  const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: wsA };
  const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId: wsA };

  const runtime = (overrides: { store?: PgActionStore } = {}) => {
    const ports = createSyntheticActionPorts({
      enabled: [{ workspaceId: wsA, capabilityId: CAP }, { workspaceId: wsB, capabilityId: CAP }], clock: () => new Date(),
      policy: { constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 },
        proposers: '*', approvers: ['bob'], executors: ['alice'] },
      store: overrides.store ?? store,
    });
    ports.ledger.seed({ workspaceId: wsA, target }, budget('100000'));
    const execute = vi.spyOn(ports.executor, 'execute');
    const service = new GovernedActionService({ ...ports, executionTimeoutMs: 100, readbackTimeoutMs: 100 });
    const authorized = async (requestKey = randomUUID()) => {
      const p = await service.propose(alice, { requestKey, capabilityId: CAP, target, arguments: budget('110000'), rationale: 'integration' });
      const previewed = await service.preview(alice, p.id);
      return service.authorize(bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: previewed.preview!.previewDigest, reason: 'ok' });
    };
    return { ports, service, execute, authorized };
  };

  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL, max: 10 });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace (id, name) VALUES ($1, $1), ($2, $2)', [wsA, wsB]);
    store = new PgActionStore(db);
  });

  afterAll(async () => {
    await db?.onModuleDestroy();
  });

  it('migration 011 rolls back cleanly and re-applies', async () => {
    const migration = loadMigrations().find((m) => m.version === '011_governed_actions')!;
    const exists = async () => (await db.query<{ p: string | null; e: string | null }>(
      "SELECT to_regclass('governed_action_proposal')::text AS p, to_regclass('governed_action_event')::text AS e")).rows[0];
    expect(await exists()).toEqual({ p: 'governed_action_proposal', e: 'governed_action_event' });
    const digestMigration = loadMigrations().find((m) => m.version === '012_content_digest')!;
    await db.withTransaction(async (tx) => { await tx.query(digestMigration.down); await tx.query(migration.down); });
    expect(await exists()).toEqual({ p: null, e: null });
    const fns = await db.query("SELECT proname FROM pg_proc WHERE proname LIKE 'governed_action_%'");
    expect(fns.rows).toHaveLength(0);
    await db.withTransaction(async (tx) => { await tx.query(migration.up); await tx.query(digestMigration.up); });
    expect(await exists()).toEqual({ p: 'governed_action_proposal', e: 'governed_action_event' });
  });

  it('runs the full lifecycle durably and the history survives a new connection pool', async () => {
    const r = runtime();
    const p = await r.authorized();
    const done = await r.service.execute(alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    const fresh = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    try {
      const reloaded = await new PgActionStore(fresh).get(wsA, p.id);
      expect(reloaded).toMatchObject({ state: 'SUCCEEDED_VERIFIED', version: 5, attempts: 1, argumentDigest: p.argumentDigest,
        arguments: budget('110000'), approval: { consumed: true, approver: { id: 'bob' } }, outcome: { verification: { observation: 'EXECUTED' } } });
      const events = await new PgActionStore(fresh).events(wsA, p.id);
      expect(events.map((e) => [e.sequence, e.type, e.toState])).toEqual([
        [1, 'PROPOSED', 'PROPOSED'], [2, 'PREVIEWED', 'PREVIEWED'], [3, 'AUTHORIZED', 'AUTHORIZED'],
        [4, 'EXECUTION_STARTED', 'EXECUTING'], [5, 'OUTCOME_RECORDED', 'SUCCEEDED_VERIFIED'],
      ]);
    } finally {
      await fresh.onModuleDestroy();
    }
  });

  it('concurrent execute attempts across connections reach the executor exactly once (CAS)', async () => {
    const r = runtime();
    const p = await r.authorized();
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => r.service.execute(alice, p.id)));
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const codes = results.filter((x): x is PromiseRejectedResult => x.status === 'rejected').map((x) => x.reason.code);
    expect(codes, JSON.stringify(codes)).toSatisfy((all: string[]) => all.every((c) => ['CONCURRENT_MODIFICATION', 'EXECUTION_IN_FLIGHT', 'ALREADY_EXECUTED'].includes(c)));
    expect(r.execute).toHaveBeenCalledTimes(1);
    const started = await db.query("SELECT count(*)::int AS n FROM governed_action_event WHERE proposal_id = $1 AND event_type = 'EXECUTION_STARTED'", [p.id]);
    expect(started.rows[0].n).toBe(1);
  });

  it('raw store CAS: two transitions from the same version — exactly one commits', async () => {
    const r = runtime();
    const p = await r.service.propose(alice, { requestKey: randomUUID(), capabilityId: CAP, target, arguments: budget('105000'), rationale: 'cas' });
    const previewBy = (who: string) => preview(p, { actor: { kind: 'human', id: who }, beforeState: { status: 'UNKNOWN', reason: who } }, new Date());
    const outcomes = await Promise.allSettled([store.transition(1, previewBy('x')), store.transition(1, previewBy('y'))]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find((o): o is PromiseRejectedResult => o.status === 'rejected')?.reason).toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
    expect((await store.events(wsA, p.id)).map((e) => e.sequence)).toEqual([1, 2]);
  });

  it('events are append-only and frozen proposal fields are immutable at the database', async () => {
    const r = runtime();
    const p = await r.service.propose(alice, { requestKey: randomUUID(), capabilityId: CAP, target, arguments: budget('101000'), rationale: 'immutability' });
    await expect(db.query("UPDATE governed_action_event SET reason = 'rewritten' WHERE proposal_id = $1", [p.id])).rejects.toThrow(/append-only/);
    await expect(db.query('DELETE FROM governed_action_event WHERE proposal_id = $1', [p.id])).rejects.toThrow(/append-only/);
    await expect(db.query('TRUNCATE governed_action_event CASCADE')).rejects.toThrow(/append-only/);
    await expect(db.query(`UPDATE governed_action_proposal SET arguments_canonical = '{"dailyBudget":{"amountMinor":"9","currency":"VND"}}', version = version + 1 WHERE id = $1`, [p.id]))
      .rejects.toThrow(/immutable/);
    await expect(db.query('UPDATE governed_action_proposal SET version = version + 2 WHERE id = $1', [p.id])).rejects.toThrow(/exactly one/);
    await expect(db.query('DELETE FROM governed_action_proposal WHERE id = $1', [p.id])).rejects.toThrow(/not deletable/);
    await expect(db.query('INSERT INTO governed_action_event (workspace_id, proposal_id, sequence, event_type, to_state, actor_kind, actor_id, reason, recorded_at) VALUES ($1,$2,1,$3,$4,$5,$6,$7,now())',
      [wsA, p.id, 'PROPOSED', 'PROPOSED', 'human', 'x', 'dup'])).rejects.toThrow(/duplicate key/);
    expect((await store.events(wsA, p.id))).toHaveLength(1);
  });

  it('request keys are unique per workspace, idempotent under concurrency, and reads are tenant scoped', async () => {
    const r = runtime();
    const key = randomUUID();
    const carolB: ActionActor = { kind: 'human', id: 'carol', workspaceId: wsB };
    const command = { requestKey: key, capabilityId: CAP, target, arguments: budget('110000'), rationale: 'tenant' };
    const concurrent = await Promise.all([r.service.propose(alice, command), r.service.propose(alice, command), r.service.propose(alice, command)]);
    expect(new Set(concurrent.map((p) => p.id)).size).toBe(1);
    const other = await r.service.propose(carolB, command);
    expect(other.id).not.toBe(concurrent[0].id);
    await expect(r.service.propose(alice, { ...command, arguments: budget('111000') })).rejects.toMatchObject({ code: 'REQUEST_KEY_CONFLICT' });
    expect(await store.get(wsB, concurrent[0].id)).toBeUndefined();
    expect(await store.events(wsB, concurrent[0].id)).toEqual([]);
    expect(await store.get(wsA, 'not-a-uuid')).toBeUndefined();
    await expect(r.service.execute(carolB, concurrent[0].id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const count = await db.query('SELECT count(*)::int AS n FROM governed_action_proposal WHERE request_key = $1', [key]);
    expect(count.rows[0].n).toBe(2);
  });

  it('persists UNKNOWN, refuses retry, and resolves only through readback', async () => {
    const r = runtime();
    r.ports.executor.behaviour = 'apply-then-hang';
    const p = await r.authorized();
    expect((await r.service.execute(alice, p.id)).state).toBe('UNKNOWN');
    r.ports.executor.behaviour = 'apply';
    await expect(r.service.execute(alice, p.id)).rejects.toMatchObject({ code: 'OUTCOME_UNKNOWN_RETRY_REFUSED' });
    expect((await r.service.verify(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(r.execute).toHaveBeenCalledTimes(1);
    const types = (await store.events(wsA, p.id)).map((e) => e.type);
    expect(types).toEqual(['PROPOSED', 'PREVIEWED', 'AUTHORIZED', 'EXECUTION_STARTED', 'OUTCOME_RECORDED', 'VERIFICATION_RECORDED']);
    expect((await store.refusals(wsA, p.id)).map((x) => [x.command, x.code, x.proposalVersion])).toEqual([['execute', 'OUTCOME_UNKNOWN_RETRY_REFUSED', 5]]);
  });
});
