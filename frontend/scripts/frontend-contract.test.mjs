import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

test('frontend build contract uses the North Start same-origin base', () => {
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
  assert.match(index, /id=["']root["']/);
  assert.match(vite, /base:\s*["']\/v1\/app\/["']/);
});

test('frontend source retains the protected route and provider boundary', () => {
  assert.ok(existsSync(resolve(root, 'src/App.tsx')));
  const app = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
  const provider = readFileSync(resolve(root, 'src/providers/north-start.tsx'), 'utf8');
  assert.match(app, /SessionProvider/);
  assert.match(app, /CoreAdminContext/);
  assert.match(provider, /credentials:\s*["']same-origin["']/);
  assert.match(provider, /X-CSRF-Token/);
});
