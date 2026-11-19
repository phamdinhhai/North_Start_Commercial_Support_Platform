import { Logger } from '@nestjs/common';
import { boundedResponseText } from './bounded-response';
import { createLocalJWKSet, errors, type JSONWebKeySet, type JWK, type JWSHeaderParameters, type FlattenedJWSInput } from 'jose';

/**
 * JWKS cache with bounded refetch (key rotation) for the experimental OIDC verifier.
 *
 * - The fetcher is injectable: tests use an in-memory JWKS with runtime-generated keys.
 * - Unknown `kid` triggers at most ONE refetch, and refetches are rate limited by a cooldown,
 *   so a flood of tokens with random `kid` values cannot amplify into IdP traffic.
 * - Fetched sets are sanitized (JWKS poisoning hardening): symmetric keys, private key
 *   material, encryption-only keys and keys without `kid` are never used for verification.
 */
export type JwksFetcher = () => Promise<unknown>;

export interface JwksKeyStoreOptions {
  readonly cacheMaxAgeMs: number;
  readonly refetchCooldownMs: number;
  readonly now?: () => number;
}

const MAX_KEYS = 50;
const MAX_JWKS_BYTES = 64 * 1024;
const ASYMMETRIC_KTY = new Set(['RSA', 'EC', 'OKP']);
const PRIVATE_PARAMS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'k'];

export class JwksUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwksUnavailableError';
  }
}

/** Returns only public, signature-capable asymmetric keys; throws if the document is unusable. */
export function sanitizeJwks(document: unknown): JSONWebKeySet {
  if (!document || typeof document !== 'object' || !Array.isArray((document as { keys?: unknown }).keys)) {
    throw new JwksUnavailableError('JWKS document has no keys array');
  }
  const raw = (document as { keys: unknown[] }).keys;
  if (raw.length > MAX_KEYS) throw new JwksUnavailableError('JWKS document has too many keys');
  const keys: JWK[] = [];
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object') continue;
    const jwk = candidate as JWK & Record<string, unknown>;
    // A published private key means the IdP or the transport is compromised/misconfigured:
    // reject the WHOLE document rather than silently trusting the remaining keys.
    if (PRIVATE_PARAMS.some((param) => param in jwk)) {
      throw new JwksUnavailableError('JWKS document contains private or symmetric key material');
    }
    if (typeof jwk.kty !== 'string' || !ASYMMETRIC_KTY.has(jwk.kty)) continue;
    if (typeof jwk.kid !== 'string' || jwk.kid.length === 0 || jwk.kid.length > 256) continue;
    if (jwk.use !== undefined && jwk.use !== 'sig') continue;
    if (Array.isArray(jwk.key_ops) && !jwk.key_ops.includes('verify')) continue;
    keys.push(jwk);
  }
  return { keys };
}

/** Production fetcher: HTTPS (validated in config), no redirects, timeout and size bound. */
export function httpJwksFetcher(uri: string, timeoutMs = 5_000): JwksFetcher {
  return async () => {
    const response = await fetch(uri, {
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/jwk-set+json, application/json' },
    });
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      throw new JwksUnavailableError(`JWKS endpoint returned ${response.status}`);
    }
    const body = await boundedResponseText(response, MAX_JWKS_BYTES);
    return JSON.parse(body) as unknown;
  };
}

export class JwksKeyStore {
  private readonly logger = new Logger(JwksKeyStore.name);
  private readonly now: () => number;
  private resolver: ReturnType<typeof createLocalJWKSet> | null = null;
  private fetchedAt = 0;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  private inflight: Promise<void> | null = null;
  /** Network fetch count — exposed for rate-limit tests and operational metrics. */
  fetchCount = 0;

  constructor(private readonly fetcher: JwksFetcher, private readonly options: JwksKeyStoreOptions) {
    this.now = options.now ?? Date.now;
  }

  /** jose-compatible key getter: `jwtVerify(token, store.getKey)`. */
  readonly getKey = async (header: JWSHeaderParameters, token: FlattenedJWSInput) => {
    if (!this.resolver || this.now() - this.fetchedAt >= this.options.cacheMaxAgeMs) {
      await this.refresh(false);
    }
    try {
      return await this.current()(header, token);
    } catch (error) {
      if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
      // Possible rotation: exactly one refetch, unless one happened within the cooldown.
      const refreshed = await this.refresh(true);
      if (!refreshed) throw error;
      return this.current()(header, token);
    }
  };

  private current(): ReturnType<typeof createLocalJWKSet> {
    if (!this.resolver) throw new JwksUnavailableError('JWKS not loaded');
    return this.resolver;
  }

  /** Returns true when a new document was fetched and installed. */
  private async refresh(forUnknownKid: boolean): Promise<boolean> {
    if (!this.inflight) {
      // Within the cooldown no network call is made: an unknown kid fails, a stale cache keeps
      // serving the previous set, and an empty cache (IdP outage) fails closed.
      if (this.now() - this.lastAttemptAt < this.options.refetchCooldownMs) {
        if (!this.resolver) throw new JwksUnavailableError('JWKS unavailable');
        return false;
      }
      this.inflight = this.fetchAndInstall().finally(() => { this.inflight = null; });
    }
    try {
      await this.inflight;
      return true;
    } catch (error) {
      // Keep the previous key set on failure (availability) but never invent keys.
      this.logger.warn(`JWKS refresh failed: ${error instanceof Error ? error.name : 'unknown error'}`);
      if (!this.resolver) throw new JwksUnavailableError('JWKS unavailable');
      return false;
    }
  }

  private async fetchAndInstall(): Promise<void> {
    this.lastAttemptAt = this.now();
    this.fetchCount += 1;
    const sanitized = sanitizeJwks(await this.fetcher());
    this.resolver = createLocalJWKSet(sanitized);
    this.fetchedAt = this.now();
  }
}
