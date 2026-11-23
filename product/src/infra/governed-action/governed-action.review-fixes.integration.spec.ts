import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import { attemptHistory, replayLifecycle } from '../../domain/governed-action/action-history';
import type { ActionActor } from '../../domain/governed-action/governed-action.types';
import type { ActionExecutionResult, ActionExecutor, ActionRequest } from '../../ports/governed-action';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PostgresService } from '../postgres/postgres.service';
import { PgActionStore } from './pg-action.store';
import { createSyntheticActionPorts } from './synthetic-runtime';

/** PostgreSQL regressions for the R2 review fixes (A-M1, A-m1) and QA R2-I-01. */
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const CAP = 'ads.campaign.budget.update';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });

suite('governed-action review fixes on PostgreSQL (migration 011)', () => {
  let db: PostgresService;
  let store: PgActionStore;
  const ws = `ga-fix-${randomUUID()}`;
  const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: ws };
  const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId: ws };
  const drafter: ActionActor = { kind: 'ai', id: 'drafter', workspaceId: ws };

  const runtime = () => {
    const ports = createSyntheticActionPorts({
      enabled: [{ workspaceId: ws, capabilityId: CAP }], clock: () => new Date(), store, actors: [alice, bob, drafter],
      policy: { constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 },
        proposers: '*', approvers: ['bob'], executors: ['alice'], readers: '*' },
    });
    ports.ledger.seed({ workspaceId: ws, target }, budget('100000'));
    let release: () => void = () => undefined;
    let gated = false;
    const inner = ports.executor;
    const executor: ActionExecutor = {
      mode: 'synthetic',
      execute: async (request: ActionRequest, signal: AbortSignal): Promise<ActionExecutionResult> => {
        if (gated) await new Promise<void>((resolve) => { release = resolve; });
        return inner.execute(request, signal);
      },
    };
    const execute = vi.spyOn(executor, 'execute');
    const service = new GovernedActionService({ ...ports, executor, executionTimeoutMs: 2_000, readbackTimeoutMs: 1_000 });
    const reauthorize = async (id: string) => {
      const p = await service.preview(alice, id);
      return service.authorize(bob, id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok' });
    };
    const authorized = async () => reauthorize((await service.propose(alice, {
      requestKey: randomUUID(), capabilityId: CAP, target, arguments: budget('110000'), rationale: 'pg review fix' })).id);
    return { ports, service, execute, reauthorize, authorized, gate: () => { gated = true; }, release: () => release() };
  };

  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL, max: 10 });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace (id, name) VALUES ($1, $1)', [ws]);
    store = new PgActionStore(db);
  });

  afterAll(async () => {
    await db?.onModuleDestroy();
  });

  it('A-M1: after FAILED → re-authorize → SUCCEEDED, both previews and both attempts are rebuilt from the event table alone', async () => {
    const r = runtime();
    r.ports.executor.behaviour = 'reject';
    const p = await r.authorized();
    expect((await r.service.execute(alice, p.id)).state).toBe('FAILED_VERIFIED');
    r.ports.ledger.seed({ workspaceId: ws, target }, budget('105000'));
    r.ports.executor.behaviour = 'apply';
    await r.reauthorize(p.id);
    expect((await r.service.execute(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');

    const fresh = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL, max: 2 });
    try {
      const freshStore = new PgActionStore(fresh);
      const [reloaded, events] = await Promise.all([freshStore.get(ws, p.id), freshStore.events(ws, p.id)]);
      const { state, version, attempts, preview, approval, execution, outcome } = reloaded!;
      expect(replayLifecycle(events)).toEqual({ state, version, attempts, preview, approval, execution, outcome });
      const previews = events.filter((e) => e.type === 'PREVIEWED').map((e) => (e.data.beforeState as { value: unknown }).value);
      expect(previews).toEqual([budget('100000'), budget('105000')]);
      const tried = attemptHistory(events);
      expect(tried.map((a) => [a.idempotencyKey, a.executorStatus, a.executorReason, a.providerReference ?? null])).toEqual([
        [`ga-${p.id}-1`, 'NOT_APPLIED', 'SYNTHETIC_REJECTED', null], [`ga-${p.id}-2`, 'APPLIED', 'SYNTHETIC_APPLIED', 'synthetic-op-1'],
      ]);
      expect(tried[0].verifications[0]).toMatchObject({ observation: 'NOT_EXECUTED', reason: 'SYNTHETIC_NO_OPERATION_FOUND',
        evidence: { synthetic: true, idempotencyKey: `ga-${p.id}-1` } });
      expect(tried[1].verifications[0]).toMatchObject({ observation: 'EXECUTED', evidence: { reference: 'synthetic-op-1' } });
    } finally {
      await fresh.onModuleDestroy();
    }
  });

  it('R2-I-01: a refused duplicate execute / AI verify while EXECUTING does not break the in-flight outcome CAS', async () => {
    const r = runtime();
    const p = await r.authorized();
    r.gate();
    const run = r.service.execute(alice, p.id);
    await vi.waitFor(() => expect(r.execute).toHaveBeenCalledTimes(1));
    await expect(r.service.execute(alice, p.id)).rejects.toMatchObject({ code: 'EXECUTION_IN_FLIGHT' });
    await expect(r.service.verify(drafter, p.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    await expect(r.service.authorize(drafter, p.id, { reviewedArgumentDigest: 'x', reviewedPreviewDigest: 'y', reason: 'z' }))
      .rejects.toMatchObject({ code: 'AI_CANNOT_AUTHORIZE' });
    r.release();
    const done = await run;
    expect(done).toMatchObject({ state: 'SUCCEEDED_VERIFIED', version: 5, execution: { providerReference: expect.stringMatching(/^synthetic-op-/) } });
    expect(r.execute).toHaveBeenCalledTimes(1);
    expect((await store.events(ws, p.id)).map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect((await store.refusals(ws, p.id)).map((x) => [x.command, x.code, x.proposalVersion])).toEqual([
      ['execute', 'EXECUTION_IN_FLIGHT', 4], ['verify', 'INVALID_TRANSITION', 4], ['authorize', 'AI_CANNOT_AUTHORIZE', 4],
    ]);
  });

  it('A-m1: the refusal log is append-only at the database and outside the proposal CAS', async () => {
    const r = runtime();
    const p = await r.service.propose(alice, { requestKey: randomUUID(), capabilityId: CAP, target, arguments: budget('101000'), rationale: 'refusals' });
    await Promise.all(Array.from({ length: 6 }, () => r.service.execute(drafter, p.id).catch(() => undefined)));
    expect((await store.get(ws, p.id))?.version).toBe(1);
    expect(await store.refusals(ws, p.id)).toHaveLength(6);
    await expect(db.query("UPDATE governed_action_refusal SET reason = 'x' WHERE proposal_id = $1", [p.id])).rejects.toThrow(/append-only/);
    await expect(db.query('DELETE FROM governed_action_refusal WHERE proposal_id = $1', [p.id])).rejects.toThrow(/append-only/);
    await expect(db.query('TRUNCATE governed_action_refusal')).rejects.toThrow(/append-only/);
    await expect(db.query(`INSERT INTO governed_action_refusal (workspace_id, proposal_id, proposal_version, command, code, actor_kind, actor_id, reason, recorded_at)
      VALUES ($1, $2, 1, 'x', 'y', 'human', 'a', 'r', now())`, ['other-ws', p.id])).rejects.toThrow(/foreign key/);
    expect((await r.service.refusals(alice, p.id)).every((x) => x.actor.kind === 'ai' && x.proposalVersion === 1)).toBe(true);
  });

  it('lead_id is stored as a UUID column (Stable Lead ID, I-07)', async () => {
    const col = await db.query<{ data_type: string }>(
      "SELECT data_type FROM information_schema.columns WHERE table_name = 'governed_action_proposal' AND column_name = 'lead_id'");
    expect(col.rows[0].data_type).toBe('uuid');
  });
});
