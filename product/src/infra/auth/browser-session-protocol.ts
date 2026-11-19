import { createHash, timingSafeEqual } from 'node:crypto';
import { jwtVerify } from 'jose';
import { BrowserSessionError } from '../../ports/browser-session';
import type { BrowserSessionConfig } from './browser-session-config';
import { httpJwksFetcher, JwksKeyStore } from './jwks-key-store';
import { OidcTokenVerifier } from './oidc-token-verifier';

export interface BrowserTokenSet { readonly accessToken: string; readonly subject: string; readonly expiresAt: number }
export interface BrowserCodeExchange { (code: string, verifier: string, nonce: string): Promise<BrowserTokenSet> }
export const digestOpaque = (value: string): string => createHash('sha256').update(value).digest('hex');
export function equalOpaque(a: string, b: string): boolean {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function codeExchange(config: BrowserSessionConfig): BrowserCodeExchange {
  const keys = new JwksKeyStore(httpJwksFetcher(config.oidc.jwksUri), {
    cacheMaxAgeMs: config.oidc.jwksCacheMaxAgeMs, refetchCooldownMs: config.oidc.jwksRefetchCooldownMs,
  });
  return async (code, verifier, nonce) => {
    const response = await fetch(config.tokenEndpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, redirect_uri: config.redirectUri,
        code, code_verifier: verifier }) });
    const body = await response.text();
    if (response.status !== 200 || body.length > 32768) throw new BrowserSessionError('LOGIN_EXCHANGE_FAILED', 401);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(body) as Record<string, unknown>; } catch { throw new BrowserSessionError('LOGIN_EXCHANGE_FAILED', 401); }
    if (parsed.token_type !== 'Bearer' || typeof parsed.access_token !== 'string' || parsed.access_token.length > 8192 ||
        typeof parsed.id_token !== 'string' || parsed.id_token.length > 8192 || !Number.isInteger(parsed.expires_in) ||
        Number(parsed.expires_in) < 1 || Number(parsed.expires_in) > 900) throw new BrowserSessionError('LOGIN_TOKEN_INVALID', 401);
    const { payload, protectedHeader } = await jwtVerify(parsed.id_token, keys.getKey, { issuer: config.oidc.issuer,
      audience: config.clientId, algorithms: [...config.oidc.algorithms], requiredClaims: ['exp', 'iat', 'sub', 'nonce'],
      clockTolerance: config.oidc.clockSkewSeconds });
    if (typeof protectedHeader.kid !== 'string' || typeof payload.sub !== 'string' || payload.nonce !== nonce ||
        (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== config.clientId) ||
        (payload.azp !== undefined && payload.azp !== config.clientId)) throw new BrowserSessionError('LOGIN_TOKEN_INVALID', 401);
    const access = await new OidcTokenVerifier(config.oidc, keys).verify(parsed.access_token);
    if (!access.ok || access.principal.subject !== payload.sub) throw new BrowserSessionError('LOGIN_TOKEN_INVALID', 401);
    return { accessToken: parsed.access_token, subject: payload.sub,
      expiresAt: Math.min(Number(payload.exp) * 1000, Date.now() + Number(parsed.expires_in) * 1000) };
  };
}
