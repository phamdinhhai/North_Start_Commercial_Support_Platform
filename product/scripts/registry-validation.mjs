import { existsSync, readFileSync } from 'node:fs';
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

// ---- Consolidated registries (docs/research/registry-2026-11-18) ----
const DEFAULT_CONSOLIDATED_ROOT = resolve(ROOT, '..', 'docs', 'research', 'registry-2026-11-18');
const DEFAULT_REPO_ROOT = resolve(ROOT, '..');
const DEFAULT_PACKAGE_JSON = resolve(ROOT, 'package.json');
export const CONSOLIDATED_FILES = ['provider-capability-registry.json', 'protocol-evidence-registry.json', 'github-research-matrix.json', 'reusable-assets-registry.json', 'decision-register.json'];
const LEVELS = ['README_CLAIM', 'SOURCE_INSPECTED', 'DOCUMENTED_API', 'SYNTHETIC_TESTED', 'CONTRACT_TESTED', 'LIVE_VERIFIED', 'RELEASE_APPROVED'];
const ACCESS = new Set(['OFFICIAL_API', 'OFFICIAL_EMBEDDED_APP_RUNTIME', 'OBSERVED_INTERNAL_PROTOCOL', 'COMMUNITY_REVERSE_ENGINEERED', 'FIRST_PARTY_BROWSER_OBSERVATION']);
const UNLICENSED = new Set(['OBSERVED_INTERNAL_PROTOCOL', 'COMMUNITY_REVERSE_ENGINEERED']);
const DELIVERY = new Set(['push', 'poll', 'request-response', 'stream', 'batch-upload', 'not-available']);
const READINESS = { none: 'README_CLAIM', synthetic: 'SYNTHETIC_TESTED', contract: 'CONTRACT_TESTED', sandbox: 'LIVE_VERIFIED' };
const VERDICTS = new Set(['ADOPT', 'ADAPT', 'REFERENCE', 'REJECT']);
const ASSET_DECISIONS = new Set([...VERDICTS, 'DEFER']);
const PROPOSAL_STATUSES = new Set(['PROPOSED', 'DRAFT', 'UNDER_REVIEW', 'REJECTED', 'WITHDRAWN']);
const FORBIDDEN_DECISION_STATES = new Set(['ACCEPTED', 'APPROVED', 'RESOLVED', 'CLOSED']);
const CANONICAL_OPEN = ['CE-1', 'CE-2', 'MM-1', 'ID-1', 'ID-2', 'PM-1', 'LG-1'];
const NIA = 'NOT_INDEPENDENTLY_AUDITED';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA64 = /^[0-9a-f]{64}$/;
const UNTRACKED_PREFIX = 'untracked-primary-worktree:';
const rank = (level) => LEVELS.indexOf(level);

function requireFields(row, fields, label) {
  for (const field of fields) {
    const value = row?.[field];
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && field !== 'inspected_paths' && field !== 'identity_fields' && value.length === 0)) fail(`${label}: missing ${field}`);
  }
}
function checkRefs(refs, label, repoRoot) {
  if (!Array.isArray(refs)) fail(`${label}: artifact_refs must be an array`);
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref) fail(`${label}: empty artifact ref`);
    if (ref.startsWith('https://') || ref.startsWith(UNTRACKED_PREFIX)) continue;
    if (!/^(docs|product)\//.test(ref)) fail(`${label}: artifact ref must be https URL or repo path: ${ref}`);
    if (ref.includes('..')) fail(`${label}: artifact ref traversal: ${ref}`);
    if (repoRoot && !existsSync(resolve(repoRoot, ref.split('#')[0]))) fail(`${label}: artifact ref not found: ${ref}`);
  }
}
function checkEvidence(row, label, repoRoot) {
  if (!LEVELS.includes(row.evidence_level)) fail(`${label}: invalid evidence_level ${row.evidence_level}`);
  if (row.evidence_level !== 'README_CLAIM' && (!Array.isArray(row.artifact_refs) || row.artifact_refs.length === 0)) fail(`${label}: ${row.evidence_level} requires artifact_refs`);
  if (row.artifact_refs !== undefined) checkRefs(row.artifact_refs, label, repoRoot);
}
function checkStaleTaxonomy(registry, name) {
  const text = JSON.stringify(registry);
  for (const pattern of STALE_TAXONOMY_PATTERNS) if (pattern.test(text)) fail(`${name}: stale Data Manager taxonomy (${pattern})`);
}
function packageNames(packageJsonPath) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

