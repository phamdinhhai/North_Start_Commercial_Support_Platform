import { expect, test, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { connect } from 'node:net';

async function login(page: Page, account: string) {
  page.on('pageerror', error => console.log('BROWSER ERROR', error.message));
  await page.goto('operator');
  await page.locator('#signin').click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3411\/authorize/);
  await expect(page.getByRole('heading', { name: 'Loopback fixture identity' })).toBeVisible();
  await page.getByLabel('Account').selectOption(account);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/3410\/v1\/operator$/);
  await expect(page.locator('#session-status')).toHaveText('Signed in.');
  await expect(page.locator('#development')).toBeHidden();
}
async function record(page: Page) {
  await page.locator('#submit-command').click();
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#context-status')).toContainText('Action recorded');
}
async function reason(page: Page, text = 'Fabricated acceptance action') { await page.locator('#reason').fill(text); }
async function create(page: Page, name: string, synthetic = true) {
  await page.locator('#new-lead').click();
  await page.locator('#display-name').fill(name);
  await page.locator('#utterance').fill('Fabricated original: please call tomorrow <script>window.qaXss=1</script>');
  await page.locator('#connection').fill('manual');
  await page.locator('#external-record').fill(crypto.randomUUID());
  if (synthetic) await page.locator('#synthetic').check();
  await record(page);
  await expect(page.locator('#context')).toContainText(name);
  const id = (await page.locator('#context').innerText()).match(/Stable Lead ID: ([\w-]+)/)![1];
  return id;
}

test('real OIDC redirect and UI-only complete commercial journey survives app restart', async ({ browser, page, request }) => {
  await login(page, 'owner');
  const cookies = await page.context().cookies();
  expect(cookies.find(c => c.name === 'north_session')).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);
  await create(page, 'Synthetic excluded learning probe');
  await expect(page.locator('#context')).toContainText('SYNTHETIC');
  await expect(page.locator('#queue .queue-item')).toHaveCount(0); // default real filter
  const excluded = page.waitForResponse(r => r.url().endsWith('/pilot/learning') && r.request().postDataJSON()?.eventType === 'evidence_viewed');
  await page.locator('#evidence').click(); await expect(page.locator('#read-view')).toContainText('Fabricated original');
  expect(await (await excluded).json()).toMatchObject({ recorded: false, reason: 'SYNTHETIC_OR_UNKNOWN_EXCLUDED' });
  const telemetryDb = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  try {
    expect((await telemetryDb.query('SELECT count(*)::int AS n FROM product_event')).rows[0].n).toBe(0);
  } finally { await telemetryDb.end(); }
  const leadId = await create(page, 'Fabricated full browser journey', false);
  await expect(page.locator('#context')).toContainText('REAL');
  await page.locator('#edit-context').click();
  await page.locator('#context-text').fill('Customer needs a callback tomorrow; source preserved'); await reason(page); await record(page);
  await page.locator('#handoff').click();
  // Directory only exposes internal identities; the test resolves recipient through signed session read.
  const recipientContext = await browser.newContext(); const recipient = await recipientContext.newPage();
  await login(recipient, 'recipient');
  const identity = await recipient.evaluate(async () => (await (await fetch('/v1/auth/session')).json()).context.userId);
  await page.locator('#recipient').selectOption(identity);
  await page.locator('#handoff-context').fill('Call tomorrow: inspect original evidence first');
  await page.locator('#action').fill('Call customer tomorrow'); await reason(page); await record(page);
  await recipient.locator('#refresh').click();
  await recipient.locator('.queue-item').filter({ hasText: 'Fabricated full browser journey' }).click();
  await expect(recipient.locator('#context')).toContainText(leadId);
  await recipient.locator('#evidence').click();
  await expect(recipient.locator('#read-view')).toContainText('Fabricated original: please call tomorrow');
  expect(await recipient.evaluate(() => (window as unknown as { qaXss?: number }).qaXss)).toBeUndefined();
  await recipient.locator('[id^="accept-"]').first().click(); await reason(recipient); await record(recipient);
  await recipient.locator('#create-action').click(); await recipient.locator('#action').fill('Independent callback'); await reason(recipient); await record(recipient);
  let section = recipient.locator('#work-items section').filter({ has: recipient.getByRole('heading', { name: 'Independent callback', exact: true }) }).last();
  await section.getByRole('button', { name: 'Reschedule', exact: true }).click();
  await recipient.locator('#due').fill('2030-01-01T10:00'); await reason(recipient); await record(recipient);
  section = recipient.locator('#work-items section').filter({ has: recipient.getByRole('heading', { name: 'Independent callback', exact: true }) }).last();
  await section.getByRole('button', { name: 'Complete action', exact: true }).click();
  await recipient.locator('#declaration-input').fill('I called using a separate phone; human claim');
  await recipient.locator('#declaration-confirm').check(); await record(recipient);
  section = recipient.locator('#work-items section').filter({ has: recipient.getByRole('heading', { name: 'Independent callback', exact: true }) }).last();
  await section.getByRole('button', { name: 'Reopen as successor' }).click(); await reason(recipient, 'Customer asked for another callback'); await record(recipient);
  for (const stage of ['Contacting', 'Follow-up']) { await recipient.locator('#stage-' + stage).click(); await reason(recipient); await record(recipient); }
  await recipient.locator('#outcome').click(); await recipient.locator('#outcome-value').selectOption('Won'); await reason(recipient); await record(recipient);
  await recipient.locator('[id^="correct-"]').last().click(); await recipient.locator('#outcome-value').selectOption('Unknown'); await reason(recipient, 'Correction: payment not verified'); await record(recipient);
  await expect(recipient.locator('#outcomes')).toContainText('Won'); await expect(recipient.locator('#outcomes')).toContainText('Unknown');
  await recipient.locator('#audit').click(); await expect(recipient.locator('#read-view')).toContainText('Correction: payment not verified');
  const db = new Pool({ connectionString: process.env.QA_DATABASE_URL });
  try {
    await expect.poll(async () => (await db.query('SELECT DISTINCT event_type FROM product_event')).rows.map(r => r.event_type))
      .toEqual(expect.arrayContaining(['evidence_viewed', 'context_edited', 'action_completed', 'outcome_corrected']));
    const events = (await db.query('SELECT payload,release_version,flag_exposure FROM product_event')).rows;
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) { expect(event.payload).toEqual({ safe: 'ok' }); expect(event.release_version).toBe('0.1.0'); expect(event.flag_exposure).toEqual({ pancake_sync: 'off' }); }
    expect(JSON.stringify(events)).not.toContain(leadId); expect(JSON.stringify(events)).not.toContain('Fabricated original');
  } finally { await db.end(); }
  // Chromium can leave requestless preconnect sockets open. A process restart
  // must close them too; graceful HTTP idle shutdown alone waits indefinitely.
  const preconnect = connect(3410, '127.0.0.1');
  preconnect.on('error', () => undefined); // A forced server restart may reset it.
  try {
    await new Promise<void>((resolve, reject) => { preconnect.once('connect', resolve); preconnect.once('error', reject); });
    const restarted = await request.post('http://127.0.0.1:3412/restart', {
      headers: { 'x-qa-control': process.env.QA_CONTROL_SECRET! }, timeout: 10000,
    });
    expect(restarted.ok()).toBe(true);
  } finally { preconnect.destroy(); }
  await recipient.reload(); await expect(recipient.locator('#signin')).toBeVisible();
  await login(recipient, 'recipient');
  await recipient.locator('.queue-item').filter({ hasText: 'Fabricated full browser journey' }).click();
  await expect(recipient.locator('#context')).toContainText(leadId);
  await expect(recipient.locator('#outcomes')).toContainText('Correction: payment not verified');
  await recipientContext.close();
});

