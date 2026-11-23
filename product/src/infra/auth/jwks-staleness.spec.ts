import { describe, expect, it } from 'vitest';
import { JwksKeyStore } from './jwks-key-store';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { createTestKey, mintToken, testConfig } from './oidc-test-kit';

describe('absolute JWKS trust age during outages', () => {
  it('denies expired cached keys even inside retry cooldown and recovers only after a successful fetch', async () => {
    const key = await createTestKey('age-bound');
    let now = Date.now(), outage = false, calls = 0;
    const start = now;
    const store = new JwksKeyStore(async () => {
      calls++;
      if (outage) throw Error('fixture unavailable');
      return { keys: [key.publicJwk] };
    }, { cacheMaxAgeMs: 60_000, refetchCooldownMs: 30_000, maxStaleAgeMs: 120_000, now: () => now });
    const verifier = new OidcTokenVerifier(testConfig(), store, () => new Date(now));
    const token = () => mintToken(key, { nowSeconds: Math.floor(now / 1000) });
    expect((await verifier.verify(await token())).ok).toBe(true);
    outage = true; now = start + 119_000;
    expect((await verifier.verify(await token())).ok).toBe(true);
    expect(calls).toBe(2);
    now = start + 120_000;
    expect(await verifier.verify(await token())).toEqual({ ok: false, reason: 'jwks_unavailable' });
    expect(calls).toBe(2); // Failed attempt never resets the successful-fetch timestamp.
    outage = false;
    expect(await verifier.verify(await token())).toEqual({ ok: false, reason: 'jwks_unavailable' });
    now = start + 150_000;
    expect((await verifier.verify(await token())).ok).toBe(true);
    expect(calls).toBe(3);
  });
});
