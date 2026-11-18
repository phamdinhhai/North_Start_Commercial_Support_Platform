import { describe, expect, it, vi } from 'vitest';
import { advanceContinuity, initialContinuity, reconcileGapBySnapshot, restoreContinuity, type ContinuityState } from './continuity';
import { analyzeReadback, runBoundedReadback, type ReadbackCollection } from './history-readback';
import { emptyJoinTracker, recordOutboundJoin, resolveTransportSignal, type JoinTracker } from './join-tracker';
import { emptyLedger, ledgerSnapshot, recordSighting, type SightingInput } from './message-ledger';
import { classifyLifecycleFrame, transportSignalToInput } from './message-lifecycle';
import { analysisDigest } from './readback-correlation';
import type { CaptureContext } from './phoenix-observer';
import { testDigester } from './digest-test-support';

/** Failing-first specs for R2 review findings R2-I-03/04/06/07/08 and A-m8. Synthetic only. */
const scope = { workspaceId: 'synthetic-workspace', connectionId: 'synthetic-connection', accountId: 'synthetic-account', providerSurface: 'pancake-conversations' as const };
const at = (second: number) => new Date(Date.parse('2026-11-18T05:00:00.000Z') + second * 1000).toISOString();
const context: CaptureContext = { scope, allowedPageIds: ['p-1', 'p-2'], captureId: 'c', sourceRevision: 'synthetic-v1', observedAt: at(0), direction: 'received', digester: testDigester() };
const frame = (parts: unknown[]) => JSON.stringify(parts);

function joinPage(state: ContinuityState, tracker: JoinTracker, pageId: string, second: number, ref = `${pageId}-${second}`) {
  const sent = recordOutboundJoin(tracker, frame([ref, ref, `pages:${pageId}`, 'phx_join', {}]), { ...context, direction: 'sent', observedAt: at(second) });
  const reply = classifyLifecycleFrame(frame([ref, ref, `pages:${pageId}`, 'phx_reply', { status: 'ok', response: {} }]), { ...context, observedAt: at(second) });
  if (reply.kind !== 'transport') throw new Error('fixture');
  const resolved = resolveTransportSignal(sent.tracker, reply);
  const input = transportSignalToInput(resolved.signal, at(second), resolved.pageId);
  if (!input) throw new Error('join not resolved');
  return { state: advanceContinuity(state, input).state, tracker: resolved.tracker };
}
const close = (state: ContinuityState, second: number) => advanceContinuity(state, { kind: 'disconnected', at: at(second) }).state;
const full = (collection: ReadbackCollection, itemIds: string[], requested: number, fetched = requested) => analyzeReadback(collection, [
  { status: 'ok', readerId: 'r-1', offset: 0, requestedAt: at(requested), fetchedAt: at(fetched), itemIds },
  { status: 'ok', readerId: 'r-1', offset: itemIds.length, requestedAt: at(fetched), fetchedAt: at(fetched + 1), itemIds: [] },
]);
const pageSnapshot = (pageId: string, requested: number, fetched = requested) => [
  full({ pageId, kind: 'conversations', conversationId: null }, ['conv-1'], requested, fetched),
  full({ pageId, kind: 'messages', conversationId: 'conv-1' }, ['m-1'], requested, fetched),
];
const provenance = { producer: 'synthetic-readback-runner/1', readerIds: ['r-1'] };

