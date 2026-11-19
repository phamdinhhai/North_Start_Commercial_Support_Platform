import { randomBytes } from 'node:crypto';
import { createHmacContentDigester, InMemoryWorkspaceKeyring, type ContentDigester, type WorkspaceDigestKey } from '../../ports/content-digester';

/** Process-local test keys are never a deployment fallback. Restarts deliberately lose these keys. */
class EphemeralKeyring extends InMemoryWorkspaceKeyring {
  override activeKey(workspaceId: string): WorkspaceDigestKey {
    try { return super.activeKey(workspaceId); } catch {
      this.rotate(workspaceId, `ephemeral-${randomBytes(12).toString('hex')}`, randomBytes(32));
      return super.activeKey(workspaceId);
    }
  }
}

/** Keys arrive only from server configuration; error messages never include configuration values. */
export function configuredContentDigester(env: NodeJS.ProcessEnv): ContentDigester {
  const encoded = env.CONTENT_DIGEST_KEYS_JSON;
  if (!encoded) {
    const mode = (env.DEPLOYMENT_MODE ?? env.APP_MODE ?? env.NODE_ENV ?? '').toLowerCase();
    if (mode === 'test' || (['local', 'development', 'dev', 'demo'].includes(mode) && env.CONTENT_DIGEST_EPHEMERAL === 'true')) {
      return createHmacContentDigester(new EphemeralKeyring());
    }
    throw new Error('content_digest_keys_required');
  }
  try {
    const config: unknown = JSON.parse(encoded);
    if (!Array.isArray(config) || config.length === 0) throw new Error();
    const keyring = new InMemoryWorkspaceKeyring();
    const workspaces = new Set<string>();
    for (const entry of config) {
      if (!entry || typeof entry !== 'object' || Object.keys(entry).sort().join() !== 'activeKid,keys,workspaceId' ||
          typeof entry.workspaceId !== 'string' || !entry.workspaceId || workspaces.has(entry.workspaceId) ||
          !Array.isArray(entry.keys) || !entry.keys.length || typeof entry.activeKid !== 'string') throw new Error();
      workspaces.add(entry.workspaceId);
      const keys = entry.keys as { kid: string; secretBase64: string }[];
      if (!keys.some((key) => key.kid === entry.activeKid)) throw new Error();
      // Rotate active last; retired keys are retained for verification without rewriting history.
      for (const key of [...keys.filter((k) => k.kid !== entry.activeKid), ...keys.filter((k) => k.kid === entry.activeKid)]) {
        if (!key || Object.keys(key).sort().join() !== 'kid,secretBase64' || typeof key.secretBase64 !== 'string') throw new Error();
        const bytes = Buffer.from(key.secretBase64, 'base64');
        if (bytes.toString('base64') !== key.secretBase64) throw new Error();
        keyring.rotate(entry.workspaceId, key.kid, bytes);
      }
    }
    return createHmacContentDigester(keyring);
  } catch { throw new Error('invalid_content_digest_key_configuration'); }
}
