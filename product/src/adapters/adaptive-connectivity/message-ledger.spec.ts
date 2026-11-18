import { describe, expect, it } from 'vitest';
import { emptyLedger, ledgerSnapshot, liveMessages, messageKey, recordSighting, type LedgerState, type SightingInput } from './message-ledger';
import { classifyLifecycleFrame } from './message-lifecycle';
import { advanceContinuity, initialContinuity } from './continuity';
import type { CaptureContext } from './phoenix-observer';

const scope = { workspaceId: 'synthetic-workspace', connectionId: 'synthetic-connection', accountId: 'synthetic-account', providerSurface: 'pancake-conversations' as const };
const base: CaptureContext = { scope, allowedPageIds: ['p-1'], captureId: 'c', sourceRevision: 'synthetic-v1', observedAt: '2026-11-18T00:00:00.000Z', direction: 'received' };
const t = (second: number) => new Date(Date.parse(base.observedAt) + second * 1000).toISOString();

function sighting(captureId: string, second: number, event: 'pages:update_messages' | 'messages:mark_as_deleted', body = 'a', id = 'm-1'): SightingInput {
  const payload = event === 'pages:update_messages'
    ? { conversation_id: 'conv-1', messages: [{ id, message: body }] }
    : { message: { id, conversation_id: 'conv-1', message: body } };
  const result = classifyLifecycleFrame(JSON.stringify([null, null, 'pages:p-1', event, payload]), { ...base, captureId, observedAt: t(second) });
  if (result.kind !== 'message-metadata') throw new Error('synthetic fixture not classified');
  return { captureId, observedAt: t(second), label: result.label, message: result.messages[0] };
}

const apply = (inputs: readonly SightingInput[], start: LedgerState = emptyLedger()) =>
  inputs.reduce((state, input) => recordSighting(state, input).state, start);

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]));
}

