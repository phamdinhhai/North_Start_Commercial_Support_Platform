import { describe, expect, it } from 'vitest';
import { observePhoenixFrame, type CaptureContext } from './phoenix-observer';
import { advanceContinuity, initialContinuity, restoreContinuity } from './continuity';

const scope = { workspaceId: 'test-workspace', connectionId: 'test-connection', accountId: 'test-account', providerSurface: 'pancake-conversations' as const };
const context: CaptureContext = {
  scope, allowedPageIds: ['test-page'], captureId: 'capture-1', sourceRevision: 'fixture-v1',
  observedAt: '2026-11-14T00:00:00.000Z', direction: 'received',
};
const frame = (payload: unknown = { conversation: { id: 'test-conversation', message_count: 1 } }, event = 'pages:update_conversation', topic = 'pages:test-page') =>
  JSON.stringify([null, null, topic, event, payload]);
const observation = (captureId = 'capture-1', raw = frame()) => {
  const result = observePhoenixFrame(raw, { ...context, captureId });
  if (result.kind !== 'observation') throw new Error('fixture_not_observed');
  return result.observation;
};
const connected = () => advanceContinuity(initialContinuity(scope), { kind: 'connected', at: context.observedAt }).state;

describe('experimental Phoenix observation boundary', () => {
  it('keeps client observations separate from canonical truth and does not retain message text', () => {
    const raw = frame({ conversation: { id: 'test-conversation' }, body: 'synthetic-private-message', accessToken: 'synthetic-secret' });
    const value = observation('capture-1', raw);
    expect(value).toMatchObject({ externalEventId: null, externalObjectId: 'test-conversation', occurredAt: null, completeness: 'UNKNOWN', authenticity: 'UNKNOWN', evidenceType: 'client-observed' });
    expect(JSON.stringify(value)).not.toMatch(/synthetic-private-message|synthetic-secret|accessToken/);
    expect(value.payloadHash).toHaveLength(64);
  });

  it('retains a batch tag observation without assigning one conversation or interpreting provider timestamp', () => {
    const value = observation('batch-test', frame({ timestamp: 1800000000,
      conversations: { first: [7], second: [] }, conversations_updated: [
        { id: 'first', page_id: 'test-page', tags: [7] }, { id: 'second', page_id: 'test-page', tags: [] },
      ] }, 'pages:tag_conversations'));
    expect(value).toMatchObject({ externalObjectId: null, externalEventId: null, occurredAt: null, evidenceType: 'client-observed' });
  });

  it.each(['not json', '{}', '[]', '[null,null,"pages:test-page","event",null]', '[12,null,"pages:test-page","event",{}]'])('rejects malformed frame %s', (raw) => {
    expect(observePhoenixFrame(raw, context)).toEqual({ kind: 'rejected', reason: 'malformed_frame' });
  });

  it('bounds frame sizes before parsing', () => {
    expect(observePhoenixFrame('x'.repeat(262145), context)).toMatchObject({ reason: 'oversized_frame' });
  });

  it('rejects another page and the POS surface', () => {
    expect(observePhoenixFrame(frame({}, 'pages:update_messages', 'pages:other-page'), context)).toMatchObject({ reason: 'scope_mismatch' });
    expect(() => observePhoenixFrame(frame(), { ...context, scope: { ...scope, providerSurface: 'pancake-pos' } })).toThrow('invalid_capture_context');
  });

  it('does not treat join replies, outgoing writes or unknown events as business evidence', () => {
    expect(observePhoenixFrame(frame({}, 'phx_reply'), context).kind).toBe('control');
    expect(observePhoenixFrame(frame(), { ...context, direction: 'sent' })).toMatchObject({ reason: 'outbound_frame' });
    expect(observePhoenixFrame(frame({}, 'new-schema-event'), context)).toMatchObject({ reason: 'unknown_event' });
    expect(observePhoenixFrame(frame({}, 'pages:update_messages', 'phoenix'), context).kind).toBe('rejected');
  });

  it('maps both message and deletion references without inventing event IDs', () => {
    for (const event of ['pages:update_messages', 'messages:mark_as_deleted']) {
      expect(observation('x', frame({ conversation_id: 'conversation-2' }, event))).toMatchObject({ externalObjectId: 'conversation-2', externalEventId: null });
    }
  });

  it('reads the nested deletion reference found in the shipped client handler', () => {
    const value = observation('delete-capture', frame({ page_id: 'test-page',
      message: { id: 'message-test', conversation_id: 'conversation-2', body: 'private-deleted-content' } }, 'messages:mark_as_deleted'));
    expect(value.externalObjectId).toBe('conversation-2');
    expect(JSON.stringify(value)).not.toContain('private-deleted-content');
  });

  it.each([
    { page_id: 'other-page', conversation: { id: 'test-conversation' } },
    { page_id: 'test-page', conversation: { id: 'test-conversation', page_id: 'other-page' } },
    { message: { page_id: 'other-page', conversation_id: 'conversation-2' } },
    { pageId: 'other-page', conversation: { id: 'test-conversation' } },
  ])('rejects contradictory page identity inside an allowed topic: %j', (payload) => {
    expect(observePhoenixFrame(frame(payload), context)).toMatchObject({ kind: 'rejected', reason: 'scope_mismatch' });
  });

  it('rejects contradictory deletion references instead of choosing one', () => {
    expect(observePhoenixFrame(frame({ conversation_id: 'first',
      message: { conversation_id: 'second' } }, 'messages:mark_as_deleted'), context)).toMatchObject({ kind: 'rejected', reason: 'malformed_frame' });
  });
});

