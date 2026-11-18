import { describe, expect, it, vi } from 'vitest';
import { analyzeReadback, collectionKey, runBoundedReadback, type ReadbackCollection, type ReadbackPage, type ReadbackPort } from './history-readback';

const messages: ReadbackCollection = { pageId: 'p-1', kind: 'messages', conversationId: 'conv-1' };
const at = (second: number) => new Date(Date.parse('2026-11-18T01:00:00.000Z') + second * 1000).toISOString();
const ids = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => `m-${from + i}`);
const ok = (offset: number, itemIds: string[], readerId = 'r-1', second = offset): ReadbackPage => ({ status: 'ok', readerId, offset, requestedAt: at(second), fetchedAt: at(second), itemIds });

describe('bounded readback analysis', () => {
  it('mirrors the inherited 25 + 16 + empty sample as contiguous-to-terminal but completeness UNKNOWN', () => {
    const result = analyzeReadback(messages, [ok(0, ids(0, 25)), ok(25, ids(25, 41)), ok(41, [])]);
    expect(result).toMatchObject({ coverage: 'contiguous-to-terminal', completeness: 'UNKNOWN', terminalAt: 41, provenRanges: [{ from: 0, to: 41 }], unknownRanges: [], duplicateSightings: 0 });
    expect(result.itemIds).toHaveLength(41);
  });

  it('does not treat a short page as terminal without an explicit empty page', () => {
    const result = analyzeReadback(messages, [ok(0, ids(0, 25)), ok(25, ids(25, 41))]);
    expect(result).toMatchObject({ coverage: 'partial', terminalAt: null, unknownRanges: [{ from: 41, to: null }] });
  });

  it('dedupes overlapping pages and counts duplicate sightings', () => {
    const result = analyzeReadback(messages, [ok(0, ids(0, 25)), ok(20, ids(20, 41)), ok(41, [])]);
    expect(result).toMatchObject({ coverage: 'contiguous-to-terminal', duplicateSightings: 5, provenRanges: [{ from: 0, to: 41 }] });
    expect(result.itemIds).toHaveLength(41);
  });

  it('flags position conflicts and moved IDs when a message is inserted between page reads', () => {
    // A new message at the head shifts every item by one between the first and second page.
    const shifted = ['m-new', ...ids(0, 41)];
    const result = analyzeReadback(messages, [ok(0, ids(0, 25)), ok(25, shifted.slice(25, 42)), ok(42, [])]);
    expect(result.coverage).toBe('partial');
    expect(result.movedIds).toContain('m-24');
    expect(result.duplicateSightings).toBe(1);
  });

  it('merges two concurrent readers and detects disagreement between them', () => {
    const agreeing = analyzeReadback(messages, [ok(0, ids(0, 10), 'r-1', 0), ok(0, ids(0, 10), 'r-2', 1), ok(10, ids(10, 20), 'r-2', 2), ok(10, ids(10, 20), 'r-1', 3), ok(20, [], 'r-1', 4)]);
    expect(agreeing).toMatchObject({ coverage: 'contiguous-to-terminal', readers: ['r-1', 'r-2'], duplicateSightings: 20 });
    const disagreeing = analyzeReadback(messages, [ok(0, ids(0, 10), 'r-1'), ok(0, ['m-x', ...ids(0, 9)], 'r-2'), ok(10, [], 'r-1')]);
    expect(disagreeing.coverage).toBe('partial');
    expect(disagreeing.positionConflicts[0]).toEqual({ position: 0, ids: ['m-0', 'm-x'] });
  });

  it('records cursor regression per reader without losing coverage information', () => {
    const result = analyzeReadback(messages, [ok(0, ids(0, 10)), ok(10, ids(10, 20)), ok(0, ids(0, 10), 'r-1', 30), ok(20, [], 'r-1', 31), ok(5, ids(5, 10), 'r-2')]);
    expect(result.cursorRegressions).toEqual([{ readerId: 'r-1', from: 10, to: 0 }]);
    expect(result.coverage).toBe('contiguous-to-terminal');
  });

  it('keeps failed and partial pages as UNKNOWN ranges while retaining partial IDs', () => {
    const result = analyzeReadback(messages, [
      ok(0, ids(0, 10)),
      { status: 'partial', readerId: 'r-1', offset: 10, requestedAt: at(10), fetchedAt: at(10), itemIds: ['m-10', 'm-12'], invalidItems: 1 },
      { status: 'failed', readerId: 'r-2', offset: 20, requestedAt: at(11), fetchedAt: at(11), reason: 'timeout' },
      ok(30, []),
    ]);
    expect(result).toMatchObject({ coverage: 'partial', failedPages: 1, partialPages: 1, provenRanges: [{ from: 0, to: 10 }], terminalAt: null, unknownRanges: [{ from: 10, to: null }] });
    expect(result.itemIds).toContain('m-12');
  });

  it('rejects contradictory terminals and reports no coverage when nothing succeeded', () => {
    expect(analyzeReadback(messages, [ok(0, ids(0, 5)), ok(5, []), ok(3, [], 'r-2')]).terminalAt).toBeNull();
    expect(analyzeReadback(messages, [{ status: 'failed', readerId: 'r-1', offset: 0, requestedAt: at(0), fetchedAt: at(0), reason: 'http_error' }])).toMatchObject({ coverage: 'none', unknownRanges: [{ from: 0, to: null }] });
    expect(analyzeReadback(messages, [])).toMatchObject({ coverage: 'none', startedAt: null });
  });

  it('is independent of page arrival order (apart from per-reader cursor regression)', () => {
    const pages = [ok(0, ids(0, 25), 'r-1'), ok(25, ids(25, 41), 'r-2'), ok(41, [], 'r-3'), ok(20, ids(20, 30), 'r-4')];
    const forward = analyzeReadback(messages, pages);
    expect(analyzeReadback(messages, [...pages].reverse())).toEqual(forward);
  });

  it('validates collections and pages at the boundary', () => {
    expect(() => collectionKey({ pageId: 'p-1', kind: 'messages', conversationId: null })).toThrow('invalid_collection');
    expect(() => collectionKey({ pageId: 'p-1', kind: 'conversations', conversationId: 'conv-1' })).toThrow('invalid_collection');
    expect(() => analyzeReadback(messages, [ok(-1, [])])).toThrow('invalid_page');
    expect(() => analyzeReadback(messages, [ok(0, ['m-1', 'm-1'])])).toThrow('invalid_page');
    expect(() => analyzeReadback(messages, [{ ...ok(0, []), fetchedAt: 'later' }])).toThrow('invalid_page');
    expect(() => analyzeReadback(messages, [{ status: 'partial', readerId: 'r', offset: 0, requestedAt: at(0), fetchedAt: at(0), itemIds: [], invalidItems: 0 }])).toThrow('invalid_page');
    expect(() => analyzeReadback(messages, Array.from({ length: 201 }, (_, i) => ok(i, [])))).toThrow('invalid_readback');
  });
});

