import { test, expect } from '@playwright/test';
import { OPERATOR_CLIENT_HTML } from '../src/api/operator-client';

// Controlled browser component tests: HTTP fixtures, no provider or database.
test.describe('operator session and command UI', () => {
  test('hides development credentials in production, escapes evidence and submits versioned context with CSRF', async ({ page }) => {
      const writes: { path: string; data: Record<string, unknown>; csrf?: string }[] = [];
      await page.route('http://localhost:47819/**', async route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        let body: unknown = {};
        if (path === '/v1/operator') return route.fulfill({ contentType: 'text/html', body: OPERATOR_CLIENT_HTML });
        if (path === '/v1/auth/session') body = { authenticated: true, loginAvailable: true, devTokensAllowed: false, csrfToken: 'csrf-fixture', context: { userId: 'user', workspaceId: 'workspace', role: 'sales' } };
        else if (r.method() === 'POST') { writes.push({ path, data: r.postDataJSON(), csrf: r.headers()['x-csrf-token'] }); body = { version: 4 }; }
        else if (path === '/v1/pilot/leads') body = { items: [{ leadId: 'lead', displayName: 'A lead', status: 'Open', version: 3 }] };
        else if (path.endsWith('/evidence')) body = { items: [{ envelopeId: 'envelope', rawPayload: { speaker: 'customer', utterance: '<img src=x onerror="window.pwned=true">' }, acquisitionMode: 'manual', acquisitionSource: 'original', mappingStatus: 'accepted' }] };
        else body = { lead: { id: 'lead', displayName: '<script>unsafe</script>', status: 'Open', owner: 'user' }, version: 3, currentContext: { text: 'Original' }, workItems: [], outcomes: [] };
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto('http://localhost:47819/v1/operator');
      await page.locator('.queue-item').waitFor();
      expect(await page.locator('#development').isVisible()).toBe(false);
      expect(await page.locator('#classification').inputValue()).toBe('real');
      await page.locator('.queue-item').click();
      await page.locator('#evidence').click();
      await page.getByText('Utterance:', { exact: false }).waitFor();
      expect(await page.locator('#read-view img').count()).toBe(0);
      expect(await page.locator('#read-view').textContent()).toContain('<img');
      await page.locator('#edit-context').click();
      await page.locator('#context-text').fill('Revised');
      await page.locator('#reason').fill('Human correction');
      await page.locator('#submit-command').click();
      await page.waitForFunction("!document.getElementById('command-dialog').open");
      const write = writes.find(w => w.path.endsWith('/context'))!;
      expect(write.data).toMatchObject({ text: 'Revised', reason: 'Human correction', expectedVersion: 3 });
      expect(typeof write.data.idempotencyKey).toBe('string');
      expect(write.csrf).toBe('csrf-fixture');
  });

  test('fails closed when session discovery is unavailable', async ({ page }) => {
      await page.route('http://localhost:47819/**', route => route.request().url().endsWith('/operator')
        ? route.fulfill({ contentType: 'text/html', body: OPERATOR_CLIENT_HTML })
        : route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
      await page.goto('http://localhost:47819/v1/operator');
      await page.waitForFunction("document.getElementById('session-status').classList.contains('error')");
      expect(await page.locator('#token').isVisible()).toBe(false);
      expect(await page.locator('#signin').isVisible()).toBe(false);
  });
});





// Regression: stale writes cannot be blindly retried and pending submit is disabled.
test('holds stale command for explicit reload and suppresses double submission', async ({ page }) => {
  let contextWrites = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('http://localhost:47819/**', async route => {
    const r = route.request(), p = new URL(r.url()).pathname;
    if (p.endsWith('/operator')) return route.fulfill({ contentType: 'text/html', body: OPERATOR_CLIENT_HTML });
    let body: unknown = {};
    if (p.endsWith('/session')) body = { authenticated: true, csrfToken: 'csrf', context: { userId: 'u', workspaceId: 'w', role: 'sales' } };
    else if (p.endsWith('/context') && r.method() === 'POST') {
      contextWrites++; await gate;
      return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'STALE_VERSION', message: 'Changed' }) });
    } else if (p === '/v1/pilot/leads') body = { items: [{ leadId: 'lead', displayName: 'Lead', status: 'Open' }] };
    else if (p.endsWith('/lead')) body = { lead: { displayName: 'Lead', status: 'Open' }, version: 7, workItems: [], outcomes: [] };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('http://localhost:47819/v1/operator');
  await page.locator('.queue-item').click();
  await page.locator('#edit-context').click();
  await page.locator('#context-text').fill('Change');
  await page.locator('#reason').fill('Correction');
  await page.locator('#submit-command').click();
  await expect(page.locator('#submit-command')).toBeDisabled();
  expect(contextWrites).toBe(1);
  release();
  await expect(page.locator('#dialog-status')).toContainText('STALE_VERSION');
  await expect(page.locator('#submit-command')).toBeDisabled();
  await page.getByRole('button', { name: 'Reload current lead' }).click();
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#context')).toContainText('Version: 7');
  expect(contextWrites).toBe(1);
});
