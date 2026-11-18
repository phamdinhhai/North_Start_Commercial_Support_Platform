import { configureUpload, reserveUpload, applyUploadResponse, captureMatchesEnrollment, exportMetadata } from './upload.mjs';
import { allowedOrigin, summarizeFrame, validScope } from './protocol.mjs';
import { appendRecord, outboxFull, outboxDigest, resetEnrollment, statusView, OUTBOX_FULL } from './lifecycle.mjs';
import { classifyRejectedFrame, shapeFingerprint, recordDrift } from './drift.mjs';

const KEY = 'northStarResearchV1';
const now = () => new Date().toISOString();
const empty = () => ({ version: 1, session: null, outbox: [], gapSince: now(), dropped: 0, continuity: 'UNKNOWN', captureSeq: 0 });
const load = async () => (await chrome.storage.local.get(KEY))[KEY] ?? empty();
const save = (state) => chrome.storage.local.set({ [KEY]: state });
const badge = (text) => chrome.action.setBadgeText({ text });
// Error codes the popup may display. Everything else collapses to a generic message; no internals are echoed.
const USER_ERRORS = new Set(['outbox_full', 'unsupported_tab', 'invalid_scope', 'capture_scope_mismatch', 'backend_permission_required',
  'pending_outbox_binding', 'blocked_requires_reset', 'enrollment_required', 'reset_not_required', 'export_required',
  'export_or_discard_required', 'discard_confirmation_required', 'invalid_enrollment', 'invalid_backend_origin']);
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

async function stop(reason, patch = {}) {
  const state = await load();
  const tabId = state.session?.tabId;
  await save({ ...state, ...patch, session: null, gapSince: state.gapSince ?? now(), lastStop: reason });
  if (tabId) await chrome.debugger.detach({ tabId }).catch(() => {});
  await badge(patch.capture === OUTBOX_FULL ? 'FULL' : 'OFF');
}

async function start(scope) {
  if (!validScope(scope)) throw new Error('invalid_scope');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !await tabOriginAllowed(tab.id)) throw new Error('unsupported_tab');
  await stop('new-session');
  const state = await load();
  if (!captureMatchesEnrollment(scope, state.upload)) throw new Error('capture_scope_mismatch');
  if (outboxFull(state)) {
    await save({ ...state, capture: OUTBOX_FULL });
    await badge('FULL');
    throw new Error('outbox_full');
  }
  const target = { tabId: tab.id };
  await chrome.debugger.attach(target, '1.3');
  try {
    const { workspaceId, connectionId, accountId, pageId } = scope;
    await save({ ...state, capture: null, session: { tabId: tab.id, scope: { workspaceId, connectionId, accountId, pageId }, sockets: [], startedAt: now() } });
    await chrome.debugger.sendCommand(target, 'Network.enable');
    await badge('ON');
  } catch (error) {
    await stop('start-failed');
    throw error;
  }
}

async function readBounded(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  let text = '', size = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 16384) { await reader.cancel(); throw new Error('ack_size_limit'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  try { return JSON.parse(text); } catch { return null; }
}

// Alarm policy: there is none. Upload/retry happens only when the user clicks "Upload / retry one record".
// The pending request is persisted before network I/O, so a worker terminated mid-upload resumes the identical
// request (same captureId + sequence) on the next explicit click. No sequence is allocated twice.
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
    const body = response.ok || response.status === 409 ? await readBounded(response) : null;
    state = applyUploadResponse(state, response.status, body);
  } catch {
    state = { ...state, upload: { ...state.upload, status: 'retry-required' } };
  } finally { clearTimeout(timer); }
  // Safe without reload: the queue serializes every writer, so nothing else touched state during fetch.
  await save(state);
  if (['unauthorized', 'expired', 'blocked'].includes(state.upload.status)) await stop('upload-' + state.upload.status);
  if (state.upload.status === 'blocked') await badge('BLK');
}

async function exportRedacted() {
  const state = await load();
  const lastExport = { at: now(), records: state.outbox.length, digest: await outboxDigest(state.outbox) };
  await save({ ...state, lastExport });
  return exportMetadata({ ...state, lastExport });
}

async function reset(message) {
  const state = await load();
  const next = resetEnrollment(state, message, await outboxDigest(state.outbox), now());
  const tabId = state.session?.tabId;
  await save(next);
  if (tabId) await chrome.debugger.detach({ tabId }).catch(() => {});
  await badge('OFF');
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
    else if (message?.kind === 'reset-enrollment') await reset(message);
    else if (message?.kind === 'stop') await stop('user-stopped');
    else if (message?.kind === 'export') return exportRedacted();
    else if (message?.kind !== 'status') throw new Error('unsupported_command');
    return statusView(await load());
  }).then((result) => respond({ ok: true, result }), (error) => respond({ ok: false,
    code: USER_ERRORS.has(error?.message) ? error.message : 'capture_unavailable',
    error: 'Capture unavailable; check scope, tab, debugger permission and storage.' }));
  return true;
});

async function observeFrame(state, payloadData) {
  const record = await summarizeFrame(payloadData, state.session.scope, now(), crypto.randomUUID());
  if (!record) {
    const drift = classifyRejectedFrame(payloadData, state.session.scope.pageId);
    if (drift) await save(recordDrift(state, await shapeFingerprint(drift), drift.kind, now()));
    return;
  }
  const appended = appendRecord(state, record);
  await save(appended.state); // Record, capture sequence and full-state decision land in one durable write.
  if (appended.stop) await stop('outbox-full', { capture: OUTBOX_FULL });
}

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
      await observeFrame(state, params.response.payloadData);
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

// Observation is bound to the one tab the user attached. Closing it or navigating it off the Pancake origins detaches.
chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(async () => { if ((await load()).session?.tabId === tabId) await stop('tab-closed'); }).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change || (change.url === undefined && change.status !== 'loading')) return;
  enqueue(async () => {
    if ((await load()).session?.tabId !== tabId) return;
    // URL comes from the debugger target list, so the extension needs no "tabs" permission.
    if (!await tabOriginAllowed(tabId)) await stop('navigated-away');
  }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => { enqueue(() => stop('browser-restarted')).catch(() => {}); });
