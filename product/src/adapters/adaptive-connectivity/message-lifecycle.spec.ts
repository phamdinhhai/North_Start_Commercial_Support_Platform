import { describe, expect, it } from 'vitest';
import fixtures from './lifecycle-synthetic-fixtures.json';
import { classifyLifecycleFrame, transportSignalToInput, READ_STATE_EVENT } from './message-lifecycle';
import type { CaptureContext } from './phoenix-observer';
import { testDigester } from './digest-test-support';

const scope = { workspaceId: 'synthetic-workspace', connectionId: 'synthetic-connection', accountId: 'synthetic-account', providerSurface: 'pancake-conversations' as const };
const context: CaptureContext = { scope, allowedPageIds: ['synthetic-page'], captureId: 'synthetic-capture', sourceRevision: 'synthetic-lifecycle-v1', observedAt: '2026-11-18T00:00:00.000Z', direction: 'received', digester: testDigester() };
const frame = (event: string, payload: unknown, topic = 'pages:synthetic-page') => JSON.stringify([null, null, topic, event, payload]);
const classify = (raw: string) => classifyLifecycleFrame(raw, context);
const PRIVATE = /synthetic-private|https?:|\.jpg|token_expired|accessToken/;

describe('synthetic lifecycle fixture corpus', () => {
  it('is explicitly labelled synthetic at file and case level', () => {
    expect(fixtures.synthetic).toBe(true);
    expect(fixtures.evidenceLevel).toBe('SYNTHETIC_TESTED');
    expect(fixtures.cases.every((item) => item.synthetic === true && item.provenance.length > 0)).toBe(true);
  });

  it.each(fixtures.cases)('classifies $name without retaining private values', (fixture) => {
    const result = classify(JSON.stringify(fixture.frame));
    expect(result.kind).toBe(fixture.expected.kind);
    expect(JSON.stringify(result)).not.toMatch(PRIVATE);
    if (result.kind === 'message-metadata') {
      const [message] = result.messages;
      expect(result.label).toBe(fixture.expected.label);
      expect(message.attachments).toEqual({ count: fixture.expected.attachmentCount, types: fixture.expected.attachmentTypes, totalBytes: fixture.expected.totalBytes });
      expect(message).toMatchObject({ providerMessageId: 'synthetic-message-1', conversationId: 'synthetic-conversation', pageId: 'synthetic-page' });
      expect(result.observation).toMatchObject({ externalEventId: null, occurredAt: null, authenticity: 'UNKNOWN', completeness: 'UNKNOWN' });
    }
    if (result.kind === 'read-state') expect(result.seen).toBe(fixture.expected.seen);
    if (result.kind === 'schema-drift') expect(result.drift).toMatchObject({ quarantined: true, reason: fixture.expected.reason, semantics: 'UNKNOWN' });
    if (result.kind === 'transport') expect(result.signal).toBe(fixture.expected.signal);
  });
});

