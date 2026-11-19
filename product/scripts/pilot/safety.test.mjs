import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, connection, cleanEnvironment } from './safety.mjs';
test('customer/shared path inputs are refused before reading', () => {
  for (const value of ['postgres://customer/db', 'C:/customer/manifest.json', './manifest.json', '/tmp/shared/manifest.json'])
    assert.throws(() => validateManifest(value), /owned OS-temp/);
});
test('connection cannot select arbitrary databases or remote hosts', () => {
  const m = { database: 'pilot_fixture', role: 'fixture', password: 'opaque', pgPort: 55555 };
  assert.throws(() => connection(m, true, 'customers'), /Arbitrary/);
  assert.equal(new URL(connection(m)).hostname, '127.0.0.1');
});
test('inherited deployment and provider secrets are not forwarded', () => {
  process.env.DATABASE_URL = 'customer'; process.env.AUTH_MODE = 'legacy'; process.env.PANCAKE_TOKEN = 'secret';
  const env = cleanEnvironment();
  assert.equal(env.DATABASE_URL, undefined); assert.equal(env.AUTH_MODE, undefined); assert.equal(env.PANCAKE_TOKEN, undefined);
});
