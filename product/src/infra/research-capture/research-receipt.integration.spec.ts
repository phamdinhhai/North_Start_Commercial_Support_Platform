import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PosWebhookFixtureReceiver } from '../../adapters/adaptive-connectivity/pos-webhook-fixture';
import { createHmacContentDigester, InMemoryWorkspaceKeyring } from '../../ports/content-digester';
import {
  createAesGcmResearchCipher,
  InMemoryWorkspaceEncryptionKeyring,
} from '../../ports/research-capture-crypto';
import { loadMigrations, Migrator } from '../postgres/migrator';
import { PostgresService, type SqlExecutor } from '../postgres/postgres.service';
import { PgResearchReceiptStore } from './pg-research-receipt.store';
import { ResearchReceiptPurgeRunner } from './research-receipt-purge.runner';

const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite('R3 A-04 bounded encrypted research-capture persistence gate (PostgreSQL)', () => {
  let db: PostgresService;
  const schema = `research_a04_${randomUUID().replaceAll('-', '')}`;
  const ws = `ws-a04-${randomUUID()}`;
  const foreignWs = `ws-foreign-${randomUUID()}`;
  const fixtureSecret = 'synthetic-only-never-provider-secret-012345';
  const scope = {
    workspaceId: ws,
    connectionId: 'conn-pos-1',
    accountId: 'shop-pos-1',
    providerSurface: 'pancake-pos' as const,
  };

  beforeAll(async () => {
    const bootstrap = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    try {
      await bootstrap.query(`CREATE SCHEMA ${schema}`);
    } finally {
      await bootstrap.onModuleDestroy();
    }
    db = new PostgresService({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    await new Migrator(db, loadMigrations()).up();
    await db.query('INSERT INTO workspace (id, name) VALUES ($1, $1), ($2, $2)', [ws, foreignWs]);
  });

  afterAll(async () => {
    if (db) {
      await db.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await db.onModuleDestroy();
    }
  });

  function createRings() {
    const digRing = new InMemoryWorkspaceKeyring();
    digRing.rotate(ws, 'dig-v1', randomBytes(32));
    const encRing = new InMemoryWorkspaceEncryptionKeyring();
    encRing.rotate(ws, 'enc-v1', randomBytes(32));
    return { digRing, encRing };
  }

  function makeStore(
    digRing: InMemoryWorkspaceKeyring,
    encRing: InMemoryWorkspaceEncryptionKeyring,
    customDb: PostgresService = db,
  ) {
    return new PgResearchReceiptStore(customDb, {
      enabled: true,
      deploymentMode: 'test',
      authorizedWorkspaceIds: [ws],
      digester: createHmacContentDigester(digRing),
      cipher: createAesGcmResearchCipher(encRing),
    });
  }

  it('stores AES-256-GCM ciphertext only (no plaintext or base64), trusts DB acceptance time, and never extends expires_at on duplicate', async () => {
    const { digRing, encRing } = createRings();
    const digester = createHmacContentDigester(digRing);
    const store = makeStore(digRing, encRing);
    const receiver = new PosWebhookFixtureReceiver(scope, fixtureSecret, store, {
      digester,
      researchCapture: { enabled: true, authorizedWorkspaceId: ws, retentionDays: 3 },
    });

    const marker = `SYNTHETIC-SECRET-${randomUUID()}`;
    const rawBody = Buffer.from(JSON.stringify({ order_id: 'ORD-101', marker }), 'utf8');
    const base64Marker = rawBody.toString('base64');

    // Untrusted forged past/future client receivedAt does not control accepted_at / expires_at
    const first = await receiver.receive({
      configuredSecretHeader: fixtureSecret,
      receiptId: 'rcpt-non-extension',
      receivedAt: '2020-01-01T00:00:00.000Z',
      rawBody,
    });
    expect(first).toEqual({ status: 202, result: 'stored' });

    const persisted = (
      await db.query<{
        accepted_at: Date;
        expires_at: Date;
        retention_days: number;
        ciphertext: Buffer;
        raw_text: string;
      }>(
        `SELECT accepted_at, expires_at, retention_days, ciphertext,
                encode(ciphertext, 'escape') AS raw_text
           FROM research_capture_receipt
          WHERE workspace_id = $1 AND receipt_id = 'rcpt-non-extension'`,
        [ws],
      )
    ).rows[0];

    expect(persisted.retention_days).toBe(3);
    const deltaMs = persisted.expires_at.getTime() - persisted.accepted_at.getTime();
    expect(deltaMs).toBe(3 * 86_400_000);
    expect(persisted.accepted_at.getUTCFullYear()).toBeGreaterThanOrEqual(2026);
    expect(persisted.ciphertext.equals(rawBody)).toBe(false);
    expect(persisted.raw_text).not.toContain(marker);
    expect(persisted.raw_text).not.toContain(base64Marker);

    // Duplicate delivery with longer retention (7d) and later receivedAt MUST NOT extend expires_at
    const widerReceiver = new PosWebhookFixtureReceiver(scope, fixtureSecret, store, {
      digester,
      researchCapture: { enabled: true, authorizedWorkspaceId: ws, retentionDays: 7 },
    });
    const duplicate = await widerReceiver.receive({
      configuredSecretHeader: fixtureSecret,
      receiptId: 'rcpt-non-extension',
      receivedAt: '2099-01-01T00:00:00.000Z',
      rawBody,
    });
    expect(duplicate).toEqual({ status: 202, result: 'duplicate' });

    const afterDup = (
      await db.query<{ accepted_at: Date; expires_at: Date; retention_days: number }>(
        `SELECT accepted_at, expires_at, retention_days
           FROM research_capture_receipt
          WHERE workspace_id = $1 AND receipt_id = 'rcpt-non-extension'`,
        [ws],
      )
    ).rows[0];
    expect(afterDup.expires_at.toISOString()).toBe(persisted.expires_at.toISOString());
    expect(afterDup.accepted_at.toISOString()).toBe(persisted.accepted_at.toISOString());
    expect(afterDup.retention_days).toBe(3);

    // Changed payload with same receipt key returns 409 conflict
    const conflict = await widerReceiver.receive({
      configuredSecretHeader: fixtureSecret,
      receiptId: 'rcpt-non-extension',
      receivedAt: '2026-11-26T00:00:00.000Z',
      rawBody: Buffer.from(JSON.stringify({ order_id: 'ORD-101', marker: 'TAMPERED' }), 'utf8'),
    });
    expect(conflict).toEqual({ status: 409, result: 'conflict' });

    // DB trigger strictly forbids UPDATE of expires_at or ciphertext
    await expect(
      db.query(
        `UPDATE research_capture_receipt SET expires_at = expires_at + interval '1 day'
          WHERE workspace_id = $1 AND receipt_id = 'rcpt-non-extension'`,
        [ws],
      ),
    ).rejects.toThrow('immutable');

    // Authorized read decrypts exact bytes and audits READ
    const readRes = await store.read({ ...scope, receiptId: 'rcpt-non-extension' }, 'researcher-1');
    expect(readRes.status).toBe('ok');
    if (readRes.status === 'ok') {
      expect(Buffer.from(readRes.rawBody).equals(rawBody)).toBe(true);
      expect(readRes.metadata.encryption.purpose).toBe('research-capture-encryption-v1');
      expect(readRes.metadata.payloadDigest.kid).toBe('dig-v1');
    }
  });

  it('surfaces honest UNKNOWN on key rotation when retired encryption or digest key is missing (I-08)', async () => {
    const { digRing, encRing } = createRings();
    const storeV1 = makeStore(digRing, encRing);
    const digesterV1 = createHmacContentDigester(digRing);
    const receiverV1 = new PosWebhookFixtureReceiver(scope, fixtureSecret, storeV1, {
      digester: digesterV1,
      researchCapture: { enabled: true, authorizedWorkspaceId: ws, retentionDays: 5 },
    });

    const rawBody = Buffer.from('{"synthetic":"rotation-test"}', 'utf8');
    expect(
      await receiverV1.receive({
        configuredSecretHeader: fixtureSecret,
        receiptId: 'rcpt-rotation',
        receivedAt: '2026-11-26T00:00:00.000Z',
        rawBody,
      }),
    ).toEqual({ status: 202, result: 'stored' });

    // Rotate both rings while keeping retired keys -> old receipt still readable & deduplicable
    digRing.rotate(ws, 'dig-v2', randomBytes(32));
    encRing.rotate(ws, 'enc-v2', randomBytes(32));
    const readableAfterRotate = await storeV1.read({ ...scope, receiptId: 'rcpt-rotation' }, 'researcher-1');
    expect(readableAfterRotate.status).toBe('ok');

    const receiverV2 = new PosWebhookFixtureReceiver(scope, fixtureSecret, storeV1, {
      digester: createHmacContentDigester(digRing),
      researchCapture: { enabled: true, authorizedWorkspaceId: ws, retentionDays: 5 },
    });
    expect(
      await receiverV2.receive({
        configuredSecretHeader: fixtureSecret,
        receiptId: 'rcpt-rotation',
        receivedAt: '2026-11-26T01:00:00.000Z',
        rawBody,
      }),
    ).toEqual({ status: 202, result: 'duplicate' });

    // Missing old encryption key -> read returns UNKNOWN (ENCRYPTION_KEY_UNAVAILABLE)
    const missingOldEncRing = new InMemoryWorkspaceEncryptionKeyring();
    missingOldEncRing.rotate(ws, 'enc-v2', randomBytes(32));
    const storeMissingEnc = makeStore(digRing, missingOldEncRing);
    const unknownEncRead = await storeMissingEnc.read({ ...scope, receiptId: 'rcpt-rotation' }, 'researcher-1');
    expect(unknownEncRead).toMatchObject({
      status: 'UNKNOWN',
      reason: 'ENCRYPTION_KEY_UNAVAILABLE',
    });

    // Missing old digest key -> duplicate check returns UNKNOWN (receiver maps to 503 UNKNOWN) & read returns UNKNOWN
    const missingOldDigRing = new InMemoryWorkspaceKeyring();
    missingOldDigRing.rotate(ws, 'dig-v2', randomBytes(32));
    const storeMissingDig = makeStore(missingOldDigRing, encRing);
    const unknownDigRead = await storeMissingDig.read({ ...scope, receiptId: 'rcpt-rotation' }, 'researcher-1');
    expect(unknownDigRead).toMatchObject({
      status: 'UNKNOWN',
      reason: 'DIGEST_KEY_UNAVAILABLE',
    });

    const receiverMissingDig = new PosWebhookFixtureReceiver(scope, fixtureSecret, storeMissingDig, {
      digester: createHmacContentDigester(missingOldDigRing),
      researchCapture: { enabled: true, authorizedWorkspaceId: ws, retentionDays: 5 },
    });
    expect(
      await receiverMissingDig.receive({
        configuredSecretHeader: fixtureSecret,
        receiptId: 'rcpt-rotation',
        receivedAt: '2026-11-26T02:00:00.000Z',
        rawBody,
      }),
    ).toEqual({ status: 503, result: 'UNKNOWN' });
  });

  it('denies expired reads, prevents unexpired deletion, rolls back delete when audit fails, and recovers cleanly across concurrent/restarted purges', async () => {
    const { digRing, encRing } = createRings();
    const store = makeStore(digRing, encRing);
    const digester = createHmacContentDigester(digRing);

    // Unexpired receipt cannot be deleted directly in SQL
    const liveReceiver = new PosWebhookFixtureReceiver(scope, fixtureSecret, store, {
      digester,
      researchCapture: { enabled: true, authorizedWorkspaceId: ws, retentionDays: 1 },
    });
    await liveReceiver.receive({
      configuredSecretHeader: fixtureSecret,
      receiptId: 'rcpt-live-protected',
      receivedAt: '2026-11-26T00:00:00.000Z',
      rawBody: Buffer.from('{"live":true}', 'utf8'),
    });
    await expect(
      db.query(
        `DELETE FROM research_capture_receipt WHERE workspace_id = $1 AND receipt_id = 'rcpt-live-protected'`,
        [ws],
      ),
    ).rejects.toThrow('cannot delete unexpired');

    // Insert 3 synthetic backdated-expired receipts (accepted_at = now - 8 days, retention_days = 7 => expires_at = now - 1 day)
    const clock = (
      await db.query<{ accepted_at: Date; expires_at: Date }>(
        `SELECT (transaction_timestamp() - interval '8 days') AS accepted_at,
                (transaction_timestamp() - interval '1 day') AS expires_at`,
      )
    ).rows[0];
    const acceptedIso = clock.accepted_at.toISOString();
    const expiresIso = clock.expires_at.toISOString();
    const cipher = createAesGcmResearchCipher(encRing);

    for (const idSuffix of ['exp-1', 'exp-2', 'exp-3']) {
      const payload = Buffer.from(JSON.stringify({ expired: idSuffix }), 'utf8');
      const dig = digester.digest(ws, 'receipt', payload);
      const sealed = cipher.encrypt(
        {
          ...scope,
          receiptId: idSuffix,
          acceptedAt: acceptedIso,
          expiresAt: expiresIso,
          retentionDays: 7,
          payloadDigestKid: dig.kid,
          payloadDigestValue: dig.value,
        },
        payload,
      );
      await db.query(
        `INSERT INTO research_capture_receipt (
           workspace_id, connection_id, account_id, provider_surface, receipt_id,
           received_at, accepted_at, retention_days, expires_at,
           payload_digest, encryption_meta, ciphertext, evidence_type, schema_status
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6::timestamptz, $6::timestamptz, 7, $7::timestamptz,
           $8::jsonb, $9::jsonb, $10, 'synthetic', 'uninterpreted'
         )`,
        [
          ws, scope.connectionId, scope.accountId, scope.providerSurface, idSuffix,
          acceptedIso, expiresIso, JSON.stringify(dig), JSON.stringify(sealed.metadata),
          Buffer.from(sealed.ciphertext),
        ],
      );
    }

    // 1. Expired read is denied and audited as EXPIRED_READ_DENIED without decrypting
    const expiredRead = await store.read({ ...scope, receiptId: 'exp-1' }, 'researcher-1');
    expect(expiredRead).toEqual({
      status: 'expired_denied',
      receiptId: 'exp-1',
      expiresAt: expiresIso,
    });

    // 2. Direct SQL DELETE of expired row WITHOUT atomic PURGED audit in same tx is rolled back by deferred constraint trigger
    await expect(
      db.withTransaction((tx) =>
        tx.query(
          `DELETE FROM research_capture_receipt WHERE workspace_id = $1 AND receipt_id = 'exp-1'`,
          [ws],
        ),
      ),
    ).rejects.toThrow('requires atomic PURGED audit');

    // 3. Inject audit_record failure during purge -> receipt deletion rolls back, failure is recorded in research_capture_failure
    const originalWithTx = db.withTransaction.bind(db);
    const failingAuditDb = {
      query: db.query.bind(db),
      withTransaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) =>
        originalWithTx((tx) =>
          fn({
            query: async (sql: string, args?: unknown[]) => {
              if (sql.includes('INSERT INTO audit_record') && String(args?.[4]).includes('purged')) {
                throw new Error('simulated audit outage');
              }
              return tx.query(sql, args);
            },
          } as SqlExecutor),
        ),
    } as PostgresService;

    const failingStore = makeStore(digRing, encRing, failingAuditDb);
    await expect(failingStore.purgeExpired('system:purge-test')).rejects.toMatchObject({
      code: 'AUDIT_UNAVAILABLE',
    });

    // All 3 expired receipts remain intact because audit failed
    const stillPresent = await db.query(
      `SELECT receipt_id FROM research_capture_receipt
        WHERE workspace_id = $1 AND receipt_id IN ('exp-1','exp-2','exp-3')`,
      [ws],
    );
    expect(stillPresent.rowCount).toBe(3);

    // Explicit failure record is visible for operator inspection
    const failures = await store.inspectFailures(ws);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      workspaceId: ws,
      stage: 'purge',
      errorCode: 'AUDIT_UNAVAILABLE',
      attempts: 1,
    });

    // 4. Concurrency + Restart recovery: run two concurrent purge workers across separate PostgresService pools
    const secondPool = new PostgresService({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    try {
      const storeB = makeStore(digRing, encRing, secondPool);
      const runnerA = new ResearchReceiptPurgeRunner(store, {
        RESEARCH_CAPTURE_STORAGE_ENABLED: 'true',
        DEPLOYMENT_MODE: 'test',
        NODE_ENV: 'test',
      });
      const runnerB = new ResearchReceiptPurgeRunner(storeB, {
        RESEARCH_CAPTURE_STORAGE_ENABLED: 'true',
        DEPLOYMENT_MODE: 'test',
        NODE_ENV: 'test',
      });

      const [resA, resB] = await Promise.all([runnerA.runOnce(2), runnerB.runOnce(2)]);
      expect(resA.purgedCount + resB.purgedCount).toBe(3);

      // Simulate restart: destroy secondPool, open fresh pool, run purge again -> 0 remaining, no duplicate PURGED audit
      await secondPool.onModuleDestroy();
      const restartedPool = new PostgresService({
        connectionString: process.env.TEST_DATABASE_URL,
        options: `-c search_path=${schema}`,
      });
      try {
        const restartedStore = makeStore(digRing, encRing, restartedPool);
        expect(await restartedStore.purgeExpired('system:post-restart')).toEqual({
          purgedCount: 0,
          remainingExpiredCount: 0,
        });
      } finally {
        await restartedPool.onModuleDestroy();
      }
      await runnerA.onModuleDestroy();
      await runnerB.onModuleDestroy();
    } finally {
      await secondPool.onModuleDestroy();
    }

    // Verify all 3 expired rows are gone, unexpired row remains, exactly 3 PURGED audits exist, and failure ledger resolved
    const remainingRows = await db.query<{ receipt_id: string }>(
      `SELECT receipt_id FROM research_capture_receipt WHERE workspace_id = $1 ORDER BY receipt_id`,
      [ws],
    );
    expect(remainingRows.rows.map((r) => r.receipt_id)).toEqual([
      'rcpt-live-protected',
      'rcpt-non-extension',
      'rcpt-rotation',
    ]);

    const purgedAudits = await db.query<{ receipt_id: string }>(
      `SELECT receipt_id FROM research_capture_audit WHERE workspace_id = $1 AND operation = 'PURGED' ORDER BY receipt_id`,
      [ws],
    );
    expect(purgedAudits.rows.map((r) => r.receipt_id)).toEqual(['exp-1', 'exp-2', 'exp-3']);
    expect(await store.inspectFailures(ws)).toEqual([]);

    // Nonempty schema refuses destructive down migration
    const down = loadMigrations().find((m) => m.version === '024_research_capture_receipts')!.down;
    await expect(db.withTransaction((tx) => tx.query(down))).rejects.toThrow(
      'cannot roll back nonempty research capture history',
    );
  });
});
