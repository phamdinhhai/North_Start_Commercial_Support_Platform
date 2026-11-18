import { describe, expect, it } from 'vitest';
import { advanceContinuity, initialContinuity, reconcileGapBySnapshot, restoreContinuity, type ContinuityInput, type ContinuityState } from './continuity';
import { analyzeReadback, type ReadbackCollection } from './history-readback';
import { classifyLifecycleFrame, transportSignalToInput } from './message-lifecycle';
import type { CaptureContext } from './phoenix-observer';

const scope = { workspaceId: 'synthetic-workspace', connectionId: 'synthetic-connection', accountId: 'synthetic-account', providerSurface: 'pancake-conversations' as const };
const at = (second: number) => new Date(Date.parse('2026-11-18T03:00:00.000Z') + second * 1000).toISOString();
const context: CaptureContext = { scope, allowedPageIds: ['p-1'], captureId: 'c', sourceRevision: 'synthetic-v1', observedAt: at(0), direction: 'received' };
const step = (state: ContinuityState, input: ContinuityInput) => advanceContinuity(state, input).state;
const observe = (captureId: string, second: number) => {
  const result = classifyLifecycleFrame(JSON.stringify([null, null, 'pages:p-1', 'pages:update_messages', { conversation_id: 'conv-1', messages: [{ id: captureId }] }]),
    { ...context, captureId, observedAt: at(second) });
  if (result.kind !== 'message-metadata') throw new Error('fixture');
  return result.observation;
};
const signal = (raw: unknown[], second: number) => {
  const result = classifyLifecycleFrame(JSON.stringify(raw), { ...context, observedAt: at(second) });
  if (result.kind !== 'transport') throw new Error('fixture');
  const input = transportSignalToInput(result.signal, at(second));
  if (!input) throw new Error('fixture');
  return input;
};
const close = (second: number) => signal(['j', 'r', 'pages:p-1', 'phx_close', {}], second);
const join = (second: number) => signal(['j', 'r', 'pages:p-1', 'phx_reply', { status: 'ok', response: {} }], second);
const expired = (second: number) => signal(['j', 'r', 'pages:p-1', 'phx_reply', { status: 'error', response: { reason: 'token_expired' } }], second);
const full = (collection: ReadbackCollection, itemIds: string[], second: number) => analyzeReadback(collection, [
  { status: 'ok', readerId: 'r-1', offset: 0, fetchedAt: at(second), itemIds },
  { status: 'ok', readerId: 'r-1', offset: itemIds.length, fetchedAt: at(second + 1), itemIds: [] },
]);
const snapshot = (second: number) => [full({ pageId: 'p-1', kind: 'conversations', conversationId: null }, ['conv-1'], second),
  full({ pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' }, ['m-1', 'm-2'], second)];

function closedAndRejoined(): ContinuityState {
  let state = step(initialContinuity(scope), join(0));
  state = step(state, { kind: 'observation', observation: observe('m-1', 5) });
  state = step(state, close(20));
  return step(state, join(80));
}

describe('gap windows from socket close / rejoin', () => {
  it('opens a window at the last observation and bounds it on rejoin without closing it', () => {
    let state = step(initialContinuity(scope), join(0));
    expect(state.gaps).toEqual([]);
    state = step(state, { kind: 'observation', observation: observe('m-1', 5) });
    state = step(state, close(20));
    expect(state.gaps).toEqual([{ id: 'gap-1', causes: ['disconnected'], start: at(5), end: null, status: 'UNKNOWN', reconciliation: null }]);
    state = step(state, join(80));
    expect(state.gaps[0]).toMatchObject({ start: at(5), end: at(80), status: 'UNKNOWN', reconciliation: null });
    expect(state).toMatchObject({ continuity: 'UNKNOWN', status: 'connected', gapSince: at(0) });
  });

  it('starts the window at the last join when nothing was observed since', () => {
    let state = closedAndRejoined();
    state = step(state, close(200));
    expect(state.gaps[1]).toMatchObject({ id: 'gap-2', start: at(80), end: null });
  });

  it('does not open a second window for repeated close / restart while one is open', () => {
    let state = step(step(initialContinuity(scope), join(0)), close(10));
    state = step(state, { kind: 'restart', at: at(11) });
    state = step(state, close(12));
    expect(state.gaps).toHaveLength(1);
    expect(state.gaps[0].causes).toEqual(['disconnected', 'restart']);
  });

  it('records no gap before the first join', () => {
    expect(step(initialContinuity(scope), close(0)).gaps).toEqual([]);
  });

  it('survives serialization and upgrades legacy checkpoints to an open legacy window', () => {
    const state = closedAndRejoined();
    expect(restoreContinuity(JSON.stringify(state), scope)).toEqual(state);
    const legacy = { version: 1, scope, status: 'disconnected', lastObservedAt: at(5), gapSince: at(5), continuity: 'UNKNOWN', seen: [] };
    expect(restoreContinuity(JSON.stringify(legacy), scope).gaps).toEqual([{ id: 'gap-1', causes: ['legacy-checkpoint'], start: at(5), end: null, status: 'UNKNOWN', reconciliation: null }]);
    expect(restoreContinuity(JSON.stringify({ ...legacy, status: 'connected' }), scope).gaps).toEqual([]);
  });

  it.each([
    ['two open windows', (s: ContinuityState) => ({ ...s, gaps: [{ ...s.gaps[0], end: null }, { ...s.gaps[0], id: 'gap-2', end: null }] })],
    ['forged reconciliation without proof fields', (s: ContinuityState) => ({ ...s, gaps: [{ ...s.gaps[0], status: 'reconciled-by-snapshot' }] })],
    ['forged replayed status', (s: ContinuityState) => ({ ...s, gaps: [{ ...s.gaps[0], status: 'replayed' }] })],
    ['end before start', (s: ContinuityState) => ({ ...s, gaps: [{ ...s.gaps[0], end: at(1) }] })],
    ['reconciled by a readback inside the window', (s: ContinuityState) => ({ ...s, gaps: [{ ...s.gaps[0], status: 'reconciled-by-snapshot',
      reconciliation: { basis: 'bounded-snapshot', readbackStartedAt: at(30), collections: ['x'], transitionsInWindow: 'UNKNOWN' } }] })],
  ])('rejects a tampered checkpoint: %s', (_name, mutate) => {
    expect(() => restoreContinuity(JSON.stringify(mutate(closedAndRejoined())), scope)).toThrow('invalid_checkpoint');
  });
});

describe('session expiry', () => {
  it('opens a window on auth-expired; rejoin is blocked so the window stays unbounded', () => {
    let state = step(initialContinuity(scope), join(0));
    state = step(state, { kind: 'observation', observation: observe('m-1', 5) });
    state = step(state, expired(10));
    const rejoin = advanceContinuity(state, join(20));
    expect(rejoin.disposition).toBe('blocked');
    expect(rejoin.state.gaps).toEqual([{ id: 'gap-1', causes: ['auth-expired'], start: at(5), end: null, status: 'UNKNOWN', reconciliation: null }]);
    const attempt = reconcileGapBySnapshot(rejoin.state, 'gap-1', ['p-1'], snapshot(30));
    expect(attempt.evaluation.eligible).toBe(false);
    expect(attempt.evaluation.reasons).toEqual(expect.arrayContaining(['gap_not_bounded', 'status_auth-expired']));
    expect(attempt.state).toEqual(rejoin.state);
  });

  it('adds auth expiry as a cause to an already open close window', () => {
    let state = step(step(initialContinuity(scope), join(0)), close(10));
    state = step(state, expired(11));
    expect(state.gaps).toHaveLength(1);
    expect(state.gaps[0].causes).toEqual(['disconnected', 'auth-expired']);
  });
});

describe('reconciled-by-snapshot (never replayed)', () => {
  it('marks only the bounded window after a covering readback that started after rejoin', () => {
    const state = closedAndRejoined();
    const result = reconcileGapBySnapshot(state, 'gap-1', ['p-1'], snapshot(100));
    expect(result.evaluation.eligible).toBe(true);
    expect(result.state.gaps[0]).toMatchObject({ status: 'reconciled-by-snapshot', end: at(80),
      reconciliation: { basis: 'bounded-snapshot', readbackStartedAt: at(100), transitionsInWindow: 'UNKNOWN' } });
    expect(result.state).toMatchObject({ continuity: 'UNKNOWN', gapSince: at(0) });
    expect(JSON.stringify(result.state)).not.toMatch(/replayed|complete/i);
    expect(restoreContinuity(JSON.stringify(result.state), scope)).toEqual(result.state);
  });

  it('refuses a readback that started before rejoin and leaves state untouched', () => {
    const state = closedAndRejoined();
    const result = reconcileGapBySnapshot(state, 'gap-1', ['p-1'], snapshot(50));
    expect(result.evaluation.eligible).toBe(false);
    expect(result.state).toEqual(state);
  });

  it('refuses while disconnected again, for unknown gaps, and for a second reconciliation', () => {
    const state = closedAndRejoined();
    expect(reconcileGapBySnapshot(step(state, close(90)), 'gap-1', ['p-1'], snapshot(100)).evaluation.reasons).toContain('status_disconnected');
    expect(() => reconcileGapBySnapshot(state, 'gap-9', ['p-1'], snapshot(100))).toThrow('unknown_gap');
    const once = reconcileGapBySnapshot(state, 'gap-1', ['p-1'], snapshot(100)).state;
    expect(reconcileGapBySnapshot(once, 'gap-1', ['p-1'], snapshot(200)).evaluation.reasons).toContain('gap_not_unknown');
  });

  it('keeps the A->B->A limitation: a reconciled window still records transitions as UNKNOWN', () => {
    const result = reconcileGapBySnapshot(closedAndRejoined(), 'gap-1', ['p-1'], snapshot(100));
    expect(result.state.gaps[0].reconciliation?.transitionsInWindow).toBe('UNKNOWN');
    expect(result.state.continuity).toBe('UNKNOWN');
  });
});
