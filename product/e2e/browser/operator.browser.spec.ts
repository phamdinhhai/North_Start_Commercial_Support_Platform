import { expect, test } from '@playwright/test';

const operator = 'operator';
const authToken = (workspaceId: string) => `Bearer ${Buffer.from(JSON.stringify({ workspaceId, userId: operator, role: 'sales' })).toString('base64')}`;
const intake = (suffix: string) => ({
  displayName: 'Synthetic browser lead',
  utterance: 'Please call me tomorrow',
  speaker: 'customer',
  connection: 'manual',
  externalRecordId: `browser-${suffix}`,
  isSynthetic: true,
});

type ApiRequest = { fetch: (url: string, options: Record<string, unknown>) => Promise<any> };
async function api(request: ApiRequest, token: string, method: string, url: string, data?: unknown) {
  return request.fetch(url, {
    method,
    headers: { authorization: token, ...(data ? { 'content-type': 'application/json' } : {}) },
    ...(data ? { data } : {}),
  });
}

test.describe('operator workflow', () => {
  test('Queue → select → accept → complete → outcome → audit', async ({ page, request }) => {
    const created = await api(request, authToken('browser-e2e-workspace'), 'POST', '/pilot/scenarios', intake('workflow'));
    expect(created.status()).toBe(201);
    const { leadId } = await created.json();
    const handoff = await api(request, authToken('browser-e2e-workspace'), 'POST', `/pilot/leads/${leadId}/handoff`, {
      context: 'Synthetic handoff context', proposedAction: 'Call back',
      responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: operator,
    });
    expect(handoff.status()).toBe(201);

    await page.goto('/operator');
    await page.locator('#token').fill(authToken('browser-e2e-workspace'));
    await page.locator('#load').click();
    await expect(page.locator('.queue-item')).toContainText('Call back');
    await page.locator('.queue-item').first().click();
    await expect(page.locator('#context')).toContainText('Synthetic browser lead');
    await expect(page.locator('#context')).toContainText('raw payload is not exposed');
    await expect(page.locator('#context')).not.toContainText('rawPayload');
    await expect(page.locator('#context')).not.toContainText(token);

    await page.locator('#accept').click();
    await expect(page.locator('#action-status')).toContainText('Action recorded');
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('Action recorded');
    await page.locator('#outcome').click();
    page.once('dialog', async (dialog) => await dialog.accept('Won'));
    await expect(page.locator('#action-status')).toContainText('Action recorded');
    await page.locator('#audit').click();
    await expect(page.locator('#action-status')).toContainText('Audit records:');
    expect(await page.locator('body').textContent()).not.toContain('rawPayload');
    expect(await page.locator('body').textContent()).not.toContain('Synthetic browser lead raw');
  });

  test('denied, empty, redaction and stale states remain visible and safe', async ({ page, request }) => {
    const denied = await request.get('/pilot/queue', { headers: { authorization: 'Bearer invalid-test-token' } });
    expect(denied.status()).toBe(401);

    await page.goto('/operator');
    await page.locator('#token').fill(authToken('browser-e2e-workspace'));
    await page.locator('#load').click();
    await expect(page.locator('#queue-status')).toContainText('Queue is empty');
    await expect(page.locator('#queue')).toContainText('Queue is empty for this scope');

    const created = await api(request, authToken('browser-e2e-workspace'), 'POST', '/pilot/scenarios', intake('stale'));
    const { leadId } = await created.json();
    const handoff = await api(request, authToken('browser-e2e-workspace'), 'POST', `/pilot/leads/${leadId}/handoff`, {
      context: 'PRIVATE-CONTEXT', proposedAction: 'Call back', responsibleParty: 'internal',
      origin: 'explicit-request', recipientUserId: operator,
    });
    const workId = (await handoff.json()).workItemId;
    const accepted = await api(request, authToken('browser-e2e-workspace'), 'POST', `/pilot/leads/${leadId}/accept`, { workId, reason: 'accepted' });
    expect(accepted.status()).toBe(200);
    const stale = await api(request, authToken('browser-e2e-workspace'), 'POST', `/pilot/leads/${leadId}/complete`, { workId, evidence: 'observed', evidenceRef: 'not-a-real-pointer', reason: 'stale item' });
    expect(stale.status()).toBe(422);
    expect(await stale.text()).not.toContain('PRIVATE-CONTEXT');
    expect(await stale.text()).not.toContain('rawPayload');
  });
});
