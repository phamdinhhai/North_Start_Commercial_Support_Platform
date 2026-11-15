import { scopeKey, validTime, validateObservation, type Observation, type ObservationScope } from './observation';

export interface ContinuityState {
  readonly version: 1;
  readonly scope: ObservationScope;
  readonly status: 'idle' | 'connected' | 'disconnected' | 'auth-expired';
  readonly lastObservedAt: string | null;
  readonly gapSince: string | null;
  readonly continuity: 'UNKNOWN';
  readonly seen: readonly { readonly captureId: string; readonly fingerprint: string }[];
}

export type ContinuityInput =
  | { readonly kind: 'connected' | 'disconnected' | 'auth-expired' | 'restart'; readonly at: string }
  | { readonly kind: 'observation'; readonly observation: Observation };

export interface ContinuityResult {
  readonly state: ContinuityState;
  readonly disposition: 'recorded' | 'accepted' | 'duplicate' | 'conflict' | 'blocked' | 'capacity';
  readonly outOfOrder: boolean;
}

export function initialContinuity(scope: ObservationScope): ContinuityState {
  scopeKey(scope);
  return { version: 1, scope: { ...scope }, status: 'idle', lastObservedAt: null, gapSince: null, continuity: 'UNKNOWN', seen: [] };
}

/** Caller must atomically persist state + accepted observation before acknowledging delivery. */
export function advanceContinuity(state: ContinuityState, input: ContinuityInput, capacity = 1000): ContinuityResult {
  validateState(state);
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('invalid_capacity');
  const result = (disposition: ContinuityResult['disposition'], next = state, outOfOrder = false): ContinuityResult =>
    ({ state: structuredClone(next), disposition, outOfOrder });
  if (input.kind !== 'observation') {
    if (!validTime(input.at)) throw new Error('invalid_time');
    if (state.status === 'auth-expired' && input.kind === 'connected') return result('blocked');
    // Transport lifecycle cannot restore authorization, including across persisted restarts.
    const status = state.status === 'auth-expired' ? 'auth-expired'
      : input.kind === 'restart' ? 'disconnected' : input.kind;
    // Reconnect/restart never erases an unverified gap. A new authorized session uses a new connection ID.
    const gapSince = state.gapSince ?? state.lastObservedAt ?? input.at;
    return result('recorded', { ...state, status, gapSince });
  }
  const observation = input.observation;
  validateObservation(observation);
  if (scopeKey(state.scope) !== scopeKey(observation.scope)) throw new Error('scope_mismatch');
  if (state.status !== 'connected') return result('blocked');
  const fingerprint = JSON.stringify([
    observation.payloadHash, observation.eventType, observation.externalEventId, observation.externalObjectId,
    observation.method, observation.evidenceType, observation.sourceRevision, observation.observedAt,
  ]);
  const existing = state.seen.find((item) => item.captureId === observation.captureId);
  if (existing) return result(existing.fingerprint === fingerprint ? 'duplicate' : 'conflict');
  // Never evict silently: without provider event IDs, identical payloads can be distinct events.
  if (state.seen.length >= capacity) return result('capacity');
  const outOfOrder = state.lastObservedAt !== null && Date.parse(observation.observedAt) < Date.parse(state.lastObservedAt);
  return result('accepted', {
    ...state,
    lastObservedAt: outOfOrder ? state.lastObservedAt : observation.observedAt,
    seen: [...state.seen, { captureId: observation.captureId, fingerprint }],
  }, outOfOrder);
}

export function restoreContinuity(serialized: string, expectedScope: ObservationScope): ContinuityState {
  const state: ContinuityState = JSON.parse(serialized);
  validateState(state);
  if (scopeKey(state.scope) !== scopeKey(expectedScope)) throw new Error('scope_mismatch');
  return structuredClone(state);
}

function validateState(state: ContinuityState): void {
  if (!state || state.version !== 1 || state.continuity !== 'UNKNOWN' ||
      !['idle', 'connected', 'disconnected', 'auth-expired'].includes(state.status) ||
      (state.lastObservedAt !== null && !validTime(state.lastObservedAt)) ||
      (state.gapSince !== null && !validTime(state.gapSince)) || !Array.isArray(state.seen) ||
      state.seen.length > 10000 || !state.seen.every((item) => item && typeof item.captureId === 'string' && typeof item.fingerprint === 'string') ||
      new Set(state.seen.map((item) => item.captureId)).size !== state.seen.length) throw new Error('invalid_checkpoint');
  scopeKey(state.scope);
}
