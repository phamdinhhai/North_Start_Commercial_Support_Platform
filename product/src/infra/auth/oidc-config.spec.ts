import { describe, it, expect } from 'vitest';
import { loadOidcConfig, resolveAuthMode, OidcConfigError } from './oidc-config';
import { createOidcAuthenticator } from './oidc-auth.module';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';

const base = {
  DEPLOYMENT_MODE: 'production',
  AUTH_MODE: 'oidc',
  OIDC_ISSUER: 'https://idp.example.invalid/realms/north',
  OIDC_AUDIENCE: 'north-star-api',
  OIDC_JWKS_URI: 'https://idp.example.invalid/realms/north/protocol/openid-connect/certs',
} as NodeJS.ProcessEnv;

describe('OIDC configuration — fail closed', () => {
  it('defaults to legacy; only explicit oidc enables the new path; unknown values throw', () => {
    expect(resolveAuthMode({})).toBe('legacy');
    expect(resolveAuthMode({ AUTH_MODE: 'legacy' })).toBe('legacy');
    expect(resolveAuthMode({ AUTH_MODE: ' OIDC ' })).toBe('oidc');
    expect(() => resolveAuthMode({ AUTH_MODE: 'jwt' })).toThrow(OidcConfigError);
    expect(createOidcAuthenticator(new InMemoryMembershipStore(), {})).toBeNull();
  });

  it('accepts a complete production configuration with safe defaults', () => {
    const config = loadOidcConfig(base);
    expect(config).toMatchObject({ issuer: base.OIDC_ISSUER, audiences: ['north-star-api'], algorithms: ['RS256', 'PS256', 'ES256'], clockSkewSeconds: 30 });
    expect(createOidcAuthenticator(new InMemoryMembershipStore(), base)).not.toBeNull();
  });

  it.each([
    ['missing issuer', { OIDC_ISSUER: '' }],
    ['missing audience', { OIDC_AUDIENCE: ' , ' }],
    ['missing JWKS URI', { OIDC_JWKS_URI: undefined }],
    ['http issuer in production', { OIDC_ISSUER: 'http://idp.example.invalid' }],
    ['http loopback JWKS in production', { OIDC_JWKS_URI: 'http://127.0.0.1:8080/certs' }],
    ['relative URL', { OIDC_JWKS_URI: '/certs' }],
    ['credentials in URL', { OIDC_JWKS_URI: 'https://u:p@idp.example.invalid/certs' }],
    ['alg none', { OIDC_ALLOWED_ALGS: 'none' }],
    ['HS256 allowlisted', { OIDC_ALLOWED_ALGS: 'RS256,HS256' }],
    ['skew too large', { OIDC_CLOCK_SKEW_SECONDS: '3600' }],
    ['skew not integer', { OIDC_CLOCK_SKEW_SECONDS: '1e3' }],
    ['cooldown too small', { OIDC_JWKS_COOLDOWN_SECONDS: '0' }],
    ['absolute key age below refresh age', { OIDC_JWKS_MAX_STALE_SECONDS: '599' }],
    ['unbounded absolute key age', { OIDC_JWKS_MAX_STALE_SECONDS: '172801' }],
    ['demo enabled in production', { DEMO_WORKSPACES: 'true' }],
    ['unsigned dev tokens in production', { AUTH_DEV_UNSIGNED_TOKENS: 'true' }],
  ])('rejects %s', (_label, overrides) => {
    const env = { ...base, ...overrides } as NodeJS.ProcessEnv;
    expect(() => loadOidcConfig(env)).toThrow(OidcConfigError);
    expect(() => createOidcAuthenticator(new InMemoryMembershipStore(), env)).toThrow(OidcConfigError);
  });

  it('pilot mode is as strict as production', () => {
    expect(() => loadOidcConfig({ ...base, DEPLOYMENT_MODE: 'pilot', DEMO_WORKSPACES: 'true' })).toThrow(OidcConfigError);
  });

  it('allows plain-http loopback only for local/test deployments', () => {
    const env = { ...base, DEPLOYMENT_MODE: 'test', OIDC_ISSUER: 'http://127.0.0.1:8080/realms/n', OIDC_JWKS_URI: 'http://localhost:8080/certs' };
    expect(loadOidcConfig(env).jwksUri).toBe('http://localhost:8080/certs');
    expect(() => loadOidcConfig({ ...env, OIDC_ISSUER: 'http://idp.lan/realms/n' })).toThrow(OidcConfigError);
  });

  it('error messages never echo secret-looking values', () => {
    try {
      loadOidcConfig({ ...base, OIDC_JWKS_URI: 'https://user:hunter2@idp.example.invalid/certs' });
    } catch (error) {
      expect(String(error)).not.toContain('hunter2');
    }
  });
});
