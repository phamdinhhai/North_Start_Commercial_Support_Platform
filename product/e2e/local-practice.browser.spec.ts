import { expect, test } from '@playwright/test';
test('actual local synthetic practice admits only synthetic intake', async ({ page }) => {
  await page.goto('/v1/operator'); await page.locator('#signin').click();
  await page.getByLabel('Account').selectOption('owner'); await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#session-status')).toHaveText('Signed in.');
  await expect(page.locator('#practice-status')).toContainText('invented data only');
  expect(await page.evaluate(async () => (await (await fetch('/v1/auth/session')).json()).syntheticOnly)).toBe(true);
  await page.locator('#new-lead').click();
  await expect(page.locator('#synthetic')).toBeChecked(); await expect(page.locator('#synthetic')).toBeDisabled();
  const denial = await page.evaluate(async () => {
    const session = await (await fetch('/v1/auth/session')).json();
    const response = await fetch('/v1/pilot/scenarios', { method: 'POST', headers: { 'content-type': 'application/json', 'X-CSRF-Token': session.csrfToken },
      body: JSON.stringify({ displayName: 'Invented forbidden classification', utterance: 'Invented', speaker: 'customer', connection: 'manual', externalRecordId: crypto.randomUUID(), occurredAt: 'unknown', isSynthetic: false }) });
    return { status: response.status, body: await response.json() };
  });
  expect(denial.status).toBe(400);
  await page.locator('#display-name').fill('Invented local practice ' + crypto.randomUUID());
  await page.locator('#utterance').fill('Invented callback'); await page.locator('#connection').fill('manual');
  await page.locator('#external-record').fill(crypto.randomUUID()); await page.locator('#submit-command').click();
  await expect(page.locator('#context')).toContainText('SYNTHETIC');
});