describe('R2-I-03 only a matched page join reply counts as rejoin', () => {
  it('classifies an ok reply as reply-ok, never joined, without a tracker', () => {
    const reply = classifyLifecycleFrame(frame([null, '7', 'phoenix', 'phx_reply', { status: 'ok', response: {} }]), context);
    expect(reply).toMatchObject({ kind: 'transport', signal: 'reply-ok', topic: 'phoenix', joinRef: null, ref: '7' });
    expect(transportSignalToInput('reply-ok', at(0))).toBeNull();
  });

  it.each([
    ['heartbeat reply on phoenix topic', [null, 'h-1', 'phoenix', 'phx_reply', { status: 'ok' }]],
    ['reply with a different ref', ['j-1', 'other', 'pages:p-1', 'phx_reply', { status: 'ok' }]],
    ['reply for another page topic', ['j-1', 'j-1', 'pages:p-2', 'phx_reply', { status: 'ok' }]],
    ['reply without join_ref', [null, 'j-1', 'pages:p-1', 'phx_reply', { status: 'ok' }]],
  ])('does not resolve %s as joined', (_name, parts) => {
    const tracker = recordOutboundJoin(emptyJoinTracker(), frame(['j-1', 'j-1', 'pages:p-1', 'phx_join', {}]), { ...context, direction: 'sent' }).tracker;
    const reply = classifyLifecycleFrame(frame(parts as unknown[]), context);
    if (reply.kind !== 'transport') throw new Error('fixture');
    const resolved = resolveTransportSignal(tracker, reply);
    expect(resolved.signal).toBe('reply-ok');
    expect(resolved.tracker.pending).toHaveLength(1);
  });

  it('resolves a matched join reply once and consumes the pending join', () => {
    const tracker = recordOutboundJoin(emptyJoinTracker(), frame(['j-1', 'j-1', 'pages:p-1', 'phx_join', {}]), { ...context, direction: 'sent' }).tracker;
    const reply = classifyLifecycleFrame(frame(['j-1', 'j-1', 'pages:p-1', 'phx_reply', { status: 'ok' }]), context);
    if (reply.kind !== 'transport') throw new Error('fixture');
    const first = resolveTransportSignal(tracker, reply);
    expect(first).toMatchObject({ signal: 'joined', pageId: 'p-1', tracker: { pending: [] } });
    expect(resolveTransportSignal(first.tracker, reply).signal).toBe('reply-ok');
  });

  it('records only outbound phx_join frames for allowed page topics, bounded', () => {
    const sent = { ...context, direction: 'sent' as const };
    expect(recordOutboundJoin(emptyJoinTracker(), frame(['j', 'j', 'pages:p-9', 'phx_join', {}]), sent).recorded).toBe(false);
    expect(recordOutboundJoin(emptyJoinTracker(), frame(['j', 'j', 'phoenix', 'heartbeat', {}]), sent).recorded).toBe(false);
    expect(recordOutboundJoin(emptyJoinTracker(), 'not json', sent).recorded).toBe(false);
    expect(() => recordOutboundJoin(emptyJoinTracker(), frame(['j', 'j', 'pages:p-1', 'phx_join', {}]), context)).toThrow('invalid_join_context');
    const many = { ...sent, allowedPageIds: Array.from({ length: 40 }, (_, i) => `p-${i}`) };
    let tracker = emptyJoinTracker();
    for (let i = 0; i < 40; i += 1) tracker = recordOutboundJoin(tracker, frame([`j${i}`, `j${i}`, `pages:p-${i}`, 'phx_join', {}]), many).tracker;
    expect(tracker.pending).toHaveLength(32);
    expect(tracker.pending[0].topic).toBe('pages:p-8');
    // A re-sent join for the same topic supersedes the earlier pending join.
    const resent = recordOutboundJoin(tracker, frame(['again', 'again', 'pages:p-39', 'phx_join', {}]), many).tracker;
    expect(resent.pending.filter((item) => item.topic === 'pages:p-39')).toEqual([expect.objectContaining({ joinRef: 'again' })]);
  });
});

