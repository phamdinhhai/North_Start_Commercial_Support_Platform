import { describe, expect, it, vi } from 'vitest';
import type { ActionActor } from '../../domain/governed-action/governed-action.types';
import type { ActionExecutionResult, ActionExecutor, ActionRequest } from '../../ports/governed-action';
import { createSyntheticActionPorts } from '../../infra/governed-action/synthetic-runtime';
import { GovernedActionService } from './governed-action.service';

/**
 * Independent QA (R2, Subagent I) — adversarial probes of the governed-action runtime.
 * Tests marked `it.fails` document a reproduced DEFECT: they assert the expected (correct)
 * behaviour and therefore fail today. When the defect is fixed, vitest reports them as
 * unexpectedly passing — flip them to `it` at that point.
 */
const WS = 'ws-a';
const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: WS };
const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId: WS };
const ai: ActionActor = { kind: 'ai', id: 'copilot', workspaceId: WS };
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const CAP = 'ads.campaign.budget.update';
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });

/** Executor that applies through the synthetic ledger but only answers when released. */
function gatedHarness() {
  const ports = createSyntheticActionPorts({
    enabled: [{ workspaceId: WS, capabilityId: CAP }], clock: () => new Date('2026-11-18T09:00:00.000Z'),
    policy: { constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 15 * 60_000 },
      proposers: '*', approvers: ['bob'], executors: ['alice'] },
  });
  ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
  let release!: () => void;
  const released = new Promise<void>((resolve) => { release = resolve; });
  let dispatched!: () => void;
  const dispatchedP = new Promise<void>((resolve) => { dispatched = resolve; });
  const inner = ports.executor;
  const gated: ActionExecutor = {
    mode: 'synthetic',
    execute: async (request: ActionRequest, signal: AbortSignal): Promise<ActionExecutionResult> => {
      dispatched();
      await released;
      return inner.execute(request, signal);
    },
  };
  const execute = vi.spyOn(gated, 'execute');
  const service = new GovernedActionService({
    ...ports, executor: gated, clock: { now: () => new Date('2026-11-18T09:00:00.000Z') },
    executionTimeoutMs: 5_000, readbackTimeoutMs: 1_000,
  });
  const authorized = async () => {
    const p = await service.propose(alice, { requestKey: 'rk-1', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'r' });
    const previewed = await service.preview(alice, p.id);
    return service.authorize(bob, p.id, {
      reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: previewed.preview!.previewDigest, reason: 'ok',
    });
  };
  return { ports, service, execute, authorized, release, dispatched: dispatchedP };
}

describe('R2 independent QA — governed action refusals during EXECUTING', () => {
  it('control: an undisturbed execution records SUCCEEDED_VERIFIED', async () => {
    const h = gatedHarness();
    const p = await h.authorized();
    const run = h.service.execute(alice, p.id);
    await h.dispatched;
    h.release();
    expect((await run).state).toBe('SUCCEEDED_VERIFIED');
  });

  // DEFECT R2-I-01: a refused command while EXECUTING appends COMMAND_REFUSED and bumps the
  // version, so the in-flight executor's outcome CAS (store.transition(running.version, …))
  // loses: the provider effect happened, execute() rejects CONCURRENT_MODIFICATION, the outcome
  // (and providerReference) is never recorded, and the proposal is stuck EXECUTING until lease expiry.
  it('a duplicate execute refused with EXECUTION_IN_FLIGHT must not break the in-flight outcome', async () => {
    const h = gatedHarness();
    const p = await h.authorized();
    const run = h.service.execute(alice, p.id);
    await h.dispatched;
    await expect(h.service.execute(alice, p.id)).rejects.toMatchObject({ code: 'EXECUTION_IN_FLIGHT' });
    h.release();
    const done = await run; // actual: rejects { code: 'CONCURRENT_MODIFICATION' }
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('an AI actor refused while EXECUTING must not break the in-flight outcome', async () => {
    const h = gatedHarness();
    const p = await h.authorized();
    const run = h.service.execute(alice, p.id);
    await h.dispatched;
    await expect(h.service.verify(ai, p.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    h.release();
    expect((await run).state).toBe('SUCCEEDED_VERIFIED');
  });
  // The pre-fix defect-evidence case was removed after R2-I-01; the cases above guard the regression.
});
