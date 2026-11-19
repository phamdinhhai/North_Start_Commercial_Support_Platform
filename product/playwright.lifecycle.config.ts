import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
// Playwright loads config in workers too; reuse the runner's ephemeral fixture key.
process.env.QA_LIFECYCLE_BOOTSTRAP_TOKEN ??= randomBytes(32).toString('hex');
process.env.BOOTSTRAP_TOKEN = process.env.QA_LIFECYCLE_BOOTSTRAP_TOKEN;
export default defineConfig({
  testDir: './e2e/lifecycle',
  testMatch: 'lifecycle.browser.spec.ts',
  use: { baseURL: 'http://127.0.0.1:3116/v1/' },
  webServer: { command: 'npm run build && npm run start', timeout: 120000, reuseExistingServer: false,
    url: 'http://127.0.0.1:3116/v1/operator', env: { ...process.env, PORT: '3116', DEPLOYMENT_MODE: 'test', NODE_ENV: 'test',
    AUTH_MODE: 'legacy', OIDC_BROWSER_ENABLED: 'false', ASSERTION_DELIVERY_ENABLED: 'false',
    PILOT_STORE_MODE: 'memory', AUTH_DEV_UNSIGNED_TOKENS: 'true', DEMO_WORKSPACES: 'false' } },
});
