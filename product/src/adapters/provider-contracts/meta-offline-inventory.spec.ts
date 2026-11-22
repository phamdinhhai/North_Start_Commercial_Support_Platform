import { describe, expect, it } from 'vitest';
import { inventoryMetaOffline } from './meta-offline-inventory';

describe('fabricated Meta batch contract inventory', () => {
  it('visits every entry/event; echoes are not incoming text and media is reference only', () => {
    const result = inventoryMetaOffline({ object: 'page', entry: [
      { id: 'fake-a', messaging: [{ message: { mid: '1', text: 'fabricated' } }, { message: { mid: '2', text: 'fabricated echo', is_echo: true } }] },
      { id: 'fake-b', messaging: [{ message: { attachments: [{ type: 'image', payload: { url: 'https://example.invalid/fabricated' } }] } }, { message_edit: { mid: '1' } }, { message_delete: { mid: '2' } }] },
    ] }, new Set(['fake-a', 'fake-b']));
    expect(result.map(x => x.kind)).toEqual(['text', 'echo', 'attachment', 'unsupported', 'unsupported']);
    expect(result.map(x => x.pageId)).toEqual(['fake-a', 'fake-a', 'fake-b', 'fake-b', 'fake-b']);
  });
  it('does not trust payload page identity without a separate server binding', () => {
    expect(() => inventoryMetaOffline({ object: 'page', entry: [{ id: 'other', messaging: [] }] }, new Set(['fake-a']))).toThrow('META_PAGE_NOT_BOUND');
    expect(() => inventoryMetaOffline({ object: 'page', entry: Array(101).fill({}) }, new Set())).toThrow('INVALID_META_CONTRACT');
  });
});
