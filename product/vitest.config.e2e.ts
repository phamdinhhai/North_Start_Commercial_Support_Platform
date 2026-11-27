import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

if (process.env.CI === 'true' && !process.env.TEST_DATABASE_URL) {
  throw new Error('CI HTTP integration requires TEST_DATABASE_URL; database tests must not silently skip');
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./vitest.crypto-setup.ts'],
    environment: 'node',
    include: ['e2e/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
