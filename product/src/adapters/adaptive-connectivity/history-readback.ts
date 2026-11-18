import { validId, validTime } from './observation';

/**
 * Bounded history readback model (offset cursor, as in the inherited `current_count` read contract).
 * Evidence: SOURCE_INSPECTED query keys + one bounded 25/16/0 sample; everything else SYNTHETIC_TESTED.
 * A readback is a current-state snapshot. It never proves event delivery, replay or deleted history.
 */
export interface ReadbackCollection {
  readonly pageId: string;
  readonly kind: 'messages' | 'conversations';
  /** Required for message history; null for the conversation list. */
  readonly conversationId: string | null;
}

/** requestedAt is taken BEFORE the request is sent; fetchedAt after the response (R2-I-06). */
interface PageTimes { readonly readerId: string; readonly offset: number; readonly requestedAt: string; readonly fetchedAt: string }
export type ReadbackPage =
  | (PageTimes & { readonly status: 'ok'; readonly itemIds: readonly string[] })
  | (PageTimes & { readonly status: 'partial'; readonly itemIds: readonly string[]; readonly invalidItems: number })
  | (PageTimes & { readonly status: 'failed'; readonly reason: 'timeout' | 'http_error' | 'malformed' });

export interface OffsetRange { readonly from: number; readonly to: number | null }

export interface ReadbackAnalysis {
  readonly collection: ReadbackCollection;
  /** Deduplicated provider IDs scoped by (pageId, conversationId); sorted. */
  readonly itemIds: readonly string[];
  readonly provenRanges: readonly OffsetRange[];
  readonly unknownRanges: readonly OffsetRange[];
  readonly terminalAt: number | null;
  readonly duplicateSightings: number;
  readonly positionConflicts: readonly { readonly position: number; readonly ids: readonly string[] }[];
  readonly movedIds: readonly string[];
  readonly cursorRegressions: readonly { readonly readerId: string; readonly from: number; readonly to: number }[];
  readonly failedPages: number;
  readonly partialPages: number;
  readonly readers: readonly string[];
  /** Never 'complete': contiguous-to-terminal still says nothing about tombstones or concurrent mutation. */
  readonly coverage: 'contiguous-to-terminal' | 'partial' | 'none';
  readonly completeness: 'UNKNOWN';
  /** Earliest request time across pages; the readback can only describe provider state from here on. */
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

export const MAX_READBACK_PAGES = 200;
export const MAX_ITEMS_PER_PAGE = 500;

export function collectionKey(collection: ReadbackCollection): string {
  if (!collection || !validId(collection.pageId) || !['messages', 'conversations'].includes(collection.kind) ||
      (collection.kind === 'messages' ? !validId(collection.conversationId) : collection.conversationId !== null)) {
    throw new Error('invalid_collection');
  }
  return JSON.stringify([collection.pageId, collection.kind, collection.conversationId]);
}

function validatePage(page: ReadbackPage): void {
  if (!page || !validId(page.readerId) || !Number.isSafeInteger(page.offset) || page.offset < 0 || !validTime(page.fetchedAt) ||
      !validTime(page.requestedAt) || Date.parse(page.requestedAt) > Date.parse(page.fetchedAt) ||
      !['ok', 'partial', 'failed'].includes(page.status)) throw new Error('invalid_page');
  if (page.status === 'failed') {
    if (!['timeout', 'http_error', 'malformed'].includes(page.reason)) throw new Error('invalid_page');
    return;
  }
  if (!Array.isArray(page.itemIds) || page.itemIds.length > MAX_ITEMS_PER_PAGE || !page.itemIds.every(validId) ||
      new Set(page.itemIds).size !== page.itemIds.length) throw new Error('invalid_page');
  if (page.status === 'partial' && (!Number.isSafeInteger(page.invalidItems) || page.invalidItems < 1)) throw new Error('invalid_page');
}

function merge(ranges: { from: number; to: number }[]): { from: number; to: number }[] {
  const sorted = ranges.filter((range) => range.to > range.from).sort((a, b) => a.from - b.from);
  const out: { from: number; to: number }[] = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else out.push({ ...range });
  }
  return out;
}

