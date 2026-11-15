const events = new Set(['pages:update_messages', 'pages:update_conversation', 'messages:mark_as_deleted', 'pages:tag_conversations']);
const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
export const allowedOrigin = (url) => {
  try { return ['https://pancake.vn', 'https://app.pancake.vn'].includes(new URL(url).origin); }
  catch { return false; }
};

export function validScope(scope) {
  return scope && ['workspaceId', 'connectionId', 'accountId', 'pageId'].every((key) => id(scope[key]));
}

/** Value allowlist: message bodies, join credentials and unknown frame types never leave this function. */
export async function summarizeFrame(raw, scope, observedAt, captureId) {
  if (!validScope(scope) || typeof raw !== 'string' || raw.length > 262144) return null;
  const bytes = new TextEncoder().encode(raw);
  if (bytes.length > 262144) return null;
  let frame;
  try { frame = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(frame) || frame.length !== 5) return null;
  const [join, ref, topic, event, payload] = frame;
  if (![join, ref].every((value) => value === null || id(value)) || topic !== `pages:${scope.pageId}` ||
      !events.has(event) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const pageClaims = [payload.page_id, payload.pageId, payload.conversation?.page_id, payload.message?.page_id];
  if (pageClaims.some((value) => value != null && value !== scope.pageId)) return null;
  if (event === 'pages:tag_conversations') {
    const changed = payload.conversations;
    if (!changed || typeof changed !== 'object' || Array.isArray(changed) || !Object.keys(changed).length ||
        !Object.entries(changed).every(([key, tags]) => id(key) && Array.isArray(tags) && tags.every(Number.isSafeInteger)) ||
        (payload.conversations_updated != null && !Array.isArray(payload.conversations_updated))) return null;
    for (const item of payload.conversations_updated ?? []) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || !id(item.id) || !Object.hasOwn(changed, item.id) ||
          (item.page_id != null && item.page_id !== scope.pageId)) return null;
    }
  }
  if (event === 'messages:mark_as_deleted' && payload.conversation_id != null &&
      payload.message?.conversation_id != null && payload.conversation_id !== payload.message.conversation_id) return null;
  const objectId = event === 'pages:tag_conversations' ? null : event === 'pages:update_conversation' ? payload.conversation?.id
    : event === 'messages:mark_as_deleted' ? payload.message?.conversation_id ?? payload.conversation_id : payload.conversation_id;
  if (objectId != null && !id(objectId)) return null;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return {
    scope: { workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: 'pancake-conversations' },
    captureId, sourceRevision: 'north-star-companion/0.1.2', externalEventId: null,
    externalObjectId: objectId ?? null, eventType: event, method: 'browser-websocket',
    evidenceType: 'client-observed', authenticity: 'UNKNOWN', completeness: 'UNKNOWN',
    occurredAt: null, observedAt,
    payloadHash: Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(''),
  };
}
