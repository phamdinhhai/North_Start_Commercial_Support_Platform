import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignJWT } from 'jose';
import { codeExchange } from './browser-session-protocol';
import { createTestKey, mintToken, testConfig } from './oidc-test-kit';
import type { BrowserSessionConfig } from './browser-session-config';

const config: BrowserSessionConfig = { oidc: testConfig(), origin: 'https://north.test.invalid',
  authorizationEndpoint: 'https://idp.test.invalid/authorize', tokenEndpoint: 'https://idp.test.invalid/token',
  clientId: 'north-browser', redirectUri: 'https://north.test.invalid/v1/auth/callback', secure: true };
afterEach(() => vi.unstubAllGlobals());
async function responses(options: { nonce?: string; subject?: string; expires?: number; status?: number; malformed?: boolean } = {}) {
  const key = await createTestKey('browser-test-key');
  const access = await mintToken(key, { sub: 'alice' });
  const id = await new SignJWT({ nonce: options.nonce ?? 'bound-nonce' })
    .setProtectedHeader({ alg: key.alg, kid: key.kid }).setIssuer(config.oidc.issuer).setAudience(config.clientId)
    .setSubject(options.subject ?? 'alice').setIssuedAt().setExpirationTime('5m').sign(key.privateKey);
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === config.oidc.jwksUri) return new Response(JSON.stringify({ keys: [key.publicJwk] }), { status: 200 });
    expect(url).toBe(config.tokenEndpoint);
    expect(init?.redirect).toBe('error');
    const params = new URLSearchParams(String(init?.body));
    expect(params.get('code_verifier')).toBe('bound-verifier');
    expect(params.get('redirect_uri')).toBe(config.redirectUri);
    return new Response(options.malformed ? '{bad' : JSON.stringify({ token_type: 'Bearer', access_token: access,
      id_token: id, expires_in: options.expires ?? 300 }), { status: options.status ?? 200 });
  });
  vi.stubGlobal('fetch', fetcher);
  return { fetcher, access };
}
describe('OIDC browser token exchange boundary', () => {
  it('verifies signed ID token nonce and access token subject without passing credentials to the browser', async () => {
    const fixture = await responses();
    const result = await codeExchange(config)('bound-code', 'bound-verifier', 'bound-nonce');
    expect(result.subject).toBe('alice'); expect(result.accessToken).toBe(fixture.access);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(fixture.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([{ nonce: 'wrong' }, { subject: 'other-user' }, { expires: 3600 }, { status: 500 }, { malformed: true }])
    ('rejects mismatched nonce/identity, lifetime and malformed/exchange failures: %o', async options => {
      await responses(options);
      await expect(codeExchange(config)('bound-code', 'bound-verifier', 'bound-nonce')).rejects.toThrow();
    });
});