/** Deterministic analysis: page arrival order does not change the result (except cursor-regression detection, which follows list order per reader). */
export function analyzeReadback(collection: ReadbackCollection, pages: readonly ReadbackPage[]): ReadbackAnalysis {
  collectionKey(collection);
  if (!Array.isArray(pages) || pages.length > MAX_READBACK_PAGES) throw new Error('invalid_readback');
  pages.forEach(validatePage);
  const positions = new Map<number, Set<string>>();
  const idPositions = new Map<string, Set<number>>();
  const sightings = new Map<string, number>();
  const proven: { from: number; to: number }[] = [];
  const terminals = new Set<number>();
  const lastOffset = new Map<string, number>();
  const cursorRegressions: { readerId: string; from: number; to: number }[] = [];
  for (const page of pages) {
    const previous = lastOffset.get(page.readerId);
    if (previous !== undefined && page.offset < previous) cursorRegressions.push({ readerId: page.readerId, from: previous, to: page.offset });
    lastOffset.set(page.readerId, page.offset);
    if (page.status === 'failed') continue;
    page.itemIds.forEach((id: string, index: number) => {
      sightings.set(id, (sightings.get(id) ?? 0) + 1);
      // Partial pages lose position certainty for every item: retain the IDs, not the range.
      if (page.status !== 'ok') return;
      const position = page.offset + index;
      positions.set(position, (positions.get(position) ?? new Set()).add(id));
      idPositions.set(id, (idPositions.get(id) ?? new Set()).add(position));
    });
    if (page.status === 'ok') {
      if (page.itemIds.length) proven.push({ from: page.offset, to: page.offset + page.itemIds.length });
      else terminals.add(page.offset);
    }
  }
  const provenRanges = merge(proven);
  const positionConflicts = [...positions].filter(([, ids]) => ids.size > 1)
    .map(([position, ids]) => ({ position, ids: [...ids].sort() })).sort((a, b) => a.position - b.position);
  const movedIds = [...idPositions].filter(([, at]) => at.size > 1).map(([id]) => id).sort();
  const contiguousEnd = provenRanges[0]?.from === 0 ? provenRanges[0].to : 0;
  // An empty page is only a terminal proof when everything before it is proven and no other terminal disagrees.
  const terminalAt = terminals.size === 1 && terminals.has(contiguousEnd) ? contiguousEnd : null;
  const unknownRanges: OffsetRange[] = [];
  let cursor = 0;
  for (const range of provenRanges) {
    if (range.from > cursor) unknownRanges.push({ from: cursor, to: range.from });
    cursor = range.to;
  }
  if (terminalAt === null) unknownRanges.push({ from: cursor, to: null });
  const stable = !positionConflicts.length && !movedIds.length;
  const okPages = pages.filter((page) => page.status === 'ok');
  const byTime = (a: string, b: string) => Date.parse(a) - Date.parse(b);
  const requested = pages.map((page) => page.requestedAt).sort(byTime);
  const fetched = pages.map((page) => page.fetchedAt).sort(byTime);
  return {
    collection: { ...collection }, itemIds: [...sightings.keys()].sort(), provenRanges, unknownRanges, terminalAt,
    duplicateSightings: [...sightings.values()].reduce((sum, count) => sum + count - 1, 0),
    positionConflicts, movedIds, cursorRegressions,
    failedPages: pages.filter((page) => page.status === 'failed').length,
    partialPages: pages.filter((page) => page.status === 'partial').length,
    readers: [...new Set(pages.map((page) => page.readerId))].sort(),
    coverage: terminalAt !== null && unknownRanges.length === 0 && stable ? 'contiguous-to-terminal' : okPages.length ? 'partial' : 'none',
    completeness: 'UNKNOWN', startedAt: requested[0] ?? null, endedAt: fetched[fetched.length - 1] ?? null,
  };
}

/** Read-only port. Implementations must be GET-only and bounded; none exists in this repository. */
export interface ReadbackPort {
  fetchPage(request: { readonly collection: ReadbackCollection; readonly offset: number; readonly limit: number }): Promise<{ readonly items: readonly unknown[] }>;
}

export interface ReadbackClock { now(): string }

/** Sequential bounded reader. Stops on failure, partial page, empty page or page budget; never retries silently. */
export async function runBoundedReadback(port: ReadbackPort, clock: ReadbackClock, collection: ReadbackCollection,
  options: { readonly readerId: string; readonly limit: number; readonly maxPages: number }): Promise<{ readonly pages: readonly ReadbackPage[]; readonly analysis: ReadbackAnalysis }> {
  collectionKey(collection);
  if (!validId(options.readerId) || !Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > MAX_ITEMS_PER_PAGE ||
      !Number.isSafeInteger(options.maxPages) || options.maxPages < 1 || options.maxPages > MAX_READBACK_PAGES) throw new Error('invalid_readback_options');
  const pages: ReadbackPage[] = [];
  let offset = 0;
  while (pages.length < options.maxPages) {
    let response: { readonly items: readonly unknown[] };
    const requestedAt = clock.now();
    try {
      response = await port.fetchPage({ collection: { ...collection }, offset, limit: options.limit });
    } catch {
      pages.push({ status: 'failed', readerId: options.readerId, offset, requestedAt, fetchedAt: clock.now(), reason: 'http_error' });
      break;
    }
    const fetchedAt = clock.now();
    if (!response || !Array.isArray(response.items) || response.items.length > options.limit) {
      pages.push({ status: 'failed', readerId: options.readerId, offset, requestedAt, fetchedAt, reason: 'malformed' });
      break;
    }
    const ids = response.items.map((item) => (item && typeof item === 'object' && validId((item as { id?: unknown }).id) ? (item as { id: string }).id : null));
    const valid = [...new Set(ids.filter((id): id is string => id !== null))];
    if (valid.length !== ids.length) {
      pages.push({ status: 'partial', readerId: options.readerId, offset, requestedAt, fetchedAt, itemIds: valid, invalidItems: ids.length - valid.length });
      break;
    }
    pages.push({ status: 'ok', readerId: options.readerId, offset, requestedAt, fetchedAt, itemIds: valid });
    if (!valid.length) break;
    offset += valid.length;
  }
  return { pages, analysis: analyzeReadback(collection, pages) };
}
