import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, connection, cleanEnvironment, assertOwnedServer } from './safety.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
test('customer/shared path inputs are refused before reading', () => {
  for (const value of ['postgres://customer/db', 'C:/customer/manifest.json', './manifest.json', '/tmp/shared/manifest.json'])
    assert.throws(() => validateManifest(value), /owned OS-temp/);
});
test('manifest role, port and data-directory tampering fail before connection', () => {
  const id = randomBytes(16).toString('hex'), home = join(tmpdir(), `north-synthetic-pilot-${id}`), data = join(home, 'data');
  mkdirSync(data, { recursive: true });
  writeFileSync(join(data, 'postgresql.auto.conf'), "listen_addresses='127.0.0.1'\nport=55555\n");
  const workspace = `synthetic-${id}`;
  const original = { kind: 'LOCAL_SYNTHETIC_ONLY_V1', id, data, database: `pilot_${id}`, role: `pilot_${id}`, password: 'a'.repeat(64), adminPassword: 'b'.repeat(64), control: 'c'.repeat(64), workspace,
    pgPort: 55555, appPort: 55556, idpPort: 55557, controlPort: 55558,
    digestKeys: [workspace, `${workspace}-foreign`].map(workspaceId => ({ workspaceId, activeKid: 'local-v1', keys: [{ kid: 'local-v1', secretBase64: randomBytes(32).toString('base64') }] })) };
  const file = join(home, 'manifest.json');
  writeFileSync(file, JSON.stringify(original)); assert.equal(validateManifest(file).role, original.role);
  for (const patch of [{ role: `pilot_${'0'.repeat(32)}` }, { pgPort: 55559 }, { data: join(home, 'foreign') }]) {
    writeFileSync(file, JSON.stringify({ ...original, ...patch })); assert.throws(() => validateManifest(file));
  }
});
test('server identity requires actual data directory, port and loopback bind', async () => {
  const data = tmpdir(), m = { data, pgPort: 55555 };
  const original = { data, port: '55555', hosts: '127.0.0.1', address: '127.0.0.1/32' };
  await assertOwnedServer({ query: async () => ({ rows: [original] }) }, m);
  for (const patch of [{ data: process.cwd() }, { port: '5432' }, { hosts: '*' }, { address: '10.0.0.1/32' }])
    await assert.rejects(assertOwnedServer({ query: async () => ({ rows: [{ ...original, ...patch }] }) }, m), /server mismatch/);
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
