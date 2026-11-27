import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createAesGcmResearchCipher,
  InMemoryWorkspaceEncryptionKeyring,
  validResearchCipherMetadata,
  type ResearchCipherAadContext,
} from '../../ports/research-capture-crypto';
import { createHmacContentDigester, InMemoryWorkspaceKeyring } from '../../ports/content-digester';
import { configuredResearchCipher } from '../crypto/configured-research-cipher';
import { PgResearchReceiptStore, researchCaptureStorageEnabled } from './pg-research-receipt.store';
import { ResearchReceiptPurgeRunner, resolvePurgeIntervalMs } from './research-receipt-purge.runner';
import type { TransactionRunner } from '../postgres/migrator';
import type { SqlExecutor } from '../postgres/postgres.service';

const baseAad = (digestKid = 'dig-v1', digestVal = 'a'.repeat(64)): ResearchCipherAadContext => ({
  workspaceId: 'ws-research',
  connectionId: 'conn-1',
  accountId: 'shop-1',
  providerSurface: 'pancake-pos',
  receiptId: 'rcpt-1',
  acceptedAt: '2026-11-26T00:00:00.000Z',
  expiresAt: '2026-12-03T00:00:00.000Z',
  retentionDays: 7,
  payloadDigestKid: digestKid,
  payloadDigestValue: digestVal,
});

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe('R3 A-04 research-capture AES-256-GCM cipher & key separation', () => {
  it('encrypts with AES-256-GCM + AAD, never equals raw or base64, and binds every AAD field', () => {
    const encRing = new InMemoryWorkspaceEncryptionKeyring();
    encRing.rotate('ws-research', 'enc-v1', randomBytes(32));
    const cipher = createAesGcmResearchCipher(encRing);
    const raw = Buffer.from('{"order_code":"ORD-999","phone":"0901234567"}', 'utf8');
    const aad = baseAad();

    const sealed = cipher.encrypt(aad, raw);
    expect(validResearchCipherMetadata(sealed.metadata)).toBe(true);
    expect(sealed.metadata.purpose).toBe('research-capture-encryption-v1');
    expect(Buffer.from(sealed.ciphertext).equals(raw)).toBe(false);
    expect(Buffer.from(sealed.ciphertext).toString('utf8')).not.toContain('0901234567');
    expect(Buffer.from(sealed.ciphertext).toString('utf8')).not.toBe(raw.toString('base64'));

    const opened = cipher.decrypt(aad, sealed);
    expect(opened.status).toBe('ok');
    if (opened.status === 'ok') {
      expect(opened.plaintext.equals(raw)).toBe(true);
    }

    // Foreign workspace even if sharing the exact kid and secret bytes fails AAD + HKDF workspace separation
    const rootSecret = randomBytes(32);
    const sharedRing = new InMemoryWorkspaceEncryptionKeyring();
    sharedRing.rotate('ws-research', 'enc-v1', rootSecret);
    sharedRing.rotate('ws-foreign', 'enc-v1', rootSecret);
    const sharedCipher = createAesGcmResearchCipher(sharedRing);
    const sharedSealed = sharedCipher.encrypt(aad, raw);
    expect(() => sharedCipher.decrypt({ ...aad, workspaceId: 'ws-foreign' }, sharedSealed)).toThrow(
      'research_ciphertext_authentication_failed',
    );

    for (const tampered of [
      { ...aad, connectionId: 'conn-other' },
      { ...aad, accountId: 'shop-other' },
      { ...aad, receiptId: 'rcpt-other' },
      { ...aad, acceptedAt: '2026-11-26T00:00:01.000Z' },
      { ...aad, expiresAt: '2026-12-04T00:00:00.000Z' },
      { ...aad, retentionDays: 6 },
      { ...aad, payloadDigestKid: 'dig-v2' },
      { ...aad, payloadDigestValue: 'b'.repeat(64) },
    ]) {
      expect(() => cipher.decrypt(tampered, sealed)).toThrow('research_ciphertext_authentication_failed');
    }
  });

  it('supports encryption key rotation and returns UNKNOWN when retired encryption key is missing', () => {
    const encRing = new InMemoryWorkspaceEncryptionKeyring();
    encRing.rotate('ws-research', 'enc-old', randomBytes(32));
    const cipher = createAesGcmResearchCipher(encRing);
    const raw = Buffer.from('{"synthetic":true}', 'utf8');
    const aad = baseAad();

    const oldSealed = cipher.encrypt(aad, raw);
    expect(oldSealed.metadata.kid).toBe('enc-old');

    encRing.rotate('ws-research', 'enc-new', randomBytes(32));
    const newSealed = cipher.encrypt(aad, raw);
    expect(newSealed.metadata.kid).toBe('enc-new');

    // Old ciphertext decrypts while retired key is retained
    const stillReadable = cipher.decrypt(aad, oldSealed);
    expect(stillReadable.status).toBe('ok');

    // Evicting retired key yields honest UNKNOWN (I-08), never crashes or guesses
    encRing.evictRetired('ws-research', 'enc-old');
    expect(cipher.decrypt(aad, oldSealed)).toEqual({
      status: 'UNKNOWN',
      reason: 'ENCRYPTION_KEY_UNAVAILABLE',
    });
    expect(() => encRing.evictRetired('ws-research', 'enc-new')).toThrow('cannot_evict_active_encryption_key');
  });

  it('enforces separate encryption vs digest key material in server configuration and fails closed in prod/pilot', () => {
    for (const env of [
      {},
      { NODE_ENV: 'production', DEPLOYMENT_MODE: 'test' },
      { DEPLOYMENT_MODE: 'pilot', NODE_ENV: 'test' },
      { DEPLOYMENT_MODE: 'local' },
    ]) {
      expect(() => configuredResearchCipher(env)).toThrow('research_encryption_keys_required');
    }

    const sharedSecret = randomBytes(32).toString('base64');
    const distinctSecret = randomBytes(32).toString('base64');
    const digestJson = JSON.stringify([
      { workspaceId: 'ws-research', activeKid: 'dig-1', keys: [{ kid: 'dig-1', secretBase64: sharedSecret }] },
    ]);
    const reusedEncJson = JSON.stringify([
      { workspaceId: 'ws-research', activeKid: 'enc-1', keys: [{ kid: 'enc-1', secretBase64: sharedSecret }] },
    ]);
    expect(() =>
      configuredResearchCipher({
        CONTENT_DIGEST_KEYS_JSON: digestJson,
        RESEARCH_CAPTURE_ENCRYPTION_KEYS_JSON: reusedEncJson,
      }),
    ).toThrow('invalid_research_encryption_key_configuration');

    const validEncJson = JSON.stringify([
      { workspaceId: 'ws-research', activeKid: 'enc-1', keys: [{ kid: 'enc-1', secretBase64: distinctSecret }] },
    ]);
    const cipher = configuredResearchCipher({
      CONTENT_DIGEST_KEYS_JSON: digestJson,
      RESEARCH_CAPTURE_ENCRYPTION_KEYS_JSON: validEncJson,
    });
    const record = cipher.encrypt(baseAad('dig-1'), Buffer.from('{"ok":true}'));
    expect(record.metadata.kid).toBe('enc-1');
  });
});

