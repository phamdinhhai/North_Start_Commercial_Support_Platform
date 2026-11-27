import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import { createAssertion, type AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
import { canonicalJson } from '../../domain/governed-action/canonical-json';
import type { ActionActor, Transition } from '../../domain/governed-action/governed-action.types';
import type { ActionStore, AssertionSink } from '../../ports/governed-action';
import type { SqlExecutor } from '../postgres/postgres.service';
import { validDeliveryEnvelope } from './assertion-envelope.validation';
import { InMemoryAssertionSink } from './commercial-evidence';
import { InMemoryActionStore } from './in-memory-action.store';
import { PgAssertionDelivery, PgAssertionInbox } from './pg-assertion-delivery';
import { createSyntheticActionPorts } from './synthetic-runtime';

const WS = 'ws-delivery';
const CAP = 'ads.campaign.budget.update';
const target = { provider: 'synthetic-ads', accountId: 'acct-1', resourceType: 'campaign', resourceId: 'cmp-1' };
const budget = (amountMinor: string) => ({ dailyBudget: { amountMinor, currency: 'VND' } });
const opts = { batchSize: 2, maxAttempts: 2, leaseMs: 1_000, timeoutMs: 5, backoffMs: 1 };
const envelope = (over: Partial<Parameters<typeof createAssertion>[0]> = {}) => createAssertion({
  workspaceId: 'ws', subjectType: 'lead', subjectId: 'l', eventType: 'ACTION_OUTCOME_OBSERVED', value: 'EXECUTED',
  acquisitionMode: 'observed', sourceSystem: 'synthetic-ads', sourceActor: 'governed-action-readback', createdBy: 'governed-action-runtime',
  capturedAt: '2026-11-26T00:00:00.000Z', ingestedAt: '2026-11-26T00:00:01.000Z',
  rawPayloadHash: 'hmac-sha256-v1:test-kid:' + 'a'.repeat(64),
  rawPayloadDigest: { algorithm_version: 'hmac-sha256-v1', kid: 'test-kid', value: 'a'.repeat(64) }, ...over,
});

function fixture(value: unknown = envelope(), attempts = 1, leaseToken = 'token-1') {
  const e = value as ReturnType<typeof envelope>;
  const row = { workspace_id: 'ws', assertion_id: e?.assertionId ?? randomUUID(), envelope: value, attempts, lease_token: leaseToken };
  const query = vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [row], rowCount: 1 }).mockResolvedValue({ rows: [], rowCount: 1 });
  return { db: { query } as unknown as SqlExecutor, query, row };
}

class TransactionalOutboxDouble implements ActionStore {
  readonly durableAssertions = true;
  private readonly inner = new InMemoryActionStore();
  readonly outbox: { readonly proposalId: string; readonly sequence: number; readonly envelope: AssertionEnvelope }[] = [];
  failOutbox = false;

  create(t: Transition) { return this.inner.create(t); }
  get(w: string, id: string) { return this.inner.get(w, id); }
  events(w: string, id: string) { return this.inner.events(w, id); }
  appendRefusal(r: Parameters<ActionStore['appendRefusal']>[0]) { return this.inner.appendRefusal(r); }
  refusals(w: string, id: string) { return this.inner.refusals(w, id); }
  appendProposalRefusal(r: Parameters<ActionStore['appendProposalRefusal']>[0]) { return this.inner.appendProposalRefusal(r); }
  proposalRefusals(w: string) { return this.inner.proposalRefusals(w); }

  async transition(expectedVersion: number, t: Transition, assertion?: AssertionEnvelope): Promise<void> {
    if (assertion && this.failOutbox) throw new Error('OUTBOX_WRITE_FAILED');
    await this.inner.transition(expectedVersion, t);
    if (assertion) this.outbox.push({ proposalId: t.proposal.id, sequence: t.event.sequence, envelope: structuredClone(assertion) });
  }
}

