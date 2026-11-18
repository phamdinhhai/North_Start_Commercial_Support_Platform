import { describe, expect, it, vi } from 'vitest';
import { attemptHistory, replayLifecycle } from '../../domain/governed-action/action-history';
import { previewDigestOf } from '../../domain/governed-action/action-lifecycle';
import type { ActionActor, ActionPrincipal, ObservedState, PreviewChange } from '../../domain/governed-action/governed-action.types';
import type { ActionStore, PolicyDecision } from '../../ports/governed-action';
import { createSyntheticActionPorts } from '../../infra/governed-action/synthetic-runtime';
import { GovernedActionService, type GovernedActionDeps } from './governed-action.service';

/** Regression tests for the R2 architecture review (A-M1, A-M4, A-m1, A-m2, A-m3) and QA R2-I-14/15. */
const WS = 'ws-a';
const actor = (kind: ActionActor['kind'], id: string): ActionActor => ({ kind, id, workspaceId: WS });
const alice = actor('human', 'alice');
const bob = actor('human', 'bob');
const carol = actor('human', 'carol');
const ops = actor('human', 'ops');
const drafter = actor('ai', 'ai-drafter');
const svc = actor('service', 'svc');
const svcPlain = actor('service', 'svc-plain');
const LEAD = '7f1c2a9e-4b6d-4c1a-9f3e-2d5b8a7c6e10';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const CAP = 'ads.campaign.budget.update';
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });
const code = (promise: Promise<unknown>) => promise.then(() => 'RESOLVED', (e: { code?: string }) => e.code ?? String(e));

function harness(overrides: Partial<GovernedActionDeps> = {}) {
  let now = new Date('2026-11-18T09:00:00.000Z');
  const clock = { now: () => new Date(now) };
  const ports = createSyntheticActionPorts({
    enabled: [{ workspaceId: WS, capabilityId: CAP }], clock: clock.now,
    actors: [alice, bob, carol, ops, drafter, svc, svcPlain],
    policy: {
      constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 15 * 60_000 },
      proposers: '*', approvers: ['bob'], executors: ['alice', 'svc-plain'], serviceExecutors: ['svc'],
      readers: '*', housekeepers: ['ops', 'svc-plain'], leadAccess: { [LEAD]: ['alice', 'bob', 'ops'] },
    },
  });
  ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
  const execute = vi.spyOn(ports.executor, 'execute');
  const readback = vi.spyOn(ports.verifier, 'readback');
  const service = new GovernedActionService({ ...ports, clock, executionTimeoutMs: 30, readbackTimeoutMs: 30, executionLeaseMs: 60_000, ...overrides });
  const propose = (by: ActionPrincipal = alice, extra: { leadId?: string } = {}) => service.propose(by, {
    requestKey: `rk-${Math.random()}`, capabilityId: CAP, target, arguments: budget('110000'), rationale: 'review fix', ...extra,
  });
  const reauthorize = async (id: string) => {
    const p = await service.preview(alice, id);
    return service.authorize(bob, id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok' });
  };
  const authorized = async (extra: { leadId?: string } = {}) => reauthorize((await propose(alice, extra)).id);
  return { service, ports, execute, readback, propose, reauthorize, authorized, advance: (ms: number) => { now = new Date(now.getTime() + ms); } };
}

