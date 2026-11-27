import { describe, expect, it } from 'vitest';
import { planPancakeHistoryOverlap } from './pancake-history-overlap';
const target = { pageId: 'page', conversationId: 'conversation' };
describe('bounded positional overlap planning', () => {
  it('rewinds only the requested overlap and remains unknown', () => {
    expect(planPancakeHistoryOverlap({ target, currentCount: 90, overlap: 30, maxPages: 3, maxItems: 100 })).toMatchObject({ startCount: 60, overlap: 30, completeness: 'UNKNOWN', durableResumeSafe: false });
  });
  it('allows a fresh pass and freezes identity', () => {
    const plan = planPancakeHistoryOverlap({ target, currentCount: 0, overlap: 0, maxPages: 1, maxItems: 1 });
    expect(plan.startCount).toBe(0); expect(Object.isFrozen(plan.target)).toBe(true);
  });
  it('rejects overlap beyond the observed positional count and unsafe bounds', () => {
    expect(() => planPancakeHistoryOverlap({ target, currentCount: 2, overlap: 3, maxPages: 1, maxItems: 1 })).toThrow();
    expect(() => planPancakeHistoryOverlap({ target, currentCount: 0, overlap: 0, maxPages: 101, maxItems: 1 })).toThrow();
  });
});
