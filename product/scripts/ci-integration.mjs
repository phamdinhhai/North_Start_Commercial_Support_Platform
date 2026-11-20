import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const productRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredSuites = [
  'src/infra/source-integration/source-intake.integration.spec.ts',
  'src/infra/postgres/pg-manager-exceptions.integration.spec.ts',
  'src/infra/postgres/pilot-resilience.integration.spec.ts',
  'src/infra/data-lifecycle/data-lifecycle.integration.spec.ts',
  'src/infra/postgres/contact-attempt.integration.spec.ts',
  'src/infra/postgres/completion-provenance.integration.spec.ts',
  'src/infra/postgres/lead-access.integration.spec.ts',
  'src/infra/integration/receipts.integration.spec.ts',
  'src/infra/observability/connector-health.integration.spec.ts',
  'src/infra/postgres/postgres.integration.spec.ts',
  'src/infra/postgres/migration-004.integration.spec.ts',
  'src/infra/postgres/migration-005.integration.spec.ts',
  'src/infra/postgres/migration-lifecycle.integration.spec.ts',
  'src/infra/postgres/pilot-loop.integration.spec.ts',
  'src/infra/postgres/pilot-closure.integration.spec.ts',
  'src/infra/postgres/lead-export.integration.spec.ts',
  'src/infra/crypto/content-digest.integration.spec.ts',
  'src/infra/membership/pg-membership.store.integration.spec.ts',
  'src/infra/membership/pg-membership.tenancy.integration.spec.ts',
  'src/infra/governed-action/governed-action.integration.spec.ts',
  'src/infra/governed-action/governed-action.review-fixes.integration.spec.ts',
  'src/infra/governed-action/governed-action.adr005.integration.spec.ts',
  'src/infra/governed-action/assertion-delivery.integration.spec.ts',
];

/** Every PostgreSQL suite on disk must be required, so a new suite can never be silently skipped. */
export function unregisteredSuites(root = productRoot, required = requiredSuites) {
  return readdirSync(join(root, 'src'), { recursive: true })
    .map((p) => `src/${String(p).replaceAll('\\', '/')}`)
    .filter((p) => p.endsWith('.integration.spec.ts') && !required.includes(p))
    .sort();
}

async function main() {
  const missing = unregisteredSuites();
  if (missing.length) throw new Error(`Unregistered PostgreSQL suites: ${missing.join(', ')}`);
  if (process.env.CI !== 'true') throw new Error('This gate requires CI=true');
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', 'localhost'].includes(url.hostname) ||
      url.pathname !== '/north_start_ci' || url.search || url.hash) {
    throw new Error('CI PostgreSQL suites require a local, isolated /north_start_ci database');
  }
  if (process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be unset for the CI integration gate');
  }

  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 5_000 });
  try {
    await client.connect();
    const result = await client.query('SELECT current_database() AS name');
    if (result.rows[0]?.name !== 'north_start_ci') throw new Error('Connected to the wrong database');
    const schema = await client.query(
      "SELECT count(*)::integer AS objects FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p', 'v', 'm')",
    );
    if (schema.rows[0]?.objects !== 0) {
      throw new Error('CI integration gate requires a fresh, empty PostgreSQL database');
    }
  } finally {
    await client.end().catch(() => undefined);
  }

  const directory = mkdtempSync(join(tmpdir(), 'north-ci-integration-'));
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 5_000 });
  const vitest = resolve(productRoot, 'node_modules/vitest/vitest.mjs');
  // Per-run names: concurrent runs on a shared server never drop each other's databases.
  const runId = randomBytes(6).toString('hex');
  let currentDatabase;
  try {
    await admin.connect();
    let totalPassed = 0;
    for (const [index, suite] of requiredSuites.entries()) {
      const database = `north_start_ci_${runId}_${index}`;
      await admin.query(`CREATE DATABASE ${database}`);
      currentDatabase = database;
      const suiteUrl = new URL(url.toString());
      suiteUrl.pathname = `/${database}`;
      const output = join(directory, `results-${index}.json`);
      const run = spawnSync(process.execPath, [vitest, 'run', suite, '--no-file-parallelism',
        '--reporter=default', '--reporter=json', `--outputFile.json=${output}`], {
        cwd: productRoot,
        env: { ...process.env, TEST_DATABASE_URL: suiteUrl.toString() },
        stdio: 'inherit',
        timeout: 300_000,
      });
      if (run.error) throw run.error;
      if (run.status !== 0) throw new Error(`Integration runner failed for ${suite} (exit ${run.status ?? run.signal})`);
      const report = JSON.parse(readFileSync(output, 'utf8'));
      const results = report.testResults ?? [];
      if (results.length !== 1 || !report.success || results.some((result) =>
        !result.assertionResults?.length || result.assertionResults.some((test) => test.status !== 'passed'))) {
        throw new Error(`Integration gate requires every test in ${suite} to pass without skips`);
      }
      totalPassed += report.numPassedTests;
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      currentDatabase = undefined;
    }
    console.log(`Integration gate: ${requiredSuites.length} suites, ${totalPassed} tests passed without skips`);
  } finally {
    if (currentDatabase) {
      await admin.query(`DROP DATABASE IF EXISTS ${currentDatabase} WITH (FORCE)`).catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
