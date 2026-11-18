import { validId, validTime } from './observation';
import type { LifecycleLabel, MessageMetadata } from './message-lifecycle';

/**
 * Observer-relative message sightings keyed by (pageId, conversationId, providerMessageId).
 * "first-observed" is NOT "created" and "re-observed-changed" is NOT a verified edit: both only
 * describe what this observer saw. Capture ID, provider message ID and payload hash stay separate.
 */
export interface MessageSighting {
  readonly key: string;
  readonly pageId: string;
  readonly conversationId: string;
  readonly providerMessageId: string;
  /** Latest sighting by (observedAt, captureId); deterministic regardless of arrival order. */
  readonly latest: { readonly captureId: string; readonly observedAt: string; readonly label: LifecycleLabel; readonly contentHash: string };
  /** Earliest local observation time; used to decide whether a later readback could have missed it. */
  readonly earliestObservedAt: string;
  readonly captureIds: readonly string[];
  readonly distinctContentHashes: number;
  readonly deletionLabelled: boolean;
}

export type SightingDisposition = 'first-observed' | 're-observed-same' | 're-observed-changed' | 'deletion-labelled' | 'duplicate-capture' | 'stale';

export interface LedgerState {
  readonly version: 1;
  readonly sightings: Readonly<Record<string, MessageSighting & { readonly hashes: readonly string[] }>>;
}

export interface SightingInput {
  readonly captureId: string;
  readonly observedAt: string;
  readonly label: LifecycleLabel;
  readonly message: MessageMetadata;
}

export const emptyLedger = (): LedgerState => ({ version: 1, sightings: {} });

export function messageKey(pageId: string, conversationId: string, providerMessageId: string): string {
  if (![pageId, conversationId, providerMessageId].every(validId)) throw new Error('invalid_message_key');
  return JSON.stringify([pageId, conversationId, providerMessageId]);
}

const later = (a: { observedAt: string; captureId: string }, b: { observedAt: string; captureId: string }): boolean => {
  const delta = Date.parse(a.observedAt) - Date.parse(b.observedAt);
  return delta > 0 || (delta === 0 && a.captureId > b.captureId);
};

/** Pure reducer. A replayed capture of the same message is a duplicate; arrival order never changes the final latest. */
export function recordSighting(state: LedgerState, input: SightingInput): { readonly state: LedgerState; readonly disposition: SightingDisposition } {
  if (!validId(input.captureId) || !validTime(input.observedAt) || !/^[a-f0-9]{64}$/.test(input.message.contentHash) ||
      !['upsert-observed', 'deletion-labelled'].includes(input.label)) throw new Error('invalid_sighting');
  const { pageId, conversationId, providerMessageId, contentHash } = input.message;
  const key = messageKey(pageId, conversationId, providerMessageId);
  const current = state.sightings[key];
  const latest = { captureId: input.captureId, observedAt: input.observedAt, label: input.label, contentHash };
  if (!current) {
    const sighting = { key, pageId, conversationId, providerMessageId, latest, earliestObservedAt: input.observedAt, captureIds: [input.captureId], hashes: [contentHash],
      distinctContentHashes: 1, deletionLabelled: input.label === 'deletion-labelled' };
    return { state: { version: 1, sightings: { ...state.sightings, [key]: sighting } }, disposition: input.label === 'deletion-labelled' ? 'deletion-labelled' : 'first-observed' };
  }
  if (current.captureIds.includes(input.captureId)) return { state, disposition: 'duplicate-capture' };
  const hashes = current.hashes.includes(contentHash) ? current.hashes : [...current.hashes, contentHash].sort();
  const isLater = later(latest, current.latest);
  const next = {
    ...current, hashes, distinctContentHashes: hashes.length,
    captureIds: [...current.captureIds, input.captureId].sort(),
    deletionLabelled: current.deletionLabelled || input.label === 'deletion-labelled',
    latest: isLater ? latest : current.latest,
    earliestObservedAt: Date.parse(input.observedAt) < Date.parse(current.earliestObservedAt) ? input.observedAt : current.earliestObservedAt,
  };
  const disposition: SightingDisposition = !isLater ? 'stale'
    : input.label === 'deletion-labelled' ? 'deletion-labelled'
      : current.hashes.includes(contentHash) ? 're-observed-same' : 're-observed-changed';
  return { state: { version: 1, sightings: { ...state.sightings, [key]: next } }, disposition };
}

/** Stable projection for comparison and reporting; excludes internal hash lists. */
export function ledgerSnapshot(state: LedgerState): readonly MessageSighting[] {
  return Object.keys(state.sightings).sort().map((key) => {
    const { hashes: _hashes, ...sighting } = state.sightings[key];
    void _hashes;
    return sighting;
  });
}

/** Live-observed provider message IDs for one (page, conversation), for readback correlation. */
export function liveMessages(state: LedgerState, pageId: string, conversationId: string): readonly LiveMessage[] {
  return ledgerSnapshot(state).filter((item) => item.pageId === pageId && item.conversationId === conversationId)
    .map((item) => ({ providerMessageId: item.providerMessageId, earliestObservedAt: item.earliestObservedAt, deletionLabelled: item.deletionLabelled }));
}

export interface LiveMessage {
  readonly providerMessageId: string;
  readonly earliestObservedAt: string;
  readonly deletionLabelled: boolean;
}
