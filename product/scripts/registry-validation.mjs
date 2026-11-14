import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DEFAULT_REGISTRY_ROOT = resolve(ROOT, '..', 'docs', 'research', 'registries');
const DEFAULT_DOCS_ROOT = resolve(ROOT, '..', 'docs');
const FILES = ['decision-register.json', 'evidence-capability-register.json', 'reusable-engineering-assets.json'];
const STATES = new Set(['DISCOVERED', 'DOCUMENTED', 'CONTRACT_TESTED', 'LIVE_VERIFIED', 'RELEASE_APPROVED', 'UNKNOWN', 'PARTIAL', 'FLAG_OFF', 'REFERENCE', 'ADAPT', 'ADOPT', 'REJECT', 'OPEN']);
const MATURITY_FIELDS = ['documented_state', 'contract_tested', 'live_state', 'release_state'];
const GOOGLE_REFERENCE = 'https://developers.google.com/data-manager/api/reference';
const GOOGLE_SKILLS = [
  'https://github.com/google/skills',
  'https://github.com/google/skills/tree/main/skills/ads/data-manager-api-setup',
  'https://github.com/google/skills/tree/main/skills/ads/data-manager-api-event-ingestion',
  'https://github.com/google/skills/tree/main/skills/ads/data-manager-api-audience-ingestion',
];
const MONITORED_REPORT_PATHS = [
  'reports/phase4-third-party-provider-readiness.md',
  'reports/decision-demand-2026-11-13/execution-summary.md',
  'reports/decision-demand-2026-11-13/research/ads-data-manager-report.md',
  'reports/decision-demand-2026-11-13/research/connector-agent-skills-evaluation.md',
  'reports/decision-demand-2026-11-13/research/omnichannel-oss-report.md',
  'reports/decision-demand-2026-11-13/research/crm-domain-integration-report.md',
  'reports/decision-demand-2026-11-13/research/vietnam-ecosystem-legitimacy-report.md',
  'reports/decision-demand-2026-11-13/research/wp4-p1-02-shortlist-source-matrix.md',
  'reports/decision-demand-2026-11-13/research/synthetic-spike.md',
];
const STALE_TAXONOMY_PATTERNS = [
  /Anthropic\s+Data\s+Manager/i,
  /Anthropic\s+Ads/i,
  /anthropic\.data-manager/i,
  /developers\.anthropic\.com/i,
  /github\.com\/anthropic\/skills\/tree\/main\/skills\/ads\/data-manager/i,
];
const ALLOWED_ACCESS_STATUSES = new Set(['UNAVAILABLE', 'HTTP_200_VERIFIED']);
const secret = /(bearer\s+[A-Za-z0-9._~-]{12,}|(?:api[_-]?key|password|secret|cookie|private[_-]?key)\s*[:=]\s*\S+|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,})/i;

