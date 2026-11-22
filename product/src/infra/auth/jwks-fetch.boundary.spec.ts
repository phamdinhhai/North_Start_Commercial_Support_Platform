import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpJwksFetcher } from './jwks-key-store';
import { loadOidcConfig } from './oidc-config';
import { developmentTokensAllowed } from './browser-session-config';

afterEach(() => vi.unstubAllGlobals());
describe('network JWKS and browser developer boundary', () => {
  it('uses bounded non-redirecting fetch and only accepts a bounded successful JSON response', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"keys":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await httpJwksFetcher('https://fixture.invalid/jwks')()).toEqual({ keys: [] });
    expect(fetcher).toHaveBeenCalledWith('https://fixture.invalid/jwks', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }));
    fetcher.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    await expect(httpJwksFetcher('https://fixture.invalid/jwks')()).rejects.toThrow('returned 404');
    fetcher.mockResolvedValueOnce(new Response('x'.repeat(65537), { status: 200 }));
    await expect(httpJwksFetcher('https://fixture.invalid/jwks')()).rejects.toThrow('too large');
    fetcher.mockResolvedValueOnce(new Response('{invalid', { status: 200 }));
    await expect(httpJwksFetcher('https://fixture.invalid/jwks')()).rejects.toThrow();
  });
  it('rejects malformed numeric configuration rather than coercing it', () => {
    expect(() => loadOidcConfig({ DEPLOYMENT_MODE: 'test', OIDC_ISSUER: 'https://fixture.invalid', OIDC_AUDIENCE: 'api',
      OIDC_JWKS_URI: 'https://fixture.invalid/jwks', OIDC_CLOCK_SKEW_SECONDS: '1evil' })).toThrow();
    expect(developmentTokensAllowed({ AUTH_MODE: 'legacy', DEPLOYMENT_MODE: 'test', AUTH_DEV_UNSIGNED_TOKENS: 'true' })).toBe(true);
    expect(developmentTokensAllowed({ AUTH_MODE: 'legacy', DEPLOYMENT_MODE: 'pilot', NODE_ENV: 'test', AUTH_DEV_UNSIGNED_TOKENS: 'true' })).toBe(false);
    expect(developmentTokensAllowed({ AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test', AUTH_DEV_UNSIGNED_TOKENS: 'true' })).toBe(false);
    expect(developmentTokensAllowed({ AUTH_MODE: 'invalid', AUTH_DEV_UNSIGNED_TOKENS: 'true' })).toBe(false);
  });
});
