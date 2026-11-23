import { expect, test, type Page, type APIRequestContext } from '@playwright/test';
const token = (ws: string, user = 'operator') => `Bearer ${Buffer.from(JSON.stringify({ workspaceId: ws, userId: user, role: 'sales' })).toString('base64')}`;
async function api(r: APIRequestContext, credential: string, method: string, path: string, data?: object) {
  return r.fetch(path, { method, headers: { authorization: credential }, ...(data ? { data } : {}) });
}
async function fixture(r: APIRequestContext, credential: string, name: string) {
  const c = await api(r, credential, 'POST', 'pilot/scenarios', { displayName: name, utterance: 'Synthetic customer requested callback', speaker: 'customer', connection: 'manual', externalRecordId: crypto.randomUUID(), isSynthetic: true });
  expect(c.status()).toBe(201); const { leadId } = await c.json();
  const h = await api(r, credential, 'POST', `pilot/leads/${leadId}/handoff`, { context: `Context ${name}`, proposedAction: `Action ${name}`, responsibleParty: 'internal', origin: 'explicit-request', recipientUserId: 'operator' });
  expect(h.status()).toBe(201); return { leadId, workId: (await h.json()).workItemId };
}
async function load(p: Page, credential: string) {
  await p.goto('operator'); await expect(p.locator('#development')).toBeVisible(); await p.locator('#token').fill(credential);
  await p.locator('#classification').selectOption('synthetic'); await expect(p.locator('#queue-status')).toContainText('loaded');
}
async function record(p: Page) { await p.locator('#submit-command').click(); await expect(p.locator('#command-dialog')).not.toBeVisible(); await expect(p.locator('#context-status')).toContainText('Action recorded'); }

test('ignores delayed prior selection and binds commands to displayed lead', async ({ page, request }) => {
  const credential = token(`selection-${Date.now()}`); const a = await fixture(request, credential, 'A'); const b = await fixture(request, credential, 'B');
  let release!: () => void, captured!: () => void; const wait = new Promise<void>(r => { release = r; }); const started = new Promise<void>(r => { captured = r; });
  await page.route(`**/pilot/leads/${a.leadId}`, async route => { captured(); await wait; await route.continue(); });
  await load(page, credential); await page.locator('.queue-item').filter({ hasText: 'A  -' }).click(); await started;
  await page.locator('.queue-item').filter({ hasText: 'B  -' }).click(); await expect(page.locator('#context')).toContainText('Context B');
  const response = page.waitForResponse(r => r.url().endsWith(a.leadId)); release(); await response;
  await expect(page.locator('#context')).toContainText('Context B'); await page.locator(`#accept-${b.workId}`).click(); await page.locator('#reason').fill('Accept B only'); await record(page);
  const auditB = await (await api(request, credential, 'GET', `pilot/leads/${b.leadId}/audit`)).json();
  const auditA = await (await api(request, credential, 'GET', `pilot/leads/${a.leadId}/audit`)).json();
  expect(JSON.stringify(auditB)).toContain('Accept B only'); expect(JSON.stringify(auditA)).not.toContain('Accept B only');
  await page.locator('#token').fill(token('foreign')); await expect(page.locator('#context')).toBeEmpty(); await expect(page.locator('.queue-item')).toHaveCount(0);
});

test('retains evidence guards, explicit declaration, claimed outcome and detailed audit', async ({ page, request }) => {
  const credential = token(`guard-${Date.now()}`); const { leadId, workId } = await fixture(request, credential, 'Evidence');
  const d = await (await api(request, credential, 'GET', `pilot/leads/${leadId}`)).json(); const envelope = d.handoff.evidenceRefs[0].envelopeId;
  await load(page, credential); await page.locator('.queue-item').first().click(); await page.locator(`#accept-${workId}`).click(); await page.locator('#reason').fill('Acceptance'); await record(page);
  await page.locator('#evidence').click(); await expect(page.locator('#read-view')).toContainText('Synthetic customer requested callback');
  await page.locator(`#complete-${workId}`).click(); await page.locator('#submit-command').click(); await expect(page.locator('#dialog-status')).toContainText('explicitly confirm');
  await page.locator('#complete-mode').selectOption('observed'); await page.locator('#submit-command').click(); await expect(page.locator('#dialog-status')).toContainText('system evidence pointer');
  await page.locator('#evidence-ref-input').fill(envelope); await page.locator('#submit-command').click(); await expect(page.locator('#dialog-status')).toContainText('EVIDENCE_NOT_ACTION_PROOF');
  // Inferred is deliberately absent from selectable completion bases; direct malicious submission still denies.
  expect(await page.locator('#complete-mode option').allTextContents()).not.toContain('inferred');
  const inferred = await api(request, credential, 'POST', `pilot/leads/${leadId}/complete`, { workId, evidence: 'inferred' }); expect(inferred.status()).toBe(422); expect(await inferred.json()).toMatchObject({ code: 'INFERRED_CANNOT_CLOSE' });
  await page.locator('#complete-mode').selectOption('declared'); await page.locator('#declaration-input').fill('I called the customer'); await page.locator('#declaration-confirm').check(); await record(page);
  for (const stage of ['Contacting', 'Follow-up']) { await page.locator('#stage-' + stage).click(); await page.locator('#reason').fill('Human stage change'); await record(page); }
  await page.locator('#outcome').click(); await page.locator('#outcome-value').selectOption('Won'); await page.locator('#reason').fill('Human outcome claim'); await record(page);
  await expect(page.locator('#outcomes')).toContainText('claimed'); await page.locator('#audit').click(); await expect(page.locator('#read-view')).toContainText('I called the customer');
  expect(await page.locator('body').textContent()).not.toContain(credential);
});

