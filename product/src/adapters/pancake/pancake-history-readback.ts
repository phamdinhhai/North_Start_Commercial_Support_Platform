/**
 * Positional readback planning only. The documented current_count parameter is
 * an index, not an opaque provider snapshot/cursor or durable processing proof.
 * No network transport, source admission or checkpoint mutation is registered.
 */
export interface PancakeHistoryTarget {
  readonly pageId: string;
  readonly conversationId: string;
}
export interface PancakeHistoryReadback {
  readonly target: PancakeHistoryTarget;
  readonly currentCount: number;
  readonly pagesRead: number;
  readonly itemsRead: number;
  readonly maxPages: number;
  readonly maxItems: number;
  readonly status: 'reading' | 'empty-pass' | 'bounded';
  readonly completeness: 'UNKNOWN';
  readonly lifecycleCoverage: 'UNKNOWN';
  readonly durableResumeSafe: false;
}
const invalid = (): never => { throw new Error('PANCAKE_READBACK_INVALID'); };
const id = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= 256 && !/[\x00-\x20\x7f/?#]/.test(value);

/** Target must come from the separate authenticated identity admission boundary. */
export function beginPancakeHistoryReadback(target: PancakeHistoryTarget, bounds: {
  readonly maxPages: number; readonly maxItems: number;
}): PancakeHistoryReadback {
  if (!target || !id(target.pageId) || !id(target.conversationId) || !bounds ||
      !Number.isSafeInteger(bounds.maxPages) || bounds.maxPages < 1 || bounds.maxPages > 100 ||
      !Number.isSafeInteger(bounds.maxItems) || bounds.maxItems < 1 || bounds.maxItems > 1000) invalid();
  return Object.freeze({ target: Object.freeze({ pageId: target.pageId, conversationId: target.conversationId }),
    currentCount: 0, pagesRead: 0, itemsRead: 0, maxPages: bounds.maxPages, maxItems: bounds.maxItems,
    status: 'reading', completeness: 'UNKNOWN', lifecycleCoverage: 'UNKNOWN', durableResumeSafe: false });
}

/**
 * Call only after the response target is verified and all observed items have
 * been safely processed. Counts do not dedupe or discard edits/deletion labels.
 * Bounds are local safety limits, not claims about provider limits.
 */
export function advancePancakeHistoryReadback(state: PancakeHistoryReadback,
  responseTarget: PancakeHistoryTarget, returnedCount: number): PancakeHistoryReadback {
  if (!state || !state.target || !id(state.target.pageId) || !id(state.target.conversationId) ||
      !Number.isSafeInteger(state.maxPages) || state.maxPages < 1 || state.maxPages > 100 ||
      !Number.isSafeInteger(state.maxItems) || state.maxItems < 1 || state.maxItems > 1000 ||
      !Number.isSafeInteger(state.pagesRead) || state.pagesRead < 0 || state.pagesRead >= state.maxPages ||
      !Number.isSafeInteger(state.itemsRead) || state.itemsRead < 0 || state.itemsRead >= state.maxItems ||
      state.currentCount !== state.itemsRead || state.completeness !== 'UNKNOWN' ||
      state.lifecycleCoverage !== 'UNKNOWN' || state.durableResumeSafe !== false ||
      state.status !== 'reading' || !responseTarget || responseTarget.pageId !== state.target.pageId ||
      responseTarget.conversationId !== state.target.conversationId || !Number.isSafeInteger(returnedCount) ||
      returnedCount < 0 || returnedCount > state.maxItems - state.itemsRead) invalid();
  const pagesRead = state.pagesRead + 1, itemsRead = state.itemsRead + returnedCount;
  return Object.freeze({ ...state, currentCount: itemsRead, pagesRead, itemsRead,
    status: returnedCount === 0 ? 'empty-pass' : pagesRead >= state.maxPages || itemsRead >= state.maxItems ? 'bounded' : 'reading' });
}
