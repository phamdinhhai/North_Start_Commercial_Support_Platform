import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';

async function login(page: Page, account: string) {
  await page.goto('operator'); await page.locator('#signin').click();
  await expect(page).toHaveURL(/3421\/authorize/);
  await page.getByLabel('Account').selectOption(account);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#session-status')).toHaveText('Signed in.');
}
async function submit(page: Page) {
  await page.locator('#submit-command').click();
  await expect(page.locator('#command-dialog')).not.toBeVisible();
}
async function connection(page: Page, provider: string, account: string) {
  await page.getByRole('button', { name: 'Create synthetic connection', exact: true }).click();
  await page.locator('#source-provider').selectOption(provider); await page.locator('#source-page').fill(account);
  const response = page.waitForResponse(r => r.url().endsWith('/source-integrations/connections') && r.request().method() === 'POST');
  await submit(page); const result = await (await response).json();
  await expect(page.locator(`[data-connection-id="${result.id}"]`)).toBeVisible(); return result.id as string;
}
async function importFixture(page: Page, id: string, change?: (fixture: any) => void, claim = false) {
  await page.locator(`[data-connection-id="${id}"]`).getByRole('button', { name: /Import fabricated/ }).click();
  await expect(page.locator('#source-fixture')).toBeVisible();
  const fixture = JSON.parse(await page.locator('#source-fixture').inputValue()); change?.(fixture);
  await page.locator('#source-fixture').fill(JSON.stringify(fixture));
  if (claim) await page.locator('#source-claim').check();
  const response = page.waitForResponse(r => r.url().endsWith(`/connections/${id}/observations`) && r.request().method() === 'POST');
  await submit(page); const result = await response; expect(result.status()).toBe(201);
  return { receipt: await result.json(), fixture };
}
async function api(page: Page, path: string, body?: unknown) {
  return page.evaluate(async ({ path, body }) => {
    const session = await (await fetch('/v1/auth/session')).json();
    const response = await fetch('/v1/source-integrations/' + path, body === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-CSRF-Token': session.csrfToken }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }, { path, body });
}

test('signed synthetic sources preserve provenance, permissions and restart-safe replay through UI intake', async ({ page, browser, request }) => {
  const db = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
  const counts = async () => (await db.query(`SELECT (SELECT count(*)::int FROM lead) leads,
    (SELECT count(*)::int FROM source_receipt) receipts, (SELECT count(*)::int FROM commercial_envelope) envelopes,
    (SELECT count(*)::int FROM outcome) outcomes`)).rows[0];
  try {
    await login(page, 'admin');
    await expect(page.locator('#synthetic-sources')).toContainText('No provider connection or live synchronization');
    const pan = await connection(page, 'pancake', 'synthetic-page-1');
    const meta = await connection(page, 'meta-page', 'synthetic-page');
    const standalonePan = await importFixture(page, pan, f => { delete f.originalMeta; f.receiptId = 'qa-pan-alone'; }, false);
    const standaloneMeta = await importFixture(page, meta, f => {
      f.receiptId = 'qa-meta-alone'; f.payload.entry[0].messaging[0].message.mid = 'qa-meta-alone-message';
    }, false);
    expect(standalonePan.receipt.leadId).not.toBe(standaloneMeta.receipt.leadId);
    const linkedPan = await importFixture(page, pan, f => { f.displayName = 'Fabricated dual source'; }, true);
    const linkedMeta = await importFixture(page, meta);
    expect(linkedMeta.receipt.leadId).toBe(linkedPan.receipt.leadId);
    expect(linkedMeta.receipt.disposition).toBe('object_aligned');
    expect(await counts()).toEqual({ leads: 3, receipts: 4, envelopes: 4, outcomes: 0 });
    expect((await db.query('SELECT owner_user_id FROM lead WHERE id=$1', [standalonePan.receipt.leadId])).rows[0].owner_user_id).toBeNull();
    const replay = await importFixture(page, pan, f => { f.displayName = 'Fabricated dual source'; }, true);
    expect(replay.receipt).toMatchObject({ leadId: linkedPan.receipt.leadId, disposition: 'receipt_duplicate' });
    expect(await counts()).toEqual({ leads: 3, receipts: 4, envelopes: 4, outcomes: 0 });
    await page.locator('#refresh').click();
    await page.locator('.queue-item').filter({ hasText: 'Fabricated dual source' }).click();
    await expect(page.locator('#context')).toContainText(linkedPan.receipt.leadId);
    await page.locator('#source-evidence').click();
    for (const label of ['Provider: pancake', 'Provider: meta-page', 'Transport account:', 'Native source: meta', 'Native message: synthetic-message', 'Observed:', 'Occurred:', 'Received:', 'UNKNOWN', 'UNVERIFIED'])
      await expect(page.locator('#read-view')).toContainText(label);
    await expect(page.locator('#read-view pre')).toHaveCount(2);
    await expect(page.locator('#commercial-truth')).toContainText('UNKNOWN');
    // Identities only are provisioned server-side. Resolve recipient from a signed session.
    const recipientContext = await browser.newContext(); contexts.push(recipientContext); const recipient = await recipientContext.newPage();
    await login(recipient, 'recipient');
    const recipientId = await recipient.evaluate(async () => (await (await fetch('/v1/auth/session')).json()).context.userId);
    await page.locator('#handoff').click(); await page.locator('#recipient').selectOption(recipientId);
    await page.locator('#handoff-context').fill('Synthetic source evidence handoff'); await page.locator('#action').fill('Review fabricated evidence');
    await page.locator('#reason').fill('Explicit human handoff'); await submit(page);
    await recipient.locator('#refresh').click(); await recipient.locator('.queue-item').filter({ hasText: 'Fabricated dual source' }).click();
    await recipient.locator('#source-evidence').click(); await expect(recipient.locator('#read-view pre')).toHaveCount(2);
    // Anonymous, missing-CSRF and viewer mutations cannot add durable effects.
    expect(await page.evaluate(async () => (await fetch('/v1/source-integrations/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status)).toBe(403);
    expect((await request.get('source-integrations/connections')).status()).toBe(401);
    const viewerContext = await browser.newContext(); contexts.push(viewerContext); const viewer = await viewerContext.newPage(); await login(viewer, 'viewer');
    expect(await api(viewer, `connections/${pan}/observations`, { fixture: linkedPan.fixture, claimResponsibility: true })).toMatchObject({ status: 403 });
    expect(await api(viewer, `leads/${linkedPan.receipt.leadId}/evidence`)).toMatchObject({ status: 403 });
    // Foreign admin authority is confined to its own workspace.
    const foreignContext = await browser.newContext(); contexts.push(foreignContext); const foreign = await foreignContext.newPage(); await login(foreign, 'foreign');
    expect(await api(foreign, `leads/${linkedPan.receipt.leadId}/evidence`)).toMatchObject({ status: 404 });
    expect(await api(foreign, `connections/${pan}/observations`, { fixture: linkedPan.fixture, claimResponsibility: false })).toMatchObject({ status: 404 });
    expect(await counts()).toEqual({ leads: 3, receipts: 4, envelopes: 4, outcomes: 0 });
    expect((await request.post('http://127.0.0.1:3422/restart', { headers: { 'x-qa-control': process.env.QA_CONTROL_SECRET! } })).ok()).toBe(true);
    await page.reload(); await expect(page.locator('#signin')).toBeVisible(); await login(page, 'admin');
    const restartedReplay = await importFixture(page, pan, f => { f.displayName = 'Fabricated dual source'; }, true);
    expect(restartedReplay.receipt).toMatchObject({ leadId: linkedPan.receipt.leadId, disposition: 'receipt_duplicate' });
    expect(await counts()).toEqual({ leads: 3, receipts: 4, envelopes: 4, outcomes: 0 });
    page.once('dialog', d => d.accept());
    await page.locator(`[data-connection-id="${pan}"]`).getByRole('button', { name: 'Revoke synthetic connection' }).click();
    await expect(page.locator(`[data-connection-id="${pan}"]`)).toContainText('revoked');
    expect(await api(page, `connections/${pan}/observations`, { fixture: linkedPan.fixture, claimResponsibility: true })).toMatchObject({ status: 403, body: { code: 'CONNECTION_REVOKED' } });
    expect(await counts()).toEqual({ leads: 3, receipts: 4, envelopes: 4, outcomes: 0 });
    await login(recipient, 'recipient');
    expect((await request.post('http://127.0.0.1:3422/revoke-recipient', { headers: { 'x-qa-control': process.env.QA_CONTROL_SECRET! } })).ok()).toBe(true);
    expect(await api(recipient, 'leads/' + linkedPan.receipt.leadId + '/evidence')).toMatchObject({ status: 403 });
  } finally { await db.end(); for (const context of contexts) await context.close(); }
});
