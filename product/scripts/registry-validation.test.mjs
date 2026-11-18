import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { afterEach, test } from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateRegistries, validateConsolidatedRegistries, CONSOLIDATED_FILES, RegistryValidationError } from './registry-validation.mjs';

const roots = [];
async function fixture(mutator) {
  const root = await mkdtemp(join(tmpdir(), 'north-registry-'));
  roots.push(root);
  for (const name of ['decision-register.json', 'evidence-capability-register.json', 'reusable-engineering-assets.json']) {
    await cp(new URL(`../../docs/research/registries/${name}`, import.meta.url), join(root, name));
  }
  if (mutator) await mutator(root);
  return root;
}
async function update(root, file, mutate) {
  const path = join(root, file);
  const value = JSON.parse(await readFile(path, 'utf8'));
  mutate(value);
  await writeFile(path, JSON.stringify(value));
}
function invalid(root, pattern, docsRoot = null) {
  assert.throws(() => validateRegistries(root, docsRoot), (error) => error instanceof RegistryValidationError && pattern.test(error.message));
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

test('accepts current Google taxonomy and verified production docs root', async () => {
  const root = await fixture();
  const result = validateRegistries(root);
  assert.deepEqual(result, { decisions: 7, capabilities: 6, assets: 13 });
});

test('rejects duplicate IDs', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => { x.capabilities.push({ ...x.capabilities[0] }); }));
  invalid(root, /duplicate/);
});

test('rejects invalid maturity states', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => { x.capabilities[0].live_state = 'VERIFIED'; }));
  invalid(root, /invalid live_state/);
});

test('rejects stale Anthropic Data Manager taxonomy in registry', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => { x.capabilities[0].provider = 'Anthropic Data Manager / Anthropic Ads'; }));
  invalid(root, /taxonomy drift/);
});

test('rejects stale Data Manager taxonomy and GitHub search URLs in monitored reports', async () => {
  const root = await fixture();
  const docsRoot = await mkdtemp(join(tmpdir(), 'north-docs-'));
  roots.push(docsRoot);
  await mkdir(join(docsRoot, 'reports', 'decision-demand-2026-11-13', 'research'), { recursive: true });
  await writeFile(join(docsRoot, 'reports', 'decision-demand-2026-11-13', 'research', 'ads-data-manager-report.md'), 'Anthropic Data Manager API\n');
  invalid(root, /stale Data Manager taxonomy/, docsRoot);

  await writeFile(join(docsRoot, 'reports', 'decision-demand-2026-11-13', 'research', 'ads-data-manager-report.md'), 'https://github.com/search?q=adport\n');
  invalid(root, /GitHub search URL/, docsRoot);
});

test('rejects missing retrieval timestamp and field evidence', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => {
    delete x.capabilities[0].retrieval_timestamp;
    x.capabilities[0].field_evidence.fields = ['Event.call_info'];
  }));
  invalid(root, /retrieval timestamp/);
});

test('rejects missing field evidence and source URLs when timestamp is retained', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => {
    x.capabilities[0].field_evidence.fields = ['Event.call_info'];
    delete x.capabilities[0].field_evidence.source_urls;
  }));
  invalid(root, /field evidence AdIdentifiers.lead_id/);
});

test('rejects unverified elevation of Google Data Manager runtime readiness', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => {
    x.capabilities[0].live_state = 'LIVE_VERIFIED';
    x.capabilities[0].live_evidence = 'fake';
  }));
  invalid(root, /overclaim unverified runtime readiness/);
});

test('rejects secret-like text anywhere in registries', async () => {
  const syntheticSecret = ['api_key=sk', 'abcdefghijklmnopqrstuvwxyz'].join('-');
  const root = await fixture((r) => update(r, 'reusable-engineering-assets.json', (x) => { x.assets[0].constraints.push(syntheticSecret); }));
  invalid(root, /secret-like text/);
});

// ---- Consolidated registries (docs/research/registry-2026-11-18) ----
const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL('../package.json', import.meta.url));
const OPTIONS = { repoRoot: REPO_ROOT, packageJson: PACKAGE_JSON };
async function consolidated(mutator) {
  const root = await mkdtemp(join(tmpdir(), 'north-consolidated-'));
  roots.push(root);
  for (const name of CONSOLIDATED_FILES) await cp(new URL(`../../docs/research/registry-2026-11-18/${name}`, import.meta.url), join(root, name));
  if (mutator) await mutator(root);
  return root;
}
function invalidConsolidated(root, pattern) {
  assert.throws(() => validateConsolidatedRegistries(root, OPTIONS), (error) => error instanceof RegistryValidationError && pattern.test(error.message));
}

