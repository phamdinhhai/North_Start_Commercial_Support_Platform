import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import {
  RESEARCH_CAPTURE_SCOPE,
  RESTORE_TABLES,
  seedResearchCaptureFixtures,
  validateRestoreTarget,
  verifyRestoredResearchCapture,
} from './restore-rehearsal.mjs';

const require = createRequire(import.meta.url);

describe('restore-rehearsal migration 024 safeguards', () => {
  it('includes all migration 024 research capture tables in RESTORE_TABLES', () => {
    for (const table of ['research_capture_receipt', 'research_capture_audit', 'research_capture_failure']) {
      assert.ok(RESTORE_TABLES.includes(table), `Missing ${table} in RESTORE_TABLES`);
    }
  });

  it('refuses non-local, missing, query-overridden, or DATABASE_URL-polluted targets', () => {
    assert.throws(() => validateRestoreTarget({}), /TEST_DATABASE_URL/);
    assert.throws(() => validateRestoreTarget({ TEST_DATABASE_URL: 'postgresql://db.example/north_start_ci' }), /TEST_DATABASE_URL/);
    assert.throws(() => validateRestoreTarget({ TEST_DATABASE_URL: 'postgresql://127.0.0.1:55432/prod_db' }), /TEST_DATABASE_URL/);
    assert.throws(() => validateRestoreTarget({
      TEST_DATABASE_URL: 'postgresql://127.0.0.1:55432/north_start_ci',
      DATABASE_URL: 'postgresql://127.0.0.1:55432/other',
    }), /TEST_DATABASE_URL/);
    assert.throws(() => validateRestoreTarget({
      TEST_DATABASE_URL: 'postgresql://127.0.0.1:55432/north_start_ci?sslmode=disable',
    }), /TEST_DATABASE_URL/);
    const ok = validateRestoreTarget({ TEST_DATABASE_URL: 'postgresql://127.0.0.1:55432/north_start_ci' });
    assert.equal(ok.pathname, '/north_start_ci');
  });

  it('seeds and verifies migration 024 encrypted receipt, trigger guards, and quarantined purge on isolated PostgreSQL', async (t) => {
    const dbUrl = process.env.TEST_DATABASE_URL;
    if (!dbUrl) {
      t.skip('TEST_DATABASE_URL not set');
      return;
    }
    const { PostgresService } = require('../dist/infra/postgres/postgres.service.js');
    const { Migrator, loadMigrations } = require('../dist/infra/postgres/migrator.js');
    const { configuredContentDigester } = require('../dist/infra/crypto/configured-content-digester.js');
    const { configuredResearchCipher } = require('../dist/infra/crypto/configured-research-cipher.js');

    const schema = `restore_024_test_${randomUUID().replaceAll('-', '')}`;
    const bootstrap = new PostgresService({ connectionString: dbUrl });
    try {
      await bootstrap.query(`CREATE SCHEMA ${schema}`);
    } finally {
      await bootstrap.onModuleDestroy();
    }

    const db = new PostgresService({ connectionString: dbUrl, options: `-c search_path=${schema}` });
    try {
      await new Migrator(db, loadMigrations()).up();
      await db.query('INSERT INTO workspace(id, name) VALUES ($1, $2)', [RESEARCH_CAPTURE_SCOPE.workspaceId, 'Restore 024 unit test']);

      const digestKeysJson = JSON.stringify([
        { workspaceId: RESEARCH_CAPTURE_SCOPE.workspaceId, activeKid: 'test-dig-v1', keys: [{ kid: 'test-dig-v1', secretBase64: randomBytes(32).toString('base64') }] },
      ]);
      const encryptionKeysJson = JSON.stringify([
        { workspaceId: RESEARCH_CAPTURE_SCOPE.workspaceId, activeKid: 'test-enc-v1', keys: [{ kid: 'test-enc-v1', secretBase64: randomBytes(32).toString('base64') }] },
      ]);
      const digester = configuredContentDigester({ CONTENT_DIGEST_KEYS_JSON: digestKeysJson });
      const cipher = configuredResearchCipher({
        CONTENT_DIGEST_KEYS_JSON: digestKeysJson,
        RESEARCH_CAPTURE_ENCRYPTION_KEYS_JSON: encryptionKeysJson,
      });

      const fixture = await seedResearchCaptureFixtures(db, { digester, cipher });
      const result = await verifyRestoredResearchCapture(db, { digester, cipher, ...fixture });

      assert.deepEqual(result, {
        liveDecrypted: true,
        expiredReadDenied: true,
        triggersEnforced: true,
        purgedCount: 1,
        remainingExpiredCount: 0,
      });

      // Confirm live receipt survived quarantine purge while expired receipt was removed.
      const remaining = await db.query('SELECT receipt_id FROM research_capture_receipt WHERE workspace_id = $1', [RESEARCH_CAPTURE_SCOPE.workspaceId]);
      assert.deepEqual(remaining.rows.map((r) => r.receipt_id), ['restore-research-live']);
    } finally {
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await db.onModuleDestroy();
    }
  });
});
