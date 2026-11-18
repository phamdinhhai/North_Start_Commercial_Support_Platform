import { scopeKey, validId, validTime, validateObservation, type Observation, type ObservationScope } from './observation';
import { analysisDigest, evaluateGapCoverage, validateProvenance, type GapCoverageEvaluation, type ReadbackProvenance } from './readback-correlation';
import { collectionKey, type ReadbackAnalysis } from './history-readback';

/**
 * Window during which provider events may have been missed. Rejoin only bounds `end`; it never closes the gap.
 * The only transition out of UNKNOWN is a bounded readback snapshot, which is still not event replay.
 */
export interface GapWindow {
  readonly id: string;
  readonly causes: readonly ('disconnected' | 'auth-expired' | 'restart' | 'legacy-checkpoint')[];
  readonly start: string;
  readonly end: string | null;
  /** Pages joined when the gap opened (from state, never from the caller, R2-I-07). */
  readonly requiredPages: readonly string[];
  /** Required pages whose matched join reply was seen since the gap opened; `end` is set once all rejoined. */
  readonly rejoinedPages: readonly string[];
  readonly status: 'UNKNOWN' | 'reconciled-by-snapshot';
  readonly reconciliation: null | {
    readonly basis: 'bounded-snapshot';
    readonly readbackStartedAt: string;
    readonly collections: readonly string[];
    /** Provenance of the readback inputs (A-m8). */
    readonly producer: string;
    readonly readerIds: readonly string[];
    readonly inputs: readonly { readonly collection: string; readonly requestedFrom: string; readonly respondedUntil: string; readonly digest: string }[];
    /** Intermediate transitions (edits, deletions, A->B->A) inside the window remain unknown. */
    readonly transitionsInWindow: 'UNKNOWN';
  };
}

export interface ContinuityState {
  readonly version: 1;
  readonly scope: ObservationScope;
  readonly status: 'idle' | 'connected' | 'disconnected' | 'auth-expired';
  readonly lastObservedAt: string | null;
  readonly gapSince: string | null;
  readonly continuity: 'UNKNOWN';
  readonly seen: readonly { readonly captureId: string; readonly fingerprint: string }[];
  readonly connectedAt: string | null;
  /** Page channels joined via a matched join reply; sorted, unique. */
  readonly pages: readonly string[];
  readonly gaps: readonly GapWindow[];
}

export type ContinuityInput =
  | { readonly kind: 'connected'; readonly at: string; readonly pageId?: string }
  | { readonly kind: 'disconnected' | 'auth-expired' | 'restart'; readonly at: string }
  | { readonly kind: 'observation'; readonly observation: Observation };

export interface ContinuityResult {
  readonly state: ContinuityState;
  readonly disposition: 'recorded' | 'accepted' | 'duplicate' | 'conflict' | 'blocked' | 'capacity' | 'out-of-order';
  readonly outOfOrder: boolean;
}

const MAX_PAGES = 256;
const sortedUnion = (items: readonly string[], item: string): string[] => [...new Set([...items, item])].sort();

export function initialContinuity(scope: ObservationScope): ContinuityState {
  scopeKey(scope);
  return { version: 1, scope: { ...scope }, status: 'idle', lastObservedAt: null, gapSince: null, continuity: 'UNKNOWN', seen: [], connectedAt: null, pages: [], gaps: [] };
}