export class RegistryValidationError extends Error {
  constructor(message) { super(`REGISTRY_INVALID: ${message}`); this.name = 'RegistryValidationError'; }
}
function fail(message) { throw new RegistryValidationError(message); }
function load(registryRoot, file) {
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
function validateCapability(row) {
  for (const field of MATURITY_FIELDS) {
    if (!(field in row) || typeof row[field] !== 'string' || !STATES.has(row[field])) fail(`capability ${row.id}: invalid ${field}`);
  }
  if (!row.evidence || !row.last_documented) fail(`capability ${row.id}: missing evidence/date`);
  if (row.contract_tested === 'CONTRACT_TESTED' && row.contract_tested_evidence === undefined) fail(`capability ${row.id}: missing contract evidence`);
  if (row.live_state === 'LIVE_VERIFIED' && !row.live_evidence) fail(`capability ${row.id}: missing live evidence`);
  if (row.release_state === 'RELEASE_APPROVED' && !row.release_evidence) fail(`capability ${row.id}: missing release evidence`);
}
function validateGoogleCapability(row) {
  const text = JSON.stringify(row);
  if (!text.includes('google.data-manager') || row.provider !== 'Google Ads / Google Data Manager') fail('Google Data Manager capability taxonomy drift');
  for (const pattern of STALE_TAXONOMY_PATTERNS) {
    if (pattern.test(text)) fail('stale Anthropic Data Manager taxonomy');
  }
  if (row.source_url !== GOOGLE_REFERENCE) fail('Google Data Manager: incorrect reference URL');
  if (!ALLOWED_ACCESS_STATUSES.has(row.access_status)) fail('Google Data Manager: invalid access_status');
  if (!row.retrieval_timestamp || Number.isNaN(Date.parse(row.retrieval_timestamp))) fail('Google Data Manager: missing retrieval timestamp');
  const fields = row.field_evidence;
  if (!fields || fields.api_version !== 'v1.9' || fields.source_date !== '2026-11-04') fail('Google Data Manager: missing version/date evidence');
  for (const field of ['Event.call_info', 'AdIdentifiers.lead_id', 'record_indices']) if (!fields.fields?.includes(field)) fail(`Google Data Manager: missing field evidence ${field}`);
  for (const url of [GOOGLE_REFERENCE, ...GOOGLE_SKILLS]) if (!fields.source_urls?.includes(url)) fail(`Google Data Manager: missing source evidence ${url}`);
  if (row.documented_state !== 'DOCUMENTED' || row.contract_tested !== 'UNKNOWN' || row.live_state !== 'UNKNOWN' || row.release_state !== 'UNKNOWN') fail('Google Data Manager: maturity states overclaim unverified runtime readiness');
}
function validateReports(docsRoot) {
  for (const rel of MONITORED_REPORT_PATHS) {
    const full = resolve(docsRoot, rel);
    let content;
    try { content = readFileSync(full, 'utf8'); } catch { continue; }
    for (const pattern of STALE_TAXONOMY_PATTERNS) {
      if (pattern.test(content)) fail(`${rel}: stale Data Manager taxonomy reference (${pattern})`);
    }
    if (rel.includes('research/') && /https:\/\/github\.com\/search\?/i.test(content)) {
      fail(`${rel}: GitHub search URL must not substitute for canonical repository URL`);
    }
  }
}
export function validateRegistries(registryRoot = DEFAULT_REGISTRY_ROOT, docsRoot = DEFAULT_DOCS_ROOT) {
  const [decisions, capabilities, assets] = FILES.map((file) => load(registryRoot, file));
  for (const [name, registry] of [['decision', decisions], ['capability', capabilities], ['assets', assets]]) {
    if (!registry.schema || !registry.registry_status || !registry.as_of) fail(`${name}: missing schema/status/date`);
    walk(registry, name);
  }
  unique(decisions.decisions, 'id', 'decisions');
  if ((decisions.decisions ?? []).length !== 7 || decisions.decisions.some((row) => row.status !== 'OPEN')) fail('decisions: all seven canonical decisions must remain OPEN');
  unique(capabilities.capabilities, 'id', 'capabilities');
  if (!capabilities.capabilities.some((row) => row.id === 'google.data-manager.call-conversions')) fail('capabilities: missing google.data-manager.call-conversions');
  unique(assets.assets, 'id', 'assets');
  for (const row of capabilities.capabilities ?? []) {
    validateCapability(row);
    if (row.id === 'google.data-manager.call-conversions') validateGoogleCapability(row);
  }
  for (const row of assets.assets ?? []) if (!row.url || !row.license || !row.verdict || !STATES.has(row.verdict)) fail(`asset ${row.id}: missing source/license/verdict`);
  if (docsRoot) validateReports(docsRoot);
  return { decisions: decisions.decisions.length, capabilities: capabilities.capabilities.length, assets: assets.assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = validateRegistries();
    console.log(`Registry validation: PASS (${result.decisions} decisions, ${result.capabilities} capabilities, ${result.assets} assets)`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