describe('R2-I-04 conflicting replays of one capture are surfaced deterministically', () => {
  const sighting = (captureId: string, second: number, body: string): SightingInput => {
    const result = classifyLifecycleFrame(frame([null, null, 'pages:p-1', 'pages:update_messages', { conversation_id: 'conv-1', messages: [{ id: 'm-1', message: body }] }]),
      { ...context, captureId, observedAt: at(second) });
    if (result.kind !== 'message-metadata') throw new Error('fixture');
    return { captureId, observedAt: at(second), label: result.label, message: result.messages[0] };
  };

  it('reports capture-conflict and records the conflicted capture in both orders', () => {
    const a = sighting('cap', 1, 'a');
    const b = sighting('cap', 2, 'b');
    const ab = recordSighting(recordSighting(emptyLedger(), a).state, b);
    const ba = recordSighting(recordSighting(emptyLedger(), b).state, a);
    expect(ab.disposition).toBe('capture-conflict');
    expect(ba.disposition).toBe('capture-conflict');
    expect(ledgerSnapshot(ab.state)).toEqual(ledgerSnapshot(ba.state));
    expect(ledgerSnapshot(ab.state)[0]).toMatchObject({ conflictedCaptureIds: ['cap'], distinctContentDigests: 2 });
  });

  it('still treats an identical replay as duplicate-capture', () => {
    const a = sighting('cap', 1, 'a');
    expect(recordSighting(recordSighting(emptyLedger(), a).state, a).disposition).toBe('duplicate-capture');
    expect(ledgerSnapshot(recordSighting(emptyLedger(), a).state)[0].conflictedCaptureIds).toEqual([]);
  });
});

describe('R2-I-06 readback start uses request time, not response time', () => {
  it('records requestedAt before awaiting the port', async () => {
    let tick = 0;
    const clock = { now: vi.fn(() => at(tick++)) };
    const fetchPage = vi.fn()
      .mockImplementationOnce(async () => { tick = 100; return { items: [{ id: 'm-1' }] }; })
      .mockResolvedValueOnce({ items: [] });
    const result = await runBoundedReadback({ fetchPage }, clock, { pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' }, { readerId: 'r-1', limit: 25, maxPages: 5 });
    expect(result.pages[0]).toMatchObject({ requestedAt: at(0), fetchedAt: at(100) });
    expect(result.analysis.startedAt).toBe(at(0));
  });

  it('refuses reconciliation when a request was sent before the rejoin even if answered after it', () => {
    let tracker = emptyJoinTracker();
    let state = initialContinuity(scope);
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 0));
    state = close(state, 10);
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 50));
    const result = reconcileGapBySnapshot(state, 'gap-1', { analyses: pageSnapshot('p-1', 40, 60), provenance });
    expect(result.evaluation.eligible).toBe(false);
    expect(result.evaluation.reasons.some((reason) => reason.startsWith('started_before_gap_end'))).toBe(true);
  });

  it('rejects pages whose request time is after their response time', () => {
    expect(() => analyzeReadback({ pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' },
      [{ status: 'ok', readerId: 'r', offset: 0, requestedAt: at(5), fetchedAt: at(4), itemIds: [] }])).toThrow('invalid_page');
  });
});