describe('observer-relative message sightings', () => {
  it('labels the first sighting as first-observed, never as created', () => {
    const result = recordSighting(emptyLedger(), sighting('cap-1', 0, 'pages:update_messages'));
    expect(result.disposition).toBe('first-observed');
    expect(JSON.stringify(result)).not.toMatch(/created|commercial|lead/i);
  });

  it('distinguishes duplicate capture, same re-observation, changed re-observation and deletion label', () => {
    let state = recordSighting(emptyLedger(), sighting('cap-1', 0, 'pages:update_messages', 'a')).state;
    expect(recordSighting(state, sighting('cap-1', 0, 'pages:update_messages', 'a')).disposition).toBe('duplicate-capture');
    const same = recordSighting(state, sighting('cap-2', 1, 'pages:update_messages', 'a'));
    expect(same.disposition).toBe('re-observed-same');
    const changed = recordSighting(same.state, sighting('cap-3', 2, 'pages:update_messages', 'b'));
    expect(changed.disposition).toBe('re-observed-changed');
    state = recordSighting(changed.state, sighting('cap-4', 3, 'messages:mark_as_deleted', 'b')).state;
    expect(ledgerSnapshot(state)[0]).toMatchObject({ deletionLabelled: true, distinctContentHashes: 3, captureIds: ['cap-1', 'cap-2', 'cap-3', 'cap-4'], latest: { captureId: 'cap-4', label: 'deletion-labelled' } });
  });

  it('marks out-of-order sightings stale without moving the latest view backwards', () => {
    const state = apply([sighting('cap-2', 10, 'pages:update_messages', 'b')]);
    const late = recordSighting(state, sighting('cap-1', 5, 'pages:update_messages', 'a'));
    expect(late.disposition).toBe('stale');
    expect(ledgerSnapshot(late.state)[0]).toMatchObject({ latest: { captureId: 'cap-2' }, earliestObservedAt: t(5), distinctContentHashes: 2 });
  });

  it('keeps a deletion label even when an older upsert arrives after it', () => {
    const state = apply([sighting('cap-del', 10, 'messages:mark_as_deleted'), sighting('cap-up', 5, 'pages:update_messages')]);
    expect(ledgerSnapshot(state)[0]).toMatchObject({ deletionLabelled: true, latest: { label: 'deletion-labelled' } });
  });

  it('produces an identical final snapshot for every arrival order, including duplicates', () => {
    const inputs = [
      sighting('cap-1', 0, 'pages:update_messages', 'a'),
      sighting('cap-2', 5, 'pages:update_messages', 'b'),
      sighting('cap-3', 5, 'pages:update_messages', 'c'),
      sighting('cap-4', 9, 'messages:mark_as_deleted', 'c'),
      sighting('cap-1', 0, 'pages:update_messages', 'a'),
    ];
    const expected = JSON.stringify(ledgerSnapshot(apply(inputs)));
    for (const order of permutations(inputs)) expect(JSON.stringify(ledgerSnapshot(apply(order)))).toBe(expected);
  });

  it('breaks equal-time ties by capture ID deterministically', () => {
    const a = sighting('cap-a', 5, 'pages:update_messages', 'x');
    const b = sighting('cap-b', 5, 'pages:update_messages', 'y');
    expect(ledgerSnapshot(apply([a, b]))[0].latest.captureId).toBe('cap-b');
    expect(ledgerSnapshot(apply([b, a]))[0].latest.captureId).toBe('cap-b');
  });

  it('scopes message identity by page and conversation', () => {
    expect(messageKey('p-1', 'conv-1', 'm-1')).not.toBe(messageKey('p-1', 'conv-2', 'm-1'));
    expect(messageKey('p-1', 'conv-1', 'm-1')).not.toBe(messageKey('p-2', 'conv-1', 'm-1'));
    const one = sighting('cap-1', 0, 'pages:update_messages');
    const other = { ...one, captureId: 'cap-2', message: { ...one.message, conversationId: 'conv-2' } };
    const state = apply([one, other]);
    expect(ledgerSnapshot(state)).toHaveLength(2);
    expect(liveMessages(state, 'p-1', 'conv-1')).toEqual([{ providerMessageId: 'm-1', earliestObservedAt: t(0), deletionLabelled: false }]);
  });

  it('rejects invalid sightings at the boundary', () => {
    const valid = sighting('cap-1', 0, 'pages:update_messages');
    expect(() => recordSighting(emptyLedger(), { ...valid, captureId: '' })).toThrow('invalid_sighting');
    expect(() => recordSighting(emptyLedger(), { ...valid, observedAt: 'yesterday' })).toThrow('invalid_sighting');
    expect(() => recordSighting(emptyLedger(), { ...valid, message: { ...valid.message, contentHash: 'abc' } })).toThrow('invalid_sighting');
    expect(() => recordSighting(emptyLedger(), { ...valid, label: 'created' as never })).toThrow('invalid_sighting');
    expect(() => recordSighting(emptyLedger(), { ...valid, message: { ...valid.message, providerMessageId: '' } })).toThrow('invalid_message_key');
  });
});

describe('duplicate and out-of-order frames at the continuity boundary', () => {
  it('handles a redelivered frame as duplicate and an older frame as out-of-order, deterministically', () => {
    const observe = (captureId: string, second: number) => {
      const result = classifyLifecycleFrame(JSON.stringify([null, null, 'pages:p-1', 'pages:update_messages', { conversation_id: 'conv-1', messages: [{ id: 'm-1' }] }]),
        { ...base, captureId, observedAt: t(second) });
      if (result.kind !== 'message-metadata') throw new Error('fixture');
      return result.observation;
    };
    const run = () => {
      let state = advanceContinuity(initialContinuity(scope), { kind: 'connected', at: t(0) }).state;
      const dispositions: string[] = [];
      for (const [captureId, second] of [['f-2', 10], ['f-1', 5], ['f-2', 10]] as const) {
        const result = advanceContinuity(state, { kind: 'observation', observation: observe(captureId, second) });
        dispositions.push(`${result.disposition}:${result.outOfOrder}`);
        state = result.state;
      }
      return { dispositions, state };
    };
    const first = run();
    expect(first.dispositions).toEqual(['accepted:false', 'accepted:true', 'duplicate:false']);
    expect(first.state.lastObservedAt).toBe(t(10));
    expect(run()).toEqual(first);
  });
});
