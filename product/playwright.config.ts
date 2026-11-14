import { defineConfig, devices } from '@playwright/test';

const browserPort = process.env.BROWSER_PORT ?? '3100';
const browserBaseURL = `http://127.0.0.1:${browserPort}`;

/** Controlled browser lane: the app uses only synthetic in-memory state and unsigned test tokens. */
export default defineConfig({
  testDir: './e2e/browser',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `${browserBaseURL}/v1/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run build && npm run start > browser-server.log 2>&1',
    cwd: '.',
    url: `${browserBaseURL}/v1/operator`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      PORT: browserPort,
      DEPLOYMENT_MODE: 'test',
      NODE_ENV: 'test',
      PILOT_STORE_MODE: 'memory',
      AUTH_DEV_UNSIGNED_TOKENS: 'true',
      DEMO_WORKSPACES: 'false',
    },
  },
});
