import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * ADR-009 §3 / R3 A-04: server-side authenticated encryption for bounded research capture.
 * Encryption keys are strictly domain-separated from ContentDigester HMAC keys so a key source
 * or purpose can never be confused with digest derivation, and base64 is never used as encryption.
 */
export interface WorkspaceEncryptionKey {
  readonly kid: string;
  readonly secret: Uint8Array;
}

/** Server-side encryption key source. Retired keys remain available by kid until purged or retired. */
export interface WorkspaceEncryptionKeyring {
  activeKey(workspaceId: string): WorkspaceEncryptionKey;
  key(workspaceId: string, kid: string): WorkspaceEncryptionKey | null;
}

export interface ResearchCipherMetadata {
  readonly alg: 'AES-256-GCM';
  readonly purpose: 'research-capture-encryption-v1';
  readonly kid: string;
  readonly nonceHex: string;
  readonly tagHex: string;
}

export interface ResearchCipherRecord {
  readonly metadata: ResearchCipherMetadata;
  readonly ciphertext: Uint8Array;
}

export interface ResearchCipherAadContext {
  readonly workspaceId: string;
  readonly connectionId: string;
  readonly accountId: string;
  readonly providerSurface: 'pancake-pos';
  readonly receiptId: string;
  readonly acceptedAt: string;
  readonly expiresAt: string;
  readonly retentionDays: number;
  readonly payloadDigestKid: string;
  readonly payloadDigestValue: string;
}

export type ResearchDecryptionResult =
  | { readonly status: 'ok'; readonly plaintext: Buffer }
  | { readonly status: 'UNKNOWN'; readonly reason: 'ENCRYPTION_KEY_UNAVAILABLE' };

export interface ResearchCaptureCipher {
  encrypt(aadContext: ResearchCipherAadContext, rawBytes: Uint8Array): ResearchCipherRecord;
  decrypt(aadContext: ResearchCipherAadContext, record: ResearchCipherRecord): ResearchDecryptionResult;
}

const KID = /^[A-Za-z0-9._-]{1,64}$/;
const HEX24 = /^[a-f0-9]{24}$/;
const HEX32 = /^[a-f0-9]{32}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const ID = /^[^\x00-\x1f]{1,256}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/;
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const MAX_RAW_BYTES = 262_144;
const KDF_SALT = Buffer.from('north-star/research-capture-kdf-salt/v1', 'utf8');
const AAD_LABEL = 'north-star/research-capture-aad/v1';

export function validResearchCipherMetadata(value: unknown): value is ResearchCipherMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const meta = value as Record<string, unknown>;
  return Object.keys(meta).sort().join(',') === 'alg,kid,nonceHex,purpose,tagHex'
    && meta.alg === 'AES-256-GCM'
    && meta.purpose === 'research-capture-encryption-v1'
    && typeof meta.kid === 'string' && KID.test(meta.kid)
    && typeof meta.nonceHex === 'string' && HEX24.test(meta.nonceHex)
    && typeof meta.tagHex === 'string' && HEX32.test(meta.tagHex);
}

function validEncryptionKey(key: WorkspaceEncryptionKey | null | undefined): key is WorkspaceEncryptionKey {
  return !!key
    && typeof key.kid === 'string'
    && KID.test(key.kid)
    && key.secret instanceof Uint8Array
    && key.secret.byteLength === KEY_BYTES;
}

function validateAadContext(ctx: ResearchCipherAadContext): Buffer {
  if (!ctx || typeof ctx !== 'object'
    || !ID.test(ctx.workspaceId ?? '')
    || !ID.test(ctx.connectionId ?? '')
    || !ID.test(ctx.accountId ?? '')
    || ctx.providerSurface !== 'pancake-pos'
    || !ID.test(ctx.receiptId ?? '')
    || !ISO_UTC.test(ctx.acceptedAt ?? '') || !Number.isFinite(Date.parse(ctx.acceptedAt))
    || !ISO_UTC.test(ctx.expiresAt ?? '') || !Number.isFinite(Date.parse(ctx.expiresAt))
    || !Number.isSafeInteger(ctx.retentionDays) || ctx.retentionDays < 1 || ctx.retentionDays > 7
    || !KID.test(ctx.payloadDigestKid ?? '')
    || !HEX64.test(ctx.payloadDigestValue ?? '')) {
    throw new Error('invalid_research_aad_context');
  }
  return Buffer.from(JSON.stringify([
    AAD_LABEL,
    ctx.workspaceId,
    ctx.connectionId,
    ctx.accountId,
    ctx.providerSurface,
    ctx.receiptId,
    new Date(ctx.acceptedAt).toISOString(),
    new Date(ctx.expiresAt).toISOString(),
    ctx.retentionDays,
    ctx.payloadDigestKid,
    ctx.payloadDigestValue,
  ]), 'utf8');
}

function deriveSubkey(key: WorkspaceEncryptionKey, workspaceId: string): Buffer {
  const info = Buffer.from(`north-star/research-capture-encryption/v1\u0000${workspaceId}\u0000${key.kid}`, 'utf8');
  return Buffer.from(hkdfSync('sha256', key.secret, KDF_SALT, info, KEY_BYTES));
}

