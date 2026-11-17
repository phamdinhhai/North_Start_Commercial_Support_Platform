import { configureUpload, reserveUpload, applyUploadResponse, captureMatchesEnrollment, exportMetadata } from './upload.mjs';
import { allowedOrigin, summarizeFrame, validScope } from './protocol.mjs';

const KEY = 'northStarResearchV1';
const MAX_RECORDS = 1000;
const now = () => new Date().toISOString();
const empty = () => ({ version: 1, session: null, outbox: [], gapSince: now(), dropped: 0, continuity: 'UNKNOWN' });
const load = async () => (await chrome.storage.local.get(KEY))[KEY] ?? empty();
const save = (state) => chrome.storage.local.set({ [KEY]: state });
const badge = (text) => chrome.action.setBadgeText({ text });
async function tabOriginAllowed(tabId) {
  const targets = await chrome.debugger.getTargets();
  return targets.some((target) => target.tabId === tabId && allowedOrigin(target.url));
}

// Serialize read/modify/write across CDP events. Each task reloads persistent state.
let queue = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
function enqueue(task) {
  const pending = queue.then(task);
  queue = pending.catch(async () => {
    await badge('ERR');
    // A failed durable write stops capture; a badge never claims delivery succeeded.
    const targets = await chrome.debugger.getTargets();
    for (const target of targets.filter((target) => target.attached && target.tabId)) {
      const state = await load();
      if (state.session?.tabId === target.tabId) await chrome.debugger.detach({ tabId: target.tabId }).catch(() => {});
    }
  }).catch(() => {});
  return pending;
}

async function stop(reason) {
  const state = await load();
  const tabId = state.session?.tabId;
  await save({ ...state, session: null, gapSince: state.gapSince ?? now(), lastStop: reason });
  if (tabId) await chrome.debugger.detach({ tabId }).catch(() => {});
  await badge('OFF');
}

async function start(scope) {
  if (!validScope(scope)) throw new Error('invalid_scope');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !await tabOriginAllowed(tab.id)) throw new Error('unsupported_tab');
  await stop('new-session');
  const state = await load();
  if (!captureMatchesEnrollment(scope, state.upload)) throw new Error('capture_scope_mismatch');
  if (state.outbox.length >= MAX_RECORDS) throw new Error('outbox_full');
  const target = { tabId: tab.id };
  await chrome.debugger.attach(target, '1.3');
  try {
    const { workspaceId, connectionId, accountId, pageId } = scope;
    await save({ ...state, session: { tabId: tab.id, scope: { workspaceId, connectionId, accountId, pageId }, sockets: [], startedAt: now() } });
    await chrome.debugger.sendCommand(target, 'Network.enable');
    await badge('ON');
  } catch (error) {
    await stop('start-failed');
    throw error;
  }
}

