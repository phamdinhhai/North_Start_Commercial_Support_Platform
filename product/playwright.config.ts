import { defineConfig, devices } from '@playwright/test';

/** Controlled browser lane: the app uses only synthetic in-memory state and unsigned test tokens. */
export default defineConfig({
  testDir: './e2e/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100/v1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run start',
    cwd: '.',
    url: 'http://127.0.0.1:3100/v1/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: '3100',
      DEPLOYMENT_MODE: 'test',
      NODE_ENV: 'test',
      PILOT_STORE_MODE: 'memory',
      AUTH_DEV_UNSIGNED_TOKENS: 'true',
      DEMO_WORKSPACES: 'false',
    },
  },
});
