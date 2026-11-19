import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import type { AuthContext } from '../../ports/auth';
import type { BrowserHeaders } from '../../ports/browser-session';
import { BrowserSessionService } from './browser-session.service';
import type { BrowserSessionConfig } from './browser-session-config';
import { loadBrowserSessionConfig } from './browser-session-config';
import { OidcAuthenticator } from './oidc-authenticator';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';
import { testConfig } from './oidc-test-kit';

const config: BrowserSessionConfig = { oidc: testConfig(), origin: 'http://127.0.0.1:3100',
  authorizationEndpoint: 'http://127.0.0.1:3200/authorize', tokenEndpoint: 'http://127.0.0.1:3200/token',
  clientId: 'north-browser', redirectUri: 'http://127.0.0.1:3100/v1/auth/callback', secure: false };
const pair = (cookie: string) => cookie.split(';')[0];
async function fixture() {
  const members = new InMemoryMembershipStore();
  const membership = await members.grant({ workspaceId: 'ws-a', issuer: config.oidc.issuer, subject: 'alice', baseRole: 'sales' });
  const auth = new OidcAuthenticator({ verify: async token => token === 'verified-test-access'
    ? { ok: true, principal: { issuer: config.oidc.issuer, subject: 'alice' } } : { ok: false, reason: 'signature' } }, members);
  let now = Date.now();
  const exchange = vi.fn(async (_code: string, _verifier: string, _nonce: string) =>
    ({ accessToken: 'verified-test-access', subject: 'alice', expiresAt: now + 300_000 }));
  const service = new BrowserSessionService(config, auth, exchange, () => now);
  const begin = service.begin();
  const url = new URL(begin.location);
  const result = await service.complete({ state: url.searchParams.get('state')!, code: 'authorized-code' }, { cookie: pair(begin.cookies[0]) });
  const cookie = pair(result.cookies[1]);
  const ctx: AuthContext = { workspaceId: 'ws-a', userId: membership.userId, role: 'sales', isDemo: false };
  return { service, auth, members, exchange, begin, result, cookie, ctx, advance: () => { now += 301_000; } };
}
describe('R4 browser sessions', () => {
  it('binds OIDC state/nonce and PKCE, stores tokens only on the server, uses HttpOnly cookies', async () => {
    const f = await fixture(); const url = new URL(f.begin.location);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const [, verifier, nonce] = f.exchange.mock.calls[0];
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(url.searchParams.get('nonce')).toBe(nonce);
    expect(f.result.cookies[1]).toContain('HttpOnly; SameSite=Lax');
    const view = f.service.view({ cookie: f.cookie }, f.ctx);
    expect(view.authenticated).toBe(true); expect(view.context?.role).toBe('sales');
    expect(JSON.stringify(view)).not.toContain('verified-test-access');
    expect(JSON.stringify(f.result)).not.toContain('verified-test-access');
  });
  it('requires matching Origin and session CSRF for mutations; never trusts role claims or a mixed credential', async () => {
    const f = await fixture(); const csrf = f.service.view({ cookie: f.cookie }, f.ctx).csrfToken!;
    for (const headers of [{ cookie: f.cookie }, { cookie: f.cookie, origin: 'https://evil.invalid', 'x-csrf-token': csrf },
      { cookie: f.cookie, origin: config.origin, 'x-csrf-token': 'wrong' }]) {
      expect(f.service.prepare(headers, 'POST')).toMatchObject({ kind: 'rejected', status: 403 });
    }
    const headers: BrowserHeaders = { cookie: f.cookie, origin: config.origin, 'x-csrf-token': csrf };
    expect(f.service.prepare(headers, 'POST')).toEqual({ kind: 'session' });
    expect((await f.auth.authenticate(headers)).kind).toBe('authenticated');
    expect(f.service.prepare({ cookie: f.cookie, authorization: 'Bearer arbitrary' }, 'GET')).toMatchObject({ status: 400 });
    expect(f.service.prepare({ cookie: f.cookie, 'x-workspace-id': 'foreign' }, 'GET')).toMatchObject({ status: 400 });
  });
  it('retains per-request membership revocation and expires/logout sessions', async () => {
    const f = await fixture(); const headers: BrowserHeaders = { cookie: f.cookie };
    f.service.prepare(headers, 'GET');
    await f.members.revoke({ workspaceId: 'ws-a', issuer: config.oidc.issuer, subject: 'alice' });
    expect((await f.auth.authenticate(headers)).kind).toBe('forbidden');
    expect(f.service.logout({ cookie: f.cookie })).toContain('Max-Age=0');
    expect(f.service.prepare({ cookie: f.cookie }, 'GET')).toMatchObject({ code: 'SESSION_EXPIRED' });
    const another = await fixture(); another.advance();
    expect(another.service.prepare({ cookie: another.cookie }, 'GET')).toMatchObject({ status: 401 });
  });
  it('refuses replay, missing binding, errors and foreign workspace login without provisioning', async () => {
    const f = await fixture(); const url = new URL(f.begin.location);
    await expect(f.service.complete({ state: url.searchParams.get('state')!, code: 'again' },
      { cookie: pair(f.begin.cookies[0]) })).rejects.toMatchObject({ code: 'LOGIN_STATE_INVALID' });
    const start = f.service.begin(); const state = new URL(start.location).searchParams.get('state')!;
    await expect(f.service.complete({ state, code: 'code' }, {})).rejects.toMatchObject({ status: 401 });
    const foreign = f.service.begin('ws-foreign');
    await expect(f.service.complete({ state: new URL(foreign.location).searchParams.get('state')!, code: 'code' },
      { cookie: pair(foreign.cookies[0]) })).rejects.toMatchObject({ code: 'LOGIN_MEMBERSHIP_REQUIRED' });
  });
  it('fails closed when disabled and validates production HTTPS/config without changing existing roles', () => {
    const disabled = new BrowserSessionService(null, null);
    expect(disabled.view({}, null)).toMatchObject({ authenticated: false, loginAvailable: false });
    expect(() => disabled.begin()).toThrow('LOGIN_NOT_CONFIGURED');
    const env = { OIDC_BROWSER_ENABLED: 'true', AUTH_MODE: 'oidc', DEPLOYMENT_MODE: 'test',
      OIDC_BROWSER_ORIGIN: config.origin, OIDC_AUTHORIZATION_ENDPOINT: config.authorizationEndpoint,
      OIDC_TOKEN_ENDPOINT: config.tokenEndpoint, OIDC_CLIENT_ID: config.clientId, OIDC_ISSUER: config.oidc.issuer,
      OIDC_JWKS_URI: config.oidc.jwksUri, OIDC_AUDIENCE: 'north-star-api' };
    expect(loadBrowserSessionConfig(env)?.secure).toBe(false);
    expect(() => loadBrowserSessionConfig({ ...env, DEPLOYMENT_MODE: 'pilot' })).toThrow();
    expect(() => loadBrowserSessionConfig({ ...env, AUTH_MODE: 'legacy' })).toThrow();
    expect(() => loadBrowserSessionConfig({ ...env, OIDC_BROWSER_ORIGIN: `${config.origin}/evil` })).toThrow();
  });
});
