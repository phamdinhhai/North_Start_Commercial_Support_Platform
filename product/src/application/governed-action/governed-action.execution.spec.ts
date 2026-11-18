import { describe, expect, it, vi } from 'vitest';
import type { ActionActor, ActionProposal } from '../../domain/governed-action/governed-action.types';
import type { ActionExecutor, ActionStore } from '../../ports/governed-action';
import { createSyntheticActionPorts } from '../../infra/governed-action/synthetic-runtime';
import { GovernedActionService, type GovernedActionDeps } from './governed-action.service';

const WS = 'ws-a';
const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: WS };
const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId: WS };
const svc: ActionActor = { kind: 'service', id: 'svc', workspaceId: WS };
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const CAP = 'ads.campaign.budget.update';
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });
const code = (promise: Promise<unknown>) => promise.then(() => 'RESOLVED', (e: { code?: string }) => e.code ?? String(e));

function harness(overrides: Partial<GovernedActionDeps> = {}) {
  let now = new Date('2026-11-18T09:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const ports = createSyntheticActionPorts({
    enabled: [{ workspaceId: WS, capabilityId: CAP }], clock: clock.now,
    policy: { constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 15 * 60_000 },
      proposers: '*', approvers: ['bob'], executors: ['alice', 'svc'] },
  });
  ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
  const execute = vi.spyOn(ports.executor, 'execute');
  const readback = vi.spyOn(ports.verifier, 'readback');
  const deps = { ...ports, clock, executionTimeoutMs: 30, readbackTimeoutMs: 30, executionLeaseMs: 60_000, ...overrides };
  const service = new GovernedActionService(deps);
  const authorized = async (): Promise<ActionProposal> => {
    const proposed = await service.propose(alice, { requestKey: `rk-${Math.random()}`, capabilityId: CAP, target, arguments: budget('110000'), rationale: 'r' });
    return reauthorize(proposed.id);
  };
  const reauthorize = async (id: string): Promise<ActionProposal> => {
    const p = await service.preview(alice, id);
    return service.authorize(bob, id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok' });
  };
  return { service, ports, execute, readback, authorized, reauthorize, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

describe('GovernedActionService — execution, UNKNOWN outcomes and verification (I-05, I-08)', () => {
  it('executor timeout ⇒ UNKNOWN, and any retry is refused until readback', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'hang';
    const p = await h.authorized();
    const result = await h.service.execute(alice, p.id);
    expect(result.state).toBe('UNKNOWN');
    expect(result.outcome?.reason).toBe('EXECUTOR_TIMEOUT');
    expect(h.readback).not.toHaveBeenCalled();
    h.ports.executor.behaviour = 'apply';
    expect(await code(h.service.execute(alice, p.id))).toBe('OUTCOME_UNKNOWN_RETRY_REFUSED');
    expect(await code(h.reauthorize(p.id))).toBe('INVALID_TRANSITION');
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('verifier proves the effect happened ⇒ SUCCEEDED_VERIFIED with no re-execution', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'apply-then-hang';
    const p = await h.authorized();
    expect((await h.service.execute(alice, p.id)).state).toBe('UNKNOWN');
    const verified = await h.service.verify(svc, p.id);
    expect(verified.state).toBe('SUCCEEDED_VERIFIED');
    expect(verified.outcome?.verification).toMatchObject({ observation: 'EXECUTED', evidence: { synthetic: true } });
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.ports.ledger.appliedCount()).toBe(1);
    const types = (await h.service.history(alice, p.id)).map((e) => e.type);
    expect(types.slice(-2)).toEqual(['OUTCOME_RECORDED', 'VERIFICATION_RECORDED']);
  });

  it('verifier proves it did not execute ⇒ FAILED_VERIFIED; another attempt needs explicit re-authorization', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'hang';
    const p = await h.authorized();
    await h.service.execute(alice, p.id);
    expect((await h.service.verify(alice, p.id)).state).toBe('FAILED_VERIFIED');
    expect(await code(h.service.execute(alice, p.id))).toBe('REAUTHORIZATION_REQUIRED');
    h.ports.executor.behaviour = 'apply';
    const again = await h.reauthorize(p.id);
    expect(again.approval?.consumed).toBe(false);
    const done = await h.service.execute(alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    expect(h.execute.mock.calls.map(([r]) => [r.attempt, r.idempotencyKey])).toEqual([[1, `ga-${p.id}`], [2, `ga-${p.id}`]]);
  });

  it('inconclusive readback keeps UNKNOWN visible and still refuses retries', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'throw';
    const p = await h.authorized();
    expect((await h.service.execute(alice, p.id)).outcome?.reason).toBe('EXECUTOR_ERROR');
    h.ports.verifier.forceUnknown = true;
    const still = await h.service.verify(alice, p.id);
    expect(still.state).toBe('UNKNOWN');
    vi.spyOn(h.ports.verifier, 'readback').mockRejectedValueOnce(new Error('provider read down'));
    expect((await h.service.verify(alice, p.id)).outcome?.reason).toBe('READBACK_UNAVAILABLE');
    expect(await code(h.service.execute(alice, p.id))).toBe('OUTCOME_UNKNOWN_RETRY_REFUSED');
    expect(await code(h.service.verify({ kind: 'ai', id: 'ai', workspaceId: WS }, p.id))).toBe('AI_CANNOT_EXECUTE');
  });

  it('executor claim without matching readback is never reported as verified', async () => {
    const lying: ActionExecutor = { mode: 'synthetic', execute: vi.fn(async () => ({ status: 'APPLIED' as const, providerReference: 'x' })) };
    const h = harness({ executor: lying });
    const p = await h.authorized();
    const r = await h.service.execute(alice, p.id);
    expect(r.state).toBe('UNKNOWN');
    expect(r.outcome?.reason).toBe('executor reported APPLIED but readback was NOT_EXECUTED');
  });

  it('provider rejection confirmed by readback ⇒ FAILED_VERIFIED', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'reject';
    const p = await h.authorized();
    expect((await h.service.execute(alice, p.id)).state).toBe('FAILED_VERIFIED');
  });

  it('concurrent execute attempts reach the executor exactly once', async () => {
    const h = harness();
    const p = await h.authorized();
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => h.service.execute(alice, p.id)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const codes = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map((r) => r.reason.code);
    expect(codes.every((c) => ['CONCURRENT_MODIFICATION', 'EXECUTION_IN_FLIGHT', 'ALREADY_EXECUTED'].includes(c))).toBe(true);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.ports.ledger.appliedCount()).toBe(1);
  });

  it('kill switch engaged at execute time refuses dispatch and keeps the approval usable', async () => {
    const h = harness();
    const p = await h.authorized();
    h.ports.killSwitch.engageCapability(CAP);
    expect(await code(h.service.execute(alice, p.id))).toBe('KILL_SWITCH_ENGAGED');
    expect(h.execute).not.toHaveBeenCalled();
    expect((await h.service.get(alice, p.id)).state).toBe('AUTHORIZED');
    h.ports.killSwitch.releaseCapability(CAP);
    expect((await h.service.execute(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
  });

  it('kill switch engaged between claim and dispatch ⇒ FAILED_VERIFIED, never dispatched', async () => {
    const h = harness();
    const p = await h.authorized();
    vi.spyOn(h.ports.killSwitch, 'status').mockResolvedValueOnce({ engaged: false }).mockResolvedValueOnce({ engaged: true, scope: 'global' });
    const r = await h.service.execute(alice, p.id);
    expect(r.state).toBe('FAILED_VERIFIED');
    expect(r.outcome?.verification?.evidence).toEqual({ dispatched: false });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('a crash after claiming execution leaves EXECUTING, which becomes UNKNOWN after the lease (never re-run)', async () => {
    const h = harness();
    const store = h.ports.store;
    const crashing: ActionStore = {
      create: (t) => store.create(t), get: (w, id) => store.get(w, id), events: (w, id) => store.events(w, id),
      transition: async (v, t) => {
        if (t.event.type === 'OUTCOME_RECORDED' && t.event.reason !== 'EXECUTION_LEASE_EXPIRED') throw new Error('process crashed');
        return store.transition(v, t);
      },
    };
    const service = new GovernedActionService({ ...h.ports, store: crashing, clock: { now: () => new Date('2026-11-18T09:00:00Z') }, executionLeaseMs: 60_000 });
    const p = await h.authorized();
    await expect(service.execute(alice, p.id)).rejects.toThrow('process crashed');
    expect((await h.service.get(alice, p.id)).state).toBe('EXECUTING');
    expect(await code(h.service.execute(alice, p.id))).toBe('EXECUTION_IN_FLIGHT');
    expect(await code(h.service.recoverStaleExecution(svc, p.id))).toBe('EXECUTION_IN_FLIGHT');
    h.advance(60_001);
    expect((await h.service.recoverStaleExecution(svc, p.id)).state).toBe('UNKNOWN');
    expect(await code(h.service.execute(alice, p.id))).toBe('OUTCOME_UNKNOWN_RETRY_REFUSED');
    expect((await h.service.verify(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('executor-trigger authority comes from the policy port', async () => {
    const h = harness();
    const p = await h.authorized();
    expect(await code(h.service.execute(bob, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect((await h.service.execute(svc, p.id)).state).toBe('SUCCEEDED_VERIFIED');
    expect(await code(h.service.execute(alice, p.id))).toBe('ALREADY_EXECUTED');
  });
});
