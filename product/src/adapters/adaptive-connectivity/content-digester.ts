import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * ADR-009: every digest over customer content is a keyed HMAC-SHA256 under a server-held, per-workspace key.
 * A digest is comparable only within one workspace AND one key id (`kid`). An unkeyed hash of short content
 * (phone number, "ok", order code) can be guessed offline, so no unkeyed content hash may leave this module.
 */
export interface ContentDigest {
  readonly alg: 'HMAC-SHA256';
  /** Key id of the workspace key that produced `value`; recorded beside every digest. */
  readonly kid: string;
  readonly value: string;
}

/** Domain separation: the same bytes digested for different purposes never yield equal digests. */
export type DigestPurpose = 'frame' | 'message' | 'receipt';

/** Port. Implementations hold key material server-side; callers only ever see digests. */
export interface ContentDigester {
  digest(workspaceId: string, purpose: DigestPurpose, content: string | Uint8Array): ContentDigest;
  /**
   * Re-derive under the digest's own kid. `UNKNOWN` when that key is no longer held (or belongs to
   * another workspace): a digest is never compared across keys.
   */
  matches(workspaceId: string, purpose: DigestPurpose, content: string | Uint8Array, digest: ContentDigest): boolean | 'UNKNOWN';
}

export interface WorkspaceDigestKey {
  readonly kid: string;
  readonly secret: Uint8Array;
}

/** Server-side key source. `key` may still return retired keys so old digests stay verifiable under their own kid. */
export interface WorkspaceKeyring {
  activeKey(workspaceId: string): WorkspaceDigestKey;
  key(workspaceId: string, kid: string): WorkspaceDigestKey | null;
}

const KID = /^[A-Za-z0-9._:-]{1,64}$/;
const HEX64 = /^[a-f0-9]{64}$/;
const PURPOSES: readonly DigestPurpose[] = ['frame', 'message', 'receipt'];
const MIN_SECRET_BYTES = 32;
const LABEL = 'north-star/content-digest/v1';

export function validContentDigest(value: unknown): value is ContentDigest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const digest = value as Record<string, unknown>;
  return Object.keys(digest).sort().join() === 'alg,kid,value' && digest.alg === 'HMAC-SHA256' &&
    typeof digest.kid === 'string' && KID.test(digest.kid) && typeof digest.value === 'string' && HEX64.test(digest.value);
}

/** Pure comparison. Different kids (rotation, or a different workspace key) are incomparable, never "different". */
export function compareDigests(left: ContentDigest, right: ContentDigest): 'same' | 'different' | 'incomparable' {
  if (!validContentDigest(left) || !validContentDigest(right)) throw new Error('invalid_content_digest');
  if (left.kid !== right.kid) return 'incomparable';
  return left.value === right.value ? 'same' : 'different';
}

/** Stable text form for set membership/sorting: comparable only when the kid prefix matches. */
export const digestToken = (digest: ContentDigest): string => `${digest.kid}:${digest.value}`;

function validKey(key: WorkspaceDigestKey | null | undefined): key is WorkspaceDigestKey {
  return !!key && typeof key.kid === 'string' && KID.test(key.kid) && key.secret instanceof Uint8Array && key.secret.byteLength >= MIN_SECRET_BYTES;
}

function checkInput(workspaceId: string, purpose: DigestPurpose, content: string | Uint8Array): Buffer {
  if (typeof workspaceId !== 'string' || !workspaceId || workspaceId.length > 256 || /[\x00-\x1f]/.test(workspaceId)) throw new Error('invalid_workspace');
  if (!PURPOSES.includes(purpose)) throw new Error('invalid_digest_purpose');
  if (typeof content === 'string') return Buffer.from(content, 'utf8');
  if (content instanceof Uint8Array) return Buffer.from(content);
  throw new Error('invalid_digest_content');
}

function hmac(key: WorkspaceDigestKey, workspaceId: string, purpose: DigestPurpose, bytes: Buffer): string {
  // Workspace and purpose are bound into the MAC input, so even a mis-shared key cannot link two workspaces.
  return createHmac('sha256', key.secret).update(`${LABEL}\u0000${purpose}\u0000${workspaceId}\u0000`, 'utf8').update(bytes).digest('hex');
}

export function createHmacContentDigester(keyring: WorkspaceKeyring): ContentDigester {
  if (!keyring || typeof keyring.activeKey !== 'function' || typeof keyring.key !== 'function') throw new Error('invalid_keyring');
  return {
    digest(workspaceId, purpose, content) {
      const bytes = checkInput(workspaceId, purpose, content);
      const key = keyring.activeKey(workspaceId);
      if (!validKey(key)) throw new Error('digest_key_unavailable');
      return { alg: 'HMAC-SHA256', kid: key.kid, value: hmac(key, workspaceId, purpose, bytes) };
    },
    matches(workspaceId, purpose, content, digest) {
      const bytes = checkInput(workspaceId, purpose, content);
      if (!validContentDigest(digest)) throw new Error('invalid_content_digest');
      const key = keyring.key(workspaceId, digest.kid);
      if (!validKey(key) || key.kid !== digest.kid) return 'UNKNOWN';
      return timingSafeEqual(Buffer.from(hmac(key, workspaceId, purpose, bytes), 'hex'), Buffer.from(digest.value, 'hex'));
    },
  };
}

/**
 * In-memory keyring for tests and single-process harnesses. Production keys come from a server-side secret store
 * (not built here). Rotation keeps the retired key for verification only; new digests always use the active kid.
 */
export class InMemoryWorkspaceKeyring implements WorkspaceKeyring {
  private readonly keys = new Map<string, { active: string; byKid: Map<string, WorkspaceDigestKey> }>();

  rotate(workspaceId: string, kid: string, secret: Uint8Array): void {
    const key = { kid, secret: Uint8Array.from(secret) };
    if (!validKey(key)) throw new Error('invalid_digest_key');
    const entry = this.keys.get(workspaceId) ?? { active: kid, byKid: new Map<string, WorkspaceDigestKey>() };
    if (entry.byKid.has(kid)) throw new Error('digest_kid_reused');
    entry.byKid.set(kid, key);
    entry.active = kid;
    this.keys.set(workspaceId, entry);
  }

  activeKey(workspaceId: string): WorkspaceDigestKey {
    const entry = this.keys.get(workspaceId);
    if (!entry) throw new Error('digest_key_unavailable');
    return entry.byKid.get(entry.active) as WorkspaceDigestKey;
  }

  key(workspaceId: string, kid: string): WorkspaceDigestKey | null {
    return this.keys.get(workspaceId)?.byKid.get(kid) ?? null;
  }
}
