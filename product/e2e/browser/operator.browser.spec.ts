import { expect, test, type APIRequestContext } from '@playwright/test';

const authToken = (workspaceId: string, userId = 'operator', role: 'sales' | 'viewer' = 'sales') =>
  `Bearer ${Buffer.from(JSON.stringify({ workspaceId, userId, role })).toString('base64')}`;

const intake = (suffix: string) => ({
  displayName: `Synthetic browser lead ${suffix}`,
  utterance: 'Please call me tomorrow afternoon',
  speaker: 'customer',
  connection: 'manual',
  externalRecordId: `browser-${suffix}`,
  isSynthetic: true,
});

async function api(request: APIRequestContext, token: string, method: string, url: string, data?: unknown) {
  return request.fetch(url.replace(/^\//, ''), {
    method,
    headers: { authorization: token, ...(data ? { 'content-type': 'application/json' } : {}) },
    ...(data ? { data } : {}),
  });
}

test.describe('operator browser workflow', () => {
  test('enforces observed vs declared vs inferred boundaries, explicit human declaration, outcome and audit', async ({ page, request }) => {
    const uid = `${Date.now()}-flow`;
    const workspaceId = `synthetic-browser-${uid}`;
    const ownerToken = authToken(workspaceId, 'intake-owner', 'sales');
    const operatorToken = authToken(workspaceId, 'operator', 'sales');

    const created = await api(request, ownerToken, 'POST', '/pilot/scenarios', intake(uid));
    expect(created.status()).toBe(201);
    const { leadId } = await created.json();

    const handoff = await api(request, ownerToken, 'POST', `/pilot/leads/${leadId}/handoff`, {
      context: 'Synthetic handoff context for operator',
      proposedAction: 'Call prospective student back',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'operator',
    });
    expect(handoff.status()).toBe(201);

    const leadSnapshot = await (await api(request, operatorToken, 'GET', `/pilot/leads/${leadId}`)).json();
    const intakeEnvelopeId: string = leadSnapshot.handoff.evidenceRefs[0].envelopeId;
    expect(intakeEnvelopeId).toBeTruthy();

    await page.goto('operator');
    await page.locator('#token').fill(operatorToken);
    await page.locator('#load').click();
    await expect(page.locator('.queue-item')).toContainText('Call prospective student back');
    await page.locator('.queue-item').first().click();

    await expect(page.locator('#context')).toContainText(`Synthetic browser lead ${uid}`);
    await expect(page.locator('#context')).toContainText('raw payload is not exposed');
    await expect(page.locator('#context')).not.toContainText('rawPayload');
    await expect(page.locator('#context')).not.toContainText(operatorToken);

    await page.locator('#accept').click();
    await expect(page.locator('#action-status')).toContainText('Action recorded');

    // 1) Declared mode refuses blank declaration and refuses unconfirmed declaration in UI
    await page.locator('#complete-mode').selectOption('declared');
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('enter a non-blank human declaration');

    await page.locator('#declaration-input').fill('Called student at 14:30 and confirmed curriculum questions.');
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('explicitly confirm your human declaration');

    // 2) Inferred mode is refused by domain policy (AI/inferred cannot close work)
    await page.locator('#complete-mode').selectOption('inferred');
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('INFERRED_CANNOT_CLOSE');

    // 3) Observed mode refuses missing pointer and refuses customer intake message as action proof
    await page.locator('#complete-mode').selectOption('observed');
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('requires a system evidence pointer');

    await page.locator('#evidence-ref-input').fill(intakeEnvelopeId);
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('EVIDENCE_NOT_ACTION_PROOF');

    // 4) Human-declared completion succeeds only when explicitly entered and confirmed; no fabricated user reason
    await page.locator('#complete-mode').selectOption('declared');
    await page.locator('#declaration-input').fill('Called student at 14:30 and confirmed curriculum questions.');
    await page.locator('#declaration-confirm').check();
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('Action recorded');

    page.once('dialog', async (dialog) => await dialog.accept('Won'));
    await page.locator('#outcome').click();
    await expect(page.locator('#action-status')).toContainText('Action recorded');

    await page.locator('#audit').click();
    await expect(page.locator('#action-status')).toContainText('Audit records:');
    await expect(page.locator('#action-status')).toContainText('provenance: audit_record');

    const auditResp = await api(request, operatorToken, 'GET', `/pilot/leads/${leadId}/audit`);
    expect(auditResp.status()).toBe(200);
    const auditBody = await auditResp.json();
    const completionAudit = auditBody.history.find((entry: { eventType: string }) => entry.eventType === 'work_completed');
    expect(completionAudit).toBeTruthy();
    expect(JSON.parse(completionAudit.newValue)).toMatchObject({
      status: 'completed',
      evidence: 'declared',
      declaration: 'Called student at 14:30 and confirmed curriculum questions.',
      confirmed: true,
    });
    expect(completionAudit.reason).toBe('work completed');
    expect(await page.locator('body').textContent()).not.toContain('rawPayload');
  });

  test('handles reschedule in UI and surfaces genuine WORK_SUPERSEDED stale conflict across concurrent operator views', async ({ browser, request }) => {
    const uid = `${Date.now()}-stale`;
    const workspaceId = `synthetic-stale-${uid}`;
    const token = authToken(workspaceId, 'operator', 'sales');

    const created = await api(request, token, 'POST', '/pilot/scenarios', intake(uid));
    const { leadId } = await created.json();
    const handoff = await api(request, token, 'POST', `/pilot/leads/${leadId}/handoff`, {
      context: 'Handoff before reschedule',
      proposedAction: 'Initial follow-up call',
      responsibleParty: 'internal',
      origin: 'explicit-commitment',
      dueAt: '2030-01-01T09:00:00Z',
      recipientUserId: 'operator',
    });
    const { workItemId } = await handoff.json();
    const accepted = await api(request, token, 'POST', `/pilot/leads/${leadId}/accept`, {
      workId: workItemId,
      reason: 'accepted for follow-up',
    });
    expect([200, 201]).toContain(accepted.status());

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      for (const p of [pageA, pageB]) {
        await p.goto('operator');
        await p.locator('#token').fill(token);
        await p.locator('#load').click();
        await p.locator('.queue-item').first().click();
        await expect(p.locator('#context')).toContainText('Initial follow-up call');
      }

      // Page A reschedules the work item via UI prompts -> creates replacement work item
      const prompts = ['2030-01-05T10:00:00Z', 'Customer asked to move call to Friday'];
      pageA.on('dialog', async (dialog) => {
        await dialog.accept(prompts.shift() ?? '');
      });
      await pageA.locator('#reschedule').click();
      await expect(pageA.locator('#action-status')).toContainText('Replacement item:');

      // Page B still holds stale selection of superseded workItemId and tries to complete it in UI
      await pageB.locator('#declaration-input').fill('Completed on stale tab');
      await pageB.locator('#declaration-confirm').check();
      await pageB.locator('#complete').click();
      await expect(pageB.locator('#action-status')).toContainText('WORK_SUPERSEDED');

      // Reloading Page B and selecting the active replacement item allows valid completion
      await pageB.locator('#refresh').click();
      const openItem = pageB.locator('.queue-item', { hasText: 'open' });
      await expect(openItem).toHaveCount(1);
      await openItem.click();
      await expect(pageB.locator('#context-status')).toContainText('Recorded projection');
      await pageB.locator('#declaration-input').fill('Completed on active replacement item');
      await pageB.locator('#declaration-confirm').check();
      await pageB.locator('#complete').click();
      await expect(pageB.locator('#action-status')).toContainText('Action recorded');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('enforces authentication, same-workspace permission denial (403) and cross-workspace isolation (404)', async ({ page, request }) => {
    const uid = `${Date.now()}-isolation`;
    const workspaceA = `synthetic-ws-a-${uid}`;
    const workspaceB = `synthetic-ws-b-${uid}`;
    const ownerAToken = authToken(workspaceA, 'owner-a', 'sales');
    const recipientAToken = authToken(workspaceA, 'recipient-a', 'sales');
    const bystanderAToken = authToken(workspaceA, 'bystander-a', 'sales');
    const workspaceBToken = authToken(workspaceB, 'operator-b', 'sales');

    // Unauthenticated / invalid bearer token -> 401 in UI
    await page.goto('operator');
    await page.locator('#token').fill('Bearer invalid-token');
    await page.locator('#load').click();
    await expect(page.locator('#queue-status')).toContainText('Authentication failed (401)');

    // Create case in Workspace A assigned to owner-a and handed off to recipient-a
    const created = await api(request, ownerAToken, 'POST', '/pilot/scenarios', intake(uid));
    expect(created.status()).toBe(201);
    const { leadId } = await created.json();
    const handoff = await api(request, ownerAToken, 'POST', `/pilot/leads/${leadId}/handoff`, {
      context: 'CONFIDENTIAL-WS-A-HANDOFF',
      proposedAction: 'Send proposal',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      recipientUserId: 'recipient-a',
    });
    const { workItemId } = await handoff.json();

    // Bystander in same workspace A sees empty queue and gets 403 on lead access & mutation
    await page.locator('#token').fill(bystanderAToken);
    await page.locator('#load').click();
    await expect(page.locator('#queue-status')).toContainText('Queue is empty');
    await expect(page.locator('#queue')).toContainText('Queue is empty for this scope');

    const bystanderRead = await api(request, bystanderAToken, 'GET', `/pilot/leads/${leadId}`);
    expect(bystanderRead.status()).toBe(403);
    const bystanderAccept = await api(request, bystanderAToken, 'POST', `/pilot/leads/${leadId}/accept`, {
      workId: workItemId,
      reason: 'unauthorized accept attempt',
    });
    expect(bystanderAccept.status()).toBe(403);
    expect(await bystanderAccept.text()).not.toContain('CONFIDENTIAL-WS-A-HANDOFF');

    // Recipient in Workspace A can see item in queue, but cannot complete before accepting (403 NOT_OWNER)
    await page.locator('#token').fill(recipientAToken);
    await page.locator('#load').click();
    await page.locator('.queue-item').first().click();
    await page.locator('#declaration-input').fill('Premature completion before accepting handoff');
    await page.locator('#declaration-confirm').check();
    await page.locator('#complete').click();
    await expect(page.locator('#action-status')).toContainText('Permission denied (NOT_OWNER)');

    // Workspace B is completely isolated: empty queue in UI and 404 invisible on Workspace A leadId
    await page.locator('#token').fill(workspaceBToken);
    await page.locator('#load').click();
    await expect(page.locator('#queue-status')).toContainText('Queue is empty');
    const crossTenantRead = await api(request, workspaceBToken, 'GET', `/pilot/leads/${leadId}`);
    expect(crossTenantRead.status()).toBe(404);
    expect(await crossTenantRead.text()).not.toContain('CONFIDENTIAL-WS-A-HANDOFF');
    expect(await crossTenantRead.text()).not.toContain('rawPayload');
  });
});
