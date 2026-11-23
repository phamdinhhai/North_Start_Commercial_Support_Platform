// Deterministic, versioned packaging of the MV3 research companion.
// Usage: node scripts/companion-package.mjs [--out <dir>]   (default dist/companion)
// Output: north-star-companion-<version>.zip + .package.json (file SHA-256 list, zip hash, permission/privacy summary).
// Refuses broad host access, manifest "key", remote/unsafe CSP, stray secrets and unreachable/missing files.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import process from 'node:process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SOURCE = resolve(ROOT, 'src/adapters/browser-companion');
const BROAD = /^(?:<all_urls>|\*:\/\/\*\/\*|https?:\/\/\*\/\*|\*:\/\/\*.*)$/;
const ANY_HOST = /^[a-z*]+:\/\/\*(?:\/|$)/;
const ALLOWED_EXTENSIONS = /\.(?:mjs|js|html|json|css|png|svg)$/;
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private-key-block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'aws-access-key'],
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/, 'api-key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'jwt'],
  [/(?:api[_-]?key|secret|password|passwd|bearer|token)["']?\s*[:=]\s*["'][A-Za-z0-9+/_.-]{16,}["']/i, 'credential-literal'],
];
// Human-readable justification for each permission the extension may hold. Unknown permissions refuse packaging.
const PERMISSION_PURPOSE = {
  activeTab: 'Temporary access to the tab the user is on when the popup is opened; no standing tab access.',
  debugger: 'Attach the Chrome DevTools protocol to the one tab the user explicitly starts capture on, to read websocket frame metadata.',
  storage: 'Local outbox, enrollment and lifecycle state; restricted to trusted extension contexts.',
};

export function inspectManifest(manifest) {
  const problems = [];
  if (manifest.manifest_version !== 3) problems.push('manifest_version must be 3');
  if (typeof manifest.version !== 'string' || !/^\d+(?:\.\d+){0,3}$/.test(manifest.version)) problems.push('invalid version');
  for (const field of ['key', 'oauth2', 'update_url']) if (Object.hasOwn(manifest, field)) problems.push(`manifest contains "${field}"`);
  const required = manifest.host_permissions ?? [];
  for (const pattern of required) if (BROAD.test(pattern) || ANY_HOST.test(pattern)) problems.push(`broad required host permission ${pattern}`);
  for (const pattern of manifest.optional_host_permissions ?? []) {
    if (pattern === '<all_urls>' || /^\*:\/\//.test(pattern) || /^http:/.test(pattern)) problems.push(`broad optional host permission ${pattern}`);
  }
  for (const script of manifest.content_scripts ?? []) for (const pattern of script.matches ?? []) if (BROAD.test(pattern) || ANY_HOST.test(pattern)) problems.push(`broad content script match ${pattern}`);
  for (const pattern of manifest.externally_connectable?.matches ?? []) if (BROAD.test(pattern) || ANY_HOST.test(pattern)) problems.push(`broad externally_connectable ${pattern}`);
  for (const resource of manifest.web_accessible_resources ?? []) for (const pattern of resource.matches ?? []) if (BROAD.test(pattern) || ANY_HOST.test(pattern)) problems.push(`broad web_accessible_resources ${pattern}`);
  for (const permission of manifest.permissions ?? []) {
    if (permission.includes('://') || permission === '<all_urls>') problems.push(`host pattern in permissions ${permission}`);
    else if (!Object.hasOwn(PERMISSION_PURPOSE, permission)) problems.push(`unreviewed permission ${permission}`);
  }
  const csp = manifest.content_security_policy?.extension_pages ?? '';
  if (!/script-src 'self'/.test(csp) || /unsafe-eval|unsafe-inline|https?:/.test(csp)) problems.push('content_security_policy must be script-src \'self\' without remote or unsafe sources');
  return problems;
}

export function scanSecrets(path, text) {
  return SECRET_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, name]) => `${path}: ${name}`);
}

/**
 * Module references of one script: `import x from`, `export … from`, side-effect `import './x'` and literal
 * `import('./x')`. Non-literal dynamic imports and non-relative specifiers are refused (the closure must be static).
 */
