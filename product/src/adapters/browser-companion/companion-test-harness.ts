// Test-only MV3 harness: runs worker.mjs in a VM with a synthetic chrome.* surface. Never packaged (see companion-package.mjs).
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

export const directory = resolve('src/adapters/browser-companion');
export const scope = { workspaceId: 'workspace-test', connectionId: 'connection-test', accountId: 'account-test', pageId: 'page-test' };
export const key = 'northStarResearchV1';
export const url = 'https://pancake.vn/';
export const grant = { enrollmentId: 'grant', token: 'x'.repeat(64), expiresAt: '2099-01-01T00:00:00Z', scope: { ...scope, providerSurface: 'pancake-conversations' } };
export const load = (name: string) => import(pathToFileURL(resolve(directory, name)).href);
type Handler = (...args: any[]) => any;

export const ackFor = (request: any, patch: Record<string, unknown> = {}) => ({ receiptId: 'receipt-' + request.sequence, disposition: 'stored',
  checkpoint: request.sequence, continuity: 'UNKNOWN', enrollmentId: 'grant', captureId: request.captureId, sequence: request.sequence, ...patch });

/** A fresh harness from a storage snapshot models a worker that was terminated and restarted by the browser. */
export async function harness(initial: Record<string, any> = {}, fetcher: any = async () => { throw new Error('offline'); }) {
  const modules = await Promise.all(['protocol.mjs', 'upload.mjs', 'lifecycle.mjs', 'drift.mjs'].map(load));
  const handlers: Record<string, Handler> = {};
  const storage = structuredClone(initial);
  const calls: string[] = [];
  let tabUrl: string | null = url;
  let failWrites = false;
  const listener = (name: string) => ({ addListener: (callback: Handler) => { handlers[name] = callback; } });
  const chrome = {
    permissions: { contains: async () => true },
    runtime: { id: 'test-extension', getURL: (path: string) => `chrome-extension://test-extension/${path}`, onMessage: listener('message'), onStartup: listener('startup') },
    storage: { local: {
      get: async () => structuredClone(storage),
      set: async (value: Record<string, unknown>) => { if (failWrites) throw new Error('disk_full'); Object.assign(storage, structuredClone(value)); },
      setAccessLevel: async (value: unknown) => { calls.push(JSON.stringify(value)); },
    } },
    action: { setBadgeText: async ({ text }: { text: string }) => { calls.push(text); } },
    tabs: { query: async () => (tabUrl ? [{ id: 1, url: tabUrl }] : []), get: async () => ({ id: 1, url: tabUrl }),
      onRemoved: listener('tabRemoved'), onUpdated: listener('tabUpdated') },
    debugger: {
      attach: async () => { calls.push('attach'); }, detach: async () => { calls.push('detach'); },
      sendCommand: async () => { calls.push('enable'); }, getTargets: async () => (tabUrl ? [{ attached: true, tabId: 1, url: tabUrl }] : []),
      onEvent: listener('event'), onDetach: listener('detach'),
    },
  };
  const source = (await readFile(resolve(directory, 'worker.mjs'), 'utf8')).replace(/^import .*;\r?\n/gm, '');
  runInNewContext(source, { chrome, ...Object.assign({}, ...modules), crypto: webcrypto, URL, Date, fetch: fetcher, setTimeout, clearTimeout, AbortController, TextEncoder, TextDecoder });
  const message = (kind: string, extra = {}) => new Promise<any>((done) => handlers.message({ kind, ...extra }, { id: 'test-extension', url: chrome.runtime.getURL('popup.html') }, done));
  const socket = (requestId = 'socket-1') => handlers.event({ tabId: 1 }, 'Network.webSocketCreated', { requestId, url: 'wss://pancake.vn/socket/websocket?credential=synthetic-secret' });
  const raw = (payloadData: string, requestId = 'socket-1') => handlers.event({ tabId: 1 }, 'Network.webSocketFrameReceived', { requestId, response: { opcode: 1, payloadData } });
  const frame = (topic = 'pages:page-test', requestId = 'socket-1') => raw(JSON.stringify([null, null, topic, 'pages:update_messages', { conversation_id: 'object-test', message: 'private-fixture-text' }]), requestId);
  return { storage, calls, handlers, message, socket, frame, raw, setTabUrl: (value: string | null) => { tabUrl = value; }, failWrites: () => { failWrites = true; } };
}