describe('A-M1 — history alone reconstructs every preview and every attempt (I-05, I-12)', () => {
  it('FAILED_VERIFIED attempt 1 → re-preview → re-authorize → SUCCEEDED attempt 2: both previews and both attempts are recoverable', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'reject';
    const p = await h.authorized();
    expect((await h.service.execute(alice, p.id)).state).toBe('FAILED_VERIFIED');
    h.ports.ledger.seed({ workspaceId: WS, target }, budget('105000'));
    h.ports.executor.behaviour = 'apply';
    await h.reauthorize(p.id);
    const done = await h.service.execute(alice, p.id);
    expect(done.state).toBe('SUCCEEDED_VERIFIED');

    const events = await h.service.history(alice, p.id);
    const previews = events.filter((e) => e.type === 'PREVIEWED');
    expect(previews.map((e) => (e.data.beforeState as { value: unknown }).value)).toEqual([budget('100000'), budget('105000')]);
    for (const e of previews) {
      const recomputed = previewDigestOf(e.data.argumentDigest as string, e.data.beforeState as unknown as ObservedState, e.data.changes as unknown as PreviewChange[]);
      expect(recomputed).toBe(e.data.previewDigest);
    }
    expect(events.filter((e) => e.type === 'AUTHORIZED').map((e) => e.data.previewDigest)).toEqual(previews.map((e) => e.data.previewDigest));

    const attempts = attemptHistory(events);
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ attempt: 1, idempotencyKey: `ga-${p.id}-1`, executorStatus: 'NOT_APPLIED', executorReason: 'SYNTHETIC_REJECTED',
      approvedPreviewDigest: previews[0].data.previewDigest, outcomes: ['FAILED_VERIFIED'] });
    expect(attempts[0].verifications).toEqual([expect.objectContaining({ observation: 'NOT_EXECUTED', reason: 'SYNTHETIC_NO_OPERATION_FOUND',
      evidence: { synthetic: true, idempotencyKey: `ga-${p.id}-1` }, observedAt: expect.any(String) })]);
    expect(attempts[1]).toMatchObject({ attempt: 2, executorStatus: 'APPLIED', providerReference: 'synthetic-op-1',
      approvedPreviewDigest: previews[1].data.previewDigest, outcomes: ['SUCCEEDED_VERIFIED'] });
    expect(attempts[1].verifications[0]).toMatchObject({ observation: 'EXECUTED', evidence: { synthetic: true, reference: 'synthetic-op-1' } });

    const { state, version, attempts: n, preview, approval, execution, outcome } = done;
    expect(replayLifecycle(events)).toEqual({ state, version, attempts: n, preview, approval, execution, outcome });
  });

  it('UNKNOWN resolved by verify keeps the readback evidence and the attempt key in history (R2-I-15 same-attempt key)', async () => {
    const h = harness();
    h.ports.executor.behaviour = 'apply-then-hang';
    const p = await h.authorized();
    expect((await h.service.execute(alice, p.id)).state).toBe('UNKNOWN');
    const verified = await h.service.verify(alice, p.id);
    expect(h.readback.mock.calls.map(([r]) => [r.attempt, r.idempotencyKey])).toEqual([[1, `ga-${p.id}-1`]]);
    const events = await h.service.history(alice, p.id);
    expect(attemptHistory(events)[0]).toMatchObject({ executorStatus: 'UNKNOWN', outcomes: ['UNKNOWN', 'SUCCEEDED_VERIFIED'] });
    expect(replayLifecycle(events)).toMatchObject({ state: verified.state, version: verified.version, outcome: verified.outcome });
  });
});

