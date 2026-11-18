import { describe, expect, it } from 'vitest';
import { advanceContinuity, initialContinuity, reconcileGapBySnapshot, type ContinuityInput, type ContinuityState } from './continuity';
import { analyzeReadback, type ReadbackCollection } from './history-readback';
import { emptyLedger, ledgerSnapshot, recordSighting, type SightingInput } from './message-ledger';
import { classifyLifecycleFrame, transportSignalToInput } from './message-lifecycle';
import type { CaptureContext } from './phoenix-observer';

/**
 * Independent QA (R2, Subagent I) — Pancake lifecycle probes. `it.fails` = reproduced DEFECT
 * asserting the expected behaviour (flip to `it` once fixed).
 */
const scope = { workspaceId: 'synthetic-workspace', connectionId: 'synthetic-connection', accountId: 'synthetic-account', providerSurface: 'pancake-conversations' as const };
const at = (second: number) => new Date(Date.parse('2026-11-18T03:00:00.000Z') + second * 1000).toISOString();
const context: CaptureContext = { scope, allowedPageIds: ['p-1'], captureId: 'c', sourceRevision: 'synthetic-v1', observedAt: at(0), direction: 'received' };
const step = (state: ContinuityState, input: ContinuityInput) => advanceContinuity(state, input).state;
const signal = (raw: unknown[], second: number) => {
  const result = classifyLifecycleFrame(JSON.stringify(raw), { ...context, observedAt: at(second) });
  if (result.kind !== 'transport') throw new Error('fixture');
  const input = transportSignalToInput(result.signal, at(second));
  if (!input) throw new Error('fixture');
  return input;
};
const join = (second: number) => signal(['j', 'r', 'pages:p-1', 'phx_reply', { status: 'ok', response: {} }], second);
const heartbeatReply = (second: number) => signal([null, '7', 'phoenix', 'phx_reply', { status: 'ok', response: {} }], second);
const full = (collection: ReadbackCollection, itemIds: string[], second: number) => analyzeReadback(collection, [
  { status: 'ok', readerId: 'r-1', offset: 0, fetchedAt: at(second), itemIds },
  { status: 'ok', readerId: 'r-1', offset: itemIds.length, fetchedAt: at(second + 1), itemIds: [] },
]);
const snapshot = (second: number) => [full({ pageId: 'p-1', kind: 'conversations', conversationId: null }, ['conv-1'], second),
  full({ pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' }, ['m-1', 'm-2'], second)];

function erroredThenHeartbeat(): ContinuityState {
  let state = step(initialContinuity(scope), join(0));
  state = step(state, signal(['j', 'r', 'pages:p-1', 'phx_error', {}], 20));
  return step(state, heartbeatReply(30));
}

describe('R2 independent QA — gap windows are not bounded by non-join replies', () => {
  // DEFECT R2-I-03: message-lifecycle.ts maps ANY phx_reply{status:ok} to 'joined', including the
  // Phoenix heartbeat reply on topic 'phoenix', so the gap is bounded and a snapshot taken before the
  // real rejoin is accepted as reconciling it.
  it.fails('a heartbeat reply after phx_error does not bound the open gap', () => {
    const state = erroredThenHeartbeat();
    expect(state.gaps[0].end).toBeNull();
    expect(state.status).not.toBe('connected');
  });

  it.fails('a snapshot taken after a heartbeat reply (before any rejoin) cannot reconcile the gap', () => {
    const state = erroredThenHeartbeat();
    expect(reconcileGapBySnapshot(state, 'gap-1', ['p-1'], snapshot(40)).evaluation.eligible).toBe(false);
  });

  it('evidence of current behaviour: heartbeat bounds the gap and the snapshot reconciles it', () => {
    const state = erroredThenHeartbeat();
    expect(state.gaps[0].end).toBe(at(30));
    expect(state.status).toBe('connected');
    expect(reconcileGapBySnapshot(state, 'gap-1', ['p-1'], snapshot(40)).evaluation.eligible).toBe(true);
  });
});

const base: CaptureContext = { ...context, observedAt: '2026-11-18T00:00:00.000Z' };
const t = (second: number) => new Date(Date.parse(base.observedAt) + second * 1000).toISOString();
function sighting(captureId: string, second: number, body: string): SightingInput {
  const result = classifyLifecycleFrame(JSON.stringify([null, null, 'pages:p-1', 'pages:update_messages', { conversation_id: 'conv-1', messages: [{ id: 'm-1', message: body }] }]),
    { ...base, captureId, observedAt: t(second) });
  if (result.kind !== 'message-metadata') throw new Error('fixture');
  return { captureId, observedAt: t(second), label: result.label, message: result.messages[0] };
}

describe('R2 independent QA — ledger ordering determinism', () => {
  // DEFECT R2-I-04: message-ledger.ts returns 'duplicate-capture' on a captureId match without comparing
  // contentHash/observedAt, so two conflicting replays of the same captureId yield order-dependent state.
  it.fails('same captureId with different content yields the same ledger regardless of arrival order', () => {
    const a = sighting('cap', 1, 'a');
    const b = sighting('cap', 2, 'b');
    const ab = recordSighting(recordSighting(emptyLedger(), a).state, b).state;
    const ba = recordSighting(recordSighting(emptyLedger(), b).state, a).state;
    expect(ledgerSnapshot(ab)).toEqual(ledgerSnapshot(ba));
  });

  it('evidence of current behaviour: conflicting replay is silently classified duplicate-capture', () => {
    const a = sighting('cap', 1, 'a');
    const b = sighting('cap', 2, 'b');
    expect(recordSighting(recordSighting(emptyLedger(), a).state, b).disposition).toBe('duplicate-capture');
  });
});
