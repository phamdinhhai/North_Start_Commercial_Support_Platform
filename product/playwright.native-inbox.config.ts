import { defineConfig, devices } from '@playwright/test';
import { randomBytes } from 'node:crypto';
process.env.NATIVE_INBOX_E2E = 'true';
process.env.QA_CONTROL_SECRET ??= randomBytes(32).toString('hex');
export default defineConfig({
  testDir: './e2e/oidc', testMatch: 'native-inbox.browser.spec.ts', workers: 1, retries: 0, timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:3410/v1/', ...devices['Desktop Chrome'], trace: 'off' },
  webServer: { command: 'npm run build && node e2e/oidc/server.mjs', url: 'http://127.0.0.1:3410/v1/operator', reuseExistingServer: false, timeout: 120000,
    env: { ...process.env, NATIVE_INBOX_E2E: 'true' } },
});
