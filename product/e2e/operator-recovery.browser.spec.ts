import { test, expect } from '@playwright/test';
import { OPERATOR_CLIENT_HTML } from '../src/api/operator-client';

for (const failure of [401, 403] as const) {
  for (const switched of failure === 401 ? ['same', 'user', 'workspace', 'revoked'] : ['same']) {
    test(`draft boundary ${failure}, identity switched ${switched}`, async ({ page }) => {
      let writes = 0, expired = false;
      await page.route('http://localhost:47819/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        if (path.endsWith('/operator')) return route.fulfill({ contentType: 'text/html', body: OPERATOR_CLIENT_HTML });
        if (path.endsWith('/context') && r.method() === 'POST') {
          writes++; expired = true;
          return route.fulfill({ status: failure, json: { message: 'Denied' } });
        }
        if (expired && switched === 'revoked' && path.endsWith('/lead')) return route.fulfill({ status: 403, json: { message: 'Revoked' } });
        const body = path.endsWith('/session') ? { authenticated: true, loginAvailable: true, csrfToken: expired ? 'fresh-csrf' : 'csrf', context: { userId: expired && switched === 'user' ? 'other' : 'user', workspaceId: expired && switched === 'workspace' ? 'other' : 'workspace', role: 'sales' } }
          : path === '/v1/pilot/leads' ? { items: [{ id: 'lead', displayName: 'Lead', status: 'Open' }] }
          : path.endsWith('/contact-attempts') ? { items: [], truth: Object.fromEntries(['conversationSource', 'acquisitionLineage', 'revenueAttribution'].map(k => [k, { status: 'unknown', reason: 'No evidence' }])) }
          : { lead: { displayName: 'Lead', status: 'Open' }, version: expired ? 8 : 7, currentContext: { text: 'Original' }, workItems: [], outcomes: [] };
        return route.fulfill({ json: body });
      });
      await page.goto('http://localhost:47819/v1/operator');
      await page.locator('.queue-item').click();
      await page.locator('#edit-context').click();
      await page.locator('#context-text').fill('Sensitive draft');
      await page.locator('#reason').fill('Human reason');
      page.once('dialog', dialog => dialog.dismiss());
      await page.locator('#cancel-command').click();
      await expect(page.locator('#context-text')).toHaveValue('Sensitive draft');
      await page.locator('#submit-command').click();
      await expect(page.locator('#command-dialog')).not.toBeVisible();
      await expect(page.locator('#command-fields')).toBeEmpty();
      await expect(page.locator('#context')).toBeEmpty();
      expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
      if (failure === 401) {
        await expect(page.locator('#signin')).toHaveAttribute('target', '_blank');
        await page.locator('#recheck-session').click();
        if (switched === 'revoked') {
          await expect(page.locator('#command-fields')).toBeEmpty();
          await expect(page.locator('#recheck-session')).toBeHidden();
        } else if (switched !== 'same') {
          await expect(page.locator('#session-status')).toContainText('Unsaved draft discarded');
          await expect(page.locator('#command-fields')).toBeEmpty();
        } else {
          await expect(page.locator('#context-text')).toHaveValue('Sensitive draft');
          await expect(page.locator('#dialog-status')).toContainText('lead access checked');
          await expect(page.locator('#context')).toContainText('Version: 8');
          await expect(page.locator('#submit-command')).toBeEnabled();
        }
      } else await expect(page.locator('#recheck-session')).toBeHidden();
      expect(writes).toBe(1);
    });
  }
}
