import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { afterEach, test } from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateRegistries, RegistryValidationError } from './registry-validation.mjs';

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
function invalid(root, pattern) {
  assert.throws(() => validateRegistries(root), (error) => error instanceof RegistryValidationError && pattern.test(error.message));
}
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

test('accepts current Google taxonomy with explicit unavailable evidence', async () => {
  const root = await fixture();
  const result = validateRegistries(root);
  assert.deepEqual(result, { decisions: 7, capabilities: 6, assets: 12 });
});

test('rejects duplicate IDs', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => { x.capabilities.push({ ...x.capabilities[0] }); }));
  invalid(root, /duplicate/);
});

test('rejects invalid maturity states', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => { x.capabilities[0].live_state = 'VERIFIED'; }));
  invalid(root, /invalid live_state/);
});

test('rejects stale Anthropic taxonomy', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => { x.capabilities[0].provider = 'Anthropic Data Manager / Anthropic Ads'; }));
  invalid(root, /taxonomy drift/);
});

test('rejects missing retrieval timestamp and field evidence', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => {
    delete x.capabilities[0].retrieval_timestamp;
    x.capabilities[0].field_evidence.fields = ['Event.call_info'];
  }));
  invalid(root, /retrieval timestamp/);
});

test('rejects missing evidence and timestamp when timestamp is retained', async () => {
  const root = await fixture((r) => update(r, 'evidence-capability-register.json', (x) => {
    x.capabilities[0].field_evidence.fields = ['Event.call_info'];
    delete x.capabilities[0].field_evidence.source_urls;
  }));
  invalid(root, /field evidence AdIdentifiers.lead_id/);
});

test('rejects secret-like text anywhere in registries', async () => {
  const root = await fixture((r) => update(r, 'reusable-engineering-assets.json', (x) => { x.assets[0].constraints.push('api_key=sk-abcdefghijklmnopqrstuvwxyz'); }));
  invalid(root, /secret-like text/);
});
