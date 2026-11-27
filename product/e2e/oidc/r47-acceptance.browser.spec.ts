import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, account: string) {
  await page.goto('operator'); await page.locator('#signin').click();
  await page.getByLabel('Account').selectOption(account);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#session-status')).toHaveText('Signed in.');
}
async function save(page: Page) {
  await page.locator('#submit-command').click();
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#context-status')).toContainText('Action recorded');
}
async function create(page: Page, name: string) {
  await page.locator('#new-lead').click();
  await page.locator('#display-name').fill(name);
  await page.locator('#utterance').fill('Invented conversation: call tomorrow');
  await page.locator('#connection').fill('manual');
  await page.locator('#external-record').fill(crypto.randomUUID());
  await page.locator('#synthetic').check(); await save(page);
  await page.locator('#classification').selectOption('synthetic');
  await page.locator('.queue-item').filter({ hasText: name }).click();
}
async function edit(page: Page, text: string) {
  await page.locator('#edit-context').click();
  await page.locator('#context-text').fill(text);
  await page.locator('#reason').fill('Invented QA correction');
}

test('actual OIDC expired session recovers in another tab, explicit retry and concurrent 409 preserve draft', async ({ page, context, request }) => {
  let contextWrites = 0;
  page.on('request', r => { if (r.method() === 'POST' && /\/leads\/[^/]+\/context$/.test(new URL(r.url()).pathname)) contextWrites++; });
  await login(page, 'owner');
  const name = 'R47 synthetic recovery ' + crypto.randomUUID(); await create(page, name);
  await edit(page, 'Draft retained only in original tab');
  const expiry = await request.post('http://127.0.0.1:3412/expire-sessions', { headers: { 'x-qa-control': process.env.QA_CONTROL_SECRET! } });
  expect(expiry.ok()).toBe(true);
  await page.locator('#submit-command').click();
  await expect(page.locator('#session-status')).toContainText('Session expired');
  await expect(page.locator('#context')).toBeEmpty();
  await expect(page.locator('#command-fields')).toBeEmpty();
  expect(contextWrites).toBe(1);
  const popupPromise = context.waitForEvent('page'); await page.locator('#signin').click();
  const auth = await popupPromise;
  await auth.getByLabel('Account').selectOption('owner'); await auth.getByRole('button', { name: 'Continue' }).click();
  await expect(auth.locator('#session-status')).toHaveText('Signed in.');
  await page.locator('#recheck-session').click();
  await expect(page.locator('#context-text')).toHaveValue('Draft retained only in original tab');
  await expect(page.locator('#dialog-status')).toContainText('lead access checked');
  expect(contextWrites).toBe(1); // Recovery is read-only until explicit submit.
  await save(page); expect(contextWrites).toBe(2);
  await edit(page, 'Concurrent stale draft');
  await auth.locator('#classification').selectOption('synthetic');
  await auth.locator('.queue-item').filter({ hasText: name }).click();
  await edit(auth, 'Newer competing context'); await save(auth);
  await page.locator('#submit-command').click();
  await expect(page.locator('#dialog-status')).toContainText('Conflict');
  await expect(page.locator('#submit-command')).toBeDisabled();
  await expect(page.locator('#context-text')).toHaveValue('Concurrent stale draft');
  await page.getByRole('button', { name: 'Reload current lead', exact: true }).click();
  await expect(page.locator('#context')).toContainText('Newer competing context');
  await expect(page.locator('#context-text')).toHaveValue('Concurrent stale draft');
  expect(contextWrites).toBe(3);
  await save(page); expect(contextWrites).toBe(4);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await auth.close();
});

test('actual OIDC CSRF rotation causes 403 and clears unsaved draft without retry', async ({ page, context }) => {
  await login(page, 'owner'); await create(page, 'R47 synthetic permission ' + crypto.randomUUID());
  await edit(page, 'Draft must clear on permission denial');
  const auth = await context.newPage();
  await auth.goto('/v1/auth/login'); await auth.getByLabel('Account').selectOption('owner');
  await auth.getByRole('button', { name: 'Continue' }).click();
  await expect(auth.locator('#session-status')).toHaveText('Signed in.'); // Original tab retains old CSRF.
  const denied = page.waitForResponse(r => /\/context$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  await page.locator('#submit-command').click(); expect((await denied).status()).toBe(403);
  await expect(page.locator('#context')).toBeEmpty();
  await expect(page.locator('#command-fields')).toBeEmpty();
  await expect(page.locator('#recheck-session')).toBeHidden();
  await expect(page.locator('#context-status')).toContainText('Access denied');
  await auth.close();
});


test('manager scans UI-created pending and overdue synthetic work without granting sales workspace access', async ({ page, browser }) => {
  await login(page, 'owner');
  const name = 'R47 manager observation ' + crypto.randomUUID(); await create(page, name);
  await page.locator('#handoff').click();
  await page.locator('#recipient').selectOption({ index: 0 });
  await page.locator('#handoff-context').fill('Invented callback context');
  await page.locator('#action').fill('Invented past-due callback');
  await page.locator('#reason').fill('Synthetic manager QA');
  await page.locator('#due').fill('2020-01-01T10:00'); await save(page);
  await expect(page.locator('#manager-exceptions')).toBeHidden();
  expect(await page.evaluate(async () => (await fetch('/v1/pilot/manager-exceptions?classification=synthetic')).status)).toBe(403);
  const managerContext = await browser.newContext(); const manager = await managerContext.newPage();
  await login(manager, 'bystander');
  const panel = manager.locator('#manager-exceptions');
  await expect(panel).toBeVisible();
  await panel.getByLabel('Manager exceptions data classification').selectOption('synthetic');
  const card = panel.locator('article').filter({ hasText: name });
  await expect(card).toContainText('Handoff awaiting acceptance');
  await expect(card).toContainText('no SLA judgment');
  await expect(card).toContainText('Current open work past its recorded due date');
  await expect(panel).toContainText('Scanned');
  await expect(panel).toContainText('Claims remain claims; UNKNOWN remains visible');
  await card.getByRole('button').click();
  await expect(manager.locator('#context')).toContainText(name);
  await expect(manager.locator('#commercial-truth')).toContainText('Revenue Attribution: UNKNOWN');
  await managerContext.close();
});
