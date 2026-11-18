import { describe, expect, it, vi } from 'vitest';
import type { ActionActor, ActionProposal } from '../../domain/governed-action/governed-action.types';
import type { ActionStore } from '../../ports/governed-action';
import { createSyntheticActionPorts } from '../../infra/governed-action/synthetic-runtime';
import { DenyAllActionPolicy, DisabledExecutor } from '../../infra/governed-action/defaults';
import { GovernedActionService, type GovernedActionDeps } from './governed-action.service';

const WS = 'ws-a';
const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: WS };
const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId: WS };
const carol: ActionActor = { kind: 'human', id: 'carol', workspaceId: WS };
const drafter: ActionActor = { kind: 'ai', id: 'ai-drafter', workspaceId: WS };
const outsider: ActionActor = { kind: 'human', id: 'bob', workspaceId: 'ws-b' };
const svc: ActionActor = { kind: 'service', id: 'svc', workspaceId: WS };
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const CAP = 'ads.campaign.budget.update';
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });

function harness(overrides: Partial<GovernedActionDeps> = {}, enabled = [{ workspaceId: WS, capabilityId: CAP }]) {
  let now = new Date('2026-11-18T09:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const ports = createSyntheticActionPorts({
    enabled, clock: clock.now, actors: [alice, bob, carol, drafter, outsider, svc],
    policy: {
      constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: ['acct-protected'], approvalTtlMs: 15 * 60_000 },
      proposers: '*', approvers: ['alice', 'bob'], executors: ['alice', 'bob'], serviceExecutors: ['svc'],
      readers: '*', housekeepers: ['alice'],
    },
  });
  ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
  const execute = vi.spyOn(ports.executor, 'execute');
  const mayApprove = vi.spyOn(ports.policy, 'mayApprove');
  const service = new GovernedActionService({ ...ports, clock, executionTimeoutMs: 50, readbackTimeoutMs: 50, ...overrides });
  const propose = (actor: ActionActor = alice, args: unknown = budget('110000'), extra: Partial<{ requestKey: string; target: typeof target }> = {}) =>
    service.propose(actor, { requestKey: extra.requestKey ?? `rk-${Math.random()}`, capabilityId: CAP, target: extra.target ?? target, arguments: args, rationale: 'synthetic test' });
  const previewed = async (actor: ActionActor = alice, args?: unknown) => {
    const p = await propose(actor, args);
    return service.preview(alice, p.id);
  };
  const authorizeAs = (actor: ActionActor, p: ActionProposal) => service.authorize(actor, p.id, {
    reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'reviewed',
  });
  return { service, ports, execute, mayApprove, propose, previewed, authorizeAs, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

const code = (promise: Promise<unknown>) => promise.then(() => 'RESOLVED', (e: { code?: string }) => e.code ?? String(e));

describe('GovernedActionService — authorization (I-03, PM-1 seam)', () => {
  it('runs the full synthetic happy path and audits every transition append-only', async () => {
    const h = harness();
    const p = await h.previewed();
    expect(p.preview?.beforeState).toMatchObject({ status: 'OBSERVED', synthetic: true });
    expect(p.preview?.changes).toEqual([{ path: 'dailyBudget', before: budget('100000').dailyBudget, beforeKnown: true, after: budget('110000').dailyBudget }]);
    const authorized = await h.authorizeAs(bob, p);
    expect(authorized.approval).toMatchObject({ approver: { kind: 'human', id: 'bob' }, argumentDigest: p.argumentDigest, consumed: false });
    expect(h.mayApprove).toHaveBeenCalledWith(bob, expect.objectContaining({ workspaceId: WS, capabilityId: CAP }));
    const done = await h.service.execute(alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');
    expect(done.outcome?.verification?.observation).toBe('EXECUTED');
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute.mock.calls[0][0]).toMatchObject({ idempotencyKey: `ga-${p.id}-1`, attempt: 1, argumentDigest: p.argumentDigest });
    expect(h.ports.ledger.state({ workspaceId: WS, target })).toEqual(budget('110000'));
    const events = await h.service.history(alice, p.id);
    expect(events.map((e) => [e.sequence, e.type, e.fromState, e.toState])).toEqual([
      [1, 'PROPOSED', null, 'PROPOSED'], [2, 'PREVIEWED', 'PROPOSED', 'PREVIEWED'], [3, 'AUTHORIZED', 'PREVIEWED', 'AUTHORIZED'],
      [4, 'EXECUTION_STARTED', 'AUTHORIZED', 'EXECUTING'], [5, 'OUTCOME_RECORDED', 'EXECUTING', 'SUCCEEDED_VERIFIED'],
    ]);
    expect(events.every((e) => e.actor.id && e.at && e.reason)).toBe(true);
    expect(Object.isFrozen(done.arguments)).toBe(true);
  });

  it('AI may draft but can never authorize or execute; a distinct human can authorize the draft', async () => {
    const h = harness();
    const p = await h.previewed(drafter);
    expect((await h.service.history(alice, p.id))[0].data).toMatchObject({ draft: true });
    expect(await code(h.authorizeAs(drafter, p))).toBe('AI_CANNOT_AUTHORIZE');
    const authorized = await h.authorizeAs(bob, p);
    expect(await code(h.service.execute(drafter, p.id))).toBe('AI_CANNOT_EXECUTE');
    expect(h.execute).not.toHaveBeenCalled();
    const refusals = await h.service.refusals(alice, p.id);
    expect(refusals.map((r) => r.code)).toEqual(['AI_CANNOT_AUTHORIZE', 'AI_CANNOT_EXECUTE']);
    expect((await h.service.get(alice, p.id)).state).toBe(authorized.state);
  });

  it('denies self-approval (separation of duties) and approvers without authority', async () => {
    const h = harness();
    const p = await h.previewed(alice);
    expect(await code(h.authorizeAs(alice, p))).toBe('SELF_APPROVAL_DENIED');
    expect(await code(h.authorizeAs(carol, p))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(await code(h.authorizeAs(svc, p))).toBe('HUMAN_APPROVER_REQUIRED');
    expect((await h.service.get(alice, p.id)).state).toBe('PREVIEWED');
  });

  it('fails closed when the policy port is unavailable', async () => {
    const h = harness();
    vi.spyOn(h.ports.policy, 'mayApprove').mockRejectedValue(new Error('policy down'));
    const p = await h.previewed();
    expect(await code(h.authorizeAs(bob, p))).toBe('ACTOR_NOT_AUTHORIZED');
    vi.spyOn(h.ports.policy, 'constraintsFor').mockRejectedValue(new Error('policy down'));
    expect(await code(h.propose())).toBe('POLICY_UNAVAILABLE');
  });

  it('default DenyAll policy and DisabledExecutor make authorization and execution impossible', async () => {
    const h = harness({ policy: new DenyAllActionPolicy() });
    expect(await code(h.propose())).toBe('ACTOR_NOT_AUTHORIZED');
    const disabled = harness({ executor: new DisabledExecutor() });
    const p = await disabled.authorizeAs(bob, await disabled.previewed());
    expect(await code(disabled.service.execute(alice, p.id))).toBe('EXECUTOR_DISABLED');
    expect((await disabled.service.get(alice, p.id)).state).toBe('AUTHORIZED');
  });

  it('refuses capabilities that are not explicitly enabled (all disabled by default)', async () => {
    const h = harness({}, []);
    const p = await h.previewed();
    expect(await code(h.authorizeAs(bob, p))).toBe('CAPABILITY_DISABLED');
  });

  it('approval expires; execution after expiry moves the proposal to EXPIRED without dispatch', async () => {
    const h = harness();
    const p = await h.authorizeAs(bob, await h.previewed());
    h.advance(15 * 60_000 + 1);
    expect(await code(h.service.execute(alice, p.id))).toBe('APPROVAL_EXPIRED');
    expect((await h.service.get(alice, p.id)).state).toBe('EXPIRED');
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('approval binds the reviewed argument digest and preview digest', async () => {
    const h = harness();
    const p = await h.previewed();
    const wrongArgs = h.service.authorize(bob, p.id, { reviewedArgumentDigest: 'f'.repeat(64), reviewedPreviewDigest: p.preview!.previewDigest, reason: 'x' });
    expect(await code(wrongArgs)).toBe('DIGEST_MISMATCH');
    const fresh = await h.service.get(bob, p.id);
    const stale = h.service.authorize(bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: '0'.repeat(64), reason: 'x' });
    expect(await code(stale)).toBe('PREVIEW_STALE');
    expect(fresh.state).toBe('PREVIEWED');
  });

  it('refuses execution when arguments were tampered with after approval', async () => {
    const h = harness();
    const p = await h.authorizeAs(bob, await h.previewed());
    const store = h.ports.store;
    const tampering: ActionStore = {
      create: (t) => store.create(t), events: (w, id) => store.events(w, id), transition: (v, t) => store.transition(v, t),
      appendRefusal: (r) => store.appendRefusal(r), refusals: (w, id) => store.refusals(w, id),
      get: async (w, id) => {
        const real = await store.get(w, id);
        return real && { ...real, arguments: budget('99999999') };
      },
    };
    const service = new GovernedActionService({ ...h.ports, store: tampering, clock: { now: () => new Date('2026-11-18T09:01:00Z') } });
    expect(await code(service.execute(alice, p.id))).toBe('DIGEST_MISMATCH');
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('enforces the kill switch at authorize time (global and per capability) and fails closed on errors', async () => {
    const h = harness();
    const p = await h.previewed();
    h.ports.killSwitch.engageGlobal();
    expect(await code(h.authorizeAs(bob, p))).toBe('KILL_SWITCH_ENGAGED');
    h.ports.killSwitch.releaseGlobal();
    h.ports.killSwitch.engageCapability(CAP);
    expect(await code(h.authorizeAs(bob, p))).toBe('KILL_SWITCH_ENGAGED');
    h.ports.killSwitch.releaseCapability(CAP);
    vi.spyOn(h.ports.killSwitch, 'status').mockRejectedValueOnce(new Error('flag store down'));
    expect(await code(h.authorizeAs(bob, p))).toBe('KILL_SWITCH_ENGAGED');
    expect((await h.authorizeAs(bob, await h.service.get(bob, p.id))).state).toBe('AUTHORIZED');
  });

  it('isolates workspaces: a foreign actor cannot see, preview, authorize, execute or read history', async () => {
    const h = harness();
    const p = await h.previewed();
    const before = await h.service.history(alice, p.id);
    for (const attempt of [
      h.service.get(outsider, p.id), h.service.preview(outsider, p.id), h.authorizeAs(outsider, p),
      h.service.execute(outsider, p.id), h.service.history(outsider, p.id), h.service.cancel(outsider, p.id, 'x'),
    ]) expect(await code(attempt)).toBe('NOT_FOUND');
    expect(await h.service.history(alice, p.id)).toEqual(before);
  });

  it('enforces the budget delta constraint against the observed baseline, and UNKNOWN baselines fail closed', async () => {
    const h = harness();
    const p = await h.previewed(alice, budget('150000'));
    const refused = h.authorizeAs(bob, p);
    await expect(refused).rejects.toMatchObject({ code: 'CONSTRAINT_VIOLATION', details: ['BUDGET_DELTA_EXCEEDED'] });
    h.ports.verifier.forceUnknown = true;
    const unknown = await h.previewed();
    expect(unknown.preview?.beforeState.status).toBe('UNKNOWN');
    await expect(h.authorizeAs(bob, unknown)).rejects.toMatchObject({ code: 'CONSTRAINT_VIOLATION', details: ['BUDGET_BASELINE_UNKNOWN'] });
  });

  it('re-checks constraints at execute time when policy tightens after approval', async () => {
    const h = harness();
    const p = await h.authorizeAs(bob, await h.previewed());
    vi.spyOn(h.ports.policy, 'constraintsFor').mockResolvedValue({ maxBudgetDeltaPercent: 5, protectedAccountIds: [], approvalTtlMs: 60_000 });
    await expect(h.service.execute(alice, p.id)).rejects.toMatchObject({ code: 'CONSTRAINT_VIOLATION', details: ['BUDGET_DELTA_EXCEEDED'] });
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('refuses actions against protected accounts at proposal time', async () => {
    const h = harness();
    await expect(h.propose(alice, budget('100000'), { target: { ...target, accountId: 'acct-protected' } }))
      .rejects.toMatchObject({ code: 'CONSTRAINT_VIOLATION', details: ['PROTECTED_ACCOUNT: acct-protected'] });
  });

  it('treats requestKey as tenant-scoped idempotent proposal creation', async () => {
    const h = harness();
    const first = await h.propose(alice, budget('110000'), { requestKey: 'same' });
    const again = await h.propose(alice, budget('110000'), { requestKey: 'same' });
    expect(again.id).toBe(first.id);
    expect(await code(h.propose(alice, budget('120000'), { requestKey: 'same' }))).toBe('REQUEST_KEY_CONFLICT');
  });

  it('supports reject, cancel (by proposer incl. AI draft) and expiry housekeeping', async () => {
    const h = harness();
    const rejected = await h.service.reject(bob, (await h.previewed()).id, 'not now');
    expect(rejected.state).toBe('REJECTED');
    expect(await code(h.service.execute(alice, rejected.id))).toBe('INVALID_TRANSITION');
    const draft = await h.propose(drafter);
    expect(await code(h.service.cancel(carol, draft.id, 'x'))).toBe('ACTOR_NOT_AUTHORIZED');
    expect((await h.service.cancel(drafter, draft.id, 'withdrawn')).state).toBe('CANCELLED');
    const stale = await h.propose();
    expect(await code(h.service.expire(alice, stale.id))).toBe('INVALID_TRANSITION');
    h.advance(24 * 60 * 60_000);
    expect((await h.service.expire(alice, stale.id)).state).toBe('EXPIRED');
    expect(await code(h.service.propose(alice, { requestKey: 'u', capabilityId: 'ads.unknown', target, arguments: {}, rationale: 'x' }))).toBe('UNKNOWN_CAPABILITY');
  });
});
