import type { PancakeHistoryTarget } from './pancake-history-readback';

export interface PancakeHistoryOverlapPlan {
  readonly target: PancakeHistoryTarget;
  readonly startCount: number;
  readonly overlap: number;
  readonly maxPages: number;
  readonly maxItems: number;
  readonly completeness: 'UNKNOWN';
  readonly durableResumeSafe: false;
}

const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\x00-\x20\x7f/?#]/.test(v);
const invalid = (): never => { throw new Error('PANCAKE_OVERLAP_INVALID'); };

/** Plan a bounded re-read preceding a positional offset; performs no I/O or checkpoint mutation. */
export function planPancakeHistoryOverlap(input: {
  readonly target: PancakeHistoryTarget;
  readonly currentCount: number;
  readonly overlap: number;
  readonly maxPages: number;
  readonly maxItems: number;
}): PancakeHistoryOverlapPlan {
  if (!input || !input.target || !validId(input.target.pageId) || !validId(input.target.conversationId) ||
      !Number.isSafeInteger(input.currentCount) || input.currentCount < 0 ||
      !Number.isSafeInteger(input.overlap) || input.overlap < 0 || input.overlap > input.currentCount ||
      !Number.isSafeInteger(input.maxPages) || input.maxPages < 1 || input.maxPages > 100 ||
      !Number.isSafeInteger(input.maxItems) || input.maxItems < 1 || input.maxItems > 1000) invalid();
  return Object.freeze({ target: Object.freeze({ ...input.target }), startCount: input.currentCount - input.overlap,
    overlap: input.overlap, maxPages: input.maxPages, maxItems: input.maxItems,
    completeness: 'UNKNOWN', durableResumeSafe: false });
}
