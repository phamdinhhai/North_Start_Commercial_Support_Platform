import type { OfflineConnection, OfflineTransportPorts, TransportBounds, TransportResponse, TransportResult, TransportStatus } from '../../ports/provider-transport';

function validBounds(b: TransportBounds): boolean {
  return [[b.maxAttempts, 10], [b.maxItems, 1000], [b.maxElapsedMs, 60000],
    [b.requestTimeoutMs, 60000], [b.backoffMs, 60000]].every(([n, max]) => Number.isSafeInteger(n) && n > 0 && n <= max);
}
function retryDelay(value: string | undefined, now: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (/^\d+$/u.test(value)) return Number(value) * 1000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : fallback;
}
/** Enforced wall-clock request deadline; abort cooperation is an additional resource bound. */
async function request(ports: OfflineTransportPorts, connection: OfflineConnection, cursor: string | null, ms: number): Promise<TransportResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => ports.request(connection, cursor, controller.signal))
        .catch((): TransportResponse => ({ status: 'provider-error' })),
      new Promise<TransportResponse>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve({ status: 'timeout' }); }, ms);
      }),
    ]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
/** Bounded function, no scheduler/network client/routes. At-least-once, no SLO promise. */
export async function runOfflineTransport(connection: OfflineConnection, initialCursor: string | null,
  bounds: TransportBounds, ports: OfflineTransportPorts): Promise<TransportResult> {
  let attempts = 0, items = 0, checkpoint = initialCursor;
  const finish = (status: TransportStatus): TransportResult => ({ status, attempts, items, checkpoint, completeness: 'UNKNOWN' });
  if (!validBounds(bounds) || connection.mode !== 'offline-synthetic' ||
      !['pancake', 'meta-page'].includes(connection.provider) || !connection.connectionId || !connection.accountId ||
      (initialCursor !== null && (typeof initialCursor !== 'string' || initialCursor.length > 4096))) return finish('invalid-configuration');
  const started = ports.now();
  if (!Number.isFinite(started)) return finish('invalid-configuration');
  while (attempts < bounds.maxAttempts) {
    const remaining = bounds.maxElapsedMs - (ports.now() - started);
    if (!Number.isFinite(remaining) || remaining <= 0) return finish('bounded');
    try { if (!await ports.isAuthorized(connection)) return finish('revoked'); }
    catch { return finish('revoked'); }
    attempts++;
    const response = await request(ports, connection, checkpoint, Math.min(remaining, bounds.requestTimeoutMs));
    if (response.status === 'provider-error') return finish('provider-error');
    if (response.status !== 'page') {
      const delay = response.status === 'rate-limited'
        ? retryDelay(response.retryAfter, ports.now(), bounds.backoffMs * 2 ** (attempts - 1))
        : bounds.backoffMs * 2 ** (attempts - 1);
      if (attempts >= bounds.maxAttempts || !Number.isFinite(delay) || delay >= bounds.maxElapsedMs - (ports.now() - started)) return finish('bounded');
      try { await ports.sleep(delay); } catch { return finish('provider-error'); }
      continue;
    }
    let page;
    try {
      page = ports.validate(response.page);
      if (!Array.isArray(page.items) || typeof page.gap !== 'boolean' ||
          (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor || page.nextCursor.length > 4096))) return finish('schema-poison');
    } catch { return finish('schema-poison'); }
    if (page.gap) return finish('gap');
    if (items + page.items.length > bounds.maxItems || ports.now() - started >= bounds.maxElapsedMs) return finish('bounded');
    try { if (!await ports.isAuthorized(connection)) return finish('revoked'); } catch { return finish('revoked'); }
    try { await ports.processAndCheckpoint(connection, page); } catch { return finish('persistence-failed'); }
    checkpoint = page.nextCursor;
    items += page.items.length;
    try { await ports.acknowledge(); } catch { return finish('ack-failed'); }
    if (checkpoint === null) return finish('complete');
    if (items >= bounds.maxItems) return finish('bounded');
  }
  return finish('bounded');
}
