import type { SourceObservation } from '../../ports/source-observation';

/** Every value is fabricated; the shape is based on the pinned public webhook spec. */
export const PANCAKE_SYNTHETIC_FIXTURE = Object.freeze({
  synthetic: true,
  receiptId: 'synthetic-pancake-receipt-1',
  displayName: 'Fabricated Pancake customer',
  observedAt: '2026-11-20T00:00:00.000Z',
  originalMeta: { pageId: 'synthetic-page', messageId: 'synthetic-message' },
  payload: {
    page_id: 'synthetic-page-1', event_type: 'messaging',
    data: { conversation: { id: 'synthetic-conversation-1', type: 'INBOX' },
      message: { id: 'synthetic-message-1', page_id: 'synthetic-page-1',
        conversation_id: 'synthetic-conversation-1', message: 'Fabricated inquiry', type: 'INBOX',
        inserted_at: '2026-11-20T00:00:00.000Z' } },
  },
});

const fail = (): never => { throw new Error('INVALID_PANCAKE_SYNTHETIC'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail();
}
function text(value: unknown, max = 256): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\x00-\x1f\x7f]/.test(value)) return fail();
  return value;
}
function timestamp(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) fail();
  return result;
}
/** Strict offline fixture boundary. No HTTP, hashes, inferred revisions or commercial assertions. */
export function decodePancakeSynthetic(input: unknown): SourceObservation {
  try {
    const root = object(input);
    keys(root, ['synthetic', 'receiptId', 'displayName', 'observedAt', 'payload', 'originalMeta']);
    if (root.synthetic !== true) return fail();
    const payload = object(root.payload);
    keys(payload, ['page_id', 'event_type', 'data']);
    if (payload.event_type !== 'messaging') return fail();
    const pageId = text(payload.page_id);
    const data = object(payload.data);
    keys(data, ['message', 'conversation']);
    const message = object(data.message);
    keys(message, ['id', 'page_id', 'conversation_id', 'message', 'type', 'inserted_at', 'is_removed', 'edit_history']);
    const messageId = text(message.id);
    if (message.page_id !== undefined && message.page_id !== pageId) return fail();
    const conversation = data.conversation === undefined ? null : object(data.conversation);
    if (conversation) keys(conversation, ['id', 'type']);
    const conversationId = message.conversation_id === undefined ? null : text(message.conversation_id);
    if (conversation && conversation.id !== undefined && conversationId !== null && conversation.id !== conversationId) return fail();
    const nativeConversationId = conversationId ?? (conversation?.id === undefined ? null : text(conversation.id));
    for (const type of [message.type, conversation?.type]) {
      if (type !== undefined && type !== 'INBOX' && type !== 'COMMENT') fail();
    }
    if (message.is_removed !== undefined && typeof message.is_removed !== 'boolean') return fail();
    if (message.edit_history !== undefined && message.edit_history !== null) {
      // Webhook spec says opaque object; do not accept unbounded content/credentials here.
      if (Object.keys(object(message.edit_history)).length !== 0) return fail();
    }
    let native: SourceObservation['native'] = {
      system: 'pancake', pageId, conversationId: nativeConversationId, messageId, eventId: null, revision: null,
    };
    if (root.originalMeta !== undefined) {
      const meta = object(root.originalMeta);
      keys(meta, ['pageId', 'conversationId', 'messageId']);
      native = { system: 'meta', pageId: text(meta.pageId),
        conversationId: meta.conversationId === undefined ? null : text(meta.conversationId),
        messageId: text(meta.messageId), eventId: null, revision: null };
    }
    return {
      schemaVersion: 1, provider: 'pancake', route: 'pancake-synthetic', accountId: pageId, synthetic: true,
      sourceAuthority: 'synthetic_fixture', completeness: 'UNKNOWN', verification: 'UNVERIFIED',
      receiptId: text(root.receiptId), displayName: text(root.displayName), observedAt: timestamp(root.observedAt),
      occurredAt: message.inserted_at === undefined ? null : timestamp(message.inserted_at),
      lifecycle: message.is_removed === true ? 'deletion-labelled' : 'upsert-observed', native,
      rawPayload: { utterance: text(message.message, 8000), speaker: 'unknown',
        original: JSON.parse(JSON.stringify(payload)) as Record<string, unknown> },
    };
  } catch { return fail(); }
}
