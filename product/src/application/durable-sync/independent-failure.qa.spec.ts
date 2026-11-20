import { describe, expect, it, vi } from 'vitest';
import { runDurableOfflineSync } from './offline-sync';
import type { SyncCheckpointStore, SyncStream } from '../../ports/durable-sync';
import type { TransportResponse } from '../../ports/provider-transport';
import { SourceIntegrationError } from '../../ports/source-observation';

const connection = { mode: 'offline-synthetic' as const, provider: 'pancake' as const, connectionId: 'connection', accountId: 'account' };
const options = { maxPages: 3, maxItems: 10, requestTimeoutMs: 5, leaseMs: 1000, maxElapsedMs: 1000, maxFailures: 3, authorizeFetch: async () => {} };
function setup(retryCount = 0) {
  const stream: SyncStream = { id: 'stream', workspaceId: 'workspace', connectionId: 'connection', provider: 'pancake', accountId: 'account', capability: 'synthetic-messages', mode: 'offline-synthetic', status: 'active', cursor: 'opaque/start', completed: false, cursorVersion: 2, schemaVersion: 1, lastAttemptedAt: null, lastCommittedAt: null, retryCount, pageCount: 2, nextRetryAt: null, failureCode: null, gapStatus: 'UNKNOWN', leaseOwner: null, leaseUntil: null };
  const store = { createStream: vi.fn(), getStream: vi.fn().mockResolvedValue(stream), claimLease: vi.fn().mockResolvedValue({ stream, token: 'token', owner: 'worker' }), releaseLease: vi.fn(), commitPage: vi.fn().mockResolvedValue({ accepted: 0, duplicates: 0, cursor: null, version: 3, replay: false, receipts: [] }), recordFailure: vi.fn(), control: vi.fn() } satisfies SyncCheckpointStore;
  return { stream, store };
}
const page = (): TransportResponse => ({ status: 'page', page: { pageKey: 'page-three', nextCursor: null, completed: true, observations: [] } });

describe('independent durable sync failure acceptance', () => {
  it('aborts a never-resolving request and records timeout without advancing checkpoint', async () => {
    const { store } = setup(); let signal: AbortSignal | undefined;
    const request = vi.fn(async (_cursor: string | null, value: AbortSignal) => { signal = value; return new Promise<TransportResponse>(() => {}); });
    const result = await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, request, store);
    expect(result).toMatchObject({ status: 'timeout', cursor: 'opaque/start', pages: 0, items: 0 });
    expect(signal?.aborted).toBe(true); expect(store.commitPage).not.toHaveBeenCalled();
    expect(store.recordFailure).toHaveBeenCalledWith('workspace', 'stream', 'token', 'TIMEOUT', expect.any(String));
    expect(store.releaseLease).toHaveBeenCalledWith('workspace', 'stream', 'token');
  });
  it('bounds numeric Retry-After and records explicit retry exhaustion', async () => {
    const first = setup(); const began = Date.now();
    const rateLimited = async (): Promise<TransportResponse> => ({ status: 'rate-limited', retryAfter: '999999999' });
    expect((await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, rateLimited, first.store)).status).toBe('rate-limited');
    const retryAt = Date.parse(first.store.recordFailure.mock.calls[0][4]);
    expect(retryAt - began).toBeGreaterThanOrEqual(3599000); expect(retryAt - began).toBeLessThan(3601000);
    const exhausted = setup(2);
    expect((await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, rateLimited, exhausted.store)).status).toBe('retry-exhausted');
    expect(exhausted.store.recordFailure).toHaveBeenCalledWith('workspace', 'stream', 'token', 'RETRY_EXHAUSTED', null);
  });
  it('rejects poison and gap pages before any accepted evidence or checkpoint', async () => {
    for (const [status, response] of [['schema-poison', { status: 'page', page: { nextCursor: {}, observations: [] } }], ['gap', { status: 'page', page: { gap: true } }]] as const) {
      const { store } = setup();
      expect((await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, async () => response, store)).status).toBe(status);
      expect(store.commitPage).not.toHaveBeenCalled(); expect(store.releaseLease).toHaveBeenCalledTimes(1);
    }
  });
  it('categorizes revocation and database failure without exposing underlying credentials', async () => {
    const revoked = setup(); revoked.store.commitPage.mockRejectedValue(new SourceIntegrationError('CREDENTIAL_REVOKED', 403));
    const denied = await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, async () => page(), revoked.store);
    expect(denied.status).toBe('auth-revoked'); expect(revoked.store.recordFailure).toHaveBeenCalledWith('workspace', 'stream', 'token', 'AUTH_REVOKED', null);
    const unavailable = setup(); unavailable.store.commitPage.mockRejectedValue(new Error('credential-private=do-not-log'));
    const failed = await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, async () => page(), unavailable.store);
    expect(failed).toMatchObject({ status: 'persistence-failed', cursor: 'opaque/start', pages: 0 });
    expect(JSON.stringify(failed)).not.toContain('private'); expect(unavailable.store.releaseLease).toHaveBeenCalledTimes(1);
  });
  it('refuses a mismatched server lease binding before fetching provider data', async () => {
    const { store, stream } = setup(); store.claimLease.mockResolvedValue({ stream: { ...stream, workspaceId: 'foreign' }, token: 'token', owner: 'worker' }); const request = vi.fn(async () => page());
    expect((await runDurableOfflineSync(connection, 'workspace', 'stream', 'worker', options, request, store)).status).toBe('auth-revoked');
    expect(request).not.toHaveBeenCalled(); expect(store.commitPage).not.toHaveBeenCalled();
  });
});
