import { describe, expect, it } from 'vitest';
import { advancePancakeHistoryReadback, beginPancakeHistoryReadback } from './pancake-history-readback';

const target = { pageId: 'fabricated-page', conversationId: 'fabricated-conversation' };
const begin = () => beginPancakeHistoryReadback(target, { maxPages: 3, maxItems: 100 });
describe('Pancake positional history readback safety', () => {
  it('keeps positional continuation distinct from durable checkpoint and completeness', () => {
    const first = advancePancakeHistoryReadback(begin(), target, 30);
    expect(first).toMatchObject({ currentCount: 30, pagesRead: 1, itemsRead: 30, status: 'reading',
      completeness: 'UNKNOWN', lifecycleCoverage: 'UNKNOWN', durableResumeSafe: false });
    expect(first).not.toHaveProperty('nextCursor');
    expect(first).not.toHaveProperty('completed');
    expect(advancePancakeHistoryReadback(first, target, 2).currentCount).toBe(32);
  });
  it('does not call a short or empty page a complete synchronization', () => {
    const short = advancePancakeHistoryReadback(begin(), target, 1);
    expect(short.status).toBe('reading');
    const empty = advancePancakeHistoryReadback(short, target, 0);
    expect(empty).toMatchObject({ status: 'empty-pass', completeness: 'UNKNOWN', lifecycleCoverage: 'UNKNOWN' });
    expect(() => advancePancakeHistoryReadback(empty, target, 1)).toThrow('PANCAKE_READBACK_INVALID');
  });
  it('starts a fresh readback after restart instead of resuming a stale offset', () => {
    const prior = advancePancakeHistoryReadback(begin(), target, 30);
    expect(prior.currentCount).toBe(30);
    expect(begin()).toMatchObject({ currentCount: 0, itemsRead: 0, pagesRead: 0 });
  });
  it('counts every returned observation, including repeated or late lifecycle observations', () => {
    // Planner never drops records based on message ID, timestamp, edit or deletion.
    const original = advancePancakeHistoryReadback(begin(), target, 1);
    const editAndDeletion = advancePancakeHistoryReadback(original, target, 2);
    expect(editAndDeletion.itemsRead).toBe(3);
  });
  it('bounds pages/items and refuses target mismatch before advancing immutable state', () => {
    const state = begin();
    for (const other of [{ ...target, pageId: 'other' }, { ...target, conversationId: 'other' }]) {
      expect(() => advancePancakeHistoryReadback(state, other, 1)).toThrow('PANCAKE_READBACK_INVALID');
    }
    expect(state.currentCount).toBe(0);
    const bounded = advancePancakeHistoryReadback(beginPancakeHistoryReadback(target, { maxPages: 1, maxItems: 2 }), target, 2);
    expect(bounded.status).toBe('bounded');
    expect(() => advancePancakeHistoryReadback(bounded, target, 1)).toThrow('PANCAKE_READBACK_INVALID');
    expect(Object.isFrozen(state.target)).toBe(true);
  });
  it('rejects invalid counts, unsafe bounds and path-like target identifiers', () => {
    for (const count of [-1, 1.5, NaN, Infinity, 101]) expect(() => advancePancakeHistoryReadback(begin(), target, count)).toThrow();
    for (const maxPages of [0, 101, 1.5]) expect(() => beginPancakeHistoryReadback(target, { maxPages, maxItems: 100 })).toThrow();
    for (const maxItems of [0, 1001, 1.5]) expect(() => beginPancakeHistoryReadback(target, { maxPages: 1, maxItems })).toThrow();
    expect(() => beginPancakeHistoryReadback({ ...target, pageId: '../other' }, { maxPages: 1, maxItems: 1 })).toThrow();
    expect(() => advancePancakeHistoryReadback({ ...begin(), currentCount: 999 }, target, 1)).toThrow();
  });
});
