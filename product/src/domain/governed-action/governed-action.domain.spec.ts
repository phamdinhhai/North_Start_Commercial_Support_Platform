import { describe, expect, it } from 'vitest';
import { argumentsIntact, canonicalJson, freezeArguments, sha256Hex } from './canonical-json';
import { evaluateConstraints } from './action-constraints';
import {
  authorize, beginExecution, markStaleExecution, preview, propose, recordExecutionResult, recordVerification,
  type ExecutionFacts, type PolicyFacts,
} from './action-lifecycle';
import { PRODUCTION_CAPABILITY_CATALOG, parseMoney, validateArguments } from './capability-catalog';
import { SYNTHETIC_CAPABILITY_CATALOG } from './testing/synthetic-capabilities.fixture';
import type { ActionProposal, ObservedState, Verification } from './governed-action.types';

const NOW = new Date('2026-11-18T09:00:00.000Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
const findCapability = (id: string) => SYNTHETIC_CAPABILITY_CATALOG.find(id);
const budgetCap = findCapability('ads.campaign.budget.update')!;
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const constraints = { maxBudgetDeltaPercent: 20, protectedAccountIds: ['acct-x'], approvalTtlMs: 600_000 };
const money = (amountMinor: string, currency = 'VND') => ({ amountMinor, currency });
const observed = (amount: string): ObservedState => ({ status: 'OBSERVED', value: { dailyBudget: money(amount) }, synthetic: true });
const facts: PolicyFacts = { authority: { allowed: true }, capabilityEnabled: true, killSwitch: { engaged: false }, constraintViolations: [] };
const execFacts: ExecutionFacts = { ...facts, executorEnabled: true, currentState: observed('100') };
const housekeeper = { actor: { kind: 'human' as const, id: 'ops' }, authorityAllowed: true, trigger: 'command' as const };
const verification = (observation: Verification['observation']): Verification => ({ observation, evidence: null, observedAt: NOW.toISOString(), reason: observation });

function proposed(proposerKind: 'human' | 'ai' = 'human'): ActionProposal {
  return propose({
    id: 'p-1', workspaceId: 'ws', requestKey: 'rk', capability: budgetCap, target, arguments: { dailyBudget: money('110') },
    proposer: { kind: proposerKind, id: 'alice' }, rationale: 'why', constraints, constraintViolations: [], ttlMs: 3_600_000,
  }, NOW).proposal;
}
function authorized(): ActionProposal {
  const p = preview(proposed(), { actor: { kind: 'human', id: 'alice' }, beforeState: observed('100') }, NOW).proposal;
  return authorize(p, { approver: { kind: 'human', id: 'bob' }, reviewedArgumentDigest: p.argumentDigest,
    reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok', facts }, NOW).proposal;
}
const throwsCode = (fn: () => unknown, code: string) => expect(fn).toThrow(expect.objectContaining({ code }));

describe('canonical JSON + digest', () => {
  it('is key-order independent, array-order sensitive and stable', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: 'x' } })).toBe('{"a":{"c":"x","d":[2,1]},"b":1}');
    expect(freezeArguments({ b: 1, a: 2 }).digest).toBe(freezeArguments({ a: 2, b: 1 }).digest);
    expect(freezeArguments([1, 2]).digest).not.toBe(freezeArguments([2, 1]).digest);
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(canonicalJson(-0)).toBe('0');
  });
  it('rejects non-JSON values instead of silently coercing them', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    for (const bad of [undefined, () => 1, NaN, Infinity, 1n, new Date(), new Map(), { a: undefined }, cyclic, Symbol('s')]) {
      throwsCode(() => canonicalJson(bad), 'INVALID_ARGUMENTS');
    }
    throwsCode(() => canonicalJson('x'.repeat(70_000)), 'INVALID_ARGUMENTS');
  });
  it('freezes a detached copy and detects tampering', () => {
    const source = { dailyBudget: money('1') };
    const f = freezeArguments(source);
    source.dailyBudget.amountMinor = '999';
    expect(f.arguments).toEqual({ dailyBudget: money('1') });
    expect(Object.isFrozen((f.arguments as { dailyBudget: object }).dailyBudget)).toBe(true);
    expect(argumentsIntact({ arguments: f.arguments, canonicalArguments: f.canonical, argumentDigest: f.digest })).toBe(true);
    expect(argumentsIntact({ arguments: { dailyBudget: money('2') }, canonicalArguments: f.canonical, argumentDigest: f.digest })).toBe(false);
  });
});

