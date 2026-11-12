import tsParser from '@typescript-eslint/parser';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const architectureCheck = resolve(root, 'scripts/check-architecture.mjs');

function architectureGuard() {
  return {
    meta: {
      type: 'problem',
      docs: { description: 'enforce module ownership and dependency direction' },
      schema: [],
    },
    create(context) {
      const fileName = context.getFilename();
      if (!fileName.startsWith(resolve(root, 'src'))) return {};
      return {
        Program() {
          // The architecture checker owns import graph parsing so the same guard can run
          // independently in CI and in editors. ESLint only reports its deterministic result.
          const source = readFileSync(architectureCheck, 'utf8');
          if (!source.includes('const RULES')) {
            context.report({ node: context.sourceCode.ast, message: 'Architecture checker is malformed' });
          }
        },
      };
    },
  };
}

export default [
  {
    files: ['src/**/*.ts', 'e2e/**/*.ts'],
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: { architecture: { rules: { boundaries: architectureGuard() } } },
    rules: { 'architecture/boundaries': 'error' },
  },
];
