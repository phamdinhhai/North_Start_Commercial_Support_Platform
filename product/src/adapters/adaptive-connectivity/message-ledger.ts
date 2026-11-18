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
  /** Latest sighting by (observedAt, captureId, contentHash, label); deterministic regardless of arrival order. */
  readonly latest: SightingVariant & { readonly captureId: string };
  /** Earliest local observation time; used to decide whether a later readback could have missed it. */
  readonly earliestObservedAt: string;
  readonly captureIds: readonly string[];
  /** Capture IDs replayed with different content/time/label (R2-I-04): surfaced, never silently deduplicated. */
  readonly conflictedCaptureIds: readonly string[];
  readonly distinctContentHashes: number;
  readonly deletionLabelled: boolean;
}

interface SightingVariant { readonly observedAt: string; readonly label: LifecycleLabel; readonly contentHash: string }

export type SightingDisposition = 'first-observed' | 're-observed-same' | 're-observed-changed' | 'deletion-labelled' |
  'duplicate-capture' | 'capture-conflict' | 'stale';

interface SightingRecord {
  readonly key: string;
  readonly pageId: string;
  readonly conversationId: string;
  readonly providerMessageId: string;
  /** Every distinct variant seen per capture ID, sorted; derived fields are a pure function of this set. */
  readonly variants: Readonly<Record<string, readonly SightingVariant[]>>;
}

export interface LedgerState {
  readonly version: 2;
  readonly sightings: Readonly<Record<string, SightingRecord>>;
}

export interface SightingInput {
  readonly captureId: string;
  readonly observedAt: string;
  readonly label: LifecycleLabel;
  readonly message: MessageMetadata;
}

export const emptyLedger = (): LedgerState => ({ version: 2, sightings: {} });

export function messageKey(pageId: string, conversationId: string, providerMessageId: string): string {
  if (![pageId, conversationId, providerMessageId].every(validId)) throw new Error('invalid_message_key');
  return JSON.stringify([pageId, conversationId, providerMessageId]);
}

type Flat = SightingVariant & { readonly captureId: string };
const compare = (a: Flat, b: Flat): number => (Date.parse(a.observedAt) - Date.parse(b.observedAt)) ||
  (a.captureId < b.captureId ? -1 : a.captureId > b.captureId ? 1 : 0) ||
  (a.contentHash < b.contentHash ? -1 : a.contentHash > b.contentHash ? 1 : 0) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0);
const variantKey = (variant: SightingVariant): string => JSON.stringify([variant.observedAt, variant.label, variant.contentHash]);

function derive(record: SightingRecord): MessageSighting {
  const captureIds = Object.keys(record.variants).sort();
  const all: Flat[] = captureIds.flatMap((captureId) => record.variants[captureId].map((variant) => ({ ...variant, captureId }))).sort(compare);
  const latest = all[all.length - 1];
  return {
    key: record.key, pageId: record.pageId, conversationId: record.conversationId, providerMessageId: record.providerMessageId,
    latest: { captureId: latest.captureId, observedAt: latest.observedAt, label: latest.label, contentHash: latest.contentHash },
    earliestObservedAt: all.reduce((min, item) => (Date.parse(item.observedAt) < Date.parse(min) ? item.observedAt : min), latest.observedAt),
    captureIds, conflictedCaptureIds: captureIds.filter((captureId) => record.variants[captureId].length > 1),
    distinctContentHashes: new Set(all.map((item) => item.contentHash)).size,
    deletionLabelled: all.some((item) => item.label === 'deletion-labelled'),
  };
}

/**
 * Pure reducer. The resulting ledger is a function of the SET of inputs, so every arrival order yields
 * the same snapshot. Only the returned disposition describes the order in which this input arrived.
 */
export function recordSighting(state: LedgerState, input: SightingInput): { readonly state: LedgerState; readonly disposition: SightingDisposition } {
  if (!state || state.version !== 2 || !state.sightings || typeof state.sightings !== 'object') throw new Error('invalid_ledger');
  if (!input || !validId(input.captureId) || !validTime(input.observedAt) || !input.message || !/^[a-f0-9]{64}$/.test(input.message.contentHash) ||
      !['upsert-observed', 'deletion-labelled'].includes(input.label)) throw new Error('invalid_sighting');
  const { pageId, conversationId, providerMessageId, contentHash } = input.message;
  const key = messageKey(pageId, conversationId, providerMessageId);
  const variant: SightingVariant = { observedAt: input.observedAt, label: input.label, contentHash };
  const current = state.sightings[key];
  const store = (record: SightingRecord, disposition: SightingDisposition) =>
    ({ state: { version: 2 as const, sightings: { ...state.sightings, [key]: record } }, disposition });
  if (!current) {
    return store({ key, pageId, conversationId, providerMessageId, variants: { [input.captureId]: [variant] } },
      input.label === 'deletion-labelled' ? 'deletion-labelled' : 'first-observed');
  }
  const existing = current.variants[input.captureId];
  if (existing) {
    if (existing.some((item) => variantKey(item) === variantKey(variant))) return { state, disposition: 'duplicate-capture' };
    const merged = [...existing, variant].sort((a, b) => compare({ ...a, captureId: '' }, { ...b, captureId: '' }));
    return store({ ...current, variants: { ...current.variants, [input.captureId]: merged } }, 'capture-conflict');
  }
  const before = derive(current);
  const isLater = compare({ ...variant, captureId: input.captureId }, before.latest) > 0;
  const hadHash = Object.values(current.variants).some((items) => items.some((item) => item.contentHash === contentHash));
  const disposition: SightingDisposition = !isLater ? 'stale'
    : input.label === 'deletion-labelled' ? 'deletion-labelled' : hadHash ? 're-observed-same' : 're-observed-changed';
  return store({ ...current, variants: { ...current.variants, [input.captureId]: [variant] } }, disposition);
}

/** Stable projection for comparison and reporting. */
export function ledgerSnapshot(state: LedgerState): readonly MessageSighting[] {
  return Object.keys(state.sightings).sort().map((key) => derive(state.sightings[key]));
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