// Explicit retry performs one bounded request. No alarm silently uploads after consent changes.
async function uploadOne() {
  let state = reserveUpload(await load());
  await save(state); // Crash before/after network keeps the identical durable pending request.
  if (state.upload?.status === 'expired') { await stop('upload-expired'); return; }
  if (!state.upload?.pending || !state.upload.token) return;
  const grant = state.upload;
  if (!await chrome.permissions.contains({ origins: [grant.origin + '/*'] })) throw new Error('backend_permission_required');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(grant.origin + '/v1/integration/observations', {
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { authorization: 'Bearer ' + grant.token, 'content-type': 'application/json' },
      body: JSON.stringify(grant.pending),
    });
    let ack = null;
    if (response.ok) {
      const reader = response.body?.getReader();
      let text = '', size = 0;
      const decoder = new TextDecoder();
      if (reader) {
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 16384) { await reader.cancel(); throw new Error('ack_size_limit'); }
            text += decoder.decode(value, { stream: true });
          }
          text += decoder.decode();
          ack = JSON.parse(text);
        } finally { reader.releaseLock(); }
      }
    }
    state = applyUploadResponse(state, response.status, ack);
  } catch {
    state = { ...state, upload: { ...state.upload, status: 'retry-required' } };
  } finally { clearTimeout(timer); }
  await save(state);
  if (['unauthorized', 'expired', 'blocked'].includes(state.upload.status)) await stop('upload-' + state.upload.status);
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) return false;
  enqueue(async () => {
    if (message?.kind === 'start') await start(message.scope);
    else if (message?.kind === 'configure-upload') {
      const state = configureUpload(await load(), message);
      if (!await chrome.permissions.contains({ origins: [state.upload.origin + '/*'] })) throw new Error('backend_permission_required');
      await save(state);
    } else if (message?.kind === 'upload') await uploadOne();
    else if (message?.kind === 'disconnect-upload') {
      const state = await load();
      if (state.upload) await save({ ...state, upload: { ...state.upload, token: null, status: 'disconnected' } });
      await stop('upload-disconnected');
    }
    else if (message?.kind === 'stop') await stop('user-stopped');
    else if (message?.kind !== 'status' && message?.kind !== 'export') throw new Error('unsupported_command');
    const state = await load();
    return message.kind === 'export' ? exportMetadata(state) : {
      active: Boolean(state.session), pending: state.outbox.length, dropped: state.dropped,
      continuity: state.continuity, gapSince: state.gapSince, upload: state.upload?.status ?? 'disabled',
    };
  }).then((result) => respond({ ok: true, result }), () => respond({ ok: false, error: 'Capture unavailable; check scope, tab, debugger permission and storage.' }));
  return true;
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!source.tabId || !['Network.webSocketCreated', 'Network.webSocketFrameReceived', 'Network.webSocketClosed', 'Network.responseReceived'].includes(method)) return;
  if (method === 'Network.webSocketFrameReceived' && typeof params.response?.payloadData === 'string' && params.response.payloadData.length > 262144) {
    if (!overloaded) {
      overloaded = true;
      enqueue(() => stop('frame-size-limit')).catch(() => {}).finally(() => { overloaded = false; });
    }
    return;
  }
  // Bound pending work: high-volume capture must stop instead of retaining unbounded raw frames.
  if (pendingFrames >= 100) {
    if (!overloaded) {
      overloaded = true;
      enqueue(() => stop('event-backlog')).catch(() => {}).finally(() => { overloaded = false; });
    }
    return;
  }
  pendingFrames += 1;
  enqueue(async () => {
    const state = await load();
    if (state.session?.tabId !== source.tabId) return;
    if (!await tabOriginAllowed(source.tabId)) return stop('origin-changed');
    if (method === 'Network.webSocketCreated') {
      let socket;
      try { socket = new URL(params.url); } catch { return; }
      if (socket.protocol !== 'wss:' || !allowedOrigin(`https://${socket.host}`) || socket.pathname !== '/socket/websocket') return;
      if (state.session.sockets.length >= 50) return stop('socket-capacity');
      await save({ ...state, session: { ...state.session, sockets: [...state.session.sockets, params.requestId] } });
    } else if (method === 'Network.responseReceived') {
      if ([401, 403].includes(params.response?.status) && allowedOrigin(params.response.url)) await stop('authorization-failed');
    } else if (state.session.sockets.includes(params.requestId)) {
      if (method === 'Network.webSocketClosed') {
        await save({ ...state, gapSince: state.gapSince ?? now(), session: { ...state.session, sockets: state.session.sockets.filter((id) => id !== params.requestId) } });
        return;
      }
      if (params.response?.opcode !== 1) return;
      const record = await summarizeFrame(params.response.payloadData, state.session.scope, now(), crypto.randomUUID());
      if (!record) return;
      if (state.outbox.length >= MAX_RECORDS) {
        await save({ ...state, dropped: state.dropped + 1 });
        await stop('outbox-full');
      } else await save({ ...state, outbox: [...state.outbox, record] });
    }
  }).catch(() => {}).finally(() => { pendingFrames -= 1; });
});
let pendingFrames = 0;
let overloaded = false;

chrome.debugger.onDetach.addListener((source) => {
  enqueue(async () => {
    const state = await load();
    if (state.session?.tabId === source.tabId) {
      await save({ ...state, session: null, gapSince: state.gapSince ?? now(), lastStop: 'debugger-detached' });
      await badge('OFF');
    }
  }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => { enqueue(() => stop('browser-restarted')).catch(() => {}); });