describe('capability catalog', () => {
  it('A-M3: the production catalog ships empty (deny-all); research examples exist only in the test fixture', () => {
    expect(PRODUCTION_CAPABILITY_CATALOG.entries).toEqual([]);
    for (const id of ['pancake.message.send', 'ads.campaign.budget.update', 'ads.campaign.status.update', 'ads.offline_conversion.upload', 'pos.order.create']) {
      expect(PRODUCTION_CAPABILITY_CATALOG.find(id)).toBeUndefined();
      expect(SYNTHETIC_CAPABILITY_CATALOG.find(id)).toBeDefined();
    }
  });
  it('declares every fixture capability as data, consequential and disabled by default', () => {
    const entries = SYNTHETIC_CAPABILITY_CATALOG.entries;
    expect(entries.every((c) => c.enabledByDefault === false && c.consequential && Object.isFrozen(c))).toBe(true);
  });
  it('validates exact argument shapes and integer minor-unit money', () => {
    expect(validateArguments(budgetCap, { dailyBudget: money('100') })).toEqual([]);
    expect(validateArguments(budgetCap, { dailyBudget: { amountMinor: 1.5, currency: 'VND' }, extra: 1 }))
      .toEqual(['unexpected argument: extra', 'invalid money: dailyBudget']);
    expect(validateArguments(findCapability('pancake.message.send')!, {})).toEqual(['missing argument: draftRef']);
    expect(parseMoney(money('007'))).toBeUndefined();
    expect(parseMoney(money('12', 'vnd'))).toBeUndefined();
  });
});

describe('constraints', () => {
  const input = (amount: string, before?: ObservedState, stage: 'propose' | 'authorize' = 'authorize') =>
    evaluateConstraints({ capability: budgetCap, target, arguments: { dailyBudget: money(amount) }, constraints, beforeState: before, stage });
  it('applies the budget delta limit exactly at the boundary', () => {
    expect(input('120', observed('100'))).toEqual([]);
    expect(input('80', observed('100'))).toEqual([]);
    expect(input('121', observed('100'))).toEqual(['BUDGET_DELTA_EXCEEDED']);
    expect(input('79', observed('100'))).toEqual(['BUDGET_DELTA_EXCEEDED']);
  });
  it('fails closed on unknown baselines, currency mismatch, zero baseline and missing limits', () => {
    expect(input('120')).toEqual(['BUDGET_BASELINE_UNKNOWN']);
    expect(input('120', { status: 'UNKNOWN', reason: 'x' })).toEqual(['BUDGET_BASELINE_UNKNOWN']);
    expect(input('120', { status: 'OBSERVED', value: { dailyBudget: money('100', 'USD') }, synthetic: true })).toEqual(['BUDGET_CURRENCY_MISMATCH']);
    expect(input('1', observed('0'))).toEqual(['BUDGET_BASELINE_ZERO']);
    expect(input('120', undefined, 'propose')).toEqual([]);
    expect(evaluateConstraints({ capability: budgetCap, target: { ...target, accountId: 'acct-x' }, arguments: { dailyBudget: money('1') },
      constraints: { protectedAccountIds: ['acct-x'], approvalTtlMs: 1 }, stage: 'propose' })).toEqual(['PROTECTED_ACCOUNT: acct-x', 'BUDGET_LIMIT_UNDEFINED']);
  });
});

