import { timingSafeEqual } from 'node:crypto';
import {
  createAesGcmResearchCipher,
  InMemoryWorkspaceEncryptionKeyring,
  type ResearchCaptureCipher,
  type WorkspaceEncryptionKey,
} from '../../ports/research-capture-crypto';

/** Process-local ephemeral encryption keys for test/explicit-local runs only; restarts deliberately lose them. */
class EphemeralEncryptionKeyring extends InMemoryWorkspaceEncryptionKeyring {
  constructor(private readonly seedByte: number = 0x5a) {
    super();
  }
  override activeKey(workspaceId: string): WorkspaceEncryptionKey {
    try {
      return super.activeKey(workspaceId);
    } catch {
      const rand = new Uint8Array(32);
      crypto.getRandomValues(rand);
      rand[0] ^= this.seedByte;
      const kid = `ephemeral-enc-${Buffer.from(rand.subarray(0, 12)).toString('hex')}`;
      this.rotate(workspaceId, kid, rand);
      rand.fill(0);
      return super.activeKey(workspaceId);
    }
  }
}

function collectConfiguredSecrets(rawJson: string | undefined): Buffer[] {
  if (!rawJson) return [];
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    const out: Buffer[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object' || !Array.isArray((entry as { keys?: unknown }).keys)) continue;
      for (const k of (entry as { keys: { secretBase64?: unknown }[] }).keys) {
        if (k && typeof k.secretBase64 === 'string') {
          const buf = Buffer.from(k.secretBase64, 'base64');
          if (buf.byteLength === 32) out.push(buf);
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Server-held research-capture encryption keyring loader (ADR-009 §3, R3 A-04).
 * Enforces separate encryption vs digest key material: refuses reuse of any secret present in
 * `CONTENT_DIGEST_KEYS_JSON`. Fails closed in pilot/production and never echoes configuration values.
 */
export function configuredResearchCipher(env: NodeJS.ProcessEnv): ResearchCaptureCipher {
  const encoded = env.RESEARCH_CAPTURE_ENCRYPTION_KEYS_JSON;
  if (!encoded) {
    const mode = (env.DEPLOYMENT_MODE ?? env.APP_MODE ?? env.NODE_ENV ?? '').toLowerCase();
    if (
      env.NODE_ENV !== 'production'
      && (mode === 'test'
        || (['local', 'development', 'dev'].includes(mode) && env.RESEARCH_CAPTURE_ENCRYPTION_EPHEMERAL === 'true'))
    ) {
      return createAesGcmResearchCipher(new EphemeralEncryptionKeyring());
    }
    throw new Error('research_encryption_keys_required');
  }
  try {
    const config: unknown = JSON.parse(encoded);
    if (!Array.isArray(config) || config.length === 0) throw new Error();
    const digestSecrets = collectConfiguredSecrets(env.CONTENT_DIGEST_KEYS_JSON);
    const keyring = new InMemoryWorkspaceEncryptionKeyring();
    const workspaces = new Set<string>();
    const seenSecrets: Buffer[] = [];
    for (const entry of config) {
      if (
        !entry
        || typeof entry !== 'object'
        || Object.keys(entry).sort().join() !== 'activeKid,keys,workspaceId'
        || typeof entry.workspaceId !== 'string'
        || !entry.workspaceId
        || workspaces.has(entry.workspaceId)
        || !Array.isArray(entry.keys)
        || !entry.keys.length
        || typeof entry.activeKid !== 'string'
      ) {
        throw new Error();
      }
      workspaces.add(entry.workspaceId);
      const keys = entry.keys as { kid: string; secretBase64: string }[];
      if (!keys.some((key) => key.kid === entry.activeKid)) throw new Error();
      for (const key of [
        ...keys.filter((k) => k.kid !== entry.activeKid),
        ...keys.filter((k) => k.kid === entry.activeKid),
      ]) {
        if (!key || Object.keys(key).sort().join() !== 'kid,secretBase64' || typeof key.secretBase64 !== 'string') {
          throw new Error();
        }
        const bytes = Buffer.from(key.secretBase64, 'base64');
        if (bytes.byteLength !== 32 || bytes.toString('base64') !== key.secretBase64) throw new Error();
        if (digestSecrets.some((ds) => timingSafeEqual(ds, bytes))) throw new Error();
        if (seenSecrets.some((ss) => timingSafeEqual(ss, bytes))) throw new Error();
        seenSecrets.push(bytes);
        keyring.rotate(entry.workspaceId, key.kid, bytes);
      }
    }
    return createAesGcmResearchCipher(keyring);
  } catch {
    throw new Error('invalid_research_encryption_key_configuration');
  }
}
