import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpJwksFetcher } from './jwks-key-store';
import { codeExchange } from './browser-session-protocol';
import { testConfig } from './oidc-test-kit';

afterEach(() => vi.unstubAllGlobals());
const config = { oidc: testConfig(), origin: 'https://north.invalid', authorizationEndpoint: 'https://idp.invalid/auth',
  tokenEndpoint: 'https://idp.invalid/token', clientId: 'browser', redirectUri: 'https://north.invalid/v1/auth/callback', secure: true };

describe('authentication response allocation boundaries', () => {
  it.each(['jwks', 'token'] as const)('cancels oversized %s streams before consuming the rest, regardless of declared length', async kind => {
    const cancel = vi.fn();
    let pulls = 0;
    const response = new Response(new ReadableStream<Uint8Array>({
      pull(controller) { pulls++; controller.enqueue(new TextEncoder().encode('é'.repeat(8192))); }, cancel,
    }, { highWaterMark: 0 }), { headers: { 'content-length': '1' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const operation = kind === 'jwks' ? httpJwksFetcher('https://idp.invalid/jwks')()
      : codeExchange(config)('code', 'verifier', 'nonce');
    await expect(operation).rejects.toThrow('too large');
    expect(cancel).toHaveBeenCalledOnce();
    expect(pulls).toBe(kind === 'jwks' ? 5 : 3);
  });
  it.each(['jwks', 'token'] as const)('cancels rejected-status %s bodies without reading', async kind => {
    const cancel = vi.fn();
    const response = new Response(new ReadableStream({ cancel }, { highWaterMark: 0 }), { status: 503 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(kind === 'jwks' ? httpJwksFetcher('https://idp.invalid/jwks')()
      : codeExchange(config)('code', 'verifier', 'nonce')).rejects.toThrow();
    expect(cancel).toHaveBeenCalledOnce();
  });
  it.each(['null', '[]', 'false'])('rejects non-object token response %s', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(codeExchange(config)('code', 'verifier', 'nonce')).rejects.toMatchObject({ code: 'LOGIN_TOKEN_INVALID' });
  });
});