describe('message created / updated / deleted frames', () => {
  it('keeps provider message ID, capture ID and payload hash as distinct identities', () => {
    const result = classify(frame('pages:update_messages', { conversation_id: 'c-1', messages: [{ id: 'm-1', message: 'x' }] }));
    if (result.kind !== 'message-metadata') throw new Error('expected metadata');
    expect(result.observation.captureId).toBe('synthetic-capture');
    expect(result.observation.externalEventId).toBeNull();
    expect(result.messages[0].providerMessageId).toBe('m-1');
    expect(result.messages[0].contentDigest.value).not.toBe(result.observation.payloadDigest.value);
    expect(result).not.toHaveProperty('commercialEvent');
    expect(result).not.toHaveProperty('leadState');
  });

  it('records text presence only, never body or length', () => {
    const result = classify(frame('pages:update_messages', { conversation_id: 'c-1', messages: [{ id: 'm-1', message: 'synthetic-private-text' }, { id: 'm-2' }] }));
    if (result.kind !== 'message-metadata') throw new Error('expected metadata');
    expect(result.messages.map((item) => item.hasText)).toEqual([true, false]);
    expect(JSON.stringify(result)).not.toContain('synthetic-private-text');
  });

  it('reports unknown attachment sizes and types honestly', () => {
    const result = classify(frame('pages:update_messages', { conversation_id: 'c-1', messages: [{ id: 'm-1', attachments: [{ type: 'Video/MP4' }, { type: 'audio', size: -1 }] }] }));
    if (result.kind !== 'message-metadata') throw new Error('expected metadata');
    expect(result.messages[0].attachments).toEqual({ count: 2, types: ['UNKNOWN', 'audio'], totalBytes: null });
  });

  it('distinguishes edited content by content hash but not by label', () => {
    const one = classify(frame('pages:update_messages', { conversation_id: 'c-1', messages: [{ id: 'm-1', message: 'a' }] }));
    const two = classify(frame('pages:update_messages', { conversation_id: 'c-1', messages: [{ id: 'm-1', message: 'b' }] }));
    if (one.kind !== 'message-metadata' || two.kind !== 'message-metadata') throw new Error('expected metadata');
    expect(one.label).toBe(two.label);
    expect(one.messages[0].contentDigest).not.toEqual(two.messages[0].contentDigest);
  });

  it.each([
    ['missing messages array', { conversation_id: 'c-1' }],
    ['empty messages array', { conversation_id: 'c-1', messages: [] }],
    ['message without id', { conversation_id: 'c-1', messages: [{ message: 'x' }] }],
    ['duplicate ids in one frame', { conversation_id: 'c-1', messages: [{ id: 'm-1' }, { id: 'm-1' }] }],
    ['message from another conversation', { conversation_id: 'c-1', messages: [{ id: 'm-1', conversation_id: 'c-2' }] }],
    ['message from another page', { conversation_id: 'c-1', messages: [{ id: 'm-1', page_id: 'other-page' }] }],
    ['attachments not an array', { conversation_id: 'c-1', messages: [{ id: 'm-1', attachments: { type: 'photo' } }] }],
    ['attachment not an object', { conversation_id: 'c-1', messages: [{ id: 'm-1', attachments: ['photo'] }] }],
    ['no conversation reference', { messages: [{ id: 'm-1' }] }],
    ['too many messages', { conversation_id: 'c-1', messages: Array.from({ length: 201 }, (_, i) => ({ id: `m-${i}` })) }],
  ])('quarantines update shape drift: %s (keeps transport observation when one exists)', (_name, payload) => {
    const result = classify(frame('pages:update_messages', payload));
    expect(result).toMatchObject({ kind: 'schema-drift', drift: { reason: 'unknown_shape', eventType: 'pages:update_messages', semantics: 'UNKNOWN' } });
  });

  it('quarantines deletion frames that do not identify a message instead of guessing', () => {
    const result = classify(frame('messages:mark_as_deleted', { conversation_id: 'c-1' }));
    expect(result).toMatchObject({ kind: 'schema-drift', drift: { reason: 'unknown_shape' }, observation: { externalObjectId: 'c-1' } });
  });

  it('still rejects contradictory scope before any lifecycle interpretation', () => {
    expect(classify(frame('pages:update_messages', { page_id: 'other', conversation_id: 'c-1', messages: [{ id: 'm-1' }] }))).toEqual({ kind: 'rejected', reason: 'scope_mismatch' });
    expect(classify(frame('pages:update_messages', { conversation_id: 'c-1', messages: [{ id: 'm-1' }] }, 'pages:other-page'))).toEqual({ kind: 'rejected', reason: 'scope_mismatch' });
    expect(classify('not json')).toEqual({ kind: 'rejected', reason: 'malformed_frame' });
    expect(classifyLifecycleFrame(frame('pages:update_messages', {}), { ...context, direction: 'sent' })).toEqual({ kind: 'ignored', reason: 'outbound_frame' });
  });
});

