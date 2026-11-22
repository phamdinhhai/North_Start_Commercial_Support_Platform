import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const product = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const input = resolve(process.argv[2] ?? resolve(product, '../docs/login_info/download.devtools'));
const output = resolve(process.argv[3] ?? resolve(product, '../docs/research/adaptive-integration-2026-11-14'));
const bytes = await readFile(input);
const har = JSON.parse(bytes.toString('utf8'));
if (!Array.isArray(har.log?.entries)) throw new Error('expected_har_entries');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const providerHosts = new Set(['pancake.vn', 'pages.fm', 'app.pancake.vn', 'pos.pancake.vn']);
const events = new Set(['phx_join', 'phx_reply', 'phx_leave', 'phx_close', 'phx_error', 'heartbeat',
  'get_online_status', 'online_status', 'pages:update_messages', 'pages:update_conversation', 'messages:mark_as_deleted']);
const topicFamilies = new Set(['pages', 'users', 'phoenix', 'pke_chat_plugin']);
const fieldNames = new Set(['userId', 'platform', 'clientSession', 'pageId', 'path', 'page_id', 'client_session',
  'user_id', 'status', 'response', 'value', 'success', 'conversation', 'conversation_id', 'messages',
  'accessToken', 'access_token', 'id', 'message_count']);
