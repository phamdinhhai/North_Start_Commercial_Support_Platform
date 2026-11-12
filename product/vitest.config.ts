import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// The CI matrix must never silently turn the PostgreSQL suites into skipped suites.
// The integration gate also verifies each discovered integration test actually ran.
if (process.env.CI === 'true' && !process.env.TEST_DATABASE_URL) {
  throw new Error('CI requires TEST_DATABASE_URL for PostgreSQL integration tests');
}

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
      thresholds: {
        lines: 80,
      },
    },
  },
});
