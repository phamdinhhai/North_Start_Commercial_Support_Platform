import { describe, expect, it, vi } from 'vitest';
import { PancakeReadAdapter, classifyResponse } from './pancake-adapter';
import { MockPancakeTransport } from './mock-pancake-transport';

const connection = { workspaceId: 'ws-1', connectionId: 'page-1', surface: 'conversations' as const };
const record = (id: string, capturedAt: string, payload: unknown = { text: id }) => ({ id, type: 'message', capturedAt, payload });
const page = (records: unknown[], nextCursor: string | null = null) => ({ records, nextCursor });
const enabled = { enabled: true, sleep: vi.fn(async () => undefined), baseBackoffMs: 1 };

describe('PancakeReadAdapter contract', () => {
  it('is disabled by default and does not call transport', async () => {
    const transport = new MockPancakeTransport([{ status: 200, page: page([record('x', '2026-01-01T00:00:00Z')]) }]);
    const result = await new PancakeReadAdapter(transport).read(connection);
    expect(result.status).toBe('disabled');
    expect(transport.requests).toHaveLength(0);
  });

  it('keeps Conversations and POS connection references distinct', async () => {
    const transport = new MockPancakeTransport([{ status: 200, page: page([record('x', '2026-01-01T00:00:00Z')]) }]);
    const result = await new PancakeReadAdapter(transport, enabled).read({ ...connection, surface: 'pos' });
    expect(result.surface).toBe('pos');
    expect(transport.requests[0].connection.surface).toBe('pos');
  });

  it('maps a page to immutable raw envelopes and preserves workspace connection', async () => {
    const raw = { text: 'hello', nested: { n: 1 } };
    const result = await new PancakeReadAdapter(new MockPancakeTransport([{ status: 200, page: page([record('m1', '2026-01-01T00:00:00Z', raw)]) }]), enabled).read(connection);
    expect(result.status).toBe('completed');
    expect(result.envelopes[0]).toMatchObject({ workspaceId: 'ws-1', connection: 'page-1', externalRecordId: 'm1', mappingStatus: 'pending', acquisitionSource: 'system' });
    expect(result.envelopes[0].rawPayload).toEqual(raw);
    (raw as { text: string }).text = 'mutated';
    expect(result.envelopes[0].rawPayload).toEqual({ text: 'hello', nested: { n: 1 } });
  });

  it('separates transport cursor from checkpoint and terminates on null cursor', async () => {
    const transport = new MockPancakeTransport([
      { status: 200, page: page([record('m1', '2026-01-01T00:00:00Z')], 'next') },
      { status: 200, page: page([record('m2', '2026-01-02T00:00:00Z')], null) },
    ]);
    const result = await new PancakeReadAdapter(transport, enabled).read(connection);
    expect(result.pagesRead).toBe(2);
    expect(result.cursor).toEqual({ value: null, pageIndex: 2 });
    expect(result.checkpoint).toMatchObject({ lastExternalRecordId: 'm2', acceptedCount: 2 });
    expect(transport.requests.map((r) => r.cursor.value)).toEqual([null, 'next']);
  });

  it('handles empty page as a normal terminal page', async () => {
    const result = await new PancakeReadAdapter(new MockPancakeTransport([{ status: 200, page: page([]) }]), enabled).read(connection);
    expect(result.status).toBe('completed');
    expect(result.pagesRead).toBe(1);
    expect(result.envelopes).toHaveLength(0);
  });

  it('quarantines malformed page and malformed records as UNKNOWN', async () => {
    const malformed = await new PancakeReadAdapter(new MockPancakeTransport([{ status: 200, page: { records: 'nope' } }]), enabled).read(connection);
    expect(malformed.status).toBe('unknown');
    expect(malformed.quarantined[0].reason).toBe('malformed_page');
    const badRecord = await new PancakeReadAdapter(new MockPancakeTransport([{ status: 200, page: page([{ id: '', capturedAt: 'bad' }]) }]), enabled).read(connection);
    expect(badRecord.quarantined[0].reason).toBe('malformed_record');
  });

  it.each([
    [401, 'auth_expired'], [403, 'forbidden'],
  ] as const)('quarantines %i as %s without retry', async (status, reason) => {
    const transport = new MockPancakeTransport([{ status }]);
    const result = await new PancakeReadAdapter(transport, enabled).read(connection);
    expect(result.quarantined[0].reason).toBe(reason);
    expect(transport.requests).toHaveLength(1);
  });

  it.each([[429, 'rate_limited'], [599, 'timeout']] as const)('retries %i (%s) and then quarantines after exhaustion', async (status, reason) => {
    const sleep = vi.fn(async () => undefined);
    const transport = new MockPancakeTransport([{ status }]);
    const result = await new PancakeReadAdapter(transport, { ...enabled, sleep, maxAttempts: 2 }).read(connection);
    expect(transport.requests).toHaveLength(2);
    expect(sleep).toHaveBeenCalled();
    expect(result.quarantined[0].reason).toBe(reason);
  });

  it('quarantines duplicate changed payload and deduplicates identical out-of-order records', async () => {
    const transport = new MockPancakeTransport([
      { status: 200, page: page([record('m1', '2026-01-02T00:00:00Z', { v: 1 })], 'next') },
      { status: 200, page: page([record('m1', '2026-01-01T00:00:00Z', { v: 1 }), record('m2', '2026-01-03T00:00:00Z', { v: 2 })]) },
    ]);
    const result = await new PancakeReadAdapter(transport, enabled).read(connection);
    expect(result.duplicates).toHaveLength(1);
    expect(result.envelopes).toHaveLength(2);
    expect(result.outOfOrder).toHaveLength(1);
    const conflict = await new PancakeReadAdapter(new MockPancakeTransport([
      { status: 200, page: page([record('m1', '2026-01-01T00:00:00Z', { v: 1 })], 'next') },
      { status: 200, page: page([record('m1', '2026-01-01T00:00:00Z', { v: 2 })]) },
    ]), enabled).read(connection);
    expect(conflict.quarantined[0].reason).toBe('changed_payload_conflict');
  });

  it('classifies success, auth, retry, and unsupported responses', () => {
    expect(classifyResponse({ status: 200 }).disposition).toBe('stop');
    expect(classifyResponse({ status: 401 }).reason).toBe('auth_expired');
    expect(classifyResponse({ status: 403 }).reason).toBe('forbidden');
    expect(classifyResponse({ status: 429 }).disposition).toBe('retry');
    expect(classifyResponse({ status: 400 }).reason).toBe('schema_conflict');
  });
});
