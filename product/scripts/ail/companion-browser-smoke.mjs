import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createServer } from 'node:https';
import { chromium } from '@playwright/test';
import { packageCompanion } from '../companion-package.mjs';

// No provider is contacted: the browser resolves pancake.vn to this local TLS fixture.
await mkdir('.tmp', { recursive: true });
const temp = await mkdtemp(resolve('.tmp/companion-smoke-'));
// Load the extension from the deterministic package (not the source tree) so the shipped artifact is what runs.
const packaged = await packageCompanion({ outDir: resolve(temp, 'package') });
const root = resolve(temp, 'extension');
await mkdir(root);
{
  const zip = await readFile(resolve(temp, 'package', packaged.zip.file));
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  for (let i = 0, at = zip.readUInt32LE(end + 16); i < zip.readUInt16LE(end + 10); i += 1) {
    const size = zip.readUInt32LE(at + 24), nameLength = zip.readUInt16LE(at + 28), offset = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const start = offset + 30 + zip.readUInt16LE(offset + 26);
    await writeFile(resolve(root, name), zip.subarray(start, start + size));
    at += 46 + nameLength;
  }
}
const openssl = process.env.AIL_OPENSSL ?? (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
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
  // One allowlisted frame plus one unknown-event frame (schema drift) per socket.
  for (const frame of [[null, null, 'pages:fixture-page', 'pages:update_messages', { conversation_id: 'fixture-conversation', message: 'private-synthetic-text' }],
    [null, null, 'pages:fixture-page', 'pages:synthetic_new_event', { private_field: 'private-drift-text' }]]) {
    const payload = Buffer.from(JSON.stringify(frame));
    // RFC 6455 requires minimal length encoding; Chromium fails the socket otherwise.
    const header = payload.length < 126 ? Buffer.from([0x81, payload.length]) : Buffer.alloc(4);
    if (payload.length >= 126) { header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
    socket.write(Buffer.concat([header, payload]));
  }
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
  // Only the local fixture and this extension's own pages may load; everything else is aborted.
  await context.route('**/*', (route) => { const target = new URL(route.request().url()); return target.hostname === 'pancake.vn' || target.protocol === 'chrome-extension:' ? route.continue() : route.abort(); });
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
  const read = async () => (await (await extensionWorker()).evaluate(async () => (await chrome.storage.local.get('northStarResearchV1')).northStarResearchV1));
  for (let attempt = 0; attempt < 50 && !(await read()).drift; attempt += 1) await new Promise((done) => setTimeout(done, 100));
  state = await read();
  assert.equal(state.drift?.count, 1, 'unknown frame shape counted as drift');
  assert.ok(!JSON.stringify(state).match(/private-drift-text|synthetic_new_event/), 'drift keeps only a fingerprint');

  // Service-worker termination: close the extension worker target (as Chrome's own termination guide does), verify a
  // fresh instance (in-memory nonce gone), then a new CDP event must be captured with durable state intact.
  await (await extensionWorker()).evaluate(() => { globalThis.smokeNonce = 'before-termination'; });
  const cdp = await context.newCDPSession(page);
  const { targetInfos } = await cdp.send('Target.getTargets');
  const workerTarget = targetInfos.find((info) => info.type === 'service_worker' && info.url.startsWith('chrome-extension://'));
  assert.ok(workerTarget, 'extension service-worker target visible');
  await cdp.send('Target.closeTarget', { targetId: workerTarget.targetId });
  for (let attempt = 0; attempt < 50 && context.serviceWorkers().length; attempt += 1) await new Promise((done) => setTimeout(done, 100));
  await page.evaluate(() => { window.secondSocket = new WebSocket('wss://pancake.vn/socket/websocket'); });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    state = await read();
    if (state.outbox.length >= 2) break;
    await new Promise((done) => setTimeout(done, 100));
  }
  assert.equal(state.outbox.length, 2, `capture resumes after worker termination: ${JSON.stringify({ outbox: state.outbox.length, stop: state.lastStop })}`);
  assert.equal(state.captureSeq, 2, 'capture sequence continues without reuse');
  assert.notEqual(state.outbox[0].captureId, state.outbox[1].captureId);
  const workerRestarted = await (await extensionWorker()).evaluate(() => globalThis.smokeNonce === undefined);
  assert.ok(workerRestarted, 'capture after termination ran in a new worker instance');

  // Popup accessibility: rendered in a tab, labelled controls and a polite live status region.
  const extensionId = new URL((await extensionWorker()).url()).host;
  const popup = await context.newPage();
  const popupErrors = [];
  popup.on('pageerror', (error) => popupErrors.push(error.message));
  popup.on('console', (entry) => popupErrors.push(entry.text()));
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForFunction(() => document.querySelector('#summary')?.textContent?.includes('records stored'), null, { timeout: 10000 })
    .catch(async (error) => { throw new Error(`popup did not render: ${JSON.stringify(popupErrors)} ${await popup.locator('#summary').textContent()}`, { cause: error }); });
  for (const label of ['Research workspace', 'Connection reference', 'Account reference', 'Allowed Pancake page ID', 'Trusted backend origin', 'Enrollment JSON']) {
    assert.equal(await popup.getByLabel(label).count(), 1, `labelled control ${label}`);
  }
  assert.equal(await popup.locator('#summary[aria-live="polite"][role="status"]').count(), 1);
  assert.ok((await popup.locator('#drift').isVisible()), 'drift notice surfaced in popup');
  await popup.keyboard.press('Tab');
  assert.equal(await popup.evaluate(() => document.activeElement?.id), 'workspaceId', 'first focus lands on the first scope field');
  await popup.close();

  // Closing the attached tab detaches observation.
  await page.close();
  for (let attempt = 0; attempt < 50 && (await read()).session; attempt += 1) await new Promise((done) => setTimeout(done, 100));
  state = await read();
  assert.equal(state.session, null, 'tab close detaches');
  const tabCloseStop = state.lastStop;
  await context.close();
  context = await chromium.launchPersistentContext(profile, options);
  worker = await extensionWorker();
  const restored = await worker.evaluate(async () => (await chrome.storage.local.get('northStarResearchV1')).northStarResearchV1);
  assert.equal(restored.outbox.length, 2, 'outbox survives browser restart');
  assert.equal(restored.continuity, 'UNKNOWN');
  console.log(JSON.stringify({ result: 'PASS', realChromiumMV3: true, syntheticWebsocketCaptured: true, rawMessageExcluded: true, browserRestartPersistence: true, providerContacted: false,
    packagedArtifact: packaged.zip.sha256, workerRestarted, captureAfterWorkerStop: true, driftFingerprintOnly: true, popupA11y: true, tabCloseStop }));
} finally {
  await context?.close();
  for (const socket of sockets) socket.destroy();
  await new Promise((done) => server.close(done));
}
