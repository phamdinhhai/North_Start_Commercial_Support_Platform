import { describe, expect, it } from 'vitest';
import { advanceContinuity, initialContinuity, restoreContinuity } from './continuity';
import { observePhoenixFrame, type CaptureContext } from './phoenix-observer';

const scope = { workspaceId: 'synthetic-workspace', connectionId: 'synthetic-session', accountId: 'synthetic-account', providerSurface: 'pancake-conversations' as const };
const at = '2026-11-17T00:00:00.000Z';
const context: CaptureContext = { scope, allowedPageIds: ['synthetic-page'], captureId: 'capture-before', sourceRevision: 'synthetic-lifecycle-v1', observedAt: at, direction: 'received' };
const raw = (tags: number[]) => JSON.stringify([null, null, 'pages:synthetic-page', 'pages:tag_conversations', { conversations: { 'synthetic-conversation': tags } }]);
const read = (captureId: string, tags: number[], observedAt = at) => {
  const result = observePhoenixFrame(raw(tags), { ...context, captureId, observedAt });
  if (result.kind !== 'observation') throw new Error('invalid_synthetic_fixture');
  return result.observation;
};

describe('synthetic continuity failure and recovery contracts', () => {
  it.each([15, 900])('cannot detect an offline A to B to A change from equal snapshots after %s seconds', (seconds) => {
    let state = advanceContinuity(initialContinuity(scope), { kind: 'connected', at }).state;
    state = advanceContinuity(state, { kind: 'observation', observation: read('capture-before', []) }).state;
    state = advanceContinuity(state, { kind: 'disconnected', at: '2026-11-17T00:00:01.000Z' }).state;
    // Model provider state changes during outage. Neither transition is delivered to this observer.
    const offlineStates = [[7], []];
    const recoveredAt = new Date(Date.parse(at) + (seconds + 1) * 1000).toISOString();
    state = restoreContinuity(JSON.stringify(state), scope);
    state = advanceContinuity(state, { kind: 'connected', at: recoveredAt }).state;
    const before = read('capture-before', []);
    const after = read('capture-after', offlineStates[1], recoveredAt);
    expect(after.payloadHash).toBe(before.payloadHash);
    const recovered = advanceContinuity(state, { kind: 'observation', observation: after });
    expect(recovered.disposition).toBe('accepted');
    expect(recovered.state).toMatchObject({ continuity: 'UNKNOWN', gapSince: at, status: 'connected' });
    expect(recovered.state.seen).toHaveLength(2);
    expect(recovered.state.seen.map((entry) => entry.captureId)).toEqual(['capture-before', 'capture-after']);
  });

  it('requires a distinct session after expiry and preserves the expired checkpoint', () => {
    const expired = advanceContinuity(initialContinuity(scope), { kind: 'auth-expired', at }).state;
    const reauthorizedScope = { ...scope, connectionId: 'synthetic-new-authorized-session' };
    expect(() => restoreContinuity(JSON.stringify(expired), reauthorizedScope)).toThrow('scope_mismatch');
    let next = advanceContinuity(initialContinuity(reauthorizedScope), { kind: 'connected', at }).state;
    const observation = { ...read('new-session-capture', []), scope: reauthorizedScope };
    next = advanceContinuity(next, { kind: 'observation', observation }).state;
    expect(next.status).toBe('connected');
    expect(next.continuity).toBe('UNKNOWN');
    expect(expired).toMatchObject({ status: 'auth-expired', seen: [] });
    expect(advanceContinuity(expired, { kind: 'observation', observation: read('late-old-session', []) }).disposition).toBe('blocked');
  });

  it('does not promote unknown schema or client deletion labels to lifecycle truth', () => {
    const drift = JSON.stringify([null, null, 'pages:synthetic-page', 'messages:restored_v2', { id: 'synthetic-message' }]);
    expect(observePhoenixFrame(drift, context)).toEqual({ kind: 'ignored', reason: 'unknown_event' });
    const deleted = observePhoenixFrame(JSON.stringify([null, null, 'pages:synthetic-page', 'messages:mark_as_deleted', { message: { id: 'synthetic-message', conversation_id: 'synthetic-conversation' } }]), context);
    expect(deleted).toMatchObject({ kind: 'observation', observation: { externalObjectId: 'synthetic-conversation', externalEventId: null, occurredAt: null, authenticity: 'UNKNOWN', completeness: 'UNKNOWN' } });
    expect(deleted).not.toHaveProperty('commercialEvent');
  });
});