describe('schema drift quarantine', () => {
  it('never silently drops an unknown event and keeps only filtered key names', () => {
    const result = classify(frame('messages:restored_v2', { message_id: 'synthetic-private-id', '1234_5678': 1, 'Mixed-Case': true }));
    expect(result).toMatchObject({ kind: 'schema-drift', observation: null, drift: { reason: 'unknown_event', payloadKeys: ['message_id'], payloadKeyCount: 3, captureId: 'synthetic-capture' } });
    expect(JSON.stringify(result)).not.toContain('synthetic-private-id');
  });

  it('bounds retained key names', () => {
    const payload = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`key_${String(i).padStart(2, '0')}`, i]));
    const result = classify(frame('pages:new_thing', payload));
    if (result.kind !== 'schema-drift') throw new Error('expected drift');
    expect(result.drift.payloadKeys).toHaveLength(32);
    expect(result.drift.payloadKeyCount).toBe(40);
  });

  it('quarantines unknown events on the phoenix topic too', () => {
    expect(classify(frame('presence_diff', {}, 'phoenix'))).toMatchObject({ kind: 'schema-drift', drift: { reason: 'unknown_event', topic: 'phoenix' } });
  });
});

describe('read / unread state', () => {
  it('is a separate observation kind and maps to no lead or obligation state', () => {
    const result = classify(frame(READ_STATE_EVENT, { conversation_id: 'c-1', seen: false }));
    expect(result).toMatchObject({ kind: 'read-state', conversationId: 'c-1', seen: false, observation: { eventType: READ_STATE_EVENT, externalObjectId: 'c-1', externalEventId: null } });
    expect(Object.keys(result).sort()).toEqual(['conversationId', 'kind', 'observation', 'seen']);
  });

  it('keeps an absent seen flag UNKNOWN rather than assuming read', () => {
    expect(classify(frame(READ_STATE_EVENT, { conversation_id: 'c-1' }))).toMatchObject({ kind: 'read-state', seen: 'UNKNOWN' });
  });

  it.each([{ seen: true }, { conversation_id: 'c-1', seen: 'yes' }, { conversation_id: 7 }])('quarantines unknown read-state shape %j', (payload) => {
    expect(classify(frame(READ_STATE_EVENT, payload))).toMatchObject({ kind: 'schema-drift', drift: { reason: 'unknown_shape' } });
  });

  it('rejects read-state from another page', () => {
    expect(classify(frame(READ_STATE_EVENT, { conversation_id: 'c-1', page_id: 'other-page' }))).toEqual({ kind: 'rejected', reason: 'scope_mismatch' });
    expect(classify(frame(READ_STATE_EVENT, { conversation_id: 'c-1' }, 'pages:other-page'))).toEqual({ kind: 'rejected', reason: 'scope_mismatch' });
  });
});

describe('transport signals', () => {
  it.each([
    [{ status: 'error', response: { reason: 'Unauthorized' } }, 'auth-expired'],
    [{ status: 'error', response: { reason: 'session_expired' } }, 'auth-expired'],
    [{ status: 'error', response: { reason: 'rate_limited' } }, 'join-rejected'],
    [{ status: 'error' }, 'join-rejected'],
    [{ status: 'ok' }, 'reply-ok'],
    [{ status: 'timeout' }, 'other'],
  ])('classifies reply %j as %s', (payload, signal) => {
    expect(classify(frame('phx_reply', payload))).toEqual({ kind: 'transport', eventType: 'phx_reply', signal, topic: 'pages:synthetic-page', joinRef: null, ref: null });
  });

  it('maps signals to continuity inputs; heartbeat and unknown replies change nothing', () => {
    const at = context.observedAt;
    expect(transportSignalToInput('joined', at)).toEqual({ kind: 'connected', at });
    expect(transportSignalToInput('joined', at, 'p-1')).toEqual({ kind: 'connected', at, pageId: 'p-1' });
    expect(transportSignalToInput('reply-ok', at)).toBeNull();
    expect(transportSignalToInput('auth-expired', at)).toEqual({ kind: 'auth-expired', at });
    for (const signal of ['channel-closed', 'channel-error', 'join-rejected'] as const) expect(transportSignalToInput(signal, at)).toEqual({ kind: 'disconnected', at });
    expect(transportSignalToInput('heartbeat', at)).toBeNull();
    expect(transportSignalToInput('other', at)).toBeNull();
    expect(classify(frame('heartbeat', {}, 'phoenix'))).toMatchObject({ signal: 'heartbeat' });
    expect(classify(frame('phx_error', {}))).toMatchObject({ signal: 'channel-error' });
  });
});