function validateProviders(reg, repoRoot) {
  unique(reg.capabilities, 'id', 'provider capabilities');
  for (const row of reg.capabilities ?? []) {
    const label = `provider ${row.id}`;
    requireFields(row, ['provider', 'product', 'surface', 'capability', 'access_class', 'transport', 'delivery_model', 'auth_model', 'permissions_required', 'approval_required', 'event_coverage', 'identity_fields', 'recovery_replay', 'evidence_level', 'unknowns', 'runtime_readiness', 'production_approval'], label);
    checkEvidence(row, label, repoRoot);
    if (!ACCESS.has(row.access_class)) fail(`${label}: invalid access_class`);
    if (!DELIVERY.has(row.delivery_model)) fail(`${label}: invalid delivery_model`);
    if (UNLICENSED.has(row.access_class) && row.licensed_api !== false) fail(`${label}: observed/reverse-engineered protocol cannot be a licensed API`);
    if (!(row.runtime_readiness in READINESS)) fail(`${label}: invalid runtime_readiness`);
    if (rank(row.evidence_level) < rank(READINESS[row.runtime_readiness])) fail(`${label}: runtime_readiness ${row.runtime_readiness} exceeds evidence_level`);
    if (row.production_approval !== 'NOT_APPROVED') {
      if (!row.production_approval_artifact) fail(`${label}: production approval without artifact`);
      checkRefs([row.production_approval_artifact], label, repoRoot);
    }
    if (row.evidence_level === 'RELEASE_APPROVED' && !row.release_approval_artifact) fail(`${label}: RELEASE_APPROVED without release_approval_artifact`);
    if (rank(row.evidence_level) >= rank('LIVE_VERIFIED') && (!row.live_evidence || row.live_evidence.audit === NIA)) fail(`${label}: LIVE_VERIFIED requires independently audited live_evidence`);
    if (row.live_observation && row.live_observation.audit !== NIA && !row.live_observation.audit_artifact) fail(`${label}: live_observation audit claim without audit_artifact`);
    if (/change\s*status|changeevent/i.test(`${row.id} ${row.capability}`) && row.delivery_model !== 'poll') fail(`${label}: Google Ads ChangeStatus is polled, not push`);
    if (row.surface === 'GOOGLE_DATA_MANAGER_API' && row.provider !== 'Google') fail(`${label}: Google Data Manager must be attributed to Google`);
  }
  return (reg.capabilities ?? []).length;
}

function validateProtocol(reg, repoRoot) {
  unique(reg.entries, 'id', 'protocol evidence');
  for (const row of reg.entries ?? []) {
    const label = `protocol ${row.id}`;
    requireFields(row, ['kind', 'subject', 'revision_or_digest', 'audit_status', 'evidence_level', 'limitations'], label);
    checkEvidence(row, label, repoRoot);
    if (!['CAPTURE', 'FINGERPRINT', 'SOURCE_REVISION', 'DOCUMENT_SNAPSHOT'].includes(row.kind)) fail(`${label}: invalid kind`);
    if ((row.private_capture || row.derived_from_private_capture) && row.audit_status !== NIA) fail(`${label}: private capture must be ${NIA}`);
    if (row.private_capture && rank(row.evidence_level) >= rank('CONTRACT_TESTED')) fail(`${label}: private capture cannot carry ${row.evidence_level}`);
    const digest = row.revision_or_digest;
    if (digest.type === 'git_sha' && !SHA40.test(digest.value)) fail(`${label}: git_sha must be 40-hex`);
    if (digest.type === 'sha256' && !SHA64.test(digest.value)) fail(`${label}: sha256 must be 64-hex`);
    for (const file of row.file_digest_reverification ?? []) if (!SHA64.test(file.raw_blob_sha256_2026_11_18 ?? '')) fail(`${label}: invalid re-verified digest`);
  }
  for (const value of Object.values(reg.committed_sanitized_artifact_digests?.files ?? {})) if (!SHA64.test(value)) fail('protocol: invalid committed artifact digest');
  return (reg.entries ?? []).length;
}

function validateGithub(reg, repoRoot, deps) {
  const rows = reg.research_recommendations ?? [];
  unique(rows, 'id', 'github matrix');
  const listed = (reg.approved_dependencies?.packages ?? []).map((p) => p.name).sort();
  if (JSON.stringify(listed) !== JSON.stringify(Object.keys(deps).sort())) fail('github matrix: approved_dependencies must mirror product/package.json exactly');
  for (const row of rows) {
    const label = `github ${row.id}`;
    requireFields(row, ['url', 'owner', 'pinned_sha', 'license', 'implemented_capability', 'verdict', 'verdict_reason', 'evidence_level'], label);
    checkEvidence(row, label, repoRoot);
    if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+$/.test(row.url)) fail(`${label}: url must be a canonical repository URL`);
    if (row.pinned_sha !== 'UNVERIFIED' && !SHA40.test(row.pinned_sha)) fail(`${label}: pinned_sha must be 40-hex or UNVERIFIED`);
    if (row.pinned_sha !== 'UNVERIFIED' && !/^(GITHUB_API_COMMIT_LOOKUP|GIT_LS_REMOTE_HEAD)_\d{4}-\d{2}-\d{2}$/.test(row.sha_verification ?? '')) fail(`${label}: pinned_sha requires recorded verification method`);
    for (const prior of row.prior_pins ?? []) if (!SHA40.test(prior.sha)) fail(`${label}: prior pin must be 40-hex`);
    if (typeof row.archived !== 'boolean') fail(`${label}: archived must be boolean`);
    if (!VERDICTS.has(row.verdict)) fail(`${label}: invalid verdict`);
    if (row.evidence_level === 'SOURCE_INSPECTED' && (!Array.isArray(row.inspected_paths) || row.inspected_paths.length === 0)) fail(`${label}: SOURCE_INSPECTED requires inspected_paths`);
    if (row.approved_dependency === true && !(row.npm_package in deps)) fail(`${label}: approved_dependency not present in product/package.json`);
  }
  return rows.length;
}