describe('R2-I-07 required pages come from continuity state', () => {
  function twoPageGap() {
    let tracker = emptyJoinTracker();
    let state = initialContinuity(scope);
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 0));
    ({ state, tracker } = joinPage(state, tracker, 'p-2', 1));
    state = close(state, 10);
    return { state, tracker };
  }

  it('captures joined pages as the required page set of the gap', () => {
    expect(twoPageGap().state.gaps[0]).toMatchObject({ requiredPages: ['p-1', 'p-2'], end: null });
  });

  it('bounds the gap only after every required page rejoined', () => {
    let { state, tracker } = twoPageGap();
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 50));
    expect(state.gaps[0]).toMatchObject({ end: null, rejoinedPages: ['p-1'] });
    ({ state } = joinPage(state, tracker, 'p-2', 55));
    expect(state.gaps[0].end).toBe(at(55));
  });

  it('cannot reconcile a two-page gap with a single-page snapshot', () => {
    let { state, tracker } = twoPageGap();
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 50));
    ({ state } = joinPage(state, tracker, 'p-2', 55));
    const partial = reconcileGapBySnapshot(state, 'gap-1', { analyses: pageSnapshot('p-1', 60), provenance });
    expect(partial.evaluation).toMatchObject({ eligible: false });
    expect(partial.evaluation.reasons).toContain('missing_conversation_list:p-2');
    expect(partial.state).toEqual(state);
    const complete = reconcileGapBySnapshot(state, 'gap-1', { analyses: [...pageSnapshot('p-1', 60), ...pageSnapshot('p-2', 60)], provenance });
    expect(complete.evaluation.eligible).toBe(true);
  });

  it('refuses reconciliation when the gap has no known page set', () => {
    let state = advanceContinuity(initialContinuity(scope), { kind: 'connected', at: at(0) }).state;
    state = close(state, 10);
    state = advanceContinuity(state, { kind: 'connected', at: at(20) }).state;
    expect(state.gaps[0]).toMatchObject({ requiredPages: [], end: at(20) });
    expect(reconcileGapBySnapshot(state, 'gap-1', { analyses: pageSnapshot('p-1', 30), provenance }).evaluation.reasons).toContain('no_required_pages');
  });
});

describe('R2-I-08 a rejoin earlier than the gap start cannot corrupt state', () => {
  it('rejects the input as out-of-order and later inputs still work', () => {
    let tracker = emptyJoinTracker();
    let state = initialContinuity(scope);
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 10));
    state = advanceContinuity(state, { kind: 'disconnected', at: at(30) }).state;
    const early = advanceContinuity(state, { kind: 'connected', at: at(5), pageId: 'p-1' });
    expect(early.disposition).toBe('out-of-order');
    expect(early.state).toEqual(state);
    expect(() => restoreContinuity(JSON.stringify(early.state), scope)).not.toThrow();
    ({ state } = joinPage(early.state, tracker, 'p-1', 40));
    expect(state.gaps[0]).toMatchObject({ start: at(10), end: at(40) });
  });
});

describe('A-m8 reconciliation records readback provenance', () => {
  it('stores producer, reader IDs, request times and analysis digests', () => {
    let tracker = emptyJoinTracker();
    let state = initialContinuity(scope);
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 0));
    state = close(state, 10);
    ({ state } = joinPage(state, tracker, 'p-1', 50));
    const analyses = pageSnapshot('p-1', 60);
    const result = reconcileGapBySnapshot(state, 'gap-1', { analyses, provenance });
    expect(result.state.gaps[0].reconciliation).toMatchObject({
      producer: 'synthetic-readback-runner/1', readerIds: ['r-1'], readbackStartedAt: at(60), transitionsInWindow: 'UNKNOWN',
      inputs: analyses.map((analysis) => ({ requestedFrom: at(60), respondedUntil: analysis.endedAt, digest: analysisDigest(analysis) })),
    });
    expect(analysisDigest(analyses[0])).toMatch(/^[a-f0-9]{64}$/);
    expect(restoreContinuity(JSON.stringify(result.state), scope)).toEqual(result.state);
  });

  it('refuses analyses read by a reader not named in the provenance, or without a producer', () => {
    let tracker = emptyJoinTracker();
    let state = initialContinuity(scope);
    ({ state, tracker } = joinPage(state, tracker, 'p-1', 0));
    state = close(state, 10);
    ({ state } = joinPage(state, tracker, 'p-1', 50));
    expect(reconcileGapBySnapshot(state, 'gap-1', { analyses: pageSnapshot('p-1', 60), provenance: { producer: 'x', readerIds: ['r-2'] } }).evaluation.reasons)
      .toEqual(expect.arrayContaining([expect.stringMatching(/^unattributed_reader/)]));
    expect(() => reconcileGapBySnapshot(state, 'gap-1', { analyses: pageSnapshot('p-1', 60), provenance: { producer: '', readerIds: [] } })).toThrow('invalid_provenance');
  });
});