describe('assertion delivery failure boundaries (R3 A-03)', () => {
  it('validates worker options strictly (safe integers, timeout < lease, bounded batch/attempts)', () => {
    const db = { query: vi.fn() } as unknown as SqlExecutor;
    const sink = { emit: vi.fn() };
    for (const bad of [
      { batchSize: 0, maxAttempts: 2, leaseMs: 1000, timeoutMs: 100, backoffMs: 1 },
      { batchSize: 101, maxAttempts: 2, leaseMs: 1000, timeoutMs: 100, backoffMs: 1 },
      { batchSize: 10, maxAttempts: 21, leaseMs: 1000, timeoutMs: 100, backoffMs: 1 },
      { batchSize: 10, maxAttempts: 2, leaseMs: 100, timeoutMs: 100, backoffMs: 1 },
      { batchSize: 10, maxAttempts: 2, leaseMs: 100, timeoutMs: 200, backoffMs: 1 },
      { batchSize: 10, maxAttempts: 2, leaseMs: 1000, timeoutMs: 100, backoffMs: 0 },
    ]) {
      expect(() => new PgAssertionDelivery(db, sink, bad)).toThrow('INVALID_DELIVERY_OPTIONS');
    }
  });

  it('rejects malformed/foreign/inferred payloads without invoking sink', async () => {
    for (const value of [{}, null, { ...envelope(), workspaceId: 'other' }, { ...envelope(), acquisitionMode: 'inferred' },
      { ...envelope(), confidence: {} }, { ...envelope(), createdAt: 'garbage' }, { ...envelope(), evidenceSummary: { bad: [] } }]) {
      const { db, query } = fixture(value);
      const sink = { emit: vi.fn() };
      await new PgAssertionDelivery(db, sink, opts).runOnce();
      expect(sink.emit).not.toHaveBeenCalled();
      expect(query.mock.calls[2][1]).toEqual(expect.arrayContaining(['FAILED', 'INVALID_ENVELOPE']));
    }
  });

  it('times out a hung sink and bounds retry exhaustion', async () => {
    for (const attempts of [1, 2]) {
      const { db, query } = fixture(envelope(), attempts);
      await new PgAssertionDelivery(db, { emit: () => new Promise(() => {}) }, opts).runOnce();
      expect(query.mock.calls[2][1]).toEqual(expect.arrayContaining([attempts === 2 ? 'FAILED' : 'PENDING', 'SINK_TIMEOUT']));
    }
  });

  it('never persists sensitive sink errors and caps ENVELOPE_CONFLICT immediately at FAILED', async () => {
    const { db, query } = fixture();
    await new PgAssertionDelivery(db, { emit: async () => { throw new Error('secret body'); } }, opts).runOnce();
    expect(JSON.stringify(query.mock.calls)).not.toContain('secret body');
    expect(query.mock.calls[2][1]).toContain('SINK_FAILED');

    const conflict = fixture(envelope(), 1);
    await new PgAssertionDelivery(conflict.db, { emit: async () => { throw new Error('ENVELOPE_CONFLICT'); } }, opts).runOnce();
    expect(conflict.query.mock.calls[2][1]).toEqual(expect.arrayContaining(['FAILED', 'ENVELOPE_CONFLICT']));
  });

  it('mints per-row lease tokens in SQL and fences acknowledgement/retry by lease token after ownership loss', async () => {
    const { db, query } = fixture(envelope(), 1, 'row-token-99');
    await new PgAssertionDelivery(db, { emit: async () => {} }, opts).runOnce();
    expect(query.mock.calls[1][0]).toContain('lease_token=gen_random_uuid()');
    expect(query.mock.calls[1][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(query.mock.calls[2][0]).toContain("lease_token=$3 AND status='LEASED'");
    expect(query.mock.calls[2][1]).toEqual(['ws', expect.any(String), 'row-token-99']);
  });

  it('reuses the exact persisted immutable envelope across sink outage, crash-after-sink-before-ack, and restart', async () => {
    const original = Object.freeze(envelope());
    const originalJson = canonicalJson(original as unknown as Record<string, unknown>);
    const inbox = new InMemoryAssertionSink();
    let mode: 'outage' | 'crash-before-ack' | 'healthy' = 'outage';
    const seen: string[] = [];
    const sink: AssertionSink = {
      emit: async (e) => {
        seen.push(canonicalJson(e as unknown as Record<string, unknown>));
        if (mode === 'outage') throw new Error('sink unreachable');
        await inbox.emit(e);
      },
    };
    // 1. Sink outage: fails to PENDING, envelope untouched
    const attempt1 = fixture(structuredClone(original), 1, 'lease-1');
    await new PgAssertionDelivery(attempt1.db, sink, { ...opts, maxAttempts: 4 }).runOnce();
    expect(attempt1.query.mock.calls[2][1]).toEqual(expect.arrayContaining(['PENDING', 'SINK_FAILED']));
    expect(inbox.envelopes).toHaveLength(0);

    // 2. Crash after sink writes to inbox but before outbox ack commits (both ack and fallback fail on lost DB connection)
    mode = 'crash-before-ack';
    const crashQuery = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws', assertion_id: original.assertionId, envelope: structuredClone(original), attempts: 2, lease_token: 'lease-2' }], rowCount: 1 })
      .mockRejectedValue(new Error('connection dropped before ack'));
    await expect(new PgAssertionDelivery({ query: crashQuery } as unknown as SqlExecutor, sink, { ...opts, maxAttempts: 4 }).runOnce())
      .rejects.toThrow('connection dropped before ack');
    expect(inbox.envelopes).toHaveLength(1);

    // 3. Restarted worker reclaims expired lease and replays exact immutable envelope; sink deduplicates
    mode = 'healthy';
    const attempt3 = fixture(structuredClone(original), 3, 'lease-3');
    await new PgAssertionDelivery(attempt3.db, sink, { ...opts, maxAttempts: 4 }).runOnce();
    expect(attempt3.query.mock.calls[2][0]).toContain("SET status='DELIVERED'");
    expect(seen).toEqual([originalJson, originalJson, originalJson]);
    expect(inbox.envelopes).toHaveLength(1);
    await expect(inbox.emit({ ...original, value: 'NOT_EXECUTED' })).rejects.toThrow('ENVELOPE_CONFLICT');
  });

  it('queues terminal observed assertions atomically on both execute and verify, never calls direct sink, and never re-dispatches executor', async () => {
    const alice: ActionActor = { kind: 'human', id: 'alice', workspaceId: WS };
    const bob: ActionActor = { kind: 'human', id: 'bob', workspaceId: WS };
    const store = new TransactionalOutboxDouble();
    const ports = createSyntheticActionPorts({
      clock: () => new Date('2026-11-26T09:00:00.000Z'), store,
      enabled: [{ workspaceId: WS, capabilityId: CAP }],
      policy: { constraints: { maxBudgetDeltaPercent: 20, protectedAccountIds: [], approvalTtlMs: 600_000 }, proposers: '*', approvers: ['bob'], executors: ['alice'] },
    });
    ports.ledger.seed({ workspaceId: WS, target }, budget('100000'));
    const directEmit = vi.spyOn(ports.assertions, 'emit');
    const execSpy = vi.spyOn(ports.executor, 'execute');
    const service = new GovernedActionService({ ...ports, executionTimeoutMs: 30, readbackTimeoutMs: 30 });

    // UNKNOWN outcome queues nothing; resolving via verify queues atomically without touching executor
    ports.executor.behaviour = 'apply-then-hang';
    const p = await service.propose(alice, { requestKey: 'rk-verify', capabilityId: CAP, target, arguments: budget('110000'), rationale: 'r' });
    const pv = await service.preview(alice, p.id);
    await service.authorize(bob, p.id, { reviewedArgumentDigest: p.argumentDigest, reviewedPreviewDigest: pv.preview!.previewDigest, reason: 'ok' });
    expect((await service.execute(alice, p.id)).state).toBe('UNKNOWN');
    expect(store.outbox).toHaveLength(0);
    expect(execSpy).toHaveBeenCalledTimes(1);

    // Outbox failure on verify rolls back terminal transition; proposal stays UNKNOWN
    store.failOutbox = true;
    await expect(service.verify(alice, p.id)).rejects.toThrow('OUTBOX_WRITE_FAILED');
    expect((await store.get(WS, p.id))?.state).toBe('UNKNOWN');
    expect(store.outbox).toHaveLength(0);

    // Recovery of outbox allows verify to commit terminal state + outbox obligation with zero executor calls
    store.failOutbox = false;
    const resolved = await service.verify(alice, p.id);
    expect(resolved.state).toBe('SUCCEEDED_VERIFIED');
    expect(execSpy).toHaveBeenCalledTimes(1);
    expect(directEmit).not.toHaveBeenCalled();
    expect(store.outbox).toHaveLength(1);
    expect(store.outbox[0]).toMatchObject({ proposalId: p.id, sequence: 6 });
    expect(validDeliveryEnvelope(store.outbox[0].envelope, WS, store.outbox[0].envelope.assertionId)).toBe(true);
  });

  it('detects conflicting immutable inbox evidence and has zero ActionExecutor dependency in delivery infrastructure', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(new PgAssertionInbox({ query }).emit(envelope())).rejects.toThrow('ENVELOPE_CONFLICT');
    expect(query).toHaveBeenCalledTimes(2);

    const e = envelope();
    expect(validDeliveryEnvelope(e, 'ws', e.assertionId)).toBe(true);
    expect(validDeliveryEnvelope({ ...e, rawEvidencePointer: 42 }, 'ws', e.assertionId)).toBe(false);
    expect(validDeliveryEnvelope({ ...e, subjectType: 'fake' }, 'ws', e.assertionId)).toBe(false);

    for (const file of ['pg-assertion-delivery.ts', 'assertion-delivery.runner.ts', 'assertion-delivery.ops.ts', 'assertion-envelope.validation.ts']) {
      const src = readFileSync(resolve(__dirname, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(src).not.toMatch(/ActionExecutor|SyntheticExecutor|lead-state|domain\/outcome|pilot-loop/);
    }
  });
});