describe('A-M4 — reads and housekeeping go through the policy; lead scope (I-09)', () => {
  it('get / history / refusals consult ActionPolicy.mayRead and deny by default', async () => {
    const h = harness();
    const p = await h.propose();
    const mayRead = vi.spyOn(h.ports.policy, 'mayRead').mockImplementation(async (a) =>
      (a.id === 'alice' ? { allowed: true } : { allowed: false, reason: 'not a reader' }) as PolicyDecision);
    expect((await h.service.get(alice, p.id)).id).toBe(p.id);
    for (const read of [h.service.get(carol, p.id), h.service.history(carol, p.id), h.service.refusals(carol, p.id)]) {
      expect(await code(read)).toBe('ACTOR_NOT_AUTHORIZED');
    }
    expect(mayRead.mock.calls.map(([a, , c]) => [a.id, c])).toEqual([['alice', 'get'], ['carol', 'get'], ['carol', 'history'], ['carol', 'refusals']]);
    mayRead.mockRejectedValue(new Error('policy down'));
    expect(await code(h.service.get(alice, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
  });

  it('every command on a lead-linked proposal passes the lead-scope hook; out-of-scope actors see NOT_FOUND', async () => {
    const h = harness();
    const hook = vi.spyOn(h.ports.policy, 'mayAccessLead');
    const p = await h.authorized({ leadId: LEAD });
    expect(p.leadId).toBe(LEAD);
    for (const attempt of [h.service.get(carol, p.id), h.service.history(carol, p.id), h.service.preview(carol, p.id), h.service.execute(carol, p.id)]) {
      expect(await code(attempt)).toBe('NOT_FOUND');
    }
    expect(h.execute).not.toHaveBeenCalled();
    expect(await code(h.propose(carol, { leadId: LEAD }))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({ id: 'carol' }), expect.objectContaining({ leadId: LEAD, workspaceId: WS }));
    const denied = (await h.service.refusals(alice, p.id)).filter((r) => r.details.includes('LEAD_SCOPE_DENIED'));
    expect(denied.map((r) => [r.actor.id, r.command])).toEqual([['carol', 'get'], ['carol', 'history'], ['carol', 'preview'], ['carol', 'execute']]);
    expect((await h.service.execute(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
  });

  it('validates leadId as a Stable Lead ID (UUID) at proposal and normalises case', async () => {
    const h = harness();
    expect(await code(h.propose(alice, { leadId: 'lead-123' }))).toBe('INVALID_INPUT');
    expect(await code(h.propose(alice, { leadId: `${LEAD}' OR 1=1` }))).toBe('INVALID_INPUT');
    expect((await h.propose(alice, { leadId: LEAD.toUpperCase() })).leadId).toBe(LEAD);
  });

  it('expire and recover require housekeeping authority; AI may never; the event records the real trigger (A-m3)', async () => {
    const h = harness();
    const housekeep = vi.spyOn(h.ports.policy, 'mayHousekeep');
    const p = await h.propose();
    h.advance(24 * 60 * 60_000);
    expect(await code(h.service.expire(drafter, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(await code(h.service.expire(carol, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(await code(h.service.recoverStaleExecution(drafter, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(await code(h.service.recoverStaleExecution(carol, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(housekeep.mock.calls.every(([a]) => a.kind !== 'ai')).toBe(true);
    expect((await h.service.expire(ops, p.id)).state).toBe('EXPIRED');
    const last = (await h.service.history(alice, p.id)).at(-1)!;
    expect(last).toMatchObject({ type: 'EXPIRED', actor: { kind: 'human', id: 'ops' }, data: { trigger: 'command' } });
  });

  it('A-m3: stale-execution recovery and approval expiry at execute are attributed to the triggering actor', async () => {
    const h = harness();
    const store = h.ports.store;
    const crashing: ActionStore = { ...bind(store), transition: async (v, t) => {
      if (t.event.type === 'OUTCOME_RECORDED' && t.event.reason !== 'EXECUTION_LEASE_EXPIRED') throw new Error('process crashed');
      return store.transition(v, t);
    } };
    const p = await h.authorized();
    const crashy = new GovernedActionService({ ...h.ports, store: crashing, clock: { now: () => new Date('2026-11-18T09:00:00Z') } });
    await expect(crashy.execute(alice, p.id)).rejects.toThrow('process crashed');
    h.advance(60_001);
    expect((await h.service.recoverStaleExecution(svcPlain, p.id)).state).toBe('UNKNOWN');
    expect((await h.service.history(alice, p.id)).at(-1)).toMatchObject({ type: 'OUTCOME_RECORDED', actor: { kind: 'service', id: 'svc-plain' },
      data: { source: 'lease-expired', trigger: 'command', attempt: 1 } });

    const q = await h.authorized();
    h.advance(15 * 60_000 + 1);
    expect(await code(h.service.execute(alice, q.id))).toBe('APPROVAL_EXPIRED');
    expect((await h.service.history(alice, q.id)).at(-1)).toMatchObject({ type: 'EXPIRED', actor: { kind: 'human', id: 'alice' }, data: { trigger: 'execute' } });
  });
});

describe('A-m1 — refusals cannot block legitimate commands', () => {
  it('a burst of refused commands during a legitimate authorize does not make it lose the CAS', async () => {
    const h = harness();
    const p = await h.service.preview(alice, (await h.propose()).id);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const real = h.ports.policy.mayApprove.bind(h.ports.policy);
    vi.spyOn(h.ports.policy, 'mayApprove').mockImplementation(async (a, ctx) => {
      if (a.id === 'bob') await gate;
      return real(a, ctx);
    });
    const legit = h.service.authorize(bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok' });
    for (let i = 0; i < 5; i += 1) {
      expect(await code(h.service.authorize(drafter, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'x' })))
        .toBe('AI_CANNOT_AUTHORIZE');
      expect(await code(h.service.execute(carol, p.id))).toBe('INVALID_TRANSITION');
    }
    release();
    const authorized = await legit;
    expect(authorized).toMatchObject({ state: 'AUTHORIZED', version: 3 });
    const refusals = await h.service.refusals(alice, p.id);
    expect(refusals).toHaveLength(10);
    expect(refusals.every((r) => r.proposalVersion === 2)).toBe(true);
    expect((await h.service.history(alice, p.id)).map((e) => e.sequence)).toEqual([1, 2, 3]);
  });
});

describe('A-m2 — actor kind is server-resolved; service actors need an explicit grant', () => {
  it('ignores a caller-claimed kind: an AI that claims to be human is still refused authority', async () => {
    const h = harness();
    const p = await h.service.preview(alice, (await h.propose()).id);
    const claimsHuman = { kind: 'human', id: 'ai-drafter', workspaceId: WS } as ActionActor;
    const auth = (who: ActionPrincipal) => h.service.authorize(who, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'x' });
    expect(await code(auth(claimsHuman))).toBe('AI_CANNOT_AUTHORIZE');
    expect(await code(auth({ id: 'stranger', workspaceId: WS }))).toBe('ACTOR_NOT_AUTHORIZED');
    vi.spyOn(h.ports.actors, 'resolve').mockResolvedValueOnce({ kind: 'human', id: 'someone-else', workspaceId: WS });
    expect(await code(auth(bob))).toBe('ACTOR_NOT_AUTHORIZED');
    vi.spyOn(h.ports.actors, 'resolve').mockRejectedValueOnce(new Error('identity down'));
    expect(await code(auth(bob))).toBe('ACTOR_NOT_AUTHORIZED');
    expect((await auth(bob)).state).toBe('AUTHORIZED');
  });

  it('a service actor cannot execute or verify unless the policy explicitly grants it (default deny)', async () => {
    const h = harness();
    const p = await h.authorized();
    expect(await code(h.service.execute(svcPlain, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    vi.spyOn(h.ports.policy, 'mayTriggerExecution').mockResolvedValueOnce({ allowed: true });
    expect(await code(h.service.execute(svc, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(h.execute).not.toHaveBeenCalled();
    h.ports.executor.behaviour = 'hang';
    expect((await h.service.execute(svc, p.id)).state).toBe('UNKNOWN');
    expect(await code(h.service.verify(svcPlain, p.id))).toBe('ACTOR_NOT_AUTHORIZED');
    expect(h.readback).not.toHaveBeenCalled();
    expect((await h.service.verify(svc, p.id)).state).toBe('FAILED_VERIFIED');
  });
});

describe('R2-I-14 — execute re-reads the external baseline', () => {
  it('a baseline that moved after approval refuses with PREVIEW_STALE and never dispatches; an unreadable baseline fails closed', async () => {
    const h = harness();
    const p = await h.authorized();
    h.ports.ledger.seed({ workspaceId: WS, target }, budget('50000'));
    expect(await code(h.service.execute(alice, p.id))).toBe('PREVIEW_STALE');
    h.ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
    h.ports.verifier.forceUnknown = true;
    expect(await code(h.service.execute(alice, p.id))).toBe('PREVIEW_STALE');
    expect(h.execute).not.toHaveBeenCalled();
    expect((await h.service.get(alice, p.id)).state).toBe('AUTHORIZED');
    h.ports.verifier.forceUnknown = false;
    expect((await h.service.execute(alice, p.id)).state).toBe('SUCCEEDED_VERIFIED');
  });
});

function bind(store: ActionStore): ActionStore {
  return {
    create: (t) => store.create(t), get: (w, id) => store.get(w, id), transition: (v, t) => store.transition(v, t),
    events: (w, id) => store.events(w, id), appendRefusal: (r) => store.appendRefusal(r), refusals: (w, id) => store.refusals(w, id),
      appendProposalRefusal: (r) => store.appendProposalRefusal(r), proposalRefusals: (w) => store.proposalRefusals(w),
  };
}
