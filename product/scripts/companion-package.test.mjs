import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { buildZip, crc32, DEFAULT_SOURCE, inspectManifest, packageCompanion, scanSecrets } from './companion-package.mjs';

await mkdir(resolve('.tmp'), { recursive: true });
const temp = await mkdtemp(resolve('.tmp/companion-package-'));
test.after(() => rm(temp, { recursive: true, force: true }));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture(name, mutate) {
  const dir = resolve(temp, name);
  await cp(DEFAULT_SOURCE, dir, { recursive: true });
  const original = await readFile(resolve(dir, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(original);
  await mutate?.(manifest, dir);
  if (JSON.stringify(manifest) !== JSON.stringify(JSON.parse(original))) await writeFile(resolve(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return dir;
}

/** Minimal independent zip reader: walks the central directory and verifies CRC/size of each stored entry. */
function readZip(zip) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50);
    const crc = zip.readUInt32LE(at + 16), size = zip.readUInt32LE(at + 24), nameLength = zip.readUInt16LE(at + 28), offset = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const localName = zip.readUInt16LE(offset + 26);
    const data = zip.subarray(offset + 30 + localName, offset + 30 + localName + size);
    assert.equal(crc32(data), crc, `crc ${name}`);
    entries.set(name, data);
    at += 46 + nameLength;
  }
  return entries;
}

test('packages the companion deterministically with a file hash list and summaries', async () => {
  const first = await packageCompanion({ outDir: resolve(temp, 'out-a') });
  const second = await packageCompanion({ sourceDir: await fixture('copy'), outDir: resolve(temp, 'out-b') });
  assert.equal(first.zip.sha256, second.zip.sha256, 'byte-identical across runs and directories');
  const zip = await readFile(resolve(temp, 'out-a', first.zip.file));
  assert.equal(sha(zip), first.zip.sha256);
  const entries = readZip(zip);
  assert.deepEqual([...entries.keys()], first.files.map((file) => file.path));
  for (const file of first.files) assert.equal(sha(entries.get(file.path)), file.sha256);
  const names = first.files.map((file) => file.path);
  for (const required of ['manifest.json', 'worker.mjs', 'popup.html', 'popup.mjs', 'protocol.mjs', 'upload.mjs', 'lifecycle.mjs', 'drift.mjs', 'popup-view.mjs']) assert.ok(names.includes(required), required);
  assert.ok(names.every((name) => !/\.ts$|spec|test/.test(name)), 'tests and TypeScript never ship');
  assert.equal(first.version, JSON.parse(entries.get('manifest.json')).version);
  assert.deepEqual(first.permissions.permissions.map((item) => item.name).sort(), ['activeTab', 'debugger', 'storage']);
  assert.deepEqual(first.permissions.requiredHostPermissions, []);
  assert.ok(first.privacy.some((line) => /cookies/.test(line)));
  const descriptor = JSON.parse(await readFile(resolve(temp, 'out-a', `north-star-companion-${first.version}.package.json`), 'utf8'));
  assert.deepEqual(descriptor, JSON.parse(JSON.stringify(first)));
  assert.ok(!JSON.stringify(descriptor).match(/\d{4}-\d{2}-\d{2}T/), 'no build timestamp');
});

test('normalizes CRLF so the package hash does not depend on checkout line endings', async () => {
  const dir = await fixture('crlf', async (_manifest, path) => {
    const worker = await readFile(resolve(path, 'worker.mjs'), 'utf8');
    await writeFile(resolve(path, 'worker.mjs'), worker.replace(/\r?\n/g, '\r\n'));
  });
  const base = await packageCompanion({ outDir: resolve(temp, 'out-base') });
  assert.equal((await packageCompanion({ sourceDir: dir, outDir: resolve(temp, 'out-crlf') })).zip.sha256, base.zip.sha256);
});

test('refuses broad host permissions, manifest key and unreviewed permissions', async () => {
  const cases = {
    allUrls: (m) => { m.host_permissions = ['<all_urls>']; },
    anyScheme: (m) => { m.host_permissions = ['*://*/*']; },
    anyHttps: (m) => { m.host_permissions = ['https://*/*']; },
    optionalAll: (m) => { m.optional_host_permissions = ['<all_urls>']; },
    optionalAnyScheme: (m) => { m.optional_host_permissions = ['*://*/*']; },
    contentScripts: (m) => { m.content_scripts = [{ matches: ['<all_urls>'], js: ['worker.mjs'] }]; },
    key: (m) => { m.key = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA'; },
    permission: (m) => { m.permissions.push('cookies'); },
    hostInPermissions: (m) => { m.permissions.push('https://*/*'); },
    csp: (m) => { m.content_security_policy.extension_pages = "script-src 'self' https://cdn.example; object-src 'none'"; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const dir = await fixture(name, mutate);
    await assert.rejects(packageCompanion({ sourceDir: dir, outDir: resolve(temp, 'refused-' + name) }), /companion packaging refused/, name);
    await assert.rejects(readdir(resolve(temp, 'refused-' + name)), name + ' writes nothing');
  }
});

test('refuses embedded secrets and missing referenced files', async () => {
  const secret = await fixture('secret', async (_m, dir) => {
    await writeFile(resolve(dir, 'upload.mjs'), (await readFile(resolve(dir, 'upload.mjs'), 'utf8')) + "\nconst apiKey = 'abcdefghijklmnopqrstuvwx';\n");
  });
  await assert.rejects(packageCompanion({ sourceDir: secret, outDir: resolve(temp, 'refused-secret') }), /credential-literal/);
  const pem = await fixture('pem', async (_m, dir) => { await writeFile(resolve(dir, 'drift.mjs'), '// -----BEGIN PRIVATE KEY-----\n'); });
  await assert.rejects(packageCompanion({ sourceDir: pem, outDir: resolve(temp, 'refused-pem') }), /private-key-block/);
  const missing = await fixture('missing', async (_m, dir) => { await rm(resolve(dir, 'lifecycle.mjs')); });
  await assert.rejects(packageCompanion({ sourceDir: missing, outDir: resolve(temp, 'refused-missing') }), /missing file lifecycle.mjs/);
  assert.deepEqual(scanSecrets('x', 'token: enrollment.token'), []);
});

test('accepts the shipped manifest and an exact-origin optional permission', () => {
  assert.deepEqual(inspectManifest({ manifest_version: 3, version: '1.0.0', permissions: ['storage'], optional_host_permissions: ['https://*/*'],
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" } }), []);
  assert.equal(buildZip([]).length, 22);
});

test('R2-I-12: follows side-effect and literal dynamic imports, refuses non-literal or bare specifiers', async () => {
  const { moduleReferences } = await import('./companion-package.mjs');
  assert.deepEqual(moduleReferences('a.mjs', "import './side.mjs';\nimport x from './x.mjs';\nexport * from './re.mjs';\nconst m = await import('./lazy.mjs');\nconst s = 'import y';"),
    ['./side.mjs', './x.mjs', './re.mjs', './lazy.mjs']);
  assert.throws(() => moduleReferences('a.mjs', 'const m = await import(name);'), /non-literal dynamic import/);
  assert.throws(() => moduleReferences('a.mjs', "import 'lodash';"), /non-relative import lodash/);
  const sideEffect = await fixture('side-effect', async (_m, dir) => {
    await writeFile(resolve(dir, 'drift.mjs'), (await readFile(resolve(dir, 'drift.mjs'), 'utf8')) + "\nimport './extra.mjs';\n");
    await writeFile(resolve(dir, 'extra.mjs'), 'export const extra = 1;\n');
  });
  assert.ok((await packageCompanion({ sourceDir: sideEffect, outDir: resolve(temp, 'out-side') })).files.some((file) => file.path === 'extra.mjs'));
  const missingSide = await fixture('missing-side', async (_m, dir) => {
    await writeFile(resolve(dir, 'drift.mjs'), (await readFile(resolve(dir, 'drift.mjs'), 'utf8')) + "\nimport './absent.mjs';\n");
  });
  await assert.rejects(packageCompanion({ sourceDir: missingSide, outDir: resolve(temp, 'refused-side') }), /missing file absent.mjs/);
  const dynamic = await fixture('dynamic', async (_m, dir) => {
    await writeFile(resolve(dir, 'drift.mjs'), (await readFile(resolve(dir, 'drift.mjs'), 'utf8')) + '\nexport const load = (name) => import(name);\n');
  });
  await assert.rejects(packageCompanion({ sourceDir: dynamic, outDir: resolve(temp, 'refused-dynamic') }), /non-literal dynamic import in drift.mjs/);
});

test('ADR-009: the shipped decoder computes and sends no body-derived digest', async () => {
  const result = await packageCompanion({ outDir: resolve(temp, 'out-adr009') });
  const entries = readZip(await readFile(resolve(temp, 'out-adr009', result.zip.file)));
  for (const name of ['protocol.mjs', 'upload.mjs', 'worker.mjs']) assert.doesNotMatch(entries.get(name).toString('utf8'), /payloadHash/, name);
  assert.doesNotMatch(entries.get('protocol.mjs').toString('utf8'), /crypto\.subtle/);
  assert.ok(result.privacy.some((line) => /ADR-009/.test(line) && /keyed per workspace on the server/.test(line)));
  assert.ok(!result.privacy.some((line) => /SHA-256 payload hash/i.test(line)));
});