describe('R3 A-04 PgResearchReceiptStore gates, no-plaintext fallback & purge runner', () => {
  const dummyDb = {
    query: vi.fn(),
    withTransaction: vi.fn(async <T>(fn: (tx: SqlExecutor) => Promise<T>) => fn({ query: dummyDb.query })),
  } as unknown as TransactionRunner & SqlExecutor;

  function makeCrypto() {
    const digRing = new InMemoryWorkspaceKeyring();
    digRing.rotate('ws-research', 'dig-1', randomBytes(32));
    const encRing = new InMemoryWorkspaceEncryptionKeyring();
    encRing.rotate('ws-research', 'enc-1', randomBytes(32));
    return {
      digester: createHmacContentDigester(digRing),
      cipher: createAesGcmResearchCipher(encRing),
    };
  }

  it('preserves disabled/synthetic defaults and refuses pilot/production or missing cipher/digester', () => {
    expect(researchCaptureStorageEnabled({})).toBe(false);
    expect(researchCaptureStorageEnabled({ RESEARCH_CAPTURE_STORAGE_ENABLED: 'false' })).toBe(false);
    expect(() => researchCaptureStorageEnabled({ RESEARCH_CAPTURE_STORAGE_ENABLED: 'yes' })).toThrow('RESEARCH_ONLY');
    expect(() =>
      researchCaptureStorageEnabled({ RESEARCH_CAPTURE_STORAGE_ENABLED: 'true', DEPLOYMENT_MODE: 'pilot' }),
    ).toThrow('RESEARCH_ONLY');
    expect(() =>
      researchCaptureStorageEnabled({
        RESEARCH_CAPTURE_STORAGE_ENABLED: 'true',
        DEPLOYMENT_MODE: 'local',
        NODE_ENV: 'production',
      }),
    ).toThrow('RESEARCH_ONLY');
    expect(
      researchCaptureStorageEnabled({
        RESEARCH_CAPTURE_STORAGE_ENABLED: 'true',
        DEPLOYMENT_MODE: 'test',
        NODE_ENV: 'test',
      }),
    ).toBe(true);

    const { digester, cipher } = makeCrypto();
    expect(
      () =>
        new PgResearchReceiptStore(dummyDb, {
          enabled: false,
          deploymentMode: 'test',
          authorizedWorkspaceIds: ['ws-research'],
          cipher,
          digester,
        }),
    ).toThrow('RESEARCH_CAPTURE_DISABLED');

    expect(
      () =>
        new PgResearchReceiptStore(dummyDb, {
          enabled: true,
          deploymentMode: 'production',
          authorizedWorkspaceIds: ['ws-research'],
          cipher,
          digester,
        }),
    ).toThrow('RESEARCH_ONLY');

    expect(
      () =>
        new PgResearchReceiptStore(dummyDb, {
          enabled: true,
          deploymentMode: 'test',
          authorizedWorkspaceIds: ['ws-research'],
          cipher: undefined as never,
          digester,
        }),
    ).toThrow('PLAINTEXT_STORAGE_FORBIDDEN');
  });

  it('refuses identity/base64 pseudo-ciphers so plaintext or base64 can never fall back to storage', async () => {
    const { digester } = makeCrypto();
    const raw = Buffer.from('{"synthetic":"never-store-base64"}', 'utf8');
    const digest = digester.digest('ws-research', 'receipt', raw);

    for (const badCiphertext of [raw, Buffer.from(raw.toString('base64'), 'utf8')]) {
      const queries: string[] = [];
      const fakeDb: TransactionRunner & SqlExecutor = {
        query: vi.fn(async (sql: string) => {
          queries.push(sql);
          if (sql.includes('transaction_timestamp() AS accepted_at')) {
            return {
              rows: [{ accepted_at: new Date('2026-11-26T00:00:00Z'), expires_at: new Date('2026-12-03T00:00:00Z') }],
              rowCount: 1, command: 'SELECT', oid: 0, fields: [],
            } as never;
          }
          return { rows: [], rowCount: 0, command: 'OK', oid: 0, fields: [] } as never;
        }),
        withTransaction: async (fn) => fn(fakeDb),
      };

      const store = new PgResearchReceiptStore(fakeDb, {
        enabled: true,
        deploymentMode: 'test',
        authorizedWorkspaceIds: ['ws-research'],
        digester,
        cipher: {
          encrypt: () => ({
            metadata: {
              alg: 'AES-256-GCM',
              purpose: 'research-capture-encryption-v1',
              kid: 'enc-1',
              nonceHex: 'a'.repeat(24),
              tagHex: 'b'.repeat(32),
            },
            ciphertext: badCiphertext,
          }),
          decrypt: vi.fn(),
        },
      });

      await expect(
        store.append({
          workspaceId: 'ws-research',
          connectionId: 'conn-1',
          accountId: 'shop-1',
          providerSurface: 'pancake-pos',
          receiptId: 'r-1',
          receivedAt: '2026-11-26T00:00:00.000Z',
          payloadHash: `hmac-sha256:${digest.kid}:${digest.value}`,
          payloadDigest: digest,
          retentionDays: 7,
          rawBody: raw,
          rawBodyBase64: raw.toString('base64'),
          evidenceType: 'synthetic',
          schemaStatus: 'uninterpreted',
        }),
      ).rejects.toMatchObject({ code: 'PLAINTEXT_STORAGE_FORBIDDEN' });

      expect(queries.some((q) => q.includes('INSERT INTO research_capture_receipt'))).toBe(false);
    }
  });

  it('purge runner stays inert when disabled and deduplicates overlapping runs when enabled', async () => {
    const store = {
      append: vi.fn(),
      read: vi.fn(),
      inspectFailures: vi.fn(),
      purgeExpired: vi.fn(async () => ({ purgedCount: 2, remainingExpiredCount: 0 })),
    };

    const disabledRunner = new ResearchReceiptPurgeRunner(store, { DEPLOYMENT_MODE: 'test', NODE_ENV: 'test' });
    disabledRunner.onModuleInit();
    expect(await disabledRunner.runOnce()).toEqual({ purgedCount: 0, remainingExpiredCount: 0 });
    expect(store.purgeExpired).not.toHaveBeenCalled();
    await disabledRunner.onModuleDestroy();

    expect(() => resolvePurgeIntervalMs({ RESEARCH_CAPTURE_PURGE_INTERVAL_MS: '10' })).toThrow(
      'INVALID_RESEARCH_CAPTURE_PURGE_INTERVAL',
    );

    let release!: () => void;
    store.purgeExpired.mockImplementationOnce(
      () => new Promise((done) => { release = () => done({ purgedCount: 3, remainingExpiredCount: 0 }); }),
    );
    const enabledRunner = new ResearchReceiptPurgeRunner(store, {
      RESEARCH_CAPTURE_STORAGE_ENABLED: 'true',
      RESEARCH_CAPTURE_PURGE_INTERVAL_MS: '500',
      DEPLOYMENT_MODE: 'test',
      NODE_ENV: 'test',
    });
    const p1 = enabledRunner.runOnce();
    const p2 = enabledRunner.runOnce();
    release();
    expect(await Promise.all([p1, p2])).toEqual([
      { purgedCount: 3, remainingExpiredCount: 0 },
      { purgedCount: 3, remainingExpiredCount: 0 },
    ]);
    expect(store.purgeExpired).toHaveBeenCalledTimes(1);
    await enabledRunner.onModuleDestroy();
  });
});
