import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, account: string) {
  await page.goto('operator');
  await page.locator('#signin').click();
  await expect(page).toHaveURL(/127\.0\.0\.1:3411\/authorize/);
  await page.getByLabel('Account').selectOption(account);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.locator('#session-status')).toHaveText('Signed in.');
}

async function api(page: Page, path: string, init: RequestInit = {}) {
  return page.evaluate(async ({ path, init }) => {
    const session = await (await fetch('/v1/auth/session')).json();
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { ...(init.body ? { 'content-type': 'application/json', 'X-CSRF-Token': session.csrfToken } : {}), ...(init.headers ?? {}) },
    });
    return { status: response.status, body: await response.json() };
  }, { path, init });
}

test('React Native Inbox renders persisted synthetic intake with canonical identity and bounded history', async ({ page }) => {
  await signIn(page, 'admin');
  const connection = await api(page, '/v1/source-integrations/connections', {
    method: 'POST', body: JSON.stringify({ provider: 'pancake', route: 'pancake-synthetic', pageId: 'react-native-page' }),
  });
  expect(connection.status).toBe(201);
  const connectionId = connection.body.id as string;
  const example = await api(page, `/v1/source-integrations/connections/${connectionId}/example`);
  expect(example.status).toBe(200);
  const fixture = example.body.fixture as Record<string, any>;
  fixture.receiptId = `react-native-${crypto.randomUUID()}`;
  fixture.originalMeta = { ...(fixture.originalMeta ?? {}), pageId: 'react-native-page', conversationId: 'react-conversation-1', messageId: `react-message-${crypto.randomUUID()}` };
  fixture.payload.page_id = 'react-native-page';
  fixture.payload.data.conversation = { id: 'react-conversation-1', type: 'INBOX' };
  fixture.payload.data.message = { ...fixture.payload.data.message, id: fixture.originalMeta.messageId, page_id: 'react-native-page', conversation_id: 'react-conversation-1' };
  const intake = await api(page, `/v1/source-integrations/connections/${connectionId}/observations`, {
    method: 'POST', body: JSON.stringify({ fixture, claimResponsibility: false }),
  });
  expect(intake.status).toBe(201);
  const projection = await api(page, '/v1/source-integrations/conversations?limit=10');
  expect(projection.status).toBe(200);
  expect(projection.body.items.map((item: any) => item.conversationId)).toContain('react-conversation-1');

  await page.goto('app/');
  await page.getByText('Hộp thư đa kênh', { exact: true }).click();
  if (!(await page.getByTestId('inbox-page').count())) throw new Error(`REACT_DEBUG ${await page.url()} links=${await page.locator('a').evaluateAll(as=>as.slice(0,20).map(a=>({text:(a as HTMLElement).innerText,href:(a as HTMLAnchorElement).getAttribute('href')})))} ${(await page.locator('body').innerText()).slice(0,500)}`);
  await page.getByRole('button', { name: /Conversation native/ }).click();
  await expect(page.getByText('react-conversation-1')).toBeVisible();
  await expect(page.getByText(/Authority UNVERIFIED.*completeness UNKNOWN/)).toBeVisible();
  await expect(page.getByText(/completeness vẫn UNKNOWN/)).toBeVisible();
  await expect(page.locator('[data-testid="inbox-page"] article')).toHaveCount(1);
});
