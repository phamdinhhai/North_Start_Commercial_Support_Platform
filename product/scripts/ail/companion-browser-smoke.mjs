import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createServer } from 'node:https';
import { chromium } from '@playwright/test';

// No provider is contacted: the browser resolves pancake.vn to this local TLS fixture.
const root = resolve('src/adapters/browser-companion');
await mkdir('.tmp', { recursive: true });
const temp = await mkdtemp(resolve('.tmp/companion-smoke-'));
const openssl = process.env.AIL_OPENSSL ?? 'C:/Program Files/Git/usr/bin/openssl.exe';
await promisify(execFile)(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', resolve(temp, 'key.pem'), '-out', resolve(temp, 'cert.pem'), '-days', '1', '-subj', '/CN=pancake.vn'], { windowsHide: true });
const server = createServer({ key: await readFile(resolve(temp, 'key.pem')), cert: await readFile(resolve(temp, 'cert.pem')) }, (_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<html><title>Synthetic North Star fixture</title><body>Local fixture</body></html>');
});
const sockets = new Set();
server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
server.on('upgrade', (request, socket) => {
  const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const payload = Buffer.from(JSON.stringify([null, null, 'pages:fixture-page', 'pages:update_messages', { conversation_id: 'fixture-conversation', message: 'private-synthetic-text' }]));
  const header = Buffer.alloc(4);
  header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2);
  socket.write(Buffer.concat([header, payload]));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const profile = resolve(temp, 'profile');
const options = {
  channel: 'chromium', headless: true, ignoreHTTPSErrors: true,
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`,
    `--host-resolver-rules=MAP pancake.vn 127.0.0.1:${port}`, '--no-proxy-server', '--ignore-certificate-errors'],
};
let context;
async function extensionWorker() {
  return context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 15000 });
}
try {
  context = await chromium.launchPersistentContext(profile, options);
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === 'pancake.vn' ? route.continue() : route.abort());
  let worker = await extensionWorker();
  const page = await context.newPage();
  await page.goto('https://pancake.vn/');
  await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    // The test harness seeds the trusted worker boundary; UI authorization is tested separately.
    const target = tabs.find((tab) => tab.url?.startsWith('https://pancake.vn/')) ?? tabs.at(-1);
    await chrome.debugger.attach({ tabId: target.id }, '1.3');
    await chrome.storage.local.set({ northStarResearchV1: {
      version: 1, session: { tabId: target.id, sockets: [], startedAt: new Date().toISOString(),
        scope: { workspaceId: 'fixture-workspace', connectionId: 'fixture-connection', accountId: 'fixture-account', pageId: 'fixture-page' } },
      outbox: [], gapSince: new Date().toISOString(), dropped: 0, continuity: 'UNKNOWN',
    } });
    await chrome.debugger.sendCommand({ tabId: target.id }, 'Network.enable');
  });
  await page.evaluate(() => { window.fixtureSocket = new WebSocket('wss://pancake.vn/socket/websocket'); });
  let state;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    state = await worker.evaluate(async () => (await chrome.storage.local.get('northStarResearchV1')).northStarResearchV1);
    if (state.outbox.length) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.equal(state.outbox.length, 1, `real CDP frame must reach persistent outbox: ${JSON.stringify(state)}`);
  assert.equal(state.outbox[0].evidenceType, 'client-observed');
  assert.ok(!JSON.stringify(state).includes('private-synthetic-text'));
  await context.close();
  context = await chromium.launchPersistentContext(profile, options);
  worker = await extensionWorker();
  const restored = await worker.evaluate(async () => (await chrome.storage.local.get('northStarResearchV1')).northStarResearchV1);
  assert.equal(restored.outbox.length, 1, 'outbox survives browser restart');
  assert.equal(restored.continuity, 'UNKNOWN');
  console.log(JSON.stringify({ result: 'PASS', realChromiumMV3: true, syntheticWebsocketCaptured: true, rawMessageExcluded: true, browserRestartPersistence: true, providerContacted: false }));
} finally {
  await context?.close();
  for (const socket of sockets) socket.destroy();
  await new Promise((done) => server.close(done));
}
