import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { preview, propose, recordRefusal } from '../../domain/governed-action/action-lifecycle';
import { GovernedActionError } from '../../domain/governed-action/governed-action.types';
import { SYNTHETIC_CAPABILITY_CATALOG } from '../../domain/governed-action/testing/synthetic-capabilities.fixture';
import {
  DenyAllActionPolicy, DenyAllActorResolver, DisabledExecutor, StaticActorResolver, StaticCapabilityEnablement, StaticKillSwitch,
} from './defaults';
import { InMemoryActionStore } from './in-memory-action.store';
import { SyntheticExecutor, SyntheticProviderLedger, SyntheticVerifier } from './synthetic-executor';

const NOW = new Date('2026-11-18T09:00:00.000Z');
const target = { provider: 'synthetic-ads', accountId: 'a', resourceType: 'campaign', resourceId: 'c' };
const created = (id = 'p-1', workspaceId = 'ws', requestKey = 'rk') => propose({
  id, workspaceId, requestKey, capability: SYNTHETIC_CAPABILITY_CATALOG.find('ads.campaign.status.update')!, target, arguments: { status: 'PAUSED' },
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
    const previewed = preview(t.proposal, { actor: { kind: 'human', id: 'bob' }, beforeState: { status: 'UNKNOWN', reason: 'x' } }, NOW);
    await store.transition(1, previewed);
    await expect(store.transition(1, previewed)).rejects.toMatchObject({ code: 'CONCURRENT_MODIFICATION' });
    expect((await store.events('ws', 'p-1')).map((e) => e.sequence)).toEqual([1, 2]);
    expect(await store.events('ws-other', 'p-1')).toEqual([]);
    const forged = { ...previewed, proposal: { ...previewed.proposal, version: 3, argumentDigest: 'f'.repeat(64) }, event: { ...previewed.event, sequence: 3 } };
    await expect(store.transition(2, forged)).rejects.toMatchObject({ code: 'DIGEST_MISMATCH' });
  });

  it('A-m1: refusals are appended to a separate log and never bump the proposal version', async () => {
    const store = new InMemoryActionStore();
    const t = created();
    await store.create(t);
    const refusal = recordRefusal(t.proposal, { kind: 'ai', id: 'spam' }, 'authorize', new GovernedActionError('AI_CANNOT_AUTHORIZE', 'x'), NOW);
    for (let i = 0; i < 5; i += 1) await store.appendRefusal(refusal);
    expect((await store.get('ws', 'p-1'))?.version).toBe(1);
    expect(await store.refusals('ws', 'p-1')).toHaveLength(5);
    expect(await store.refusals('ws-other', 'p-1')).toEqual([]);
    await expect(store.appendRefusal({ ...refusal, proposalId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('safe defaults', () => {
  it('DisabledExecutor throws, DenyAll denies, kill switch starts engaged, enablement starts empty', async () => {
    await expect(new DisabledExecutor().execute()).rejects.toThrow(/no executor is enabled/);
    const policy = new DenyAllActionPolicy();
    for (const decision of [await policy.mayPropose(), await policy.mayApprove(), await policy.mayTriggerExecution(),
      await policy.mayRead(), await policy.mayHousekeep(), await policy.mayAccessLead()]) expect(decision.allowed).toBe(false);
    expect(await new DenyAllActorResolver().resolve()).toBeUndefined();
    const resolver = new StaticActorResolver([{ kind: 'ai', id: 'bot', workspaceId: 'ws' }]);
    expect(await resolver.resolve({ id: 'bot', workspaceId: 'ws' })).toEqual({ kind: 'ai', id: 'bot', workspaceId: 'ws' });
    expect(await resolver.resolve({ id: 'bot', workspaceId: 'ws-other' })).toBeUndefined();
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

describe('A-M3: capability scope is not decided in production code (OPEN: LG-1 / MM-1)', () => {
  const SRC = resolve(__dirname, '../..');
  const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.ts$/.test(name) ? [path] : [];
  });

  it('only specs and the synthetic runtime import the synthetic capability fixture; nothing in production imports the synthetic runtime', () => {
    const offenders = files(SRC).filter((f) => !f.endsWith('.spec.ts')).flatMap((f) => {
      const source = readFileSync(f, 'utf8');
      const rel = relative(SRC, f).split(sep).join('/');
      const hits: string[] = [];
      if (/synthetic-capabilities\.fixture/.test(source) && rel !== 'infra/governed-action/synthetic-runtime.ts') hits.push(rel);
      if (/governed-action\/synthetic-runtime|from '\.\/synthetic-runtime'/.test(source)) hits.push(rel);
      return hits;
    });
    expect(offenders).toEqual([]);
  });

  it('migration 011 creates storage only and seeds no capabilities', () => {
    const up = readFileSync(resolve(SRC, '../migrations/011_governed_actions.up.sql'), 'utf8');
    expect(up).not.toMatch(/\bINSERT\b/i);
    for (const id of ['pancake.message.send', 'ads.campaign', 'ads.offline_conversion', 'pos.order']) expect(up).not.toContain(id);
  });
});
