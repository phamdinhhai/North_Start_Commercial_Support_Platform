import { describe, expect, it } from 'vitest';
import { propose, recordRefusal } from '../../domain/governed-action/action-lifecycle';
import { findCapability } from '../../domain/governed-action/capability-catalog';
import { GovernedActionError } from '../../domain/governed-action/governed-action.types';
import { DenyAllActionPolicy, DisabledExecutor, StaticCapabilityEnablement, StaticKillSwitch } from './defaults';
import { InMemoryActionStore } from './in-memory-action.store';
import { SyntheticExecutor, SyntheticProviderLedger, SyntheticVerifier } from './synthetic-executor';

const NOW = new Date('2026-11-18T09:00:00.000Z');
const target = { provider: 'synthetic-ads', accountId: 'a', resourceType: 'campaign', resourceId: 'c' };
const created = (id = 'p-1', workspaceId = 'ws', requestKey = 'rk') => propose({
  id, workspaceId, requestKey, capability: findCapability('ads.campaign.status.update')!, target, arguments: { status: 'PAUSED' },
  proposer: { kind: 'human', id: 'alice' }, rationale: 'r', constraints: { protectedAccountIds: [], approvalTtlMs: 60_000 },
  constraintViolations: [], ttlMs: 60_000,
}, NOW);
const request = { workspaceId: 'ws', proposalId: 'p', capabilityId: 'x', target, arguments: { status: 'PAUSED' }, canonicalArguments: '{"status":"PAUSED"}', argumentDigest: 'd', idempotencyKey: 'ga-p', attempt: 1 };

describe('InMemoryActionStore', () => {
  it('scopes by workspace, de-duplicates request keys per workspace and enforces CAS', async () => {
    const store = new InMemoryActionStore();
    const t = created();
    expect((await store.create(t)).created).toBe(true);
    expect((await store.create(created('p-2'))).proposal.id).toBe('p-1');
    expect((await store.create(created('p-3', 'ws-other'))).created).toBe(true);
    expect(await store.get('ws-other', 'p-1')).toBeUndefined();
    const refusal = recordRefusal(t.proposal, { kind: 'human', id: 'bob' }, 'test', new GovernedActionError('INVALID_INPUT', 'x'), NOW);
    await store.transition(1, refusal);
    await expect(store.transition(1, refusal)).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
    expect((await store.events('ws', 'p-1')).map((e) => e.sequence)).toEqual([1, 2]);
    expect(await store.events('ws-other', 'p-1')).toEqual([]);
    const forged = { ...refusal, proposal: { ...refusal.proposal, version: 3, argumentDigest: 'f'.repeat(64) }, event: { ...refusal.event, sequence: 3 } };
    await expect(store.transition(2, forged)).rejects.toMatchObject({ code: 'DIGEST_MISMATCH' });
  });
});

describe('safe defaults', () => {
  it('DisabledExecutor throws, DenyAll denies, kill switch starts engaged, enablement starts empty', async () => {
    await expect(new DisabledExecutor().execute()).rejects.toThrow(/no executor is enabled/);
    const policy = new DenyAllActionPolicy();
    for (const decision of [await policy.mayPropose(), await policy.mayApprove(), await policy.mayTriggerExecution()]) expect(decision.allowed).toBe(false);
    expect(await policy.constraintsFor()).toMatchObject({ maxBudgetDeltaPercent: 0 });
    expect(await new StaticKillSwitch().status({ capabilityId: 'x' })).toMatchObject({ engaged: true, scope: 'global' });
    expect(await new StaticCapabilityEnablement().isEnabled('ws', 'ads.campaign.budget.update')).toBe(false);
  });
});

describe('Synthetic executor / verifier', () => {
  it('applies idempotently by key and reads back only what happened', async () => {
    const ledger = new SyntheticProviderLedger();
    ledger.seed(request, { status: 'ACTIVE' });
    const executor = new SyntheticExecutor(ledger);
    const verifier = new SyntheticVerifier(ledger, () => NOW);
    expect((await verifier.readback(request)).observation).toBe('NOT_EXECUTED');
    const signal = new AbortController().signal;
    expect(await executor.execute(request, signal)).toMatchObject({ status: 'APPLIED', reason: 'SYNTHETIC_APPLIED' });
    expect(await executor.execute(request, signal)).toMatchObject({ status: 'APPLIED', reason: 'SYNTHETIC_DEDUPLICATED' });
    expect(ledger.appliedCount()).toBe(1);
    expect(await verifier.readback(request)).toMatchObject({ observation: 'EXECUTED', evidence: { synthetic: true } });
    ledger.seed(request, { status: 'ACTIVE' });
    expect((await verifier.readback(request)).observation).toBe('UNKNOWN');
    expect(await verifier.readCurrentState({ ...request, target: { ...target, resourceId: 'none' } })).toEqual({ status: 'UNKNOWN', reason: 'SYNTHETIC_RESOURCE_NOT_SEEDED' });
    executor.behaviour = 'reject';
    expect((await executor.execute(request, signal)).status).toBe('NOT_APPLIED');
    executor.behaviour = 'hang';
    const ac = new AbortController();
    const pending = executor.execute(request, ac.signal);
    ac.abort();
    await expect(pending).rejects.toThrow('aborted');
  });
});