/** Caller must atomically persist state + accepted observation before acknowledging delivery. */
export function advanceContinuity(state: ContinuityState, input: ContinuityInput, capacity = 1000): ContinuityResult {
  validateState(state);
  if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('invalid_capacity');
  const result = (disposition: ContinuityResult['disposition'], next = state, outOfOrder = false): ContinuityResult =>
    ({ state: structuredClone(next), disposition, outOfOrder });
  if (input.kind !== 'observation') {
    if (!validTime(input.at)) throw new Error('invalid_time');
    const pageId = input.kind === 'connected' ? input.pageId : undefined;
    if (pageId !== undefined && !validId(pageId)) throw new Error('invalid_page');
    if (state.status === 'auth-expired' && input.kind === 'connected') return result('blocked');
    const open = state.gaps.find((gap) => gap.end === null);
    // R2-I-08: a rejoin timestamped before the open gap began cannot bound it; refuse without touching state.
    if (input.kind === 'connected' && open && Date.parse(input.at) < Date.parse(open.start)) return result('out-of-order');
    if (pageId !== undefined && !state.pages.includes(pageId) && state.pages.length >= MAX_PAGES) return result('capacity');
    // Transport lifecycle cannot restore authorization, including across persisted restarts.
    const status = state.status === 'auth-expired' ? 'auth-expired'
      : input.kind === 'restart' ? 'disconnected' : input.kind;
    // Reconnect/restart never erases an unverified gap. A new authorized session uses a new connection ID.
    const gapSince = state.gapSince ?? state.lastObservedAt ?? input.at;
    return result('recorded', { ...state, status, gapSince, ...nextWindows(state, input.kind, input.at, status, pageId) });
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

function nextWindows(state: ContinuityState, kind: 'connected' | 'disconnected' | 'auth-expired' | 'restart', at: string,
  status: ContinuityState['status'], pageId: string | undefined): Pick<ContinuityState, 'gaps' | 'connectedAt' | 'pages'> {
  const open = state.gaps.findIndex((gap) => gap.end === null);
  if (kind === 'connected') {
    if (status !== 'connected') return { gaps: state.gaps, connectedAt: state.connectedAt, pages: state.pages };
    const pages = pageId === undefined ? state.pages : sortedUnion(state.pages, pageId);
    const gaps = state.gaps.map((gap, index) => {
      if (index !== open) return gap;
      const rejoinedPages = pageId !== undefined && gap.requiredPages.includes(pageId) ? sortedUnion(gap.rejoinedPages, pageId) : gap.rejoinedPages;
      // Rejoin bounds the window (once every required page is back) but leaves it UNKNOWN.
      const allBack = gap.requiredPages.every((page) => rejoinedPages.includes(page));
      return { ...gap, rejoinedPages, end: allBack ? at : null };
    });
    return { gaps, connectedAt: at, pages };
  }
  if (open >= 0) {
    const gap = state.gaps[open];
    const causes = gap.causes.includes(kind) ? gap.causes : [...gap.causes, kind];
    return { gaps: state.gaps.map((item, index) => (index === open ? { ...item, causes } : item)), connectedAt: state.connectedAt, pages: state.pages };
  }
  // Before the first join nothing was being observed, so there is no observation gap to record yet.
  if (state.status === 'idle') return { gaps: state.gaps, connectedAt: state.connectedAt, pages: state.pages };
  // Events after the last observation (or last join) may already have been missed before the close was noticed.
  const candidates = [state.lastObservedAt, state.connectedAt]
    .filter((value): value is string => value !== null && Date.parse(value) <= Date.parse(at))
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  const gap: GapWindow = { id: `gap-${state.gaps.length + 1}`, causes: [kind], start: candidates[0] ?? at, end: null,
    requiredPages: [...state.pages], rejoinedPages: [], status: 'UNKNOWN', reconciliation: null };
  return { gaps: [...state.gaps, gap], connectedAt: state.connectedAt, pages: state.pages };
}

export interface GapReconciliationInput {
  readonly analyses: readonly ReadbackAnalysis[];
  readonly provenance: ReadbackProvenance;
  readonly alsoRequired?: readonly { readonly pageId: string; readonly conversationId: string }[];
}

/**
 * Mark one bounded gap "reconciled-by-snapshot" when the supplied readbacks satisfy evaluateGapCoverage for the
 * gap's state-derived page set. Provenance and per-analysis digests are recorded. Continuity stays UNKNOWN and
 * gapSince is preserved: snapshots do not prove that no events were lost.
 */
export function reconcileGapBySnapshot(state: ContinuityState, gapId: string, input: GapReconciliationInput):
  { readonly state: ContinuityState; readonly evaluation: GapCoverageEvaluation } {
  validateState(state);
  if (!validId(gapId)) throw new Error('invalid_gap_id');
  if (!input || typeof input !== 'object') throw new Error('invalid_gap_coverage_input');
  validateProvenance(input.provenance);
  const gap = state.gaps.find((item) => item.id === gapId);
  if (!gap) throw new Error('unknown_gap');
  const evaluation = evaluateGapCoverage(gap, input.analyses, input.provenance, input.alsoRequired ?? []);
  const reasons = state.status === 'connected' ? evaluation.reasons : [...evaluation.reasons, `status_${state.status}`];
  if (reasons.length || evaluation.readbackStartedAt === null) {
    return { state: structuredClone(state), evaluation: { ...evaluation, eligible: false, reasons } };
  }
  const inputs = input.analyses.map((analysis) => ({ collection: collectionKey(analysis.collection),
    requestedFrom: analysis.startedAt as string, respondedUntil: analysis.endedAt as string, digest: analysisDigest(analysis) }))
    .sort((a, b) => (a.collection < b.collection ? -1 : 1));
  const reconciled: GapWindow = { ...gap, status: 'reconciled-by-snapshot', reconciliation: {
    basis: 'bounded-snapshot', readbackStartedAt: evaluation.readbackStartedAt, collections: evaluation.collections,
    producer: input.provenance.producer, readerIds: [...new Set(input.provenance.readerIds)].sort(), inputs, transitionsInWindow: 'UNKNOWN',
  } };
  return { state: structuredClone({ ...state, gaps: state.gaps.map((item) => (item.id === gapId ? reconciled : item)) }), evaluation };
}

export function restoreContinuity(serialized: string, expectedScope: ObservationScope): ContinuityState {
  const parsed = JSON.parse(serialized);
  // Checkpoints written before gap windows existed: an unverified, non-connected gapSince becomes an open legacy
  // window with no known page set (so it can never be reconciled by snapshot).
  const legacy = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !('gaps' in parsed) && !('connectedAt' in parsed) && !('pages' in parsed);
  const state: ContinuityState = legacy ? { ...parsed, connectedAt: null, pages: [],
    gaps: validTime(parsed.gapSince) && parsed.status !== 'connected' && parsed.status !== 'idle'
      ? [{ id: 'gap-1', causes: ['legacy-checkpoint'], start: parsed.gapSince, end: null, requiredPages: [], rejoinedPages: [], status: 'UNKNOWN', reconciliation: null }] : [] }
    : parsed;
  validateState(state);
  if (scopeKey(state.scope) !== scopeKey(expectedScope)) throw new Error('scope_mismatch');
  return structuredClone(state);
}

const validPageList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= MAX_PAGES && value.every(validId) &&
  new Set(value).size === value.length && value.every((item, index) => index === 0 || value[index - 1] < item);

function validateState(state: ContinuityState): void {
  if (!state || state.version !== 1 || state.continuity !== 'UNKNOWN' ||
      !['idle', 'connected', 'disconnected', 'auth-expired'].includes(state.status) ||
      (state.lastObservedAt !== null && !validTime(state.lastObservedAt)) ||
      (state.gapSince !== null && !validTime(state.gapSince)) || !Array.isArray(state.seen) ||
      state.seen.length > 10000 || !state.seen.every((item) => item && typeof item.captureId === 'string' && typeof item.fingerprint === 'string') ||
      new Set(state.seen.map((item) => item.captureId)).size !== state.seen.length ||
      (state.connectedAt !== null && !validTime(state.connectedAt)) || !validPageList(state.pages) ||
      !Array.isArray(state.gaps) || state.gaps.length > 1000 ||
      !state.gaps.every(validGap) || new Set(state.gaps.map((gap) => gap.id)).size !== state.gaps.length ||
      state.gaps.filter((gap) => gap.end === null).length > 1) throw new Error('invalid_checkpoint');
  scopeKey(state.scope);
}

function validGap(gap: GapWindow): boolean {
  const reconciliation = gap?.reconciliation;
  return !!gap && validId(gap.id) && Array.isArray(gap.causes) && gap.causes.length > 0 &&
    gap.causes.every((cause) => ['disconnected', 'auth-expired', 'restart', 'legacy-checkpoint'].includes(cause)) &&
    validTime(gap.start) && (gap.end === null || (validTime(gap.end) && Date.parse(gap.end) >= Date.parse(gap.start))) &&
    validPageList(gap.requiredPages) && validPageList(gap.rejoinedPages) && gap.rejoinedPages.every((page) => gap.requiredPages.includes(page)) &&
    (gap.status === 'UNKNOWN' ? reconciliation === null
      : gap.status === 'reconciled-by-snapshot' && gap.end !== null && !!reconciliation && validReconciliation(reconciliation, gap.end));
}

function validReconciliation(value: NonNullable<GapWindow['reconciliation']>, end: string): boolean {
  return value.basis === 'bounded-snapshot' && value.transitionsInWindow === 'UNKNOWN' &&
    validTime(value.readbackStartedAt) && Date.parse(value.readbackStartedAt) >= Date.parse(end) &&
    Array.isArray(value.collections) && value.collections.length > 0 && validId(value.producer) &&
    Array.isArray(value.readerIds) && value.readerIds.length > 0 && value.readerIds.every(validId) &&
    Array.isArray(value.inputs) && value.inputs.length === value.collections.length &&
    value.inputs.every((item) => item && value.collections.includes(item.collection) && validTime(item.requestedFrom) &&
      Date.parse(item.requestedFrom) >= Date.parse(end) && validTime(item.respondedUntil) && /^[a-f0-9]{64}$/.test(item.digest));
}