describe('continuity and delivery retries', () => {
  it('survives serialization and deduplicates a capture retry', () => {
    const accepted = advanceContinuity(connected(), { kind: 'observation', observation: observation() });
    const restored = restoreContinuity(JSON.stringify(accepted.state), scope);
    expect(advanceContinuity(restored, { kind: 'observation', observation: observation() }).disposition).toBe('duplicate');
    expect(accepted.disposition).toBe('accepted');
  });

  it('retains distinct events with the same object, message count and payload', () => {
    const first = advanceContinuity(connected(), { kind: 'observation', observation: observation() }).state;
    expect(advanceContinuity(first, { kind: 'observation', observation: observation('capture-2') }).disposition).toBe('accepted');
    const changed = observation('capture-3', frame({ conversation: { id: 'test-conversation', message_count: 1, status: 'changed' } }));
    expect(advanceContinuity(first, { kind: 'observation', observation: changed }).disposition).toBe('accepted');
  });

  it('quarantines changed content using the same capture identity', () => {
    const first = advanceContinuity(connected(), { kind: 'observation', observation: observation() }).state;
    const changed = observation('capture-1', frame({ conversation: { id: 'other' } }));
    expect(advanceContinuity(first, { kind: 'observation', observation: changed }).disposition).toBe('conflict');
  });

  it('preserves an unverified 15-minute gap after reconnect and restart', () => {
    const first = advanceContinuity(connected(), { kind: 'observation', observation: observation() }).state;
    const lost = advanceContinuity(first, { kind: 'disconnected', at: '2026-11-14T00:01:00.000Z' }).state;
    const resumed = advanceContinuity(restoreContinuity(JSON.stringify(lost), scope), { kind: 'connected', at: '2026-11-14T00:16:00.000Z' }).state;
    expect(resumed).toMatchObject({ continuity: 'UNKNOWN', gapSince: context.observedAt });
    expect(advanceContinuity(resumed, { kind: 'restart', at: '2026-11-14T00:17:00.000Z' }).state.status).toBe('disconnected');
  });

  it('stops after auth expiry, including after process restart', () => {
    const expired = advanceContinuity(connected(), { kind: 'auth-expired', at: context.observedAt }).state;
    expect(advanceContinuity(expired, { kind: 'connected', at: context.observedAt }).disposition).toBe('blocked');
    expect(advanceContinuity(expired, { kind: 'observation', observation: observation() }).disposition).toBe('blocked');
    const restarted = advanceContinuity(expired, { kind: 'restart', at: context.observedAt }).state;
    expect(restarted.status).toBe('auth-expired');
  });

  it('rejects cross-workspace checkpoints and observations', () => {
    expect(() => restoreContinuity(JSON.stringify(connected()), { ...scope, workspaceId: 'other' })).toThrow('scope_mismatch');
    expect(() => advanceContinuity(connected(), { kind: 'observation', observation: { ...observation(), scope: { ...scope, accountId: 'other' } } })).toThrow('scope_mismatch');
    expect(() => restoreContinuity('{}', scope)).toThrow('invalid_checkpoint');
  });

  it.each([
    ['disconnected', 'connected'],
    ['restart', 'disconnected', 'connected'],
    ['disconnected', 'restart', 'connected'],
    ['disconnected', 'auth-expired', 'connected'],
  ] as const)('keeps expiry latched across lifecycle sequence %j', (...events) => {
    let state = advanceContinuity(connected(), { kind: 'auth-expired', at: context.observedAt }).state;
    const originalGap = state.gapSince;
    for (const kind of events) {
      const next = advanceContinuity(state, { kind, at: context.observedAt });
      state = restoreContinuity(JSON.stringify(next.state), scope);
      expect(state.status).toBe('auth-expired');
      expect(state.gapSince).toBe(originalGap);
      expect(advanceContinuity(state, { kind: 'observation', observation: observation() }).disposition).toBe('blocked');
      if (kind === 'connected') expect(next.disposition).toBe('blocked');
    }
  });

  it('rejects forged evidence upgrades and malformed scope at the intake boundary', () => {
    const forged = { ...observation(), authenticity: 'provider-confirmed' } as unknown as ReturnType<typeof observation>;
    expect(() => advanceContinuity(connected(), { kind: 'observation', observation: forged })).toThrow('invalid_observation');
    expect(() => initialContinuity({ ...scope, workspaceId: '' })).toThrow('invalid_scope');
    expect(() => advanceContinuity(connected(), { kind: 'restart', at: 'invalid' })).toThrow('invalid_time');
    expect(() => advanceContinuity(connected(), { kind: 'observation', observation: observation() }, 0)).toThrow('invalid_capacity');
  });

  it('does not move the observation watermark backwards', () => {
    const first = advanceContinuity(connected(), { kind: 'observation', observation: observation() }).state;
    const older = { ...observation('capture-2'), observedAt: '2026-11-13T23:59:00.000Z' };
    const result = advanceContinuity(first, { kind: 'observation', observation: older });
    expect(result.outOfOrder).toBe(true);
    expect(result.state.lastObservedAt).toBe(context.observedAt);
  });

  it('refuses overflow rather than silently weakening deduplication', () => {
    const first = advanceContinuity(connected(), { kind: 'observation', observation: observation() }, 1).state;
    const result = advanceContinuity(first, { kind: 'observation', observation: observation('capture-2') }, 1);
    expect(result.disposition).toBe('capacity');
    expect(result.state).toEqual(first);
  });
});
