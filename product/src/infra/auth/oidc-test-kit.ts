import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import type { OidcConfig } from './oidc-config';

/**
 * TEST-ONLY helpers (not wired into any module): runtime-generated signing keys and an
 * in-memory JWKS so OIDC tests never use the network or committed key material.
 */
export const TEST_ISSUER = 'https://idp.test.invalid/realms/north';
export const TEST_AUDIENCE = 'north-star-api';

export interface TestSigningKey {
  readonly kid: string;
  readonly alg: string;
  readonly privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
  readonly publicJwk: JWK;
}

export async function createTestKey(kid: string, alg = 'RS256'): Promise<TestSigningKey> {
  const { publicKey, privateKey } = await generateKeyPair(alg, { extractable: true });
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg, use: 'sig' };
  return { kid, alg, privateKey, publicJwk };
}

export function testConfig(overrides: Partial<OidcConfig> = {}): OidcConfig {
  return {
    issuer: TEST_ISSUER,
    audiences: [TEST_AUDIENCE],
    jwksUri: 'https://idp.test.invalid/jwks',
    algorithms: ['RS256', 'PS256', 'ES256'],
    clockSkewSeconds: 30,
    jwksCacheMaxAgeMs: 600_000,
    jwksRefetchCooldownMs: 30_000,
    ...overrides,
  };
}

export interface MintOptions {
  readonly sub?: string;
  readonly iss?: string;
  readonly aud?: string;
  readonly expSecondsFromNow?: number | null;
  readonly nbfSecondsFromNow?: number;
  readonly kid?: string | null;
  readonly extraClaims?: Record<string, unknown>;
  readonly nowSeconds?: number;
  readonly typ?: string;
}

export async function mintToken(key: TestSigningKey, options: MintOptions = {}): Promise<string> {
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const header: { alg: string; kid?: string; typ: string } = { alg: key.alg, typ: options.typ ?? 'JWT' };
  if (options.kid !== null) header.kid = options.kid ?? key.kid;
  const jwt = new SignJWT({ ...(options.extraClaims ?? {}) })
    .setProtectedHeader(header)
    .setIssuer(options.iss ?? TEST_ISSUER)
    .setAudience(options.aud ?? TEST_AUDIENCE)
    .setSubject(options.sub ?? 'user-alice')
    .setIssuedAt(now);
  if (options.expSecondsFromNow !== null) jwt.setExpirationTime(now + (options.expSecondsFromNow ?? 300));
  if (options.nbfSecondsFromNow !== undefined) jwt.setNotBefore(now + options.nbfSecondsFromNow);
  return jwt.sign(key.privateKey);
}

/** Unsigned/HMAC token builders for negative tests (alg `none`, HS256 key confusion). */
export function b64url(value: unknown): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}