test('reschedules in UI and rejects concurrent stale work without overwriting history', async ({ browser, request }) => {
  const credential = token(`stale-${Date.now()}`); const { leadId, workId } = await fixture(request, credential, 'Stale');
  await api(request, credential, 'POST', `pilot/leads/${leadId}/accept`, { workId, reason: 'Acceptance' });
  const ca = await browser.newContext(), cb = await browser.newContext(); const a = await ca.newPage(), b = await cb.newPage();
  try {
    for (const p of [a, b]) { await load(p, credential); await p.locator('.queue-item').first().click(); await expect(p.locator('#context')).toContainText('Action Stale'); }
    await b.locator(`#complete-${workId}`).click(); await b.locator('#declaration-input').fill('Stale completion'); await b.locator('#declaration-confirm').check();
    await a.locator(`#reschedule-${workId}`).click(); await a.locator('#due').fill('2030-01-05T10:00'); await a.locator('#reason').fill('Move to Friday'); await record(a);
    let completionWrites = 0;
    b.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/complete')) completionWrites++; });
    await b.locator('#submit-command').click(); await expect(b.locator('#dialog-status')).toContainText(/STALE_VERSION|WORK_SUPERSEDED/); await expect(b.locator('#submit-command')).toBeDisabled();
    expect(completionWrites).toBe(1);
    const refreshed = await (await api(request, credential, 'GET', 'pilot/leads/' + leadId)).json();
    await b.getByRole('button', { name: 'Reload current lead' }).click(); await expect(b.locator('#context')).toContainText('Move to Friday');
    await expect(b.locator('#context')).toContainText('Version: ' + refreshed.version);
    await expect(b.locator('#command-dialog')).toBeVisible();
    await expect(b.locator('#declaration-input')).toHaveValue('Stale completion');
    await expect(b.locator('#declaration-confirm')).toBeChecked();
    await expect(b.locator('#submit-command')).toBeEnabled();
    expect(completionWrites).toBe(1);
    const discard = b.waitForEvent('dialog');
    const cancel = b.locator('#cancel-command').click();
    const confirmation = await discard; expect(confirmation.message()).toBe('Discard unsaved changes?');
    await confirmation.accept(); await cancel;
    await expect(b.locator('#command-dialog')).not.toBeVisible();
    expect(completionWrites).toBe(1);
    const replacement = b.locator('#work-items section').filter({ hasText: '"status": "open"' }).last();
    await replacement.getByRole('button', { name: 'Complete action', exact: true }).click(); await b.locator('#declaration-input').fill('Completed replacement'); await b.locator('#declaration-confirm').check(); await record(b);
    expect(completionWrites).toBe(2);
    const detail = await (await api(request, credential, 'GET', `pilot/leads/${leadId}`)).json(); expect(detail.workItems.find((w: { id: string }) => w.id === workId).status).toBe('rescheduled');
  } finally { await ca.close(); await cb.close(); }
});

test('enforces unauthenticated, same-workspace 403 and cross-workspace 404 boundaries', async ({ page, request }) => {
  const ws = `isolation-${Date.now()}`, credential = token(ws); const { leadId } = await fixture(request, credential, 'Scoped');
  expect((await request.get(`pilot/leads/${leadId}`)).status()).toBe(401);
  await load(page, token(ws, 'bystander')); await expect(page.locator('.queue-item')).toHaveCount(0);
  expect((await api(request, token(ws, 'bystander'), 'GET', `pilot/leads/${leadId}`)).status()).toBe(403);
  expect((await api(request, token(ws, 'bystander'), 'POST', `pilot/leads/${leadId}/outcome`, { value: 'Won' })).status()).toBe(403);
  await page.locator('#token').fill(token('other-workspace')); await page.locator('#load').click(); await expect(page.locator('.queue-item')).toHaveCount(0);
  expect((await api(request, token('other-workspace'), 'GET', `pilot/leads/${leadId}`)).status()).toBe(404);
});