export function createAesGcmResearchCipher(keyring: WorkspaceEncryptionKeyring): ResearchCaptureCipher {
  if (!keyring || typeof keyring.activeKey !== 'function' || typeof keyring.key !== 'function') {
    throw new Error('invalid_encryption_keyring');
  }
  return {
    encrypt(aadContext, rawBytes) {
      const aad = validateAadContext(aadContext);
      if (!(rawBytes instanceof Uint8Array) || rawBytes.byteLength === 0 || rawBytes.byteLength > MAX_RAW_BYTES) {
        throw new Error('invalid_research_plaintext');
      }
      const rootKey = keyring.activeKey(aadContext.workspaceId);
      if (!validEncryptionKey(rootKey)) throw new Error('encryption_key_unavailable');
      const subkey = deriveSubkey(rootKey, aadContext.workspaceId);
      const nonce = randomBytes(NONCE_BYTES);
      try {
        const cipher = createCipheriv('aes-256-gcm', subkey, nonce, { authTagLength: TAG_BYTES });
        cipher.setAAD(aad);
        const ciphertext = Buffer.concat([cipher.update(rawBytes), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
          metadata: Object.freeze({
            alg: 'AES-256-GCM',
            purpose: 'research-capture-encryption-v1',
            kid: rootKey.kid,
            nonceHex: nonce.toString('hex'),
            tagHex: tag.toString('hex'),
          }),
          ciphertext: Uint8Array.from(ciphertext),
        };
      } finally {
        subkey.fill(0);
      }
    },
    decrypt(aadContext, record) {
      const aad = validateAadContext(aadContext);
      if (!record || !validResearchCipherMetadata(record.metadata)
        || !(record.ciphertext instanceof Uint8Array)
        || record.ciphertext.byteLength === 0
        || record.ciphertext.byteLength > MAX_RAW_BYTES) {
        throw new Error('invalid_research_ciphertext');
      }
      const rootKey = keyring.key(aadContext.workspaceId, record.metadata.kid);
      if (!validEncryptionKey(rootKey) || rootKey.kid !== record.metadata.kid) {
        return { status: 'UNKNOWN', reason: 'ENCRYPTION_KEY_UNAVAILABLE' };
      }
      const subkey = deriveSubkey(rootKey, aadContext.workspaceId);
      try {
        const decipher = createDecipheriv(
          'aes-256-gcm',
          subkey,
          Buffer.from(record.metadata.nonceHex, 'hex'),
          { authTagLength: TAG_BYTES },
        );
        decipher.setAAD(aad);
        decipher.setAuthTag(Buffer.from(record.metadata.tagHex, 'hex'));
        const plaintext = Buffer.concat([decipher.update(record.ciphertext), decipher.final()]);
        return { status: 'ok', plaintext };
      } catch {
        throw new Error('research_ciphertext_authentication_failed');
      } finally {
        subkey.fill(0);
      }
    },
  };
}

/**
 * In-memory encryption keyring for tests and single-process research harnesses.
 * Retired keys can be retained for decryption or explicitly retired/removed (causing UNKNOWN on read).
 */
export class InMemoryWorkspaceEncryptionKeyring implements WorkspaceEncryptionKeyring {
  private readonly keys = new Map<string, { active: string; byKid: Map<string, WorkspaceEncryptionKey> }>();

  rotate(workspaceId: string, kid: string, secret: Uint8Array): void {
    const copy = Uint8Array.from(secret);
    const key: WorkspaceEncryptionKey = { kid, secret: copy };
    if (!ID.test(workspaceId ?? '') || !validEncryptionKey(key)) throw new Error('invalid_encryption_key');
    const entry = this.keys.get(workspaceId) ?? { active: kid, byKid: new Map<string, WorkspaceEncryptionKey>() };
    if (entry.byKid.has(kid)) throw new Error('encryption_kid_reused');
    entry.byKid.set(kid, key);
    entry.active = kid;
    this.keys.set(workspaceId, entry);
  }

  evictRetired(workspaceId: string, kid: string): void {
    const entry = this.keys.get(workspaceId);
    if (!entry) return;
    if (entry.active === kid) throw new Error('cannot_evict_active_encryption_key');
    const existing = entry.byKid.get(kid);
    if (existing) {
      Buffer.from(existing.secret.buffer, existing.secret.byteOffset, existing.secret.byteLength).fill(0);
      entry.byKid.delete(kid);
    }
  }

  activeKey(workspaceId: string): WorkspaceEncryptionKey {
    const entry = this.keys.get(workspaceId);
    if (!entry) throw new Error('encryption_key_unavailable');
    const key = entry.byKid.get(entry.active);
    if (!key) throw new Error('encryption_key_unavailable');
    return key;
  }

  key(workspaceId: string, kid: string): WorkspaceEncryptionKey | null {
    return this.keys.get(workspaceId)?.byKid.get(kid) ?? null;
  }
}
