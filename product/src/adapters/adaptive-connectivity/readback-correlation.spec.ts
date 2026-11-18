import { describe, expect, it } from 'vitest';
import { analyzeReadback, collectionKey, type ReadbackCollection, type ReadbackPage } from './history-readback';
import { correlateLiveWithReadback, evaluateGapCoverage } from './readback-correlation';
import type { LiveMessage } from './message-ledger';
import type { GapWindow } from './continuity';

const collection: ReadbackCollection = { pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' };
const at = (second: number) => new Date(Date.parse('2026-11-18T02:00:00.000Z') + second * 1000).toISOString();
const page = (offset: number, itemIds: string[], second = 100, c = collection): { c: ReadbackCollection; p: ReadbackPage } => ({ c, p: { status: 'ok', readerId: 'r-1', offset, fetchedAt: at(second), itemIds } });
const full = (itemIds: string[], second = 100, c = collection) => analyzeReadback(c, [page(0, itemIds, second, c).p, page(itemIds.length, [], second + 1, c).p]);
const live = (id: string, second = 10, deletionLabelled = false): LiveMessage => ({ providerMessageId: id, earliestObservedAt: at(second), deletionLabelled });

describe('live observation vs readback correlation', () => {
  it('splits confirmed, missingFromLive and missingFromReadback against a contiguous readback', () => {
    const result = correlateLiveWithReadback([live('m-1'), live('m-2'), live('m-9', 10, true)], full(['m-1', 'm-2', 'm-3']));
    expect(result).toMatchObject({ confirmed: ['m-1', 'm-2'], missingFromLive: ['m-3'], missingFromReadback: ['m-9'],
      deletionLabelledMissingFromReadback: ['m-9'], unknown: [], setsEqual: false, eventsLost: 'UNKNOWN' });
  });

  it('never treats equal sets as proof that no events were lost', () => {
    const result = correlateLiveWithReadback([live('m-1'), live('m-2')], full(['m-1', 'm-2']));
    expect(result.setsEqual).toBe(true);
    expect(result.eventsLost).toBe('UNKNOWN');
    expect(result).not.toHaveProperty('noEventsLost');
  });

  it('puts live IDs into unknown when the readback is partial', () => {
    const partial = analyzeReadback(collection, [page(0, ['m-1']).p]);
    const result = correlateLiveWithReadback([live('m-1'), live('m-2')], partial);
    expect(result).toMatchObject({ confirmed: ['m-1'], missingFromReadback: [], unknown: ['m-2'], readbackCoverage: 'partial' });
  });

  it('puts live IDs first seen after the readback started into unknown, not missing', () => {
    const result = correlateLiveWithReadback([live('m-late', 150)], full(['m-1'], 100));
    expect(result).toMatchObject({ missingFromReadback: [], unknown: ['m-late'], missingFromLive: ['m-1'] });
  });

  it('rejects conversation-list analyses and malformed live input', () => {
    const list = full(['conv-1'], 100, { pageId: 'p-1', kind: 'conversations', conversationId: null });
    expect(() => correlateLiveWithReadback([], list)).toThrow('invalid_collection');
    expect(() => correlateLiveWithReadback([live('m-1'), live('m-1')], full([]))).toThrow('invalid_live_messages');
    expect(() => correlateLiveWithReadback([{ ...live('m-1'), earliestObservedAt: 'x' }], full([]))).toThrow('invalid_live_messages');
  });
});

describe('gap coverage evaluation', () => {
  const gap: GapWindow = { id: 'gap-1', causes: ['disconnected'], start: at(0), end: at(60), status: 'UNKNOWN', reconciliation: null };
  const list = (conversations: string[], second = 100) => full(conversations, second, { pageId: 'p-1', kind: 'conversations', conversationId: null });
  const history = (conversationId: string, second = 100) => full(['m-1'], second, { pageId: 'p-1', kind: 'messages', conversationId });

  it('is eligible only with a contiguous list plus contiguous history for every listed conversation after the window', () => {
    const result = evaluateGapCoverage(gap, ['p-1'], [list(['conv-1', 'conv-2']), history('conv-1'), history('conv-2')]);
    expect(result).toMatchObject({ eligible: true, reasons: [], readbackStartedAt: at(100) });
    expect(result.collections).toHaveLength(3);
  });

  it.each([
    ['open window (rejoin not yet observed)', { ...gap, end: null }, [list(['conv-1']), history('conv-1')], 'gap_not_bounded'],
    ['already reconciled', { ...gap, status: 'reconciled-by-snapshot' as const }, [list(['conv-1']), history('conv-1')], 'gap_not_unknown'],
    ['missing conversation list', gap, [history('conv-1')], 'missing_conversation_list:p-1'],
    ['missing history for a listed conversation', gap, [list(['conv-1', 'conv-2']), history('conv-1')], 'missing_message_history'],
    ['readback started inside the window', gap, [list(['conv-1'], 30), history('conv-1')], 'started_before_gap_end'],
    ['partial history', gap, [list(['conv-1']), analyzeReadback({ pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' }, [page(0, ['m-1']).p])], 'not_contiguous'],
    ['foreign page', gap, [list(['conv-1']), history('conv-1'), full([], 100, { pageId: 'p-9', kind: 'conversations', conversationId: null })], 'unexpected_page:p-9'],
  ] as const)('is not eligible: %s', (_name, window, analyses, reason) => {
    const result = evaluateGapCoverage(window, ['p-1'], analyses);
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((item) => item.startsWith(reason))).toBe(true);
  });

  it('requires history for live-observed conversations missing from the current list', () => {
    const result = evaluateGapCoverage(gap, ['p-1'], [list(['conv-1']), history('conv-1')], [{ pageId: 'p-1', conversationId: 'conv-gone' }]);
    expect(result.reasons).toEqual([`missing_message_history:${collectionKey({ pageId: 'p-1', kind: 'messages', conversationId: 'conv-gone' })}`]);
  });

  it('rejects duplicated collections and invalid inputs', () => {
    expect(evaluateGapCoverage(gap, ['p-1'], [list(['conv-1']), history('conv-1'), history('conv-1')]).reasons[0]).toMatch(/^duplicate_collection/);
    expect(() => evaluateGapCoverage(gap, [], [])).toThrow('invalid_gap_coverage_input');
  });
});
