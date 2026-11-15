import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { installWebSocketFaultProbe } from './websocket-fault-probe.mjs';

test('local Chromium closes an established socket, rejects retries, then forwards recovery', { timeout: 20000 }, async () => {
  const sockets = new Set();
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end(`<body data-greetings="0"><script>
      let greetings=0; function connect(){const ws=new WebSocket('ws://'+location.host+'/socket');
      ws.onmessage=()=>document.body.dataset.greetings=String(++greetings);
      ws.onclose=()=>setTimeout(connect,50)} connect();
    </script></body>`);
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.write(Buffer.from([0x81, 5, ...Buffer.from('hello')]));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const host = `127.0.0.1:${server.address().port}`;
    const probe = await installWebSocketFaultProbe(page, `ws://${host}/socket`);
    await page.goto(`http://${host}`);
    await page.locator('body[data-greetings="1"]').waitFor();
    await probe.cut();
    await assertEventually(() => probe.audit.refusedConnections > 0);
    assert.equal(probe.audit.cutConnections, 1);
    const before = await page.locator('body').getAttribute('data-greetings');
    probe.restore();
    await page.waitForFunction((count) => Number(document.body.dataset.greetings) > Number(count), before);
    assert.ok(probe.audit.forwardedConnections >= 2);
    assert.equal(probe.audit.closeFailures, 0);
  } finally {
    await browser?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise((done) => server.close(done));
  }
});

async function assertEventually(predicate) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  assert.fail('fixture did not retry the closed socket');
}
