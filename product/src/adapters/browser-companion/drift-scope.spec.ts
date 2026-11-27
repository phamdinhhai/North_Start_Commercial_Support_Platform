import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ackFor, directory, grant, harness, key, load, scope } from './companion-test-harness';

const phoenix = (event: string, payload: unknown, topic = 'pages:page-test') => JSON.stringify([null, 'ref-1', topic, event, payload]);

describe('schema-drift monitoring keeps shape hashes only', () => {
  it('counts unknown shapes with a stable value-free fingerprint and ignores control/foreign frames', async () => {
    const h = await harness(); await h.message('start', { scope }); h.socket();
    h.raw(phoenix('pages:new_feature', { conversation_id: 'conv-111', secret_text: 'private-drift-value' }));
    h.raw(phoenix('pages:new_feature', { conversation_id: 'conv-222', secret_text: 'other-private-value' }));
    h.raw(phoenix('phx_reply', { status: 'ok' }));
    h.raw(phoenix('pages:new_feature', { x: 1 }, 'pages:other-page'));
    h.raw('not json private-unparseable');
    h.raw(phoenix('pages:update_conversation', { conversation: { id: 'conv-1', page_id: 'other-page' } })); // rejected known event
    const status = (await h.message('status')).result;
    expect(status.drift.count).toBe(4);
    expect(status.drift.samples.map((sample: any) => [sample.kind, sample.count])).toEqual([['unknown-event', 2], ['unparseable', 1], ['rejected-shape', 1]]);
    for (const sample of status.drift.samples) expect(sample.fingerprint).toMatch(/^[0-9a-f]{24}$/);
    expect(h.storage[key].outbox).toHaveLength(0);
    expect(JSON.stringify(h.storage)).not.toMatch(/private-drift-value|other-private-value|private-unparseable|conv-111|conv-222|new_feature|secret_text/);
    expect((await h.message('export')).result.driftNotice.count).toBe(4);
  });

  it('collapses identifier-like keys so per-object maps do not explode fingerprints', async () => {
    const drift = await load('drift.mjs');
    const a = drift.classifyRejectedFrame(phoenix('pages:x', { conversations: { '123_456': [1] } }), 'page-test');
    const b = drift.classifyRejectedFrame(phoenix('pages:x', { conversations: { '789_012': [2], '345_678': [3] } }), 'page-test');
    expect(await drift.shapeFingerprint(a)).toBe(await drift.shapeFingerprint(b));
    const c = drift.classifyRejectedFrame(phoenix('pages:x', { conversations: 'text' }), 'page-test');
    expect(await drift.shapeFingerprint(c)).not.toBe(await drift.shapeFingerprint(a));
  });

  it('treats pages:seen_conversation as drift until browser/backend decoders and server contract agree on it', async () => {
    // Deliberate: payload shape is ASSUMED upstream; no seen/read value is captured or uploaded by this companion.
    const h = await harness(); await h.message('start', { scope }); h.socket();
    h.raw(phoenix('pages:seen_conversation', { conversation_id: 'conv-seen', seen: true }));
    const status = (await h.message('status')).result;
    expect(h.storage[key].outbox).toHaveLength(0);
    expect(status.drift.samples).toEqual([expect.objectContaining({ kind: 'unknown-event', count: 1 })]);
    expect(JSON.stringify(h.storage)).not.toMatch(/conv-seen|seen_conversation/);
  });

  it('bounds distinct samples and counts overflow', async () => {
    const drift = await load('drift.mjs');
    let state: any = { outbox: [] };
    for (let i = 0; i < drift.MAX_DRIFT_SAMPLES + 5; i += 1) state = drift.recordDrift(state, 'f' + i, 'unknown-event', 'at');
    expect(state.drift).toMatchObject({ count: 25, overflow: 5 });
    expect(state.drift.samples).toHaveLength(drift.MAX_DRIFT_SAMPLES);
  });

  it('never adds drift data to the strict server upload body', async () => {
    let body: any;
    const h = await harness({}, async (_url: string, options: any) => { body = JSON.parse(options.body); return new Response(JSON.stringify(ackFor(body)), { status: 200 }); });
    await h.message('configure-upload', { origin: 'https://backend.example', enrollment: grant });
    await h.message('start', { scope }); h.socket();
    h.raw(phoenix('pages:new_feature', {})); h.frame();
    await h.message('upload');
    expect(Object.keys(body).sort()).toEqual(['captureId', 'observation', 'pageId', 'sequence']);
  });
});