const increment = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
const report = {
  schema: 'north-star.har-metadata-review.v1', evidenceType: 'historical-user-capture',
  source: { filename: 'download.devtools', sha256: hash(bytes), bytes: bytes.length },
  totalEntries: har.log.entries.length, totalPages: har.log.pages?.length ?? null,
  methods: {}, statuses: {}, socketRecords: [], pageInventory: [],
  limitations: [
    'Local JSON extraction; not a live replay. HAR has no independently established capture completeness.',
    'Headers, cookies, query values, payload values, account IDs, customer data and response text are excluded.',
    'The REA derivative contains selected WebSocket handshake metadata only; bodies and frame records are omitted.',
    'A successful join or heartbeat is not evidence of business-event delivery or replay guarantees.',
    'Page membership/role fields are historical provider assertions, not current North Star authorization.',
  ],
};
const derivative = { log: { version: '1.2', creator: { name: 'North Star metadata derivative', version: '1' }, entries: [] } };
const ordinals = [];
for (const [ordinal, entry] of har.log.entries.entries()) {
  increment(report.methods, entry.request.method);
  increment(report.statuses, entry.response.status);
  const url = new URL(entry.request.url);
  if (!providerHosts.has(url.hostname)) continue;
  if (url.pathname === '/api/v1/pages' && entry.response.status === 200 && entry.response.content?.text) {
    try {
      const content = entry.response.content;
      const text = content.encoding === 'base64' ? Buffer.from(content.text, 'base64').toString('utf8') : content.text;
      const pages = JSON.parse(text).categorized?.activated;
      if (Array.isArray(pages)) report.pageInventory.push({ sourceOrdinal: ordinal,
        count: pages.length, platforms: pages.reduce((counts, page) => {
          const platform = ['facebook', 'tiktok_business_messaging'].includes(page.platform) ? page.platform : 'other';
          increment(counts, platform); return counts;
        }, {}), allAdminister: pages.every((page) => page.role_in_page === 'ADMINISTER') });
    } catch { /* Bodies that do not match this documented research seam remain unclassified. */ }
  }
  if (!Array.isArray(entry._webSocketMessages)) continue;
  const socket = { sourceOrdinal: ordinal, origin: url.origin,
    path: url.pathname === '/socket/websocket' ? url.pathname : 'UNKNOWN',
    status: entry.response.status, queryNames: [...url.searchParams.keys()].filter((name) => ['vsn', 'pke_chat_plugin_page_id'].includes(name)),
    frameCount: entry._webSocketMessages.length, parsedPhoenixTuples: 0, unclassifiedFrames: 0,
    directions: {}, events: {}, topics: {}, replyStatuses: {}, payloadFieldNames: [], heartbeatIntervalsSeconds: [] };
  const fields = new Set(); let heartbeatTime = null;
  for (const frame of entry._webSocketMessages) {
    const direction = ['send', 'receive'].includes(frame.type) ? frame.type : 'UNKNOWN';
    increment(socket.directions, direction);
    let tuple;
    try { tuple = JSON.parse(frame.data); } catch { socket.unclassifiedFrames += 1; continue; }
    if (!Array.isArray(tuple) || tuple.length !== 5) { socket.unclassifiedFrames += 1; continue; }
    socket.parsedPhoenixTuples += 1;
    const event = events.has(tuple[3]) ? tuple[3] : 'UNKNOWN';
    const family = typeof tuple[2] === 'string' ? tuple[2].split(':')[0] : 'UNKNOWN';
    increment(socket.events, event); increment(socket.topics, topicFamilies.has(family) ? family : 'UNKNOWN');
    if (tuple[4] && typeof tuple[4] === 'object') for (const key of Object.keys(tuple[4])) if (fieldNames.has(key)) fields.add(key);
    if (event === 'phx_reply') increment(socket.replyStatuses, ['ok', 'error'].includes(tuple[4]?.status) ? tuple[4].status : 'UNKNOWN');
    if (event === 'heartbeat' && direction === 'send' && Number.isFinite(frame.time)) {
      if (heartbeatTime !== null) socket.heartbeatIntervalsSeconds.push(Number((frame.time - heartbeatTime).toFixed(3)));
      heartbeatTime = frame.time;
    }
  }
  socket.payloadFieldNames = [...fields].sort();
  report.socketRecords.push(socket);
  // This is a declared metadata derivative, never a replacement for the raw capture.
  const copied = structuredClone(entry);
  delete copied._initiator; delete copied.serverIPAddress; delete copied.connection;
  delete copied._connectionId; delete copied.pageref; delete copied._webSocketMessages;
  copied.request = { method: entry.request.method, url: url.origin + socket.path,
    httpVersion: entry.request.httpVersion, headers: [], cookies: [], queryString: [], headersSize: -1, bodySize: -1 };
  copied.response = { status: entry.response.status, statusText: entry.response.statusText,
    httpVersion: entry.response.httpVersion, headers: [], cookies: [], redirectURL: '',
    content: { size: entry.response.content.size, mimeType: entry.response.content.mimeType }, headersSize: -1, bodySize: -1 };
  copied.cache = {};
  derivative.log.entries.push(copied); ordinals.push(ordinal);
}
report.totalWebsocketFrames = report.socketRecords.reduce((total, socket) => total + socket.frameCount, 0);
report.businessEventFrames = report.socketRecords.reduce((total, socket) => total +
  ['pages:update_messages', 'pages:update_conversation', 'messages:mark_as_deleted'].reduce((count, event) => count + (socket.events[event] ?? 0), 0), 0);
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'har-review.json'), JSON.stringify(report, null, 2) + '\n');
const derivedBytes = JSON.stringify(derivative);
const derivedPath = resolve(product, '.tmp/ail-research-2026-11-14/handshake-metadata.har');
await mkdir(dirname(derivedPath), { recursive: true });
await writeFile(derivedPath, derivedBytes);
await writeFile(resolve(output, 'har-derivation.json'), JSON.stringify({ sourceSha256: report.source.sha256,
  derivativeSha256: hash(derivedBytes), derivativeBytes: Buffer.byteLength(derivedBytes),
  originalOrdinalsInDerivativeOrder: ordinals, transformation: report.limitations[2] }, null, 2) + '\n');
console.log(JSON.stringify({ totalEntries: report.totalEntries, sockets: report.socketRecords.length,
  websocketFrames: report.totalWebsocketFrames, businessEventFrames: report.businessEventFrames,
  pageInventory: report.pageInventory, socketTopics: report.socketRecords.map((socket) => ({ origin: socket.origin, topics: socket.topics })) }));
