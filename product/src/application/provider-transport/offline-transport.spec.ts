import { describe, expect, it, vi } from 'vitest';
import { runOfflineTransport } from './offline-transport';
import type { OfflineConnection, OfflineTransportPorts, TransportBounds, TransportPage, TransportResponse } from '../../ports/provider-transport';

const connection: OfflineConnection = { mode: 'offline-synthetic', provider: 'pancake', connectionId: 'fabricated-connection', accountId: 'fabricated-page' };
const bounds: TransportBounds = { maxAttempts: 3, maxItems: 10, maxElapsedMs: 1000, requestTimeoutMs: 10, backoffMs: 1 };
const page = (nextCursor: string | null = null, items: readonly unknown[] = ['fabricated']): TransportResponse => ({ status: 'page', page: { items, nextCursor, gap: false } });
function harness(responses: TransportResponse[]) {
  let time = 0;
  let durable: string | null = 'opaque/start';
  const order: string[] = [], receipts = new Set<unknown>();
  const ports: { -readonly [K in keyof OfflineTransportPorts]: OfflineTransportPorts[K] } = {
    now: () => time,
    sleep: vi.fn(async ms => { time += ms; }),
    isAuthorized: vi.fn(async () => true),
    request: vi.fn(async () => responses.shift() ?? page()),
    validate: input => input as TransportPage,
    processAndCheckpoint: vi.fn(async (_connection, current) => {
      current.items.forEach((item: unknown) => receipts.add(item)); durable = current.nextCursor; order.push('commit');
    }),
    acknowledge: vi.fn(async () => { order.push('ack'); }),
  };
  return { ports, order, receipts, durable: () => durable };
}
describe('offline bounded provider transport', () => {
  it('commits receipts and opaque checkpoint before ack; cursor is not a sequence', async () => {
    const h = harness([page('opaque/z'), page('opaque/a'), page()]);
    const result = await runOfflineTransport(connection, 'opaque/start', bounds, h.ports);
    expect(result).toMatchObject({ status: 'complete', attempts: 3, completeness: 'UNKNOWN' });
    expect(h.order).toEqual(['commit', 'ack', 'commit', 'ack', 'commit', 'ack']);
    expect(h.ports.request).toHaveBeenNthCalledWith(3, connection, 'opaque/a', expect.any(AbortSignal));
  });
  it('persistence rejection cannot advance the checkpoint or ack', async () => {
    const h = harness([page('next')]);
    h.ports.processAndCheckpoint = vi.fn(async () => { throw new Error('secret provider query'); });
    expect(await runOfflineTransport(connection, 'opaque/start', bounds, h.ports)).toMatchObject({ status: 'persistence-failed', checkpoint: 'opaque/start' });
    expect(h.durable()).toBe('opaque/start'); expect(h.ports.acknowledge).not.toHaveBeenCalled();
  });
  it('ack loss and replay are at least once with idempotent receipt persistence', async () => {
    const h = harness([page('next'), page('next')]);
    h.ports.acknowledge = vi.fn().mockRejectedValueOnce(new Error('token')).mockResolvedValue(undefined);
    expect((await runOfflineTransport(connection, 'opaque/start', bounds, h.ports)).status).toBe('ack-failed');
    expect(h.durable()).toBe('next');
    await runOfflineTransport(connection, 'opaque/start', { ...bounds, maxAttempts: 1 }, h.ports);
    expect(h.receipts.size).toBe(1);
  });
  it('respects numeric Retry-After, HTTP date and timeout backoff without network', async () => {
    const h = harness([{ status: 'rate-limited', retryAfter: '1' }, page()]);
    expect((await runOfflineTransport(connection, null, { ...bounds, maxElapsedMs: 3000 }, h.ports)).status).toBe('complete');
    expect(h.ports.sleep).toHaveBeenCalledWith(1000);
    const dated = harness([{ status: 'rate-limited', retryAfter: new Date(1000).toUTCString() }, { status: 'timeout' }, page()]);
    await runOfflineTransport(connection, null, { ...bounds, maxElapsedMs: 3000 }, dated.ports);
    expect(dated.ports.sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(dated.ports.sleep).toHaveBeenNthCalledWith(2, 2);
  });
  it('enforces a real deadline on a never resolving request and aborts it', async () => {
    const h = harness([]); let signal: AbortSignal | undefined;
    h.ports.request = vi.fn(async (_c, _cursor, s) => { signal = s; return new Promise<TransportResponse>(() => {}); });
    expect((await runOfflineTransport(connection, null, { ...bounds, maxAttempts: 1 }, h.ports)).status).toBe('bounded');
    expect(signal?.aborted).toBe(true);
  });
  it('stops before processing on revoke, explicit gaps and schema poison', async () => {
    for (const reason of ['revoked', 'gap', 'schema-poison'] as const) {
      const h = harness([reason === 'gap' ? { status: 'page', page: { items: [], nextCursor: null, gap: true } } : page()]);
      if (reason === 'revoked') h.ports.isAuthorized = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      if (reason === 'schema-poison') h.ports.validate = () => { throw new Error('raw private body'); };
      expect((await runOfflineTransport(connection, null, bounds, h.ports)).status).toBe(reason);
      expect(h.ports.processAndCheckpoint).not.toHaveBeenCalled();
    }
  });
  it('bounds retries, item count and elapsed time without silent dropping', async () => {
    const h = harness([page(null, Array(11).fill('fabricated'))]);
    expect((await runOfflineTransport(connection, null, bounds, h.ports)).status).toBe('bounded');
    expect(h.ports.processAndCheckpoint).not.toHaveBeenCalled();
    const retry = harness([{ status: 'rate-limited', retryAfter: '99999999' }]);
    expect((await runOfflineTransport(connection, null, bounds, retry.ports)).attempts).toBe(1);
    for (const maxAttempts of [NaN, Infinity, 0, 11]) expect((await runOfflineTransport(connection, null, { ...bounds, maxAttempts }, h.ports)).status).toBe('invalid-configuration');
  });
  it('redacts provider exceptions and rejects runtime privilege/configuration spoofing', async () => {
    const h = harness([]); h.ports.request = vi.fn(async () => { throw new Error('access_token=private'); });
    const result = await runOfflineTransport(connection, null, bounds, h.ports);
    expect(JSON.stringify(result)).not.toContain('private'); expect(result.status).toBe('provider-error');
    expect((await runOfflineTransport({ ...connection, mode: 'live' } as unknown as OfflineConnection, null, bounds, h.ports)).status).toBe('invalid-configuration');
  });
  it('rejects authorization errors, exhausted budgets and invalid page cursors', async () => {
    const h = harness([page('next')]);
    h.ports.isAuthorized = async () => { throw new Error('private'); };
    expect((await runOfflineTransport(connection, null, bounds, h.ports)).status).toBe('revoked');
    h.ports.isAuthorized = async () => true;
    h.ports.now = vi.fn().mockReturnValueOnce(0).mockReturnValue(1000);
    expect((await runOfflineTransport(connection, null, bounds, h.ports)).status).toBe('bounded');
    h.ports.now = () => NaN;
    expect((await runOfflineTransport(connection, null, bounds, h.ports)).status).toBe('invalid-configuration');
    h.ports.now = () => 0;
    h.ports.validate = () => ({ items: [], gap: false, nextCursor: '' });
    expect((await runOfflineTransport(connection, null, bounds, h.ports)).status).toBe('schema-poison');
    const retry = harness([{ status: 'timeout' }]);
    retry.ports.sleep = async () => { throw new Error('private'); };
    expect((await runOfflineTransport(connection, null, bounds, retry.ports)).status).toBe('provider-error');
  });
});
