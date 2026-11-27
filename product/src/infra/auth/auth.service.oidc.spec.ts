import { describe, it, expect, afterEach } from 'vitest';
import { AuthService } from './auth.service';
import { VerifiedContextRegistry } from './verified-context-registry';

const KEYS = ['AUTH_MODE', 'AUTH_DEV_UNSIGNED_TOKENS', 'BOOTSTRAP_TOKEN', 'DEMO_WORKSPACES'] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

describe('AuthService — AUTH_MODE=oidc seam (ADR-006)', () => {
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('returns only the context attached to this request (brand), never one rebuilt from header values', () => {
    process.env.AUTH_MODE = 'oidc';
    const registry = new VerifiedContextRegistry();
    const svc = new AuthService(registry);
    const headers: Record<string, string | undefined> = { authorization: 'Bearer anything' };
    registry.attach(headers, { workspaceId: 'ws-a', userId: 'alice', role: 'sales', isDemo: false });
    expect(svc.resolve({ headers })).toEqual({ workspaceId: 'ws-a', userId: 'alice', role: 'sales', isDemo: false });
    // A-M5: server-side shallow copies (spread, Fastify's Object.assign merge) keep the request brand.
    expect(svc.resolve({ headers: { ...headers } })).toEqual({ workspaceId: 'ws-a', userId: 'alice', role: 'sales', isDemo: false });
    expect(svc.resolve({ headers: Object.assign({}, headers, { 'x-extra': '1' }) })?.userId).toBe('alice');
    // What a client can reproduce — identical string values, JSON round-trip, any header named
    // like the brand — does not match.
    expect(svc.resolve({ headers: { authorization: 'Bearer anything' } })).toBeNull();
    expect(svc.resolve({ headers: JSON.parse(JSON.stringify(headers)) })).toBeNull();
    expect(svc.resolve({ headers: { authorization: 'Bearer anything', 'north.verifiedContext': '{}', 'Symbol(north.verifiedContext)': '{}' } })).toBeNull();
    // A brand from another registry instance is unknown here; a request is branded at most once.
    const other = new VerifiedContextRegistry();
    expect(other.lookup(headers)).toBeNull();
    expect(() => registry.attach(headers, { workspaceId: 'ws-b', userId: 'mallory', role: 'admin', isDemo: false })).toThrow();
    expect(svc.resolve({ headers })?.workspaceId).toBe('ws-a');
    // Headers are not mutated in any visible (string-keyed) way.
    expect(Object.keys(headers)).toEqual(['authorization']);
    expect(JSON.stringify(headers)).toBe('{"authorization":"Bearer anything"}');
  });

  it('without a lookup (e.g. manually constructed), OIDC mode denies every bearer', () => {
    process.env.AUTH_MODE = 'oidc';
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    process.env.BOOTSTRAP_TOKEN = 'boot-test-value';
    const svc = new AuthService();
    const token = Buffer.from(JSON.stringify({ workspaceId: 'w', userId: 'u', role: 'sales' })).toString('base64');
    expect(svc.resolve({ headers: { authorization: `Bearer ${token}` } })).toBeNull();
    expect(svc.resolve({ headers: { 'x-bootstrap-token': 'boot-test-value' } })).toBeNull();
  });

  it('unknown AUTH_MODE fails closed per request', () => {
    process.env.AUTH_MODE = 'bogus';
    process.env.BOOTSTRAP_TOKEN = 'boot-test-value';
    expect(new AuthService().resolve({ headers: { 'x-bootstrap-token': 'boot-test-value' } })).toBeNull();
  });

  it('demo sandbox path is unchanged (opt-in, viewer, demo: prefix)', () => {
    process.env.AUTH_MODE = 'oidc';
    process.env.DEMO_WORKSPACES = 'true';
    expect(new AuthService().resolve({ headers: { 'x-demo-workspace': 'ws-x' } }))
      .toEqual({ workspaceId: 'demo:ws-x', userId: 'demo:ws-x:viewer', role: 'viewer', isDemo: true });
  });

  it('registry ignores non-object keys', () => {
    expect(new VerifiedContextRegistry().lookup(null as never)).toBeNull();
  });
});
