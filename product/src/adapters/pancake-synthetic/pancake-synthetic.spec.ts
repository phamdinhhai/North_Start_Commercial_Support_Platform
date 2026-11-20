import { describe, expect, it } from 'vitest';
import { decodePancakeSynthetic, PANCAKE_SYNTHETIC_FIXTURE } from './pancake-synthetic';

const fixture = () => {
  const input = structuredClone(PANCAKE_SYNTHETIC_FIXTURE) as Record<string, any>;
  delete input.originalMeta;
  delete input.payload.data.message.inserted_at;
  return input;
};

describe('Pancake fabricated webhook contract', () => {
  it('exports explicit test-only original identity for the fabricated dual-route demo', () => {
    expect(decodePancakeSynthetic(PANCAKE_SYNTHETIC_FIXTURE)).toMatchObject({
      accountId: 'synthetic-page-1',
      native: { system: 'meta', pageId: 'synthetic-page', messageId: 'synthetic-message' },
      occurredAt: '2026-11-20T00:00:00.000Z',
    });
  });
  it('retains scoped Pancake IDs without inventing Meta identity, time, event or revision', () => {
    const result = decodePancakeSynthetic(fixture());
    expect(result.native).toEqual({ system: 'pancake', pageId: 'synthetic-page-1',
      conversationId: 'synthetic-conversation-1', messageId: 'synthetic-message-1', eventId: null, revision: null });
    expect(result).toMatchObject({ provider: 'pancake', route: 'pancake-synthetic', sourceAuthority: 'synthetic_fixture',
      verification: 'UNVERIFIED', completeness: 'UNKNOWN', occurredAt: null, lifecycle: 'upsert-observed' });
    expect(Object.keys(result)).not.toContain('outcome');
    expect(Object.keys(result)).not.toContain('payloadDigest');
  });
  it('keeps missing conversation UNKNOWN and does not derive it from customer/message IDs', () => {
    const input = fixture(); delete input.payload.data.conversation; delete input.payload.data.message.conversation_id;
    expect(decodePancakeSynthetic(input).native.conversationId).toBeNull();
  });
  it('supports only explicitly fabricated original Meta linkage', () => {
    const input = fixture(); input.originalMeta = { pageId: 'meta-page-fixture', messageId: 'meta-message-fixture' };
    expect(decodePancakeSynthetic(input).native).toMatchObject({ system: 'meta', pageId: 'meta-page-fixture',
      messageId: 'meta-message-fixture', conversationId: null });
    expect(decodePancakeSynthetic(input).rawPayload.original).toEqual(input.payload);
  });
  it('preserves original fabricated payload by copy and removal label without erasing evidence', () => {
    const input = fixture(); input.payload.data.message.is_removed = true;
    input.payload.data.message.inserted_at = '2026-11-19T23:59:00Z';
    const result = decodePancakeSynthetic(input);
    input.payload.data.message.message = 'changed';
    expect(result.lifecycle).toBe('deletion-labelled');
    expect(result.occurredAt).toBe('2026-11-19T23:59:00Z');
    expect(result.rawPayload.utterance).toBe('Fabricated inquiry');
  });
  it.each(['access_token', 'page_access_token', 'api_key', 'url', 'payloadHash', 'workspaceId', 'connectionId'])('rejects %s anywhere in accepted objects without echo', key => {
    for (const select of [(x: any) => x, (x: any) => x.payload, (x: any) => x.payload.data,
      (x: any) => x.payload.data.message, (x: any) => x.payload.data.conversation]) {
      const input = fixture(); select(input)[key] = 'synthetic-sensitive-value';
      expect(() => decodePancakeSynthetic(input)).toThrow(/^INVALID_PANCAKE_SYNTHETIC$/);
    }
  });
  it.each([null, [], {}, { synthetic: false }])('rejects invalid boundaries %j', input => {
    expect(() => decodePancakeSynthetic(input)).toThrow('INVALID_PANCAKE_SYNTHETIC');
  });
  it('rejects identity mismatch, unsupported event and opaque edit history rather than guessing', () => {
    const edits = [
      (x: any) => { x.payload.data.message.page_id = 'other-page'; },
      (x: any) => { x.payload.data.message.conversation_id = 'other-conversation'; },
      (x: any) => { x.payload.event_type = 'orders'; },
      (x: any) => { x.payload.data.message.edit_history = []; },
      (x: any) => { x.payload.data.message.edit_history = { url: 'https://example.invalid' }; },
      (x: any) => { x.payload.data.message.inserted_at = 'untrusted-time'; },
    ];
    for (const edit of edits) { const input = fixture(); edit(input); expect(() => decodePancakeSynthetic(input)).toThrow('INVALID_PANCAKE_SYNTHETIC'); }
  });
});