test('OIDC viewer and tenant denials with UI-created classification fixtures', async ({ browser, page }) => {
  await login(page, 'owner');
  const lead = await create(page, 'Fabricated classification real flag', false);
  await expect(page.locator('.queue-item')).toContainText('Fabricated classification real flag');
  await create(page, 'Fabricated classification synthetic flag', true);
  await expect(page.locator('.queue-item')).not.toContainText('Fabricated classification synthetic flag');
  await page.locator('#classification').selectOption('all');
  await expect(page.locator('.queue-item').filter({ hasText: 'Fabricated classification' })).toHaveCount(2);
  const other = await browser.newContext(); const actor = await other.newPage();
  await login(actor, 'viewer');
  const denied = await actor.evaluate(async id => ({ read: (await fetch('/v1/pilot/leads/' + id)).status,
    create: (await fetch('/v1/pilot/scenarios', { method: 'POST', headers: { 'content-type': 'application/json', 'X-CSRF-Token': (await (await fetch('/v1/auth/session')).json()).csrfToken }, body: JSON.stringify({}) })).status }), lead);
  expect(denied).toEqual({ read: 403, create: 403 });
  const csrfDenial = await page.evaluate(async () => (await fetch('/v1/pilot/scenarios', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status);
  expect(csrfDenial).toBe(403);
  await actor.locator('#logout').click(); await login(actor, 'foreign');
  expect(await actor.evaluate(async id => (await fetch('/v1/pilot/leads/' + id)).status, lead)).toBe(404);
  await other.close();
});