export function moduleReferences(path, text) {
  const refs = [];
  const staticForm = /(?:^|[\n;])\s*(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?(['"])([^'"\n]+)\1/g;
  for (const match of text.matchAll(staticForm)) refs.push(match[2]);
  for (const match of text.matchAll(/\bimport\s*\(/g)) {
    const literal = /^import\s*\(\s*(['"])([^'"\n]+)\1\s*\)/.exec(text.slice(match.index));
    if (!literal) throw new Error(`non-literal dynamic import in ${path}`);
    refs.push(literal[2]);
  }
  for (const ref of refs) if (!/^\.\.?\//.test(ref)) throw new Error(`non-relative import ${ref} in ${path}`);
  return refs;
}

/** Packaged set = closure of manifest entry points and their relative module/script references. Tests/specs never ship. */
async function collect(sourceDir, manifest) {
  const pending = ['manifest.json', manifest.background?.service_worker, manifest.action?.default_popup,
    ...Object.values(manifest.icons ?? {}), ...Object.values(manifest.action?.default_icon ?? {})].filter(Boolean);
  const files = new Map();
  while (pending.length) {
    const path = posix.normalize(pending.pop());
    if (files.has(path)) continue;
    if (path.startsWith('..') || posix.isAbsolute(path) || !ALLOWED_EXTENSIONS.test(path) || /\.(?:spec|test)\./.test(path)) throw new Error(`refused file ${path}`);
    let bytes;
    try { bytes = await readFile(resolve(sourceDir, path)); } catch { throw new Error(`missing file ${path}`); }
    // Text is normalized to LF so the hash does not depend on the checkout's core.autocrlf setting.
    const text = /\.(?:png)$/.test(path) ? null : bytes.toString('utf8').replace(/\r\n/g, '\n');
    files.set(path, text === null ? bytes : Buffer.from(text, 'utf8'));
    if (text === null) continue;
    const refs = path.endsWith('.mjs') || path.endsWith('.js') ? moduleReferences(path, text)
      : path.endsWith('.html') ? [...text.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(?!https?:|\/\/)([^"]+)"/g)].map((match) => match[1]) : [];
    for (const ref of refs) pending.push(posix.join(posix.dirname(path), ref));
    if (path.endsWith('.html') && /<script\b[^>]*src="(?:https?:)?\/\//.test(text)) throw new Error(`remote script in ${path}`);
  }
  return [...files].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Stored (uncompressed) zip with fixed 1980-01-01 timestamps and sorted entries: byte-identical for identical input. */
export function buildZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x0021, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0x0021, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function permissionSummary(manifest) {
  return {
    permissions: (manifest.permissions ?? []).map((name) => ({ name, purpose: PERMISSION_PURPOSE[name] })),
    requiredHostPermissions: manifest.host_permissions ?? [],
    optionalHostPermissions: (manifest.optional_host_permissions ?? []).map((pattern) => ({ pattern,
      purpose: 'Declared optional only. At runtime the popup requests exactly one operator-entered HTTPS backend origin after an explicit consent gesture.' })),
    contentScripts: (manifest.content_scripts ?? []).length,
    contentSecurityPolicy: manifest.content_security_policy?.extension_pages ?? null,
  };
}

export const PRIVACY_SUMMARY = Object.freeze([
  'Model A: observes the user\'s own browser session in one explicitly attached Pancake tab (https://pancake.vn, https://app.pancake.vn).',
  'Never reads or exports cookies, websocket credentials, message bodies or unknown payload fields; observations are allowlisted metadata only.',
  'ADR-009: no digest derived from message or frame content is computed or sent; content digests are keyed per workspace on the server only.',
  'Local scope labels authorize nothing; upload requires a server-issued enrollment and an explicit per-origin permission grant.',
  'Upload happens only on explicit user click; there is no alarm, background sync or automatic conflict retry.',
  'Schema drift is recorded as structural fingerprints only (hash of key/type skeleton), never values.',
  'Exports are redacted: no token, pending request internals or socket request identifiers.',
  'Authenticity, completeness and continuity remain UNKNOWN; delivery ACK does not prove provider completeness.',
]);

export async function packageCompanion({ sourceDir = DEFAULT_SOURCE, outDir = resolve(ROOT, 'dist/companion') } = {}) {
  let manifest;
  try { manifest = JSON.parse(await readFile(resolve(sourceDir, 'manifest.json'), 'utf8')); } catch { throw new Error('manifest.json missing or invalid'); }
  const problems = inspectManifest(manifest);
  const entries = problems.length ? [] : await collect(sourceDir, manifest);
  for (const [path, bytes] of entries) problems.push(...scanSecrets(path, bytes.toString('utf8')));
  if (problems.length) throw Object.assign(new Error(`companion packaging refused: ${problems.join('; ')}`), { problems });
  const zip = buildZip(entries);
  const base = `north-star-companion-${manifest.version}`;
  const descriptor = {
    name: manifest.name, version: manifest.version, manifestVersion: manifest.manifest_version,
    files: entries.map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha256(bytes) })),
    zip: { file: `${base}.zip`, bytes: zip.length, sha256: sha256(zip) },
    permissions: permissionSummary(manifest), privacy: PRIVACY_SUMMARY,
    distribution: 'Unpacked research build for developer-mode loading; not store-signed.',
  };
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, `${base}.zip`), zip);
  await writeFile(resolve(outDir, `${base}.package.json`), JSON.stringify(descriptor, null, 2) + '\n');
  return descriptor;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const outIndex = process.argv.indexOf('--out');
  try {
    const descriptor = await packageCompanion(outIndex > 0 ? { outDir: resolve(process.argv[outIndex + 1]) } : {});
    console.log(JSON.stringify({ version: descriptor.version, zip: descriptor.zip, files: descriptor.files.length }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
