import { hashBytes, validId, validTime, validateScope, type Observation, type ObservationScope } from './observation';

const BUSINESS_EVENTS = new Set(['pages:update_messages', 'pages:update_conversation', 'messages:mark_as_deleted', 'pages:tag_conversations']);
const CONTROL_EVENTS = new Set(['phx_reply', 'phx_close', 'phx_error', 'phx_join', 'phx_leave', 'heartbeat']);

export interface CaptureContext {
  readonly scope: ObservationScope;
  readonly allowedPageIds: readonly string[];
  readonly captureId: string;
  readonly sourceRevision: string;
  readonly observedAt: string;
  readonly direction: 'received' | 'sent';
}

export type FrameResult =
  | { readonly kind: 'observation'; readonly observation: Observation }
  | { readonly kind: 'control'; readonly eventType: string }
  | { readonly kind: 'ignored'; readonly reason: 'outbound_frame' | 'unknown_event' }
  | { readonly kind: 'rejected'; readonly reason: 'malformed_frame' | 'oversized_frame' | 'scope_mismatch' };

/** No socket client, credential handling or commercial-state mutation lives here. */
export function observePhoenixFrame(raw: string, context: CaptureContext): FrameResult {
  validateScope(context.scope);
  if (context.scope.providerSurface !== 'pancake-conversations' ||
      !validId(context.captureId) || !validId(context.sourceRevision) || !validTime(context.observedAt) ||
      !Array.isArray(context.allowedPageIds) || !context.allowedPageIds.length || !context.allowedPageIds.every(validId) ||
      !['received', 'sent'].includes(context.direction)) throw new Error('invalid_capture_context');
  if (context.direction === 'sent') return { kind: 'ignored', reason: 'outbound_frame' };
  if (typeof raw !== 'string') return { kind: 'rejected', reason: 'malformed_frame' };
  if (Buffer.byteLength(raw, 'utf8') > 262144) return { kind: 'rejected', reason: 'oversized_frame' };
  let frame: unknown;
  try { frame = JSON.parse(raw); } catch { return { kind: 'rejected', reason: 'malformed_frame' }; }
  if (!Array.isArray(frame) || frame.length !== 5) return { kind: 'rejected', reason: 'malformed_frame' };
  const [joinRef, ref, topic, event, payload] = frame;
  if (![joinRef, ref].every((value) => value === null || validId(value)) || !validId(topic) || !validId(event) ||
      !payload || typeof payload !== 'object' || Array.isArray(payload)) return { kind: 'rejected', reason: 'malformed_frame' };
  if (topic !== 'phoenix' && (!topic.startsWith('pages:') || !context.allowedPageIds.includes(topic.slice(6)))) {
    return { kind: 'rejected', reason: 'scope_mismatch' };
  }
  if (CONTROL_EVENTS.has(event)) return { kind: 'control', eventType: event };
  if (!BUSINESS_EVENTS.has(event)) return { kind: 'ignored', reason: 'unknown_event' };
  if (topic === 'phoenix') return { kind: 'rejected', reason: 'scope_mismatch' };
  const pageClaims: unknown[] = [payload.page_id, payload.pageId, payload.conversation?.page_id, payload.message?.page_id];
  if (pageClaims.some((value) => value != null && value !== topic.slice(6))) {
    return { kind: 'rejected', reason: 'scope_mismatch' };
  }
  if (event === 'pages:tag_conversations') {
    const changed = payload.conversations;
    if (!changed || typeof changed !== 'object' || Array.isArray(changed) || !Object.keys(changed).length ||
        !Object.entries(changed).every(([key, tags]) => validId(key) && Array.isArray(tags) && tags.every(Number.isSafeInteger)) ||
        (payload.conversations_updated != null && !Array.isArray(payload.conversations_updated))) {
      return { kind: 'rejected', reason: 'malformed_frame' };
    }
    for (const item of payload.conversations_updated ?? []) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !validId(item.id) || !Object.hasOwn(changed, item.id)) {
        return { kind: 'rejected', reason: 'malformed_frame' };
      }
      if (item.page_id != null && item.page_id !== topic.slice(6)) return { kind: 'rejected', reason: 'scope_mismatch' };
    }
  }
  if (event === 'messages:mark_as_deleted' && payload.conversation_id != null &&
      payload.message?.conversation_id != null && payload.conversation_id !== payload.message.conversation_id) {
    return { kind: 'rejected', reason: 'malformed_frame' };
  }
  // Shipped client handler reads deletion references from payload.message; older relay fixtures use the outer field.
  const objectId: unknown = event === 'pages:tag_conversations' ? null : event === 'pages:update_conversation' ? payload.conversation?.id
    : event === 'messages:mark_as_deleted' ? payload.message?.conversation_id ?? payload.conversation_id : payload.conversation_id;
  if (objectId !== undefined && objectId !== null && !validId(objectId)) return { kind: 'rejected', reason: 'malformed_frame' };
  // OPEN: CE-2 - transport observations cannot become canonical commercial events here.
  return { kind: 'observation', observation: {
    scope: { ...context.scope }, captureId: context.captureId, sourceRevision: context.sourceRevision,
    externalEventId: null, externalObjectId: validId(objectId) ? objectId : null,
    eventType: event, method: 'browser-websocket', evidenceType: 'client-observed',
    authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null,
    observedAt: context.observedAt, payloadHash: hashBytes(raw),
  } };
}