test('accepts the consolidated 2026-11-18 registries', async () => {
  const result = validateConsolidatedRegistries(await consolidated(), OPTIONS);
  assert.equal(result.decisions, 7);
  assert.ok(result.providerCapabilities > 0 && result.protocolEvidence > 0 && result.githubRepositories > 0 && result.reusableAssets > 0 && result.proposals > 0);
});

test('rejects evidence levels outside the allowed enum', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => { x.capabilities[0].evidence_level = 'LIVE_OBSERVED'; })), /invalid evidence_level/);
});

test('rejects non-README_CLAIM entries without artifacts and missing repository paths', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'github-research-matrix.json', (x) => {
    x.research_recommendations.find((e) => e.evidence_level === 'SOURCE_INSPECTED').artifact_refs = [];
  })), /requires artifact_refs/);
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => {
    x.capabilities[0].artifact_refs.push('docs/research/does-not-exist.json');
  })), /artifact ref not found/);
});

test('rejects ACCEPTED status for canonical open decisions and proposals', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'decision-register.json', (x) => { x.decisions[0].status = 'ACCEPTED'; })), /not allowed in the research decision register/);
  invalidConsolidated(await consolidated((r) => update(r, 'decision-register.json', (x) => { x.proposals[0].status = 'ACCEPTED'; })), /not allowed in the research decision register/);
  invalidConsolidated(await consolidated((r) => update(r, 'decision-register.json', (x) => { x.decisions.pop(); })), /must list exactly/);
});

test('rejects production approval or release level without artifact', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => { x.capabilities[0].production_approval = 'APPROVED'; })), /production approval without artifact/);
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => { x.capabilities[0].evidence_level = 'RELEASE_APPROVED'; })), /RELEASE_APPROVED without release_approval_artifact/);
});

test('rejects LIVE_VERIFIED backed only by unaudited private observation', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => {
    const row = x.capabilities.find((e) => e.live_observation);
    row.evidence_level = 'LIVE_VERIFIED';
    row.live_evidence = { audit: 'NOT_INDEPENDENTLY_AUDITED' };
  })), /independently audited live_evidence/);
});

test('rejects runtime readiness above evidence and licensed internal protocols', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => {
    x.capabilities.find((e) => e.evidence_level === 'DOCUMENTED_API').runtime_readiness = 'contract';
  })), /exceeds evidence_level/);
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => {
    x.capabilities.find((e) => e.access_class === 'OBSERVED_INTERNAL_PROTOCOL').licensed_api = true;
  })), /cannot be a licensed API/);
});

test('rejects Google Ads ChangeStatus modelled as push', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => {
    x.capabilities.find((e) => /change-status/.test(e.id)).delivery_model = 'push';
  })), /polled, not push/);
});

test('rejects private captures not marked NOT_INDEPENDENTLY_AUDITED', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'protocol-evidence-registry.json', (x) => {
    x.entries.find((e) => e.private_capture).audit_status = 'AUDITED';
  })), /private capture must be NOT_INDEPENDENTLY_AUDITED/);
});

test('rejects malformed SHAs but accepts explicit UNVERIFIED', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'github-research-matrix.json', (x) => { x.research_recommendations[0].pinned_sha = 'abc123'; })), /40-hex or UNVERIFIED/);
  const root = await consolidated((r) => update(r, 'github-research-matrix.json', (x) => { x.research_recommendations[0].pinned_sha = 'UNVERIFIED'; }));
  assert.ok(validateConsolidatedRegistries(root, OPTIONS).githubRepositories > 0);
  invalidConsolidated(await consolidated((r) => update(r, 'protocol-evidence-registry.json', (x) => {
    x.entries.find((e) => e.revision_or_digest.type === 'git_sha').revision_or_digest.value = 'deadbeef';
  })), /git_sha must be 40-hex/);
});

test('rejects approved dependencies that are not in product/package.json', async () => {
  invalidConsolidated(await consolidated((r) => update(r, 'reusable-assets-registry.json', (x) => {
    const row = x.assets.find((e) => e.id === 'asset.bullmq');
    row.approved_dependency = true;
    row.npm_package = 'bullmq';
  })), /not present in product\/package.json/);
  invalidConsolidated(await consolidated((r) => update(r, 'github-research-matrix.json', (x) => {
    x.approved_dependencies.packages.push({ name: 'kafkajs', range: '^2.0.0' });
  })), /mirror product\/package.json/);
});

test('rejects secret-like strings and stale taxonomy in consolidated registries', async () => {
  const syntheticSecret = ['api_key=sk', 'abcdefghijklmnopqrstuvwxyz'].join('-');
  invalidConsolidated(await consolidated((r) => update(r, 'protocol-evidence-registry.json', (x) => { x.entries[0].limitations.push(syntheticSecret); })), /secret-like text/);
  invalidConsolidated(await consolidated((r) => update(r, 'provider-capability-registry.json', (x) => { x.capabilities[0].product = 'Anthropic Data Manager'; })), /stale Data Manager taxonomy/);
});
