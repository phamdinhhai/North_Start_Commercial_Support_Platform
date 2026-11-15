import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { conversationSnapshotFingerprint, summarizeFacebookCapture } from './facebook-research-summary.mjs';
import { allowsTagMutation, allowsConversationTag, tagExperimentActions } from './facebook-tag-research-policy.mjs';
import { installWebSocketFaultProbe } from './websocket-fault-probe.mjs';

// Local research runner. REA performs declared actions; this process restricts scope
// and retains private evidence locally without printing response or credential values.
const product = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const privateRoot = resolve(product, '../docs/login_info');
const session = JSON.parse(await readFile(resolve(privateRoot, 'pancake-research-session.json'), 'utf8'));
const port = (await readFile(resolve(privateRoot, 'pancake-research-profile/DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0];
const endpoint = `http://127.0.0.1:${port}`;
const spec = JSON.parse(await readFile(resolve(process.argv[2]), 'utf8'));
if (!/^[a-z0-9-]{1,80}$/.test(spec.runId)) throw new Error('invalid_run_id');
const facebookId = session.facebook.pageId;
const tagUi = spec.uiMode === 'tag-settings';
const tagMutation = ['create', 'delete'].includes(spec.tagOperation);
const socketInterruption = spec.connectivityProbe === 'websocket-interruption';
const connectivityProbe = spec.connectivityProbe === 'brief-offline' || socketInterruption;
const faultDuration = spec.faultDurationMs ?? 15000;
if (![15000, 900000].includes(faultDuration) || (faultDuration === 900000 && !socketInterruption)) throw new Error('invalid_fault_duration');
const conversationInspect = spec.uiMode === 'conversation-inspection';
const conversationMutation = ['attach', 'detach'].includes(spec.conversationTagOperation);
let selectedConversation;
let selectedShopId;
if (conversationInspect || conversationMutation) {
  const snapshot = JSON.parse(await readFile(resolve(privateRoot, 'research-2026-11-15/fresh-conversations.json'), 'utf8'));
  if (![0, 1].includes(spec.conversationOrdinal ?? 0)) throw new Error('invalid_conversation_ordinal');
  const selected = snapshot.conversations?.filter((item) => item.page_id === facebookId && item.seen === true && item.unread_count === 0)[spec.conversationOrdinal ?? 0];
  if (!selected || !/^[0-9_]+$/.test(selected.id)) throw new Error('no_read_facebook_conversation');
  selectedConversation = selected;
  spec.actions = [
    { step_id: 'settle', action: 'wait_for_timeout', duration_ms: 1500 },
    { step_id: 'open_read_conversation', action: 'click', locator: { kind: 'css', selector: `[id="${selected.id}"] .conversation-list-item` }, timeout_ms: 15000 },
    { step_id: 'settle_messages', action: 'wait_for_timeout', duration_ms: 3000 },
  ];
  if (conversationMutation) {
    if (!/^NSR-[0-9]{4}-[A-F0-9]{4}$/.test(spec.tagName)) throw new Error('invalid_conversation_tag');
    const settings = JSON.parse(await readFile(resolve(privateRoot, 'research-2026-11-15/fresh-settings.json'), 'utf8'));
    selectedShopId = String(settings.shop_id);
    if (!/^[0-9]+$/.test(selectedShopId) || settings.settings.crm_workspace) throw new Error('unknown_automation_scope');
    spec.actions.push(
      { step_id: 'current_conversations', action: 'request', method: 'GET', path: `/api/v1/pages/${facebookId}/conversations`, expected_status: [200] },
      { step_id: 'current_shop', action: 'request', method: 'GET', path: `/pos-api/api/v1/shops/${selectedShopId}`, expected_status: [200] },
      { step_id: 'current_automations', action: 'request', method: 'GET', path: `/pos-api/api/v1/shops/${selectedShopId}/crm/automation`, expected_status: [200] },
      { step_id: 'toggle_synthetic_conversation_tag', action: 'click', locator: { kind: 'css', selector: `.btn-tag-item:text-is("${spec.tagName}")` }, timeout_ms: 10000 },
      { step_id: 'settle_tag', action: 'wait_for_timeout', duration_ms: 2500 },
      { step_id: 'readback', action: 'request', method: 'GET', path: `/api/v1/pages/${facebookId}/conversations`, expected_status: [200] });
  }
}
if (connectivityProbe) {
  if (tagUi || spec.tagOperation) throw new Error('probe_cannot_mutate');
  spec.actions = [
    { step_id: 'initial_settle', action: 'wait_for_timeout', duration_ms: 2000 },
    { step_id: 'baseline_conversations', action: 'request', method: 'GET', path: `/api/v1/pages/${facebookId}/conversations`, expected_status: [200], timeout_ms: 15000 },
    { step_id: 'observe_fault_window', action: 'wait_for_timeout', duration_ms: faultDuration },
    { step_id: 'observe_recovery_window', action: 'wait_for_timeout', duration_ms: 15000 },
    { step_id: 'recovery_conversations', action: 'request', method: 'GET', path: `/api/v1/pages/${facebookId}/conversations`, expected_status: [200], timeout_ms: 15000 },
    { step_id: 'recovery_settings', action: 'request', method: 'GET', path: `/api/v1/pages/${facebookId}/settings`, expected_status: [200], timeout_ms: 15000 },
  ];
}
if (tagMutation) {
  if (!tagUi || !/^NSR-[0-9]{4}-[A-F0-9]{4}$/.test(spec.tagName)) throw new Error('invalid_tag_experiment');
  spec.actions = tagExperimentActions(spec.tagOperation, spec.tagName);
  spec.actions.push({ step_id: 'readback', action: 'request', method: 'GET',
    path: `/api/v1/pages/${facebookId}/settings`, expected_status: [200], timeout_ms: 15000 });
}
if (spec.tagOperation === 'preview') {
  if (!tagUi) throw new Error('tag_preview_requires_settings');
  spec.actions = [
    { step_id: 'tags_ready', action: 'wait_for', locator: { kind: 'css', selector: '.setting-tag-container' }, state: 'visible', timeout_ms: 15000 },
    { step_id: 'preview_new_tag', action: 'click', locator: { kind: 'css', selector: '.btn-create-tags' }, timeout_ms: 10000 },
  ];
}
const permittedPaths = new Set(['/api/v1/pages',
  `/api/v1/pages/${facebookId}/settings`, `/api/v1/pages/${facebookId}/conversations`]);
if (spec.readSurface === 'message-tail') {
  const prior = JSON.parse(await readFile(resolve(privateRoot, 'research-2026-11-15/contract-reads.json'), 'utf8'));
  const events = prior.normalized_result.events.items;
  const response = events.find((item) => item.kind === 'response' && item.step_index === 7 && item.status === 200);
  const content = events.find((item) => item.kind === 'network-content' && item.phase === 'response' && item.transaction_id === response?.transaction_id);
  const body = JSON.parse(Buffer.from(content.body.content, 'base64'));
  const address = new URL(response.url.url);
  if (address.origin !== 'https://pancake.vn' || !address.pathname.startsWith(`/api/v1/pages/${facebookId}/conversations/`) ||
      !address.pathname.endsWith('/messages') || address.searchParams.get('current_count') !== '25' || !body.success || !Array.isArray(body.messages)) throw new Error('invalid_prior_message_page');
  const paths = [25 + body.messages.length, 0].map((count) => { const next = new URL(address); next.searchParams.set('current_count', String(count)); return next.pathname + next.search; });
  for (const path of paths) permittedPaths.add(path);
  spec.actions = [{ step_id: 'settle', action: 'wait_for_timeout', duration_ms: 1500 },
    ...paths.map((path, index) => ({ step_id: index ? 'repeat_first_message_page' : 'message_tail', action: 'request', method: 'GET', path, expected_status: [200], timeout_ms: 30000 }))];
}
if (spec.readSurface === 'contract-reads') {
  const prior = JSON.parse(await readFile(resolve(privateRoot, 'research-2026-11-15/inspect-read-conversation.json'), 'utf8'));
  const recorded = prior.normalized_result.events.items.filter((item) => item.kind === 'request' && item.method === 'GET');
  const list = recorded.map((item) => new URL(item.url.url)).find((address) => address.origin === 'https://pancake.vn' && address.pathname === `/api/v1/pages/${facebookId}/conversations`);
  const messages = recorded.map((item) => new URL(item.url.url)).find((address) => address.origin === 'https://pancake.vn' &&
    address.pathname.startsWith(`/api/v1/pages/${facebookId}/conversations/`) && address.pathname.endsWith('/messages'));
  if (!list || !messages || [...list.searchParams.keys(), ...messages.searchParams.keys()].some((key) => /token|secret|auth|key/i.test(key))) throw new Error('invalid_recorded_read_contract');
  const conversationPath = messages.pathname.slice(0, -'/messages'.length);
  const snapshot = JSON.parse(await readFile(resolve(privateRoot, 'research-2026-11-15/fresh-conversations.json'), 'utf8'));
  if (!snapshot.conversations.some((item) => item.page_id === facebookId && conversationPath.endsWith(`/${item.id}`))) throw new Error('recorded_conversation_outside_scope');
  const listMore = new URL(list);
  listMore.searchParams.set('current_count', String(snapshot.conversations.length));
  messages.searchParams.delete('user_view');
  messages.searchParams.set('current_count', '25');
  const take = new URL(list.origin + list.pathname);
  take.searchParams.set('take_conversation_ids[]', conversationPath.split('/').at(-1));
  take.searchParams.set('request_source', 'fill_customer_count');
  const paths = [list.pathname + list.search, listMore.pathname + listMore.search, take.pathname + take.search,
    conversationPath, `${conversationPath}/tags_update_histories`, messages.pathname + messages.search];
  for (const path of paths) permittedPaths.add(path);
  spec.actions = [{ step_id: 'settle', action: 'wait_for_timeout', duration_ms: 1500 },
    ...paths.map((path, index) => ({ step_id: ['initial_cursor_list', 'list_next_page', 'read_selected_snapshot',
      'read_single_conversation', 'read_tag_history', 'read_message_next_page'][index], action: 'request', method: 'GET', path, expected_status: [200], timeout_ms: 15000 }))];
}
if (spec.readSurface === 'pos-discovery' || conversationMutation) {
  const settings = JSON.parse(await readFile(resolve(privateRoot, 'research-2026-11-15/current-settings.json'), 'utf8'));
  const shopId = selectedShopId ?? String(settings.shop_id);
  if (!/^[0-9]+$/.test(shopId)) throw new Error('missing_selected_pos_shop');
  permittedPaths.add(`/pos-api/api/v1/shops/${shopId}`);
  permittedPaths.add(`/pos-api/api/v1/shops/${shopId}/crm/automation`);
}
if (!Array.isArray(spec.actions) || spec.actions.length < 1 || spec.actions.length > 10) throw new Error('invalid_actions');
for (const action of spec.actions) {
  // Mutation plans are generated above, never accepted as caller-supplied selectors or code.
  if (tagMutation || conversationMutation) continue;
  if (connectivityProbe && action.step_id === 'observe_fault_window' && action.duration_ms === faultDuration) continue;
  if (conversationInspect && action.action === 'click' && action.step_id === 'open_read_conversation') continue;
  if (action.action === 'wait_for_timeout' && Number.isInteger(action.duration_ms) &&
      action.duration_ms >= 0 && action.duration_ms <= 15000) continue;
  if (tagUi && action.action === 'wait_for' && action.locator?.kind === 'css' &&
      action.locator.selector === '.setting-tag-container' && action.state === 'visible' && action.timeout_ms <= 15000) continue;
  if (spec.tagOperation === 'preview' && action.action === 'click' && action.locator?.selector === '.btn-create-tags') continue;
  if (action.action !== 'request') throw new Error('only_explicit_requests_in_this_runner');
  // Request actions remain read-only; settings writes are limited to the generated UI experiment.
  if (action.method === 'GET' && permittedPaths.has(action.path) &&
      Object.keys(action).every((key) => ['step_id', 'action', 'method', 'path', 'expected_status', 'timeout_ms'].includes(key))) continue;
  throw new Error('request_outside_facebook_research_scope');
}
const browser = await chromium.connectOverCDP(endpoint);
const context = browser.contexts()[0];
const targets = await (await fetch(`${endpoint}/json/list`)).json();
let target = session.targetId ? targets.find((item) => item.type === 'page' && item.id === session.targetId) : targets.find((item) => {
  try { return item.type === 'page' && new URL(item.url).origin === 'https://pancake.vn'; } catch { return false; }
});
if (!target) throw new Error('target_missing');
let ownedProbePage;
if (socketInterruption || spec.disposableTab === true) {
  ownedProbePage = await context.newPage();
  const discovery = await context.newCDPSession(ownedProbePage);
  const { targetInfo } = await discovery.send('Target.getTargetInfo');
  target = { id: targetInfo.targetId, url: 'about:blank' };
  await discovery.detach();
}
const watchedPage = ownedProbePage ?? context.pages().find((page) => page.url() === target.url);
const pages = JSON.parse(await readFile(resolve(privateRoot, 'pancake-research-targets.json'), 'utf8'));
const tiktokIds = pages.filter((page) => page.platform !== 'facebook').map((page) => page.id);
let blockedTikTokWrites = 0;
let liveMembership = null;
let liveSettings = null;
let liveConversations = null;
let liveShop = null;
let liveAutomations = null;
const writeAudit = { allowed: 0, blocked: 0, reasons: [] };
const privateDir = resolve(privateRoot, 'research-2026-11-15');
await mkdir(privateDir, { recursive: true });
const probe = { phase: 'baseline', faults: [], snapshots: [], failedRequests: {}, restoredInFinally: false };
let faultTimer;
let restoreTimer;
let faultTask;
let socketFault;
let actorTask;
const setOffline = async (offline) => {
  if (socketInterruption) {
    if (offline) await socketFault.cut(); else socketFault.restore();
  } else await cdp.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  probe.phase = offline ? 'offline' : 'restored';
  probe.faults.push({ offline, appliedAt: new Date().toISOString(), mechanism: socketInterruption
    ? 'disposable-tab WebSocket closure and retry rejection' : 'target CDP network emulation' });
  if (offline && socketInterruption && spec.gapActor) {
    if (!/^NSR-[0-9]{4}-[A-F0-9]{4}$/.test(spec.gapActor.tagName)) throw new Error('invalid_gap_actor');
    const actorSpec = resolve(privateDir, `${spec.runId}-actor-spec.json`);
    actorTask = (async () => {
      await writeFile(actorSpec, JSON.stringify({ runId: `${spec.runId}-actor`, conversationTagOperation: 'attach',
        tagName: spec.gapActor.tagName, disposableTab: true }));
      const { stdout } = await promisify(execFile)(process.execPath, [fileURLToPath(import.meta.url), actorSpec],
        { timeout: 90000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
      probe.actor = JSON.parse(stdout);
    })();
    actorTask.catch(() => { probe.actor = { result: 'failed', details: 'private_actor_artifacts' }; });
  }
};
const inspectResponse = async (response) => {
  try {
    if (response.frame().page() !== watchedPage) return;
    const address = new URL(response.url());
    if (address.origin !== 'https://pancake.vn' || response.request().method() !== 'GET' || response.status() !== 200) return;
    if (address.pathname === '/api/v1/pages') {
      const body = await response.json();
      const activated = body.categorized?.activated;
      if (Array.isArray(activated)) liveMembership = activated.find((page) => page.id === facebookId) ?? null;
    }
    if (address.pathname === `/api/v1/pages/${facebookId}/settings`) {
      const body = await response.json();
      if (body.success && Array.isArray(body.settings?.tags)) liveSettings = body.settings;
    }
    if (conversationMutation && address.pathname === `/api/v1/pages/${facebookId}/conversations`) {
      const body = await response.json();
      if (body.success && Array.isArray(body.conversations)) liveConversations = body.conversations;
    }
    if (conversationMutation && address.pathname === `/pos-api/api/v1/shops/${selectedShopId}`) {
      const body = await response.json(); if (body.success && body.shop) liveShop = body.shop;
    }
    if (conversationMutation && address.pathname === `/pos-api/api/v1/shops/${selectedShopId}/crm/automation`) {
      const body = await response.json(); if (body.success && Array.isArray(body.data)) liveAutomations = body.data;
    }
    if (connectivityProbe && address.pathname === `/api/v1/pages/${facebookId}/conversations`) {
      const body = await response.json();
      if (body.success && Array.isArray(body.conversations)) {
        probe.snapshots.push({ phase: probe.phase, observedAt: new Date().toISOString(), count: body.conversations.length,
          canonicalSha256: conversationSnapshotFingerprint(body.conversations) });
        if (!faultTimer && probe.phase === 'baseline') {
          faultTimer = setTimeout(() => {
            faultTask = setOffline(true).then(() => {
              restoreTimer = setTimeout(() => { faultTask = setOffline(false); faultTask.catch(() => {}); }, faultDuration);
            });
            faultTask.catch(() => {});
          }, 5000);
        }
      }
    }
  } catch { /* Missing response bodies cannot establish write preconditions. */ }
};
context.on('response', inspectResponse);
const guard = async (route) => {
  const request = route.request();
  const address = new URL(request.url());
  if (address.origin === 'https://pancake.vn' && /\/conversations\/[^/]+\/toggle_tag$/.test(address.pathname) && request.method() !== 'GET') {
    let allowed = false;
    try {
      if (conversationMutation && request.method() === 'POST' && writeAudit.allowed === 0 &&
          address.pathname === `/api/v1/pages/${facebookId}/conversations/${selectedConversation.id}/toggle_tag`) {
        const parsed = await new Request(request.url(), { method: 'POST',
          headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer() }).formData();
        const fields = Object.fromEntries(parsed.entries());
        const baseline = { membership: liveMembership, settings: liveSettings,
          conversation: liveConversations?.find((item) => item.id === selectedConversation.id), shop: liveShop, automations: liveAutomations };
        allowed = [...parsed.keys()].length === Object.keys(fields).length &&
          allowsConversationTag(fields, baseline, spec.conversationTagOperation, spec.tagName);
        await writeFile(resolve(privateDir, `${spec.runId}-${allowed ? 'before' : 'blocked-payload'}.json`), JSON.stringify({ fields, baseline }));
      }
    } catch { allowed = false; }
    if (!allowed) { writeAudit.blocked += 1; writeAudit.reasons.push('conversation_tag_contract_mismatch'); return route.abort('blockedbyclient'); }
    writeAudit.allowed += 1;
  }
  if (address.origin === 'https://pancake.vn' && address.pathname === `/api/v1/pages/${facebookId}/settings` &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
    let allowed = false;
    let blockedReason = 'live_preconditions_missing';
    if (tagMutation && request.method() === 'POST' && writeAudit.allowed === 0 &&
        liveMembership?.platform === 'facebook' && liveMembership.role_in_page === 'ADMINISTER' && !liveMembership.tag_sync_group_id) {
      try {
        const parsed = await new Request(request.url(), { method: 'POST',
          headers: { 'content-type': request.headers()['content-type'] }, body: request.postDataBuffer() }).formData();
        const fields = Object.fromEntries(parsed.entries());
        allowed = parsed.getAll('changes').length === 1 && parsed.getAll('current_settings_key').length === 1 &&
          allowsTagMutation(fields, liveSettings, spec.tagOperation, spec.tagName);
        if (!allowed) {
          blockedReason = 'mutation_contract_mismatch';
          await writeFile(resolve(privateDir, `${spec.runId}-blocked-payload.json`), JSON.stringify({ fields, baseline: liveSettings }));
        }
        if (allowed) await writeFile(resolve(privateDir, `${spec.runId}-before.json`), JSON.stringify({ membership: liveMembership, settings: liveSettings }));
      } catch { allowed = false; blockedReason = 'form_parse_or_snapshot_failed'; }
    }
    if (!allowed) { writeAudit.blocked += 1; writeAudit.reasons.push(blockedReason); return route.abort('blockedbyclient'); }
    writeAudit.allowed += 1;
  }
  if (['pancake.vn', 'pages.fm'].includes(address.hostname) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
      address.pathname !== '/api/v1/pages/unread_conv_pages_count') {
    let input;
    try { input = decodeURIComponent(address.pathname + address.search) + (request.postData() ?? ''); }
    catch { return route.abort('blockedbyclient'); }
    if (address.pathname.includes('/tiktok/') || tiktokIds.some((id) => input.includes(id))) {
      blockedTikTokWrites += 1;
      return route.abort('blockedbyclient');
    }
  }
  return route.continue();
};
await watchedPage.route('**/*', guard);
const childEnv = { ...process.env };
const secrets = (await context.cookies('https://pancake.vn')).filter((cookie) => cookie.value.length >= 8).map((cookie, index) => {
  const key = `AIL_SESSION_SECRET_${index}`;
  childEnv[key] = cookie.value;
  return { secret_id: `cookie_${index}`, environment_variable: key };
});
const scenario = {
  browser: { mode: 'connect', cdp_endpoint: endpoint, target_id: target.id },
  start_url: { url: `https://pancake.vn${session.facebook.path}${tagUi ? '/setting/tag' : ''}`, query: [] },
  environment: { service_workers: 'allow' }, secrets, actions: spec.actions,
  capture: { at_end: tagUi || spec.captureUi === true ? ['url', 'dom', 'accessibility'] : ['url'], events: ['network', 'websockets'], network: { request_body: false, response_body: true, header_values: false },
    limits: { max_network_body_bytes: 65536, max_network_body_allocation_bytes: 1048576,
      max_total_event_allocation_bytes: 67108864, max_network_metadata_allocation_bytes: 4194304 } },
  command_timeout_ms: faultDuration === 900000 ? 960000 : 30000,
};
const reaRoot = resolve(process.env.LOCALAPPDATA, 'REA');
const cdp = await context.newCDPSession(watchedPage);
if (socketInterruption) socketFault = await installWebSocketFaultProbe(watchedPage, (address) =>
  address.origin === 'wss://pancake.vn' && address.pathname === '/socket/websocket');
const sockets = new Set();
const transport = { receivedFrames: 0, settingsEvents: [], conversationEvents: [], connections: [] };
const socketRecords = new Map();
const pendingJoins = new Map();
cdp.on('Network.webSocketCreated', ({ requestId, url }) => {
  try {
    const address = new URL(url);
    if (address.origin === 'wss://pancake.vn' && address.pathname === '/socket/websocket') {
      sockets.add(requestId);
      if (transport.connections.length < 32) {
        const record = { ordinal: transport.connections.length + 1, openedAt: new Date().toISOString(), phase: probe.phase,
          closedAt: null, facebookJoinSentAt: null, facebookJoinAckAt: null };
        socketRecords.set(requestId, record); transport.connections.push(record);
      }
    }
  } catch {}
});
cdp.on('Network.webSocketClosed', ({ requestId }) => {
  const record = socketRecords.get(requestId);
  if (record) record.closedAt = new Date().toISOString();
});
cdp.on('Network.webSocketFrameSent', ({ requestId, response }) => {
  if (!socketRecords.has(requestId) || Buffer.byteLength(response.payloadData) > 262144) return;
  try {
    const tuple = JSON.parse(response.payloadData);
    if (tuple?.[2] === `pages:${facebookId}` && tuple?.[3] === 'phx_join') {
      pendingJoins.set(requestId, tuple[1]);
      socketRecords.get(requestId).facebookJoinSentAt = new Date().toISOString();
    }
  } catch {}
});
cdp.on('Network.loadingFailed', ({ errorText }) => {
  if (!connectivityProbe) return;
  const code = errorText.match(/ERR_[A-Z_]+/)?.[0] ?? 'OTHER';
  probe.failedRequests[code] = (probe.failedRequests[code] ?? 0) + 1;
});
cdp.on('Network.webSocketFrameReceived', ({ requestId, response }) => {
  if (!sockets.has(requestId)) return;
  transport.receivedFrames += 1;
  const raw = response.payloadData;
  if (Buffer.byteLength(raw) > 262144) return;
  try {
    const tuple = JSON.parse(raw);
    if (tuple?.[2] === `pages:${facebookId}` && ['pages:tag_conversation', 'pages:tag_conversations', 'pages:update_conversation', 'pages:update_messages'].includes(tuple?.[3])) {
      transport.conversationEvents.push({ observedAt: new Date().toISOString(), phase: probe.phase, event: tuple[3],
        frameSha256: createHash('sha256').update(raw).digest('hex'), knownPayloadKeys: Object.keys(tuple[4] ?? {}),
        matchesSelectedConversation: !!selectedConversation && (tuple[4]?.conversation_id === selectedConversation.id ||
          tuple[4]?.conversation?.id === selectedConversation.id || !!tuple[4]?.conversations_updated?.some((item) => item.id === selectedConversation.id)) });
    }
    if (tuple?.[2] === `pages:${facebookId}` && tuple?.[3] === 'phx_reply' &&
        pendingJoins.has(requestId) && tuple[1] === pendingJoins.get(requestId) && tuple[4]?.status === 'ok') {
      socketRecords.get(requestId).facebookJoinAckAt = new Date().toISOString();
    }
    if (!Array.isArray(tuple) || tuple.length !== 5 || tuple[3] !== 'pages:update_settings') return;
    const payload = tuple[4];
    transport.settingsEvents.push({ observedAt: new Date().toISOString(), event: tuple[3],
      topicFamily: typeof tuple[2] === 'string' ? tuple[2].split(':')[0] : 'UNKNOWN',
      facebookReference: tuple[2] === `pages:${facebookId}` || payload?.page_id === facebookId || payload?.pageId === facebookId,
      containsSyntheticMarker: !!spec.tagName && raw.includes(spec.tagName),
      frameSha256: createHash('sha256').update(raw).digest('hex'),
      knownPayloadKeys: ['page_id', 'pageId', 'settings', 'change_settings', 'tags', 'current_settings_key'].filter((key) => payload && Object.hasOwn(payload, key)) });
  } catch { /* Other frames are not interpreted as settings evidence. */ }
});
await cdp.send('Network.enable');
try {
  const { stdout } = await promisify(execFile)(resolve(reaRoot, 'node-v24.22.2-win-x64/node.exe'),
    [resolve(reaRoot, 'cli/node_modules/rea-agents/scripts/rea.mjs'), 'capture-browser-scenario', JSON.stringify(scenario), '--format', 'json'],
    { env: childEnv, timeout: faultDuration === 900000 ? 990000 : 90000, maxBuffer: 24 * 1024 * 1024, windowsHide: true });
  const evidence = JSON.parse(stdout);
  const dir = resolve(privateRoot, 'research-2026-11-15');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, `${spec.runId}.json`), JSON.stringify(evidence));
  if (actorTask) await actorTask.catch(() => {});
  const summary = { ...summarizeFacebookCapture(evidence, spec, facebookId), blockedTikTokWrites, writeAudit, transport };
  if (connectivityProbe) {
    summary.connectivityProbe = probe;
    if (socketInterruption) summary.socketFaultAudit = socketFault.audit;
    if (probe.faults.length !== 2 || probe.phase !== 'restored') summary.result = 'failed';
    if (spec.gapActor) {
      const actorAt = probe.actor?.transport?.conversationEvents?.find((event) => event.matchesSelectedConversation)?.observedAt;
      summary.actorInsideFault = !!actorAt && Date.parse(actorAt) > Date.parse(probe.faults[0]?.appliedAt) &&
        Date.parse(actorAt) < Date.parse(probe.faults[1]?.appliedAt);
      if (probe.actor?.result !== 'completed' || !summary.actorInsideFault) summary.result = 'failed';
    }
  }
  if (tagMutation) {
    const matches = liveSettings?.tags?.filter((tag) => tag.text === spec.tagName).length;
    summary.mutationVerification = { operation: spec.tagOperation,
      syntheticTagCount: matches ?? null, readbackAvailable: matches !== undefined };
    if (writeAudit.allowed !== 1 || writeAudit.blocked !== 0 || matches === undefined ||
        matches !== (spec.tagOperation === 'create' ? 1 : 0)) summary.result = 'failed';
  }
  if (conversationMutation) {
    const tag = liveSettings?.tags?.find((item) => item.text === spec.tagName);
    const conversation = liveConversations?.find((item) => item.id === selectedConversation.id);
    const present = !!tag && conversation?.tags?.includes(tag.id);
    summary.conversationTagVerification = { operation: spec.conversationTagOperation, readbackAvailable: !!conversation,
      syntheticTagPresent: present ?? null, tagCount: conversation?.tags?.length ?? null };
    if (writeAudit.allowed !== 1 || writeAudit.blocked !== 0 || !conversation || !tag ||
        present !== (spec.conversationTagOperation === 'attach')) summary.result = 'failed';
    await writeFile(resolve(privateDir, `${spec.runId}-after-conversations.json`), JSON.stringify(liveConversations));
  }
  await writeFile(resolve(dir, `${spec.runId}-summary.json`), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
  if (summary.result !== 'completed') process.exitCode = 1;
  if (tagMutation && liveSettings) await writeFile(resolve(dir, `${spec.runId}-after.json`), JSON.stringify(liveSettings));
  if (!ownedProbePage) await writeFile(resolve(privateRoot, 'pancake-research-session.json'), JSON.stringify({ ...session, cdpEndpoint: endpoint, targetId: target.id }, null, 2));
} catch (error) {
  const diagnostic = String(error.stdout ?? '') + String(error.stderr ?? '');
  const failure = { runId: spec.runId, result: 'failed',
    reasonCodes: [...new Set(diagnostic.match(/ERR_[A-Z_]+/g) ?? [])], blockedTikTokWrites,
    recordedAt: new Date().toISOString(), actionsCompleted: 'UNKNOWN' };
  const dir = resolve(privateRoot, 'research-2026-11-15');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, `${spec.runId}-private-diagnostic.txt`), String(error.message) + '\n' + diagnostic);
  await writeFile(resolve(dir, `${spec.runId}-failure.json`), JSON.stringify(failure, null, 2));
  console.log(JSON.stringify(failure));
  process.exitCode = 1;
} finally {
  clearTimeout(faultTimer); clearTimeout(restoreTimer);
  if (faultTask) await faultTask.catch(() => {});
  if (actorTask) await actorTask.catch(() => {});
  clearTimeout(restoreTimer);
  if (connectivityProbe) {
    await setOffline(false);
    probe.restoredInFinally = true;
    await writeFile(resolve(privateDir, `${spec.runId}-fault-cleanup.json`), JSON.stringify(probe, null, 2));
  }
  context.off('response', inspectResponse);
  await cdp.detach();
  await watchedPage.unroute('**/*', guard);
  await ownedProbePage?.close();
  // Disconnect from the externally owned browser, preserving the user's session.
  await browser.close();
}