describe('tab and origin restrictions', () => {
  it('declares only optional, HTTPS-only host access and no broad or tab-reading permissions', async () => {
    const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.permissions.sort()).toEqual(['activeTab', 'debugger', 'storage']);
    for (const pattern of manifest.optional_host_permissions) expect(pattern).toMatch(/^https:\/\//);
    expect(JSON.stringify(manifest)).not.toMatch(/<all_urls>|\*:\/\/\*\/\*|"key"/);
    const popup = await readFile(resolve(directory, 'popup.mjs'), 'utf8');
    expect(popup).toContain("chrome.permissions.request({ origins: [origin + '/*'] })"); // exact origin at runtime
  });

  it('detaches when the attached tab closes and ignores other tabs', async () => {
    const h = await harness(); await h.message('start', { scope });
    h.handlers.tabRemoved(2); await h.message('status');
    expect(h.storage[key].session).not.toBeNull();
    h.handlers.tabRemoved(1); await h.message('status');
    expect(h.storage[key]).toMatchObject({ session: null, lastStop: 'tab-closed' });
    expect(h.calls).toContain('detach');
  });

  it('detaches on navigation away from the allowed origins, keeps in-origin navigation', async () => {
    const h = await harness(); await h.message('start', { scope });
    h.setTabUrl('https://pancake.vn/other-view'); h.handlers.tabUpdated(1, { status: 'loading' }); await h.message('status');
    expect(h.storage[key].session).not.toBeNull();
    h.setTabUrl('https://example.org/'); h.handlers.tabUpdated(1, { status: 'loading' }); await h.message('status');
    expect(h.storage[key]).toMatchObject({ session: null, lastStop: 'navigated-away' });
  });
});

describe('popup accessibility and view model', () => {
  it('labels every control, announces status politely and alerts on blocking states', async () => {
    const html = await readFile(resolve(directory, 'popup.html'), 'utf8');
    expect(html).toMatch(/<html lang="en">/);
    const labelled = new Set([...html.matchAll(/<label for="([^"]+)"/g)].map((match) => match[1]));
    for (const control of html.matchAll(/<(input|textarea)\b[^>]*>/g)) {
      const id = /id="([^"]+)"/.exec(control[0])?.[1];
      const wrapped = /<label>\s*$/.test(html.slice(0, control.index));
      expect(wrapped || (id && labelled.has(id)), control[0]).toBeTruthy();
    }
    expect(html).toMatch(/id="summary" role="status" aria-live="polite"/);
    expect(html.match(/role="alert"/g)).toHaveLength(2);
    expect(html).not.toMatch(/tabindex="[1-9]/);
    for (const button of html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)) expect(button[1].trim().length).toBeGreaterThan(2);
  });

  it('renders blocked reason, OUTBOX_FULL, reset availability and drift without record values', async () => {
    const { popupView, errorMessage } = await load('popup-view.mjs');
    const base = { capture: 'OUTBOX_FULL', pending: 1000, limits: { records: 1000 }, upload: 'blocked', blockedReason: 'SEQUENCE_GAP', continuity: 'UNKNOWN', dropped: 0,
      drift: { count: 3, overflow: 0, samples: [{ kind: 'unknown-event', fingerprint: 'ab'.repeat(12), count: 3 }] } };
    const view = popupView(base);
    expect(view).toMatchObject({ blocked: 'SEQUENCE_GAP', full: true, reset: true });
    expect(view.blockedText).toContain('sequence gap');
    expect(view.drift).toContain('ab'.repeat(12));
    expect(popupView({ ...base, blockedReason: '<script>' }).blocked).toBe('CONFLICT_UNKNOWN');
    expect(popupView({ ...base, upload: 'ready', capture: 'ACTIVE' })).toMatchObject({ blocked: null, full: false, reset: false });
    expect(popupView({ ...base, upload: 'disabled' }).reset).toBe(true);
    expect(errorMessage('unknown-internal')).toMatch(/Capture unavailable/);
    expect(popupView({ ...base, upload: 'disabled', freshEnrollmentRequired: true, gaps: [{ from: 't0', until: null, reason: 'tab-closed' }] }).summary)
      .toMatch(/Fresh enrollment required.*Not observing since t0 \(tab-closed\)/);
    expect(errorMessage('fresh_enrollment_required')).toMatch(/fresh enrollment/);
  });
});
