import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import contracts from '../adaptive-connectivity/pancake-contract-fixtures.json';

const directory = resolve('src/adapters/browser-companion');
const scope = { workspaceId: 'workspace-test', connectionId: 'connection-test', accountId: 'account-test', pageId: 'page-test' };
const key = 'northStarResearchV1';
const url = 'https://pancake.vn/';

async function harness(initial: Record<string, any> = {}, fetcher: any = async () => { throw new Error("offline"); }) {
  const protocol = await import(pathToFileURL(resolve(directory, 'protocol.mjs')).href);
  const upload = await import(pathToFileURL(resolve(directory, 'upload.mjs')).href);
  const handlers: Record<string, (...args: any[]) => any> = {};
  const storage = structuredClone(initial);
  const calls: string[] = [];
  let tabUrl = url;
  let failWrites = false;
  const listener = (name: string) => ({ addListener: (callback: (...args: any[]) => any) => { handlers[name] = callback; } });
  const chrome = {
    permissions: { contains: async () => true },
    runtime: { id: 'test-extension', getURL: (path: string) => `chrome-extension://test-extension/${path}`, onMessage: listener('message'), onStartup: listener('startup') },
    storage: { local: {
      get: async () => structuredClone(storage),
      set: async (value: Record<string, unknown>) => { if (failWrites) throw new Error('disk_full'); Object.assign(storage, structuredClone(value)); },
      setAccessLevel: async (value: unknown) => { calls.push(JSON.stringify(value)); },
    } },
    action: { setBadgeText: async ({ text }: { text: string }) => { calls.push(text); } },
    tabs: { query: async () => [{ id: 1, url: tabUrl }], get: async () => ({ id: 1, url: tabUrl }) },
    debugger: {
      attach: async () => { calls.push('attach'); }, detach: async () => { calls.push('detach'); },
      sendCommand: async () => { calls.push('enable'); }, getTargets: async () => [{ attached: true, tabId: 1, url: tabUrl }],
      onEvent: listener('event'), onDetach: listener('detach'),
    },
  };
  const source = (await readFile(resolve(directory, 'worker.mjs'), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  runInNewContext(source, { chrome, ...protocol, ...upload, crypto: webcrypto, URL, Date, fetch: fetcher, setTimeout, clearTimeout, AbortController, TextEncoder, TextDecoder });
  const message = (kind: string, extra = {}) => new Promise<any>((done) => handlers.message({ kind, ...extra }, { id: 'test-extension', url: chrome.runtime.getURL('popup.html') }, done));
  const socket = (requestId = 'socket-1') => handlers.event({ tabId: 1 }, 'Network.webSocketCreated', { requestId, url: 'wss://pancake.vn/socket/websocket?credential=synthetic-secret' });
  const frame = (topic = 'pages:page-test', requestId = 'socket-1') => handlers.event({ tabId: 1 }, 'Network.webSocketFrameReceived', { requestId, response: { opcode: 1, payloadData: JSON.stringify([null, null, topic, 'pages:update_messages', { conversation_id: 'object-test', message: 'private-fixture-text' }]) } });
  return { storage, calls, handlers, message, socket, frame, setTabUrl: (value: string) => { tabUrl = value; }, failWrites: () => { failWrites = true; } };
}

describe('MV3 companion privacy and persistence', () => {
  it('persists pending before fetch and retries identical envelopes after offline worker restart', async () => {
    const grant = { enrollmentId: 'grant', token: 'x'.repeat(64), expiresAt: '2099-01-01T00:00:00Z', scope: { ...scope, providerSurface: 'pancake-conversations' } };
    const h = await harness();
    expect((await h.message('configure-upload', { origin: 'https://backend.example', enrollment: grant })).ok).toBe(true);
    await h.message('start', { scope }); h.socket(); h.frame(); await h.message('status');
    await h.message('upload');
    const pending = structuredClone(h.storage[key].upload.pending);
    expect(h.storage[key].outbox).toHaveLength(1);
    let request: any;
    const resumed = await harness(h.storage, async (_url: string, options: any) => {
      request = JSON.parse(options.body);
      return new Response(JSON.stringify({ receiptId: 'receipt', disposition: 'duplicate', checkpoint: 1, continuity: 'UNKNOWN', enrollmentId: 'grant', captureId: request.captureId, sequence: 1 }), { status: 200 });
    });
    await resumed.message('upload');
    expect(request).toEqual(pending);
    expect(resumed.storage[key].outbox).toHaveLength(0);
    expect(resumed.storage[key].upload.nextSequence).toBe(2);
    expect(JSON.stringify(request)).not.toMatch(/private-fixture-text|synthetic-secret/);
  });
  it('processes the evidence-labeled contract corpus equally without promoting batch events to a single object', async () => {
    const { summarizeFrame } = await import(pathToFileURL(resolve(directory, 'protocol.mjs')).href);
    const { observePhoenixFrame } = await import('../adaptive-connectivity/phoenix-observer');
    const at = '2026-11-15T00:00:00.000Z';
    for (const fixture of contracts.cases) {
      const raw = JSON.stringify(fixture.frame);
      const browserRecord = await summarizeFrame(raw, scope, at, 'capture-test');
      const backend = observePhoenixFrame(raw, { scope: { workspaceId: scope.workspaceId, connectionId: scope.connectionId,
        accountId: scope.accountId, providerSurface: 'pancake-conversations' }, allowedPageIds: [scope.pageId],
        observedAt: at, captureId: 'capture-test', sourceRevision: 'north-star-companion/0.1.2', direction: 'received' });
      expect(backend.kind, fixture.name).toBe('observation');
      if (backend.kind === 'observation') {
        expect(browserRecord).toEqual(backend.observation);
        expect(browserRecord.externalObjectId).toBe(fixture.objectId);
        expect(browserRecord.occurredAt).toBeNull();
        expect(JSON.stringify(browserRecord)).not.toContain('synthetic-private-content');
      }
    }
  });

  it('refuses mixed-page or malformed tag batches on both decoders', async () => {
    const { summarizeFrame } = await import(pathToFileURL(resolve(directory, 'protocol.mjs')).href);
    const { observePhoenixFrame } = await import('../adaptive-connectivity/phoenix-observer');
    const at = '2026-11-15T00:00:00.000Z';
    const make = (payload: unknown) => JSON.stringify([null, null, 'pages:page-test', 'pages:tag_conversations', payload]);
    for (const payload of [
      { conversations: { 'conversation-test': [7] }, conversations_updated: [{ id: 'conversation-test', page_id: 'other-page' }] },
      { conversations: [], conversations_updated: [] },
      { conversations: { 'conversation-test': 'not-array' } },
      { conversations: { 'conversation-test': [7] }, conversations_updated: [{ id: 'unrelated', page_id: 'page-test' }] },
      { conversations: { 'conversation-test': [7] }, conversations_updated: [null] },
      { conversations: { 'conversation-test': [7] }, conversations_updated: {} },
      { conversations: {} },
    ]) {
      expect(await summarizeFrame(make(payload), scope, at, 'capture-test')).toBeNull();
      expect(observePhoenixFrame(make(payload), { scope: { workspaceId: scope.workspaceId, connectionId: scope.connectionId,
        accountId: scope.accountId, providerSurface: 'pancake-conversations' }, allowedPageIds: [scope.pageId],
        observedAt: at, captureId: 'capture-test', sourceRevision: 'fixture', direction: 'received' }).kind).toBe('rejected');
    }
  });
  it('preserves source-derived deletion references and rejects inconsistent page or object claims', async () => {
    const { summarizeFrame } = await import(pathToFileURL(resolve(directory, 'protocol.mjs')).href);
    const at = '2026-11-15T00:00:00.000Z';
    const encode = (payload: unknown) => JSON.stringify([null, null, 'pages:page-test', 'messages:mark_as_deleted', payload]);
    const record = await summarizeFrame(encode({ page_id: 'page-test',
      message: { conversation_id: 'conversation-test', body: 'private-deleted-content' } }), scope, at, 'capture-test');
    expect(record?.externalObjectId).toBe('conversation-test');
    expect(JSON.stringify(record)).not.toContain('private-deleted-content');
    for (const payload of [
      { page_id: 'other-page' }, { conversation: { page_id: 'other-page' } },
      { message: { page_id: 'other-page' } }, { pageId: 'other-page' },
      { conversation_id: 'first', message: { conversation_id: 'second' } },
    ]) expect(await summarizeFrame(encode(payload), scope, at, 'capture-test')).toBeNull();
  });

  it('keeps the browser and backend decoder metadata contracts aligned', async () => {
    const { summarizeFrame } = await import(pathToFileURL(resolve(directory, 'protocol.mjs')).href);
    const { observePhoenixFrame } = await import('../adaptive-connectivity/phoenix-observer');
    const at = '2026-11-14T00:00:00.000Z';
    for (const eventType of ['pages:update_messages', 'pages:update_conversation', 'messages:mark_as_deleted']) {
      const raw = JSON.stringify([null, null, 'pages:page-test', eventType, { conversation_id: 'object-test', conversation: { id: 'object-test' } }]);
      const browserRecord = await summarizeFrame(raw, scope, at, 'capture-test');
      const backend = observePhoenixFrame(raw, { scope: { workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: 'pancake-conversations' },
        allowedPageIds: [scope.pageId], observedAt: at, captureId: 'capture-test', sourceRevision: 'north-star-companion/0.1.2', direction: 'received' });
      expect(backend.kind).toBe('observation');
      if (backend.kind === 'observation') expect(browserRecord).toEqual(backend.observation);
    }
  });

  it('persists only scoped metadata and serializes concurrent arrivals', async () => {
    const h = await harness();
    expect((await h.message('start', { scope })).ok).toBe(true);
    h.socket();
    h.frame(); h.frame();
    await h.message('status');
    expect(h.storage[key].outbox).toHaveLength(2);
    expect(h.storage[key].outbox[0].captureId).not.toBe(h.storage[key].outbox[1].captureId);
    expect(JSON.stringify(h.storage)).not.toMatch(/private-fixture-text|synthetic-secret/);
    expect(h.calls).toContain('{"accessLevel":"TRUSTED_CONTEXTS"}');
  });

  it('recovers outbox and socket scope after worker suspension', async () => {
    const first = await harness();
    await first.message('start', { scope }); first.socket(); first.frame(); await first.message('status');
    const resumed = await harness(first.storage);
    resumed.frame(); await resumed.message('status');
    expect(resumed.storage[key].outbox).toHaveLength(2);
    expect(resumed.storage[key].continuity).toBe('UNKNOWN');
  });

  it('does not capture unselected tabs, page channels or unknown sockets', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket();
    h.frame('pages:other'); h.frame('pages:page-test', 'unseen-socket');
    h.handlers.event({ tabId: 2 }, 'Network.webSocketCreated', { requestId: 'foreign', url: 'wss://pancake.vn/socket/websocket' });
    h.handlers.event({ tabId: 1 }, 'Network.webSocketCreated', { requestId: 'untrusted', url: 'wss://evil.example/socket/websocket' });
    await h.message('status');
    expect(h.storage[key].outbox).toHaveLength(0);
    expect(h.storage[key].session.sockets).toEqual(['socket-1']);
  });

  it('requires an extension popup sender and rejects provider-page commands', async () => {
    const h = await harness();
    let responded = false;
    expect(h.handlers.message({ kind: 'start', scope }, { id: 'test-extension', url }, () => { responded = true; })).toBe(false);
    expect(responded).toBe(false);
    expect(h.calls).not.toContain('attach');
  });

  it('refuses activation outside the exact HTTPS Pancake origins', async () => {
    for (const origin of ['http://pancake.vn/', 'https://pancake.vn.evil.example/', 'https://pos.pancake.vn/', 'not a URL']) {
      const h = await harness(); h.setTabUrl(origin);
      expect((await h.message('start', { scope })).ok).toBe(false);
      expect(h.calls).not.toContain('attach');
    }
  });

  it('stops capture on navigation outside scope', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); await h.message('status');
    h.setTabUrl('https://other.example/'); h.frame(); await h.message('status');
    expect(h.storage[key].session).toBe(null);
    expect(h.storage[key].outbox).toHaveLength(0);
  });

  it('stops on authorization failure without deleting stored evidence', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); h.frame();
    h.handlers.event({ tabId: 1 }, 'Network.responseReceived', { response: { status: 401, url } });
    await h.message('status');
    expect(h.storage[key].session).toBe(null);
    expect(h.storage[key].lastStop).toBe('authorization-failed');
    expect(h.storage[key].outbox).toHaveLength(1);
  });

  it('marks restart and detach gaps without claiming complete history', async () => {
    const h = await harness(); await h.message('start', { scope });
    h.handlers.startup(); await h.message('status');
    expect(h.storage[key].session).toBe(null);
    expect(h.storage[key].gapSince).toBeTruthy();
    await h.message('start', { scope }); h.handlers.detach({ tabId: 1 }); await h.message('status');
    expect(h.storage[key].lastStop).toBe('debugger-detached');
  });

  it('stops on outbox capacity without losing existing records', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); await h.message('status');
    h.storage[key].outbox = Array.from({ length: 1000 }, () => ({ synthetic: true }));
    h.frame(); await h.message('status');
    expect(h.storage[key]).toMatchObject({ session: null, dropped: 1, lastStop: 'outbox-full' });
    expect(h.storage[key].outbox).toHaveLength(1000);
  });

  it('stops before queueing oversized frames', async () => {
    const h = await harness(); await h.message('start', { scope });
    h.handlers.event({ tabId: 1 }, 'Network.webSocketFrameReceived', { response: { payloadData: 'x'.repeat(262145) } });
    await h.message('status');
    expect(h.storage[key].lastStop).toBe('frame-size-limit');
    expect(h.storage[key].outbox).toHaveLength(0);
  });

  it('detaches after a failed durable write and exposes an error badge', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket(); await h.message('status');
    h.failWrites(); h.frame(); await h.message('status');
    expect(h.calls).toContain('ERR');
    expect(h.calls).toContain('detach');
    expect(h.storage[key].outbox).toHaveLength(0);
  });
});
