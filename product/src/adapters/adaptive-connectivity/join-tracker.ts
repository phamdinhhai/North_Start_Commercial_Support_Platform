import { validId, validTime } from './observation';
import type { CaptureContext } from './phoenix-observer';
import type { LifecycleResult, TransportSignal } from './message-lifecycle';

/**
 * Pending outbound phx_join frames for allowed page topics (R2-I-03). A successful reply counts as a
 * rejoin only when its (topic, join_ref, ref) equals a pending join; heartbeat or push replies never do.
 * Synthetic contract: the real Pancake join/ref behaviour is SOURCE_INSPECTED (Phoenix v2 tuple) only.
 */
export interface PendingJoin { readonly topic: string; readonly joinRef: string; readonly ref: string; readonly sentAt: string }
export interface JoinTracker { readonly version: 1; readonly pending: readonly PendingJoin[] }

export const MAX_PENDING_JOINS = 32;
export const emptyJoinTracker = (): JoinTracker => ({ version: 1, pending: [] });

function validateTracker(tracker: JoinTracker): void {
  if (!tracker || tracker.version !== 1 || !Array.isArray(tracker.pending) || tracker.pending.length > MAX_PENDING_JOINS ||
      !tracker.pending.every((item) => item && validId(item.topic) && validId(item.joinRef) && validId(item.ref) && validTime(item.sentAt))) {
    throw new Error('invalid_join_tracker');
  }
}

/** Record one outbound frame. Only phx_join on an allowed `pages:<id>` topic with join_ref and ref is kept. */
export function recordOutboundJoin(tracker: JoinTracker, raw: string, context: CaptureContext): { readonly tracker: JoinTracker; readonly recorded: boolean } {
  validateTracker(tracker);
  if (!context || context.direction !== 'sent' || !validTime(context.observedAt) || !Array.isArray(context.allowedPageIds)) throw new Error('invalid_join_context');
  const unchanged = { tracker, recorded: false };
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > 262144) return unchanged;
  let frame: unknown;
  try { frame = JSON.parse(raw); } catch { return unchanged; }
  if (!Array.isArray(frame) || frame.length !== 5) return unchanged;
  const [joinRef, ref, topic, event] = frame;
  if (event !== 'phx_join' || !validId(joinRef) || !validId(ref) || !validId(topic) || !topic.startsWith('pages:') ||
      !context.allowedPageIds.includes(topic.slice(6))) return unchanged;
  // A re-sent join for the same topic supersedes the earlier one; oldest entries are evicted beyond the bound.
  const pending = [...tracker.pending.filter((item) => item.topic !== topic), { topic, joinRef, ref, sentAt: context.observedAt }].slice(-MAX_PENDING_JOINS);
  return { tracker: { version: 1, pending }, recorded: true };
}

/** Resolve a classified transport frame against pending joins. Returns the page ID only for a matched join reply. */
export function resolveTransportSignal(tracker: JoinTracker, result: Extract<LifecycleResult, { kind: 'transport' }>):
  { readonly tracker: JoinTracker; readonly signal: TransportSignal; readonly pageId: string | null } {
  validateTracker(tracker);
  if (!result || result.kind !== 'transport') throw new Error('invalid_transport_result');
  const isReply = result.eventType === 'phx_reply' && ['reply-ok', 'auth-expired', 'join-rejected'].includes(result.signal);
  const match = isReply ? tracker.pending.find((item) => item.topic === result.topic && item.joinRef === result.joinRef && item.ref === result.ref) : undefined;
  if (!match) return { tracker, signal: result.signal === 'joined' ? 'reply-ok' : result.signal, pageId: null };
  const next: JoinTracker = { version: 1, pending: tracker.pending.filter((item) => item !== match) };
  return { tracker: next, signal: result.signal === 'reply-ok' ? 'joined' : result.signal, pageId: result.signal === 'reply-ok' ? match.topic.slice(6) : null };
}
