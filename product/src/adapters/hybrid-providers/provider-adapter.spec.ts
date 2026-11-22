import { describe, expect, it } from 'vitest';
import { PancakeReadAdapter } from './pancake-read-adapter';
import { TikTokReadAdapter } from './tiktok-read-adapter';
import { ZaloReadAdapter } from './zalo-read-adapter';

const observedAt = '2026-11-21T00:00:00.000Z';
describe('R4.14 read-only provider adapter slices', () => {
  it('binds Pancake page and conversation and keeps completeness unknown', () => {
    const adapter = new PancakeReadAdapter();
    const result = adapter.observe({ provider: 'pancake', kind: 'conversation.history', context: { provider: 'pancake', surface: 'conversation', accountId: 'fabricated-account', pageId: 'fabricated-page', conversationId: 'fabricated-conversation', observedAt }, fields: { messages: [{ id: 'm1' }] } });
    expect(result).toMatchObject({ provider: 'pancake', route: 'pancake-read', synthetic: true, completeness: 'UNKNOWN', context: { pageId: 'fabricated-page', nativeObjectId: 'fabricated-conversation' } });
    expect(adapter.classifyError({ code: 'META_ERROR_10' })).toBe('POLICY_WINDOW');
  });
  it('rejects Pancake context switching and schema drift', () => {
    const adapter = new PancakeReadAdapter();
    expect(() => adapter.recognize({ provider: 'pancake', surface: 'conversation', accountId: 'a', pageId: 'b', conversationId: '', observedAt })).toThrow('INVALID_CONVERSATION_ID');
    expect(() => adapter.observe({ provider: 'pancake', kind: 'conversation.history', context: { provider: 'pancake', surface: 'conversation', accountId: 'a', pageId: 'b', conversationId: 'c', observedAt }, fields: { messages: 'not-array' } })).toThrow('PANCAKE_SCHEMA_DRIFT');
  });
  it('normalizes TikTok ads reports without allowing mutations', () => {
    const adapter = new TikTokReadAdapter();
    const result = adapter.observe({ context: { provider: 'tiktok-business', surface: 'ad-account', accountId: 'fabricated-business', advertiserId: 'fabricated-advertiser', observedAt }, kind: 'ads.report', fields: { rows: [{ campaignId: 'c1', spend: 0 }] } });
    expect(result).toMatchObject({ provider: 'tiktok-business', route: 'tiktok-read', context: { nativeObjectId: 'fabricated-advertiser' } });
    expect(adapter.classifyError({ status: 429 })).toBe('RATE_LIMITED');
  });
  it('normalizes Zalo OA threads and blocks cross-surface context', () => {
    const adapter = new ZaloReadAdapter();
    const result = adapter.observe({ context: { provider: 'zalo-oa', surface: 'oa-inbox', accountId: 'fabricated-account', oaId: 'fabricated-oa', threadId: 'fabricated-thread', observedAt }, kind: 'oa.thread', fields: { messages: [] } });
    expect(result).toMatchObject({ provider: 'zalo-oa', route: 'zalo-read', context: { pageId: 'fabricated-oa' } });
    expect(() => adapter.recognize({ provider: 'zalo-oa', surface: 'conversation', accountId: 'a', oaId: 'oa', threadId: 't', observedAt })).toThrow('ZALO_CONTEXT_MISMATCH');
  });
  it.each([[401, 'AUTHENTICATION'], [403, 'AUTHORIZATION'], [429, 'RATE_LIMITED'], ['SCHEMA_DRIFT', 'SCHEMA_DRIFT'], ['ECONNRESET', 'TRANSPORT']] as const)('classifies provider error %s without throwing', (value, expected) => {
    const adapter = new PancakeReadAdapter();
    expect(adapter.classifyError(typeof value === 'number' ? { status: value } : { code: value })).toBe(expected);
  });
});
