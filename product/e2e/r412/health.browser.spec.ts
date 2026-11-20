import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';

async function login(page: Page, account: string) {
  await page.goto('operator');
  await page.locator('#signin').click();
  await expect(page).toHaveURL(/3441\/authorize/);
  await page.getByLabel('Account').selectOption(account);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#session-status')).toHaveText('Signed in.');
}
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(async ({ path, body }) => {
    const session = await (await fetch('/v1/auth/session')).json();
    const init = body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(body) };
    const response = await fetch('/v1/source-integrations/' + path, init);
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  }, { path, body });
}

test('signed OIDC health is bounded, tenant-scoped and admin-controlled', async ({ page, browser, request }) => {
  const db = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  const contexts = [];
  try {
    const seeded = await request.post('http://127.0.0.1:3442/seed-health', { headers: { 'x-qa-control': process.env.QA_CONTROL_SECRET! } });
    expect(seeded.ok()).toBe(true);
    const streams = (await seeded.json()).streams as { streamId: string; connectionId: string; workspaceId: string }[];
    const own = streams.filter(s => s.workspaceId === 'qa-browser-a');
    const foreign = streams.find(s => s.workspaceId === 'qa-browser-b')!;
    await login(page, 'admin');
    const panel = page.locator('#synchronization-health');
    await expect(panel).toBeVisible();
    const health = await api(page, 'sync-health');
    expect(health.status).toBe(200);
    expect(health.cache).toBe('no-store');
    expect(health.body).toMatchObject({ classification: 'OPERATIONAL_SYNC_TELEMETRY_NOT_COMMERCIAL_EVIDENCE', completeness: 'UNKNOWN' });
    expect(health.body.items).toHaveLength(2);
    for (const item of health.body.items) expect(item).toMatchObject({ state: 'SYNTHETIC_ONLY', cursorVersion: 1, localReceiptCount: 1, lag: 'UNKNOWN', completeness: 'UNKNOWN' });
    expect(JSON.stringify(health.body)).not.toMatch(/secret-cursor|leaseToken|rawPayload|utterance|"secret"|"cursor"/);
    const card = panel.locator('article').filter({ hasText: own[0].streamId });
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: 'pause synthetic synchronization' }).click();
    await expect(card).toContainText('DISABLED');
    await card.getByRole('button', { name: 'resume synthetic synchronization' }).click();
    await expect(card).toContainText('SYNTHETIC_ONLY');
    expect(await page.evaluate(async id => (await fetch('/v1/source-integrations/sync-health/' + id + '/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'pause' }) })).status, own[0].streamId)).toBe(403);

    const managerContext = await browser.newContext(); contexts.push(managerContext); const manager = await managerContext.newPage();
    await login(manager, 'bystander');
    expect((await api(manager, 'sync-health')).status).toBe(200);
    expect((await api(manager, 'sync-health/' + own[0].streamId + '/control', { action: 'pause' })).status).toBe(403);
    await expect(manager.locator('#synchronization-health').getByRole('button', { name: 'pause synthetic synchronization' })).toHaveCount(0);
    const salesContext = await browser.newContext(); contexts.push(salesContext); const sales = await salesContext.newPage();
    await login(sales, 'owner');
    await expect(sales.locator('#synchronization-health')).toBeHidden();
    expect((await api(sales, 'sync-health')).status).toBe(403);
    const foreignContext = await browser.newContext(); contexts.push(foreignContext); const foreignPage = await foreignContext.newPage();
    await login(foreignPage, 'foreign');
    expect((await api(foreignPage, 'sync-health')).body.items.map((s: { streamId: string }) => s.streamId)).toEqual([foreign.streamId]);

    expect((await api(page, 'connections/' + own[0].connectionId + '/revoke', {})).status).toBe(201);
    await panel.getByRole('button', { name: 'Refresh synchronization health' }).click();
    await expect(card).toContainText('REVOKED');
    page.once('dialog', dialog => dialog.accept());
    await panel.locator('article').filter({ hasText: own[1].streamId }).getByRole('button', { name: 'revoke synthetic synchronization' }).click();
    await expect(panel.locator('article').filter({ hasText: own[1].streamId })).toContainText('REVOKED');
    const counts = (await db.query('SELECT (SELECT count(*) FROM sync_page_commit)::int pages,(SELECT count(*) FROM source_receipt)::int receipts,(SELECT count(*) FROM outcome)::int outcomes,(SELECT count(*) FROM lead WHERE owner_user_id IS NOT NULL)::int owned')).rows[0];
    expect(counts).toEqual({ pages: 3, receipts: 3, outcomes: 0, owned: 0 });
    expect((await request.get('source-integrations/sync-health')).status()).toBe(401);
    expect((await request.post('http://127.0.0.1:3442/restart', { headers: { 'x-qa-control': process.env.QA_CONTROL_SECRET! } })).ok()).toBe(true);
    await login(page, 'admin');
    expect((await api(page, 'sync-health')).body.items.every((item: { state: string }) => item.state === 'REVOKED')).toBe(true);
  } finally { for (const context of contexts) await context.close(); await db.end(); }
});
