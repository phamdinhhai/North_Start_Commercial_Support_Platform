import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const productRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredSuites = [
  'src/infra/postgres/postgres.integration.spec.ts',
  'src/infra/postgres/migration-004.integration.spec.ts',
  'src/infra/postgres/migration-005.integration.spec.ts',
  'src/infra/postgres/pilot-loop.integration.spec.ts',
];

async function main() {
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
  let currentDatabase;
  try {
    await admin.connect();
    let totalPassed = 0;
    for (const [index, suite] of requiredSuites.entries()) {
      const database = `north_start_ci_${index}`;
      currentDatabase = database;
      await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${database}`);
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
