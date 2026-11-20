import { describe, expect, it } from 'vitest';
import { decodeMetaSynthetic, META_SYNTHETIC_FIXTURE } from './meta-page-fixture';

function fixture() {
  return {
    schemaVersion: 1, synthetic: true, receiptId: 'receipt-1', displayName: 'Fabricated customer',
    observedAt: '2026-11-20T01:00:00.000Z',
    payload: { object: 'page', entry: [{ id: 'page-1', time: 1795136400000,
      messaging: [{ sender: { id: 'psid-1' }, recipient: { id: 'page-1' }, timestamp: 1795136400000,
        message: { mid: 'mid-1', text: 'Fabricated enquiry' } }] }] },
  };
}
describe('Meta Page synthetic fixture boundary', () => {
  it('exports an operator preset with transport account distinct from event identity', () => {
    expect(decodeMetaSynthetic(META_SYNTHETIC_FIXTURE)).toMatchObject({
      accountId: 'synthetic-page', occurredAt: '2026-11-20T00:00:00.000Z',
      native: { messageId: 'synthetic-message', eventId: null, conversationId: null },
    });
  });
  it('preserves exact detached fabricated evidence with unknown conversation/event/revision', () => {
    const raw = fixture();
    const result = decodeMetaSynthetic(raw, 'page-1');
    expect(result.rawPayload.original).toEqual(raw);
    raw.payload.entry[0].messaging[0].message.text = 'changed';
    expect(result.rawPayload.utterance).toBe('Fabricated enquiry');
    expect(result.rawPayload.original).not.toEqual(raw);
    expect(result).toMatchObject({ sourceAuthority: 'synthetic_fixture', verification: 'UNVERIFIED', completeness: 'UNKNOWN',
      native: { system: 'meta', pageId: 'page-1', messageId: 'mid-1', conversationId: null, eventId: null, revision: null } });
  });
  it('allows only explicitly disclosed fabricated conversation linkage', () => {
    const input = { ...fixture(), syntheticLinkage: { conversationId: 'fabricated-thread', disclosure: 'fabricated_fixture_linkage' } };
    expect(decodeMetaSynthetic(input, 'page-1').native.conversationId).toBe('fabricated-thread');
    expect(() => decodeMetaSynthetic({ ...input, syntheticLinkage: { conversationId: 'thread' } }, 'page-1')).toThrow('INVALID_FIXTURE');
  });
  it.each(['token', 'access_token', 'workspaceId', 'leadId', 'eventId', '__proto__'])('rejects extra boundary field %s', key => {
    const raw = JSON.parse(JSON.stringify(fixture())) as Record<string, unknown>;
    Object.defineProperty(raw, key, { value: 'untrusted', enumerable: true });
    expect(() => decodeMetaSynthetic(raw, 'page-1')).toThrow('INVALID_FIXTURE');
  });
  it('rejects connection page and recipient mismatches', () => {
    expect(() => decodeMetaSynthetic(fixture(), 'other-page')).toThrow('PAGE_MISMATCH');
    const raw = fixture(); raw.payload.entry[0].messaging[0].recipient.id = 'other-page';
    expect(() => decodeMetaSynthetic(raw, 'page-1')).toThrow('PAGE_MISMATCH');
  });
  it.each([NaN, Infinity, -1, 1.5, 8640000000000001, '2026-01-01'])('rejects timestamp %s', timestamp => {
    const raw = fixture();
    Object.assign(raw.payload.entry[0].messaging[0], { timestamp });
    expect(() => decodeMetaSynthetic(raw, 'page-1')).toThrow('INVALID_FIXTURE');
  });
  it('rejects oversize text, unsupported edits/deletions/credentials, batches and non-synthetic input', () => {
    const raw = fixture(); raw.payload.entry[0].messaging[0].message.text = 'x'.repeat(10001);
    expect(() => decodeMetaSynthetic(raw, 'page-1')).toThrow('INVALID_FIXTURE');
    for (const field of ['is_deleted', 'is_edited', 'access_token']) {
      const value = fixture(); Object.assign(value.payload.entry[0].messaging[0].message, { [field]: true });
      expect(() => decodeMetaSynthetic(value, 'page-1')).toThrow('INVALID_FIXTURE');
    }
    const batch = fixture(); batch.payload.entry.push(batch.payload.entry[0]);
    expect(() => decodeMetaSynthetic(batch, 'page-1')).toThrow('INVALID_FIXTURE');
    expect(() => decodeMetaSynthetic({ ...fixture(), synthetic: false }, 'page-1')).toThrow('INVALID_FIXTURE');
  });
});