describe('lifecycle state machine', () => {
  it('freezes arguments and digest at proposal and starts at version 1', () => {
    const p = proposed();
    expect(p).toMatchObject({ state: 'PROPOSED', version: 1, attempts: 0, idempotencyKey: 'ga-p-1', argumentDigest: sha256Hex(p.canonicalArguments) });
    expect(Object.isFrozen(p)).toBe(true);
    throwsCode(() => propose({ ...{ id: 'p', workspaceId: 'ws', requestKey: 'r', capability: budgetCap, target: { ...target, resourceType: 'order' },
      arguments: { dailyBudget: money('1') }, proposer: { kind: 'human', id: 'a' }, rationale: 'x', constraints, constraintViolations: [], ttlMs: 60_000 } }, NOW), 'INVALID_INPUT');
  });
  it('requires a human, distinct, authorized approver bound to the reviewed digests', () => {
    const p = preview(proposed('ai'), { actor: { kind: 'ai', id: 'alice' }, beforeState: observed('100') }, NOW).proposal;
    const base = { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: p.preview!.previewDigest, reason: 'ok', facts };
    throwsCode(() => authorize(p, { ...base, approver: { kind: 'ai', id: 'other-ai' } }, NOW), 'AI_CANNOT_AUTHORIZE');
    throwsCode(() => authorize(p, { ...base, approver: { kind: 'human', id: 'alice' } }, NOW), 'SELF_APPROVAL_DENIED');
    throwsCode(() => authorize(p, { ...base, approver: { kind: 'human', id: 'bob' }, facts: { ...facts, authority: { allowed: false } } }, NOW), 'ACTOR_NOT_AUTHORIZED');
    throwsCode(() => authorize(p, { ...base, approver: { kind: 'human', id: 'bob' } }, later(3_600_000)), 'PROPOSAL_EXPIRED');
    const ok = authorize(p, { ...base, approver: { kind: 'human', id: 'bob' } }, NOW);
    expect(ok.proposal.approval?.expiresAt).toBe(later(600_000).toISOString());
    expect(ok.event).toMatchObject({ sequence: 3, type: 'AUTHORIZED', fromState: 'PREVIEWED', toState: 'AUTHORIZED' });
  });
  it('consumes the approval on execution start and never allows a second start', () => {
    const started = beginExecution(authorized(), { actor: { kind: 'human', id: 'alice' }, facts: execFacts }, NOW).proposal;
    expect(started).toMatchObject({ state: 'EXECUTING', attempts: 1, approval: { consumed: true } });
    throwsCode(() => beginExecution(started, { actor: { kind: 'human', id: 'alice' }, facts: execFacts }, NOW), 'EXECUTION_IN_FLIGHT');
    throwsCode(() => beginExecution(authorized(), { actor: { kind: 'human', id: 'a' }, facts: { ...execFacts, killSwitch: { engaged: true } } }, NOW), 'KILL_SWITCH_ENGAGED');
    throwsCode(() => beginExecution(authorized(), { actor: { kind: 'human', id: 'a' }, facts: { ...execFacts, executorEnabled: false } }, NOW), 'EXECUTOR_DISABLED');
    throwsCode(() => beginExecution(authorized(), { actor: { kind: 'human', id: 'a' }, facts: execFacts }, later(600_000)), 'APPROVAL_EXPIRED');
  });
  it('maps executor claims plus readback to outcomes; UNKNOWN only resolves through verification', () => {
    const started = beginExecution(authorized(), { actor: { kind: 'human', id: 'a' }, facts: execFacts }, NOW).proposal;
    const outcome = (s: 'APPLIED' | 'NOT_APPLIED' | 'UNKNOWN', v?: Verification) =>
      recordExecutionResult(started, { executorStatus: s, reason: s, verification: v }, NOW).proposal.state;
    expect(outcome('APPLIED', verification('EXECUTED'))).toBe('SUCCEEDED_VERIFIED');
    expect(outcome('NOT_APPLIED', verification('NOT_EXECUTED'))).toBe('FAILED_VERIFIED');
    expect(outcome('APPLIED', verification('NOT_EXECUTED'))).toBe('UNKNOWN');
    expect(outcome('NOT_APPLIED', verification('EXECUTED'))).toBe('UNKNOWN');
    expect(outcome('APPLIED')).toBe('UNKNOWN');
    const unknown = recordExecutionResult(started, { executorStatus: 'UNKNOWN', reason: 'timeout' }, NOW).proposal;
    throwsCode(() => beginExecution(unknown, { actor: { kind: 'human', id: 'a' }, facts: execFacts }, NOW), 'OUTCOME_UNKNOWN_RETRY_REFUSED');
    const granted = { allowed: true, serviceGrant: true };
    expect(recordVerification(unknown, { actor: { kind: 'service', id: 's' }, verification: verification('UNKNOWN'), authority: granted }, NOW).proposal.state).toBe('UNKNOWN');
    expect(recordVerification(unknown, { actor: { kind: 'service', id: 's' }, verification: verification('EXECUTED'), authority: granted }, NOW).proposal.state).toBe('SUCCEEDED_VERIFIED');
    throwsCode(() => markStaleExecution(started, { ...housekeeper, leaseMs: 60_000 }, later(59_999)), 'EXECUTION_IN_FLIGHT');
    expect(markStaleExecution(started, { ...housekeeper, leaseMs: 60_000 }, later(60_000)).proposal.state).toBe('UNKNOWN');
  });
});
