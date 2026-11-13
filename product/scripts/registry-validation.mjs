import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const registryRoot = resolve(root, 'docs', 'research', 'registries');
const files = ['decision-register.json', 'evidence-capability-register.json', 'reusable-engineering-assets.json'];
const statuses = new Set(['DISCOVERED', 'DOCUMENTED', 'CONTRACT_TESTED', 'LIVE_VERIFIED', 'RELEASE_APPROVED', 'UNKNOWN', 'PARTIAL', 'FLAG_OFF', 'REFERENCE', 'ADAPT', 'ADOPT', 'REJECT', 'OPEN']);
const secret = /(bearer\s+[A-Za-z0-9._~-]{12,}|(?:api[_-]?key|password|secret|cookie|private[_-]?key)\s*[:=]\s*\S+|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})/i;

function fail(message) { throw new Error(`REGISTRY_INVALID: ${message}`); }
function load(file) {
  try { return JSON.parse(readFileSync(resolve(registryRoot, file), 'utf8')); }
  catch (error) { fail(`${file}: ${error instanceof Error ? error.message : 'invalid JSON'}`); }
}
function walk(value, path = '') {
  if (typeof value === 'string' && secret.test(value)) fail(`${path}: secret-like text`);
  if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, entry]) => walk(entry, path ? `${path}.${key}` : key));
}
function unique(rows, field, label) {
  const seen = new Set();
  for (const row of rows ?? []) {
    if (!row || typeof row[field] !== 'string' || !row[field]) fail(`${label}: missing ${field}`);
    if (seen.has(row[field])) fail(`${label}: duplicate ${row[field]}`);
    seen.add(row[field]);
  }
}

const [decisions, capabilities, assets] = files.map(load);
for (const [name, registry] of [['decision', decisions], ['capability', capabilities], ['assets', assets]]) {
  if (!registry.schema || !registry.registry_status || !registry.as_of) fail(`${name}: missing schema/status/date`);
  walk(registry, name);
}
unique(decisions.decisions, 'id', 'decisions');
if ((decisions.decisions ?? []).length !== 7 || decisions.decisions.some((row) => row.status !== 'OPEN')) fail('decisions: all seven canonical decisions must remain OPEN');
unique(capabilities.capabilities, 'id', 'capabilities');
unique(assets.assets, 'id', 'assets');
for (const row of capabilities.capabilities ?? []) {
  for (const field of ['documented_state', 'live_state', 'release_state']) if (!statuses.has(row[field])) fail(`capability ${row.id}: invalid ${field}`);
  if (!row.evidence || !row.last_documented) fail(`capability ${row.id}: missing evidence/date`);
}
for (const row of assets.assets ?? []) {
  if (!row.url || !row.license || !row.verdict || !statuses.has(row.verdict)) fail(`asset ${row.id}: missing source/license/verdict`);
}
console.log(`Registry validation: PASS (${decisions.decisions.length} decisions, ${capabilities.capabilities.length} capabilities, ${assets.assets.length} assets)`);
