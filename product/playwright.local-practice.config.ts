import { defineConfig, devices } from '@playwright/test';
const target = new URL(process.env.LOCAL_PILOT_ORIGIN || 'invalid:');
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port || target.pathname !== '/') throw new Error('Explicit local loopback pilot origin required');
export default defineConfig({ testDir: './e2e', testMatch: 'local-practice.browser.spec.ts', workers: 1, retries: 0,
  use: { baseURL: target.origin, ...devices['Desktop Chrome'], trace: 'off' } });
