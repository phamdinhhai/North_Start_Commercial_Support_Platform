import type { AuthMode } from '../../ports/auth';
import { resolveDeploymentMode } from '../postgres/postgres.service';

/**
 * Experimental OIDC configuration (AUTH_MODE=oidc). Every validation failure throws so that
 * application bootstrap fails closed instead of starting with a weaker verifier.
 * // ADR-006 — revocation applies on the next request (membership read per request); access token
 * TTL ≤ 15 min is enforced by the verifier. IdP product choice and session/refresh design are
 * not decided by ADR-006.
 */

/** Asymmetric JWS algorithms only. `none` and every HS* (shared secret) are never accepted. */
export const SUPPORTED_ASYMMETRIC_ALGS = Object.freeze([
  'RS256', 'RS384', 'RS512', 'PS256', 'PS384', 'PS512', 'ES256', 'ES384', 'EdDSA',
] as const);
const DEFAULT_ALGS = ['RS256', 'PS256', 'ES256'];

export interface OidcConfig {
  readonly issuer: string;
  readonly audiences: readonly string[];
  readonly jwksUri: string;
  readonly algorithms: readonly string[];
  readonly clockSkewSeconds: number;
  readonly jwksCacheMaxAgeMs: number;
  readonly jwksRefetchCooldownMs: number;
  readonly jwksMaxStaleAgeMs?: number;
}

export class OidcConfigError extends Error {
  constructor(message: string) {
    super(`OIDC configuration invalid: ${message}`);
    this.name = 'OidcConfigError';
  }
}

export function resolveAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const raw = (env.AUTH_MODE ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'legacy' || raw === 'stub') return 'legacy';
  if (raw === 'oidc') return 'oidc';
  throw new OidcConfigError(`unsupported AUTH_MODE '${raw.slice(0, 32)}'`);
}

function integerInRange(env: NodeJS.ProcessEnv, name: string, fallback: number, min: number, max: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new OidcConfigError(`${name} must be an integer`);
  const value = Number(raw);
  if (value < min || value > max) throw new OidcConfigError(`${name} must be between ${min} and ${max}`);
  return value;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** HTTPS is mandatory except plain-http loopback in local/test deployments. */
function parseEndpoint(name: string, raw: string | undefined, allowLoopbackHttp: boolean): URL {
  const value = raw?.trim();
  if (!value) throw new OidcConfigError(`${name} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OidcConfigError(`${name} must be an absolute URL`);
  }
  if (url.username || url.password || url.hash) throw new OidcConfigError(`${name} must not contain credentials or fragment`);
  const insecureAllowed = allowLoopbackHttp && url.protocol === 'http:' && isLoopback(url.hostname);
  if (url.protocol !== 'https:' && !insecureAllowed) throw new OidcConfigError(`${name} must use https`);
  return url;
}

export function loadOidcConfig(env: NodeJS.ProcessEnv = process.env): OidcConfig {
  const deployment = resolveDeploymentMode(env);
  const strict = deployment === 'production' || deployment === 'pilot';
  if (strict && env.DEMO_WORKSPACES === 'true') {
    throw new OidcConfigError(`DEMO_WORKSPACES must be off in ${deployment} mode`);
  }
  if (strict && env.AUTH_DEV_UNSIGNED_TOKENS === 'true') {
    throw new OidcConfigError(`AUTH_DEV_UNSIGNED_TOKENS must be off in ${deployment} mode`);
  }
  const allowLoopbackHttp = deployment === 'local' || deployment === 'test';
  // The issuer is compared as an exact string with the token `iss` claim, so keep it verbatim.
  parseEndpoint('OIDC_ISSUER', env.OIDC_ISSUER, allowLoopbackHttp);
  const issuer = (env.OIDC_ISSUER ?? '').trim();
  const jwksUri = parseEndpoint('OIDC_JWKS_URI', env.OIDC_JWKS_URI, allowLoopbackHttp).toString();
  const audiences = (env.OIDC_AUDIENCE ?? '').split(',').map((a) => a.trim()).filter(Boolean);
  if (audiences.length === 0) throw new OidcConfigError('OIDC_AUDIENCE is required');
  if (audiences.some((a) => a.length > 512)) throw new OidcConfigError('OIDC_AUDIENCE entry too long');
  const algorithms = (env.OIDC_ALLOWED_ALGS?.trim() ? env.OIDC_ALLOWED_ALGS.split(',') : DEFAULT_ALGS)
    .map((a) => a.trim()).filter(Boolean);
  if (algorithms.length === 0) throw new OidcConfigError('OIDC_ALLOWED_ALGS is empty');
  for (const alg of algorithms) {
    if (!(SUPPORTED_ASYMMETRIC_ALGS as readonly string[]).includes(alg)) {
      throw new OidcConfigError(`algorithm '${alg.slice(0, 16)}' is not an allowed asymmetric algorithm`);
    }
  }
  const cacheSeconds = integerInRange(env, 'OIDC_JWKS_CACHE_SECONDS', 600, 60, 86_400);
  const maximumSeconds = integerInRange(env, 'OIDC_JWKS_MAX_STALE_SECONDS', cacheSeconds + 900, cacheSeconds, 172_800);
  return Object.freeze({
    issuer,
    audiences: Object.freeze(audiences),
    jwksUri,
    algorithms: Object.freeze(algorithms),
    clockSkewSeconds: integerInRange(env, 'OIDC_CLOCK_SKEW_SECONDS', 30, 0, 120),
    jwksCacheMaxAgeMs: cacheSeconds * 1000,
    jwksMaxStaleAgeMs: maximumSeconds * 1000,
    jwksRefetchCooldownMs: integerInRange(env, 'OIDC_JWKS_COOLDOWN_SECONDS', 30, 5, 3_600) * 1000,
  });
}
