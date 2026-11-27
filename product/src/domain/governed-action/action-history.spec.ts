import { describe, expect, it } from 'vitest';
import { attemptHistory, replayLifecycle } from './action-history';
import {
  authorize, baselineChanged, beginExecution, expire, markStaleExecution, preview, propose, recordExecutionResult, recordRefusal,
  recordVerification, type ExecutionFacts, type PolicyFacts,
} from './action-lifecycle';
import { GovernedActionError, type ActionEvent, type ActionProposal, type ObservedState, type Transition } from './governed-action.types';
import { SYNTHETIC_CAPABILITY_CATALOG } from './testing/synthetic-capabilities.fixture';

const NOW = new Date('2026-11-18T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const cap = SYNTHETIC_CAPABILITY_CATALOG.find('ads.campaign.budget.update')!;
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const money = (amountMinor: string) => ({ amountMinor, currency: 'VND' });
const observed = (amount: string): ObservedState => ({ status: 'OBSERVED', value: { dailyBudget: money(amount) }, synthetic: true });
const facts: PolicyFacts = { authority: { allowed: true }, capabilityEnabled: true, killSwitch: { engaged: false }, constraintViolations: [] };
const exec = (currentState: ObservedState = observed('100')): ExecutionFacts => ({ ...facts, executorEnabled: true, currentState });
const human = (id: string) => ({ kind: 'human' as const, id });
const throwsCode = (fn: () => unknown, code: string) => expect(fn).toThrow(expect.objectContaining({ code }));

function chain(): { events: ActionEvent[]; last: () => ActionProposal; push: (t: Transition) => ActionProposal } {
  const events: ActionEvent[] = [];
  let current: ActionProposal;
  const push = (t: Transition) => { events.push(t.event); current = t.proposal; return current; };
  push(propose({ id: 'p-1', workspaceId: 'ws', requestKey: 'rk', capability: cap, target, arguments: { dailyBudget: money('110') },
    proposer: human('alice'), rationale: 'why', constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 },
    constraintViolations: [], ttlMs: 3_600_000 }, NOW));
  return { events, last: () => current, push };
}
const approve = (p: ActionProposal) => authorize(p, { approver: human('bob'), reviewedArgumentDigest: p.argumentDigest,
  reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok', facts }, NOW);

describe('A-M1 replay: the projection is a cache derivable from events', () => {
  it('replays a FAILED → re-authorized → SUCCEEDED history to exactly the stored projection', () => {
    const c = chain();
    c.push(preview(c.last(), { actor: human('alice'), beforeState: observed('100') }, NOW));
    c.push(approve(c.last()));
    c.push(beginExecution(c.last(), { actor: human('alice'), facts: exec() }, NOW));
    c.push(recordExecutionResult(c.last(), { executorStatus: 'NOT_APPLIED', reason: 'rejected',
      verification: { observation: 'NOT_EXECUTED', evidence: { probe: 1 }, observedAt: NOW.toISOString(), reason: 'none' } }, NOW));
    c.push(preview(c.last(), { actor: human('alice'), beforeState: observed('105') }, later(1)));
    c.push(approve(c.last()));
    c.push(beginExecution(c.last(), { actor: human('alice'), facts: exec(observed('105')) }, later(2)));
    const done = c.push(recordExecutionResult(c.last(), { executorStatus: 'APPLIED', reason: 'ok', providerReference: 'ref-2',
      verification: { observation: 'EXECUTED', evidence: { probe: 2 }, observedAt: later(3).toISOString(), reason: 'match' } }, later(3)));
    const { state, version, attempts, preview: pv, approval, execution, outcome } = done;
    expect(replayLifecycle(c.events)).toEqual({ state, version, attempts, preview: pv, approval, execution, outcome });
    expect(attemptHistory(c.events).map((a) => [a.idempotencyKey, a.executorStatus, a.providerReference, a.verifications[0].evidence]))
      .toEqual([['ga-p-1-1', 'NOT_APPLIED', undefined, { probe: 1 }], ['ga-p-1-2', 'APPLIED', 'ref-2', { probe: 2 }]]);
  });

  it('detects a history whose preview content no longer matches its digest, or with gaps', () => {
    const c = chain();
    c.push(preview(c.last(), { actor: human('alice'), beforeState: observed('100') }, NOW));
    const forged = { ...c.events[1], data: { ...c.events[1].data, beforeState: observed('999') as never } };
    throwsCode(() => replayLifecycle([c.events[0], forged]), 'INVALID_INPUT');
    throwsCode(() => replayLifecycle([c.events[1]]), 'INVALID_INPUT');
    throwsCode(() => replayLifecycle([c.events[0], { ...c.events[1], sequence: 3 }]), 'INVALID_INPUT');
  });
});

describe('domain guards added by the review', () => {
  it('A-m2: a service actor needs an explicit serviceGrant to start or resolve execution', () => {
    const c = chain();
    c.push(preview(c.last(), { actor: human('alice'), beforeState: observed('100') }, NOW));
    const authorized = c.push(approve(c.last()));
    const svc = { kind: 'service' as const, id: 'svc' };
    throwsCode(() => beginExecution(authorized, { actor: svc, facts: exec() }, NOW), 'ACTOR_NOT_AUTHORIZED');
    const granted = { ...exec(), authority: { allowed: true, serviceGrant: true } };
    const started = beginExecution(authorized, { actor: svc, facts: granted }, NOW).proposal;
    const unknown = recordExecutionResult(started, { executorStatus: 'UNKNOWN', reason: 'timeout' }, NOW).proposal;
    const v = { observation: 'EXECUTED' as const, evidence: null, observedAt: NOW.toISOString(), reason: 'r' };
    throwsCode(() => recordVerification(unknown, { actor: svc, verification: v, authority: { allowed: true } }, NOW), 'ACTOR_NOT_AUTHORIZED');
    throwsCode(() => recordVerification(unknown, { actor: { kind: 'ai', id: 'a' }, verification: v, authority: { allowed: true } }, NOW), 'AI_CANNOT_EXECUTE');
    expect(recordVerification(unknown, { actor: svc, verification: v, authority: { allowed: true, serviceGrant: true } }, NOW).proposal.state)
      .toBe('SUCCEEDED_VERIFIED');
  });

  it('A-m3: expiry and stale recovery record the triggering actor; AI and unauthorised actors are refused', () => {
    const c = chain();
    const p = c.last();
    throwsCode(() => expire(p, { actor: { kind: 'ai', id: 'a' }, authorityAllowed: true, trigger: 'command' }, later(3_600_000)), 'ACTOR_NOT_AUTHORIZED');
    throwsCode(() => expire(p, { actor: human('carol'), authorityAllowed: false, trigger: 'command' }, later(3_600_000)), 'ACTOR_NOT_AUTHORIZED');
    expect(expire(p, { actor: human('ops'), authorityAllowed: true, trigger: 'command' }, later(3_600_000)).event)
      .toMatchObject({ actor: { kind: 'human', id: 'ops' }, data: { trigger: 'command' } });
    expect(expire(p, { actor: { kind: 'system', id: 'sweeper' }, authorityAllowed: false, trigger: 'sweep' }, later(3_600_000)).event.actor)
      .toEqual({ kind: 'system', id: 'sweeper' });
    c.push(preview(p, { actor: human('alice'), beforeState: observed('100') }, NOW));
    c.push(approve(c.last()));
    const started = c.push(beginExecution(c.last(), { actor: human('alice'), facts: exec() }, NOW));
    throwsCode(() => markStaleExecution(started, { actor: { kind: 'ai', id: 'a' }, authorityAllowed: true, trigger: 'command', leaseMs: 1 }, later(5)), 'ACTOR_NOT_AUTHORIZED');
    expect(markStaleExecution(started, { actor: human('ops'), authorityAllowed: true, trigger: 'command', leaseMs: 1 }, later(5)).event.actor)
      .toEqual({ kind: 'human', id: 'ops' });
  });

  it('R2-I-14/15: a moved baseline refuses execution; each attempt has its own idempotency key', () => {
    expect(baselineChanged(observed('100'), observed('100'))).toBe(false);
    expect(baselineChanged(observed('100'), observed('101'))).toBe(true);
    expect(baselineChanged(observed('100'), { status: 'UNKNOWN', reason: 'x' })).toBe(true);
    expect(baselineChanged({ status: 'UNKNOWN', reason: 'a' }, { status: 'UNKNOWN', reason: 'b' })).toBe(false);
    const c = chain();
    c.push(preview(c.last(), { actor: human('alice'), beforeState: observed('100') }, NOW));
    const authorized = c.push(approve(c.last()));
    throwsCode(() => beginExecution(authorized, { actor: human('alice'), facts: exec(observed('50')) }, NOW), 'PREVIEW_STALE');
    expect(beginExecution(authorized, { actor: human('alice'), facts: exec() }, NOW).proposal.execution?.idempotencyKey).toBe('ga-p-1-1');
  });

  it('leadId must be a UUID; refusal records do not advance the proposal version', () => {
    throwsCode(() => propose({ id: 'p', workspaceId: 'ws', requestKey: 'r', capability: cap, target, arguments: { dailyBudget: money('1') },
      proposer: human('a'), rationale: 'x', constraints: { protectedAccountIds: [], approvalTtlMs: 1 }, constraintViolations: [], ttlMs: 60_000,
      leadId: 'lead-1' }, NOW), 'INVALID_INPUT');
    const p = chain().last();
    const r = recordRefusal(p, human('x'), 'authorize', new GovernedActionError('AI_CANNOT_AUTHORIZE', 'no'), NOW);
    expect(r).toMatchObject({ proposalId: 'p-1', proposalVersion: 1, code: 'AI_CANNOT_AUTHORIZE', actor: { kind: 'human', id: 'x' } });
    expect(p.version).toBe(1);
  });
});
