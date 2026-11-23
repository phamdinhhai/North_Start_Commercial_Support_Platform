import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

// Retained as historical research evidence. The broad POST guard caused retries.
throw new Error('retired_research_runner: use facebook-research-scenario.mjs with the existing local session');

// Research only: session values stay in this process, its browser and REA child.
// No request/response bodies, DOM, screenshots or credential files are exported.
const product = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cookiePath = resolve(process.argv[2] ?? resolve(product, '../docs/login_info/pancake.json'));
const output = resolve(process.argv[3] ?? resolve(product, '.tmp/ail-research-2026-11-14/live-summary.json'));
const reaHome = resolve(process.env.LOCALAPPDATA, 'REA');
const reaNode = process.env.AIL_REA_NODE ?? resolve(reaHome, 'node-v24.22.2-win-x64/node.exe');
const reaCli = process.env.AIL_REA_CLI ?? resolve(reaHome, 'cli/node_modules/rea-agents/scripts/rea.mjs');
const origin = 'https://pancake.vn';
const server = createServer();
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
await new Promise((done) => server.close(done));
let browser;
let stage = 'read_credentials';
const summary = {
  schemaVersion: 1, observedAt: new Date().toISOString(), evidenceType: 'attempted-live-capture',
  method: 'REA controlled browser scenario; GET/HEAD/OPTIONS only',
  authenticated: 'UNKNOWN', blockedRequests: 0, httpStatuses: {},
  eventKinds: {}, websocketOrigins: [], businessEvents: 'UNKNOWN',
  limitations: [
    'Non-read HTTP methods are blocked, which may prevent application initialization.',
    'No business actions or conversation navigation; a quiet capture cannot establish event absence.',
    'Browser transport observations do not prove replay, delivery guarantees or standalone connector rights.',
    'Sanitized aggregate derivative only; full REA evidence is not persisted.',
  ],
};
try {
  const supplied = JSON.parse(await readFile(cookiePath, 'utf8'));
  if (!Array.isArray(supplied) || !supplied.length) throw new Error('invalid_cookie_file');
  const cookies = supplied.map((cookie) => {
    if (!['pancake.vn', '.pancake.vn'].includes(cookie.domain) ||
        typeof cookie.name !== 'string' || typeof cookie.value !== 'string') {
      throw new Error('unsupported_cookie_scope');
    }
    return {
      name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path ?? '/',
      httpOnly: Boolean(cookie.httpOnly), secure: Boolean(cookie.secure),
      sameSite: cookie.sameSite === 'strict' ? 'Strict' : cookie.sameSite === 'no_restriction' ? 'None' : 'Lax',
      ...(typeof cookie.expirationDate === 'number' ? { expires: cookie.expirationDate } : {}),
    };
  });
  stage = 'launch_browser';
  browser = await chromium.launch({ headless: true, args: [`--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'] });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  stage = 'install_scoped_cookies';
  await context.addCookies(cookies);
  let requestCount = 0;
  await context.route('**/*', async (route) => {
    requestCount += 1;
    if (requestCount > 500 || summary.blockedRequests >= 100) {
      summary.abortReason = 'request_or_blocked_retry_budget';
      await route.abort('blockedbyclient').catch(() => {});
      await context.close().catch(() => {});
      return;
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      summary.blockedRequests += 1;
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  stage = 'create_bootstrap_target';
  const page = await context.newPage();
  // REA selects an HTTP target, so initialize a synthetic page without visiting the provider.
  await page.route(`${origin}/__north_star_research_bootstrap`, (route) => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
  await page.goto(`${origin}/__north_star_research_bootstrap`);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((item) => item.type === 'page' && item.url === page.url());
  if (!target) throw new Error('research_target_missing');
  const childEnv = { ...process.env };
  const secrets = cookies.map((cookie, index) => {
    const key = `AIL_RESEARCH_COOKIE_${index}`;
    childEnv[key] = cookie.value;
    return { secret_id: `cookie_${index}`, environment_variable: key };
  });
  const scenario = {
    browser: { mode: 'connect', cdp_endpoint: `http://127.0.0.1:${port}`, target_id: target.id },
    start_url: { url: origin, query: [] }, secrets,
    actions: [{ step_id: 'observe_idle', action: 'wait_for_timeout', duration_ms: 15000 }],
    capture: { at_end: ['url'], events: ['network', 'websockets'], network: { request_body: false, response_body: false, header_values: false } },
    command_timeout_ms: 60000,
  };
  stage = 'rea_capture';
  const { stdout } = await promisify(execFile)(reaNode, [reaCli, 'capture-browser-scenario', JSON.stringify(scenario), '--format', 'json'], {
    env: childEnv, timeout: 90000, maxBuffer: 8 * 1024 * 1024, windowsHide: true,
  });
  stage = 'parse_evidence';
  const evidence = JSON.parse(stdout);
  // Accept only the known Evidence result shape; never dump unknown CLI output.
  const capture = evidence.normalized_result ?? evidence.raw_result ?? evidence.result ?? evidence;
  summary.evidenceId = typeof evidence.id === 'string' ? evidence.id : evidence.evidence_id ?? null;
  if (!capture.events?.items) {
    summary.result = 'unrecognized_evidence_shape';
    summary.resultKeys = Object.keys(evidence);
    summary.captureKeys = Object.keys(capture);
  } else {
    summary.result = 'captured';
    summary.evidenceType = 'live-observed';
    summary.durationMs = capture.duration_ms;
    summary.eventsDropped = capture.events.dropped;
    summary.stepStatuses = capture.steps.map((step) => step.status ?? step.outcome);
    for (const event of capture.events.items) {
      summary.eventKinds[event.kind] = (summary.eventKinds[event.kind] ?? 0) + 1;
      if (Number.isInteger(event.status)) summary.httpStatuses[event.status] = (summary.httpStatuses[event.status] ?? 0) + 1;
      const observedOrigin = typeof event.url === 'string' ? new URL(event.url).origin : event.url?.origin;
      if (event.kind.startsWith('websocket') && typeof observedOrigin === 'string') {
        const socketOrigin = observedOrigin;
        if (!summary.websocketOrigins.includes(socketOrigin)) summary.websocketOrigins.push(socketOrigin);
      }
    }
    summary.reaCleanup = capture.browser.cleanup;
  }
  summary.finalLocation = new URL(page.url()).origin;
  summary.loginRouteVisible = /login|sign_in|signin/.test(new URL(page.url()).pathname);
} catch (error) {
  summary.result = 'capture_failed';
  summary.failedStage = stage;
  // Exception text can contain browser URLs or process environment: never export it.
  summary.errorClass = error instanceof Error ? error.name : 'UnknownError';
  summary.errorCode = typeof error?.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : null;
  summary.exitCode = typeof error?.code === 'number' ? error.code : null;
  const diagnostics = String(error?.stdout ?? '') + String(error?.stderr ?? '');
  summary.reasonCodes = [...new Set(diagnostics.match(/(?:ERR|EAI)_[A-Z_]+/g) ?? [])];
  try {
    const failure = JSON.parse(error?.stdout ?? '{}');
    summary.failureKeys = Object.keys(failure);
    summary.failureCode = typeof failure.error?.code === 'string' && /^[a-z_]+$/.test(failure.error.code) ? failure.error.code : null;
  } catch { /* Raw stderr may include URLs; only reason codes are retained. */ }
} finally {
  await browser?.close();
  summary.ownedBrowserClosed = true;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.result !== 'captured') process.exitCode = 1;
}
