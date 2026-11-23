import { expect, test } from '@playwright/test';

test('memory lifecycle composition refuses durable planning with typed 503', async ({ request }) => {
  // Legacy test-only bootstrap, never a production identity; no commercial fixtures.
  const credential = process.env.BOOTSTRAP_TOKEN;
  if (!credential) throw new Error('Use playwright.lifecycle.config.ts for the memory fixture');
  for (const [path, data] of [
    ['policies', { dataClass: 'audit', retentionSeconds: 60, expectedRevision: 0, approvalRef: 'SYNTHETIC-ONLY' }],
    ['previews/audit', {}],
  ] as const) {
    const response = await request.post('pilot/lifecycle/' + path, { headers: { 'x-bootstrap-token': credential }, data });
    expect(response.status()).toBe(503);
    expect(await response.json()).toEqual({ code: 'DURABLE_STORAGE_REQUIRED' });
  }
});