function validateAssets(reg, repoRoot, deps) {
  unique(reg.assets, 'id', 'reusable assets');
  for (const row of reg.assets ?? []) {
    const label = `asset ${row.id}`;
    requireFields(row, ['name', 'category', 'url', 'license', 'adoption_decision', 'rationale', 'architecture_fit', 'evidence_level'], label);
    checkEvidence(row, label, repoRoot);
    if (!ASSET_DECISIONS.has(row.adoption_decision)) fail(`${label}: invalid adoption_decision`);
    if (typeof row.approved_dependency !== 'boolean') fail(`${label}: approved_dependency must be boolean`);
    if (row.approved_dependency && !(row.npm_package in deps)) fail(`${label}: approved_dependency not present in product/package.json`);
  }
  return (reg.assets ?? []).length;
}

function findForbiddenStatus(value, path = 'decision-register') {
  if (Array.isArray(value)) value.forEach((entry, index) => findForbiddenStatus(entry, `${path}[${index}]`));
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (/status|state/i.test(key) && typeof entry === 'string' && FORBIDDEN_DECISION_STATES.has(entry.toUpperCase())) fail(`${path}.${key}: ${entry} is not allowed in the research decision register`);
      findForbiddenStatus(entry, `${path}.${key}`);
    }
  }
}

function validateDecisionRegister(reg, repoRoot) {
  findForbiddenStatus(reg);
  unique(reg.decisions, 'id', 'canonical decisions');
  const ids = (reg.decisions ?? []).map((row) => row.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify([...CANONICAL_OPEN].sort())) fail('decision-register: must list exactly CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, LG-1');
  for (const row of reg.decisions) {
    if (row.status !== 'OPEN') fail(`decision ${row.id}: canonical open decision must remain OPEN`);
    if (row.evidence_refs) checkRefs(row.evidence_refs, `decision ${row.id}`, repoRoot);
  }
  unique(reg.proposals, 'id', 'proposals');
  for (const row of reg.proposals ?? []) {
    const label = `proposal ${row.id}`;
    requireFields(row, ['title', 'context', 'alternatives', 'evidence_refs', 'trade_offs', 'recommendation', 'migration_impact', 'owner', 'approval_requirement', 'status'], label);
    if (!PROPOSAL_STATUSES.has(row.status)) fail(`${label}: invalid status ${row.status}`);
    if (!Array.isArray(row.alternatives) || row.alternatives.length < 2) fail(`${label}: at least two alternatives required`);
    for (const id of row.related_open_decisions ?? []) if (!CANONICAL_OPEN.includes(id)) fail(`${label}: unknown open decision ${id}`);
    checkRefs(row.evidence_refs, label, repoRoot);
  }
  return { decisions: reg.decisions.length, proposals: (reg.proposals ?? []).length };
}

export function validateConsolidatedRegistries(root = DEFAULT_CONSOLIDATED_ROOT, { repoRoot = DEFAULT_REPO_ROOT, packageJson = DEFAULT_PACKAGE_JSON } = {}) {
  const [providers, protocol, github, assets, decisions] = CONSOLIDATED_FILES.map((file) => load(root, file));
  CONSOLIDATED_FILES.forEach((file, index) => {
    const registry = [providers, protocol, github, assets, decisions][index];
    if (!registry.schema || !registry.registry_status || !registry.as_of) fail(`${file}: missing schema/status/date`);
    walk(registry, file);
    checkStaleTaxonomy(registry, file);
  });
  const deps = packageNames(packageJson);
  return {
    providerCapabilities: validateProviders(providers, repoRoot),
    protocolEvidence: validateProtocol(protocol, repoRoot),
    githubRepositories: validateGithub(github, repoRoot, deps),
    reusableAssets: validateAssets(assets, repoRoot, deps),
    ...validateDecisionRegister(decisions, repoRoot),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = validateRegistries();
    console.log(`Registry validation: PASS (${result.decisions} decisions, ${result.capabilities} capabilities, ${result.assets} assets)`);
    const consolidated = validateConsolidatedRegistries();
    console.log(`Consolidated registry validation: PASS (${consolidated.providerCapabilities} provider capabilities, ${consolidated.protocolEvidence} protocol evidence, ${consolidated.githubRepositories} GitHub repositories, ${consolidated.reusableAssets} reusable assets, ${consolidated.decisions} open decisions, ${consolidated.proposals} proposals)`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
