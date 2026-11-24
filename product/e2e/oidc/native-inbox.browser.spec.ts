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

test.skip(!process.env.NATIVE_INBOX_E2E, 'run with playwright.native-inbox.config.ts');

test('React Native Inbox renders persisted synthetic intake with canonical identity and bounded history', async ({ page }) => {
  await signIn(page, 'admin');
  const connection = await api(page, '/v1/source-integrations/connections', {
    method: 'POST', body: JSON.stringify({ provider: 'pancake', route: 'pancake-synthetic', pageId: 'react-native-page' }),
  });
  expect(connection.status).toBe(201);
  const connectionId = connection.body.id as string;
  const example = await api(page, `/v1/source-integrations/connections/${connectionId}/example`);
  expect(example.status).toBe(200);
  const baseFixture = example.body.fixture as Record<string, any>;
  async function intake(conversationId: string, messageId: string) {
    const fixture = JSON.parse(JSON.stringify(baseFixture));
    fixture.receiptId = `react-native-${crypto.randomUUID()}`;
    delete fixture.originalMeta;
    fixture.payload.page_id = 'react-native-page';
    fixture.payload.data.conversation = { id: conversationId, type: 'INBOX' };
    fixture.payload.data.message = { ...fixture.payload.data.message, id: messageId, page_id: 'react-native-page', conversation_id: conversationId };
    return api(page, `/v1/source-integrations/connections/${connectionId}/observations`, { method: 'POST', body: JSON.stringify({ fixture, claimResponsibility: false }) });
  }
  expect((await intake('react-conversation-1', `react-message-${crypto.randomUUID()}`)).status).toBe(201);
  const conversationIds = Array.from({ length: 54 }, (_, i) => `react-conversation-${i + 2}`);
  for (let i = 0; i < conversationIds.length; i += 10) {
    const results = await Promise.all(conversationIds.slice(i, i + 10).map(id => intake(id, `react-message-${crypto.randomUUID()}`)));
    expect(results.every(result => result.status === 201)).toBe(true);
  }
  const longMessages = await Promise.all(Array.from({ length: 101 }, () => intake('react-long-history', `react-message-${crypto.randomUUID()}`)));
  expect(longMessages.every(result => result.status === 201)).toBe(true);
  const projection = await api(page, '/v1/source-integrations/conversations?limit=100');
  expect(projection.status).toBe(200);
  expect(projection.body.items.map((item: any) => item.conversationId)).toContain('react-conversation-1');
  const long = projection.body.items.find((item: any) => item.conversationId === 'react-long-history');
  expect(long.messages).toHaveLength(100);
  expect(long.messageHistoryLimit).toBe(100);
  expect(long.messageHistoryTruncated).toBe(true);

  await page.goto('app/');
  await page.getByText('Hộp thư đa kênh', { exact: true }).click();
  await expect(page.getByTestId('inbox-page')).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Conversation native/ }).click();
  await expect(page.getByRole('heading', { name: 'react-conversation-1', exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="inbox-page"] article')).toHaveCount(50);
  await page.getByRole('button', { name: /Tải thêm conversation/ }).click();
  await expect(page.locator('[data-testid="inbox-page"] article')).toHaveCount(56);
  await expect(page.getByText(/Authority UNVERIFIED.*completeness UNKNOWN/).first()).toBeVisible();
  await expect(page.getByText(/completeness vẫn UNKNOWN/).first()).toBeVisible();
  await expect(page.locator('[data-testid="inbox-page"] article')).toHaveCount(56);
});