describe('bounded sequential reader (mocked read-only port)', () => {
  const clock = () => { let tick = 0; return { now: vi.fn(() => at(tick++)) }; };
  const port = (pages: (unknown[] | Error)[]): ReadbackPort & { fetchPage: ReturnType<typeof vi.fn> } => {
    const fetchPage = vi.fn();
    for (const page of pages) {
      if (page instanceof Error) fetchPage.mockRejectedValueOnce(page);
      else fetchPage.mockResolvedValueOnce({ items: page });
    }
    return { fetchPage };
  };
  const options = { readerId: 'r-1', limit: 25, maxPages: 10 };

  it('advances the offset cursor by received items and stops on the empty terminal page', async () => {
    const mock = port([ids(0, 25).map((id) => ({ id, message: 'synthetic-private' })), ids(25, 41).map((id) => ({ id })), []]);
    const result = await runBoundedReadback(mock, clock(), messages, options);
    expect(mock.fetchPage.mock.calls.map(([request]) => request.offset)).toEqual([0, 25, 41]);
    expect(mock.fetchPage).toHaveBeenCalledWith({ collection: messages, offset: 0, limit: 25 });
    expect(result.analysis).toMatchObject({ coverage: 'contiguous-to-terminal', terminalAt: 41 });
    expect(JSON.stringify(result)).not.toContain('synthetic-private');
  });

  it('stops and records a failed page on port error without retrying silently', async () => {
    const mock = port([ids(0, 25).map((id) => ({ id })), new Error('synthetic network failure')]);
    const result = await runBoundedReadback(mock, clock(), messages, options);
    expect(mock.fetchPage).toHaveBeenCalledTimes(2);
    expect(result.pages[1]).toMatchObject({ status: 'failed', reason: 'http_error', offset: 25 });
    expect(result.analysis.coverage).toBe('partial');
  });

  it('records a partial page when some items lack provider IDs', async () => {
    const result = await runBoundedReadback(port([[{ id: 'm-0' }, { body: 'no id' }, null]]), clock(), messages, options);
    expect(result.pages[0]).toMatchObject({ status: 'partial', itemIds: ['m-0'], invalidItems: 2 });
    expect(result.analysis.coverage).toBe('none');
  });

  it('treats an oversize or malformed response as failed', async () => {
    const big = await runBoundedReadback(port([ids(0, 26).map((id) => ({ id }))]), clock(), messages, options);
    expect(big.pages[0]).toMatchObject({ status: 'failed', reason: 'malformed' });
    const fetchPage = vi.fn().mockResolvedValue({ rows: [] });
    expect((await runBoundedReadback({ fetchPage }, clock(), messages, options)).pages[0]).toMatchObject({ status: 'failed', reason: 'malformed' });
  });

  it('respects the page budget and leaves the tail UNKNOWN', async () => {
    const fetchPage = vi.fn(async ({ offset }: { offset: number }) => ({ items: ids(offset, offset + 25).map((id) => ({ id })) }));
    const result = await runBoundedReadback({ fetchPage }, clock(), messages, { ...options, maxPages: 3 });
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(result.analysis).toMatchObject({ coverage: 'partial', unknownRanges: [{ from: 75, to: null }] });
  });

  it('rejects unbounded options', async () => {
    const fetchPage = vi.fn();
    await expect(runBoundedReadback({ fetchPage }, clock(), messages, { ...options, maxPages: 0 })).rejects.toThrow('invalid_readback_options');
    await expect(runBoundedReadback({ fetchPage }, clock(), messages, { ...options, limit: 501 })).rejects.toThrow('invalid_readback_options');
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
