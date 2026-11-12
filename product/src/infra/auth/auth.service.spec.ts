import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './auth.service';

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64');
}

describe('AuthService — PH3 T3-03 (1-A stub, OPEN: PM-1)', () => {
  const svc = new AuthService();
  const prev = process.env.AUTH_DEV_UNSIGNED_TOKENS;
  const prevDemo = process.env.DEMO_WORKSPACES;
  const prevBootstrap = process.env.BOOTSTRAP_TOKEN;
  beforeAll(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    process.env.DEMO_WORKSPACES = 'true';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.AUTH_DEV_UNSIGNED_TOKENS;
    else process.env.AUTH_DEV_UNSIGNED_TOKENS = prev;
    if (prevDemo === undefined) delete process.env.DEMO_WORKSPACES;
    else process.env.DEMO_WORKSPACES = prevDemo;
    if (prevBootstrap === undefined) delete process.env.BOOTSTRAP_TOKEN;
    else process.env.BOOTSTRAP_TOKEN = prevBootstrap;
  });

  it('demo workspace allowed without token, but always SANDBOXED to demo:<name>', () => {
    const ctx = svc.resolve({ headers: { 'x-demo-workspace': 'ws-demo' } });
    expect(ctx?.isDemo).toBe(true);
    expect(ctx?.workspaceId).toBe('demo:ws-demo');
    expect(svc.isAuthenticated(ctx, false)).toBe(true);
  });

  it('demo header cannot be used to address a real tenant workspace (P1 review)', () => {
    const ctx = svc.resolve({ headers: { 'x-demo-workspace': 'ws-real-tenant' } });
    expect(ctx?.workspaceId).not.toBe('ws-real-tenant');
    expect(ctx?.workspaceId).toBe('demo:ws-real-tenant');
    // two different tenants naming themselves in the demo header stay in separate sandboxes
    expect(svc.resolve({ headers: { 'x-demo-workspace': 'ws-a' } })?.workspaceId).toBe('demo:ws-a');
    expect(svc.resolve({ headers: { 'x-demo-workspace': 'ws-b' } })?.workspaceId).toBe('demo:ws-b');
  });

  it('demo mode is opt-in: with DEMO_WORKSPACES unset the header grants nothing (fail closed)', () => {
    process.env.DEMO_WORKSPACES = 'false';
    try {
      expect(svc.resolve({ headers: { 'x-demo-workspace': 'ws-demo' } })).toBeNull();
    } finally {
      process.env.DEMO_WORKSPACES = 'true';
    }
  });

  it('non-demo without token → unauthenticated', () => {
    const ctx = svc.resolve({ headers: {} });
    expect(ctx).toBeNull();
    expect(svc.isAuthenticated(ctx, false)).toBe(false);
  });

  it('demo route allows null ctx', () => {
    expect(svc.isAuthenticated(null, true)).toBe(true);
  });

  it('Bearer base64 token resolves workspace/user', () => {
    const token = b64({ workspaceId: 'ws-1', userId: 'sales-1', role: 'sales' });
    const ctx = svc.resolve({ headers: { authorization: `Bearer ${token}` } });
    expect(ctx?.workspaceId).toBe('ws-1');
    expect(ctx?.userId).toBe('sales-1');
  });

  it('does not read workspace from body (QA-32)', () => {
    const ctx = svc.resolve({ headers: {}, body: { workspaceId: 'ws-evil' } } as any);
    expect(ctx).toBeNull();
  });

  it('Bearer empty token → null', () => {
    const ctx = svc.resolve({ headers: { authorization: 'Bearer ' } });
    expect(ctx).toBeNull();
  });

  it('invalid base64 → null', () => {
    const ctx = svc.resolve({ headers: { authorization: 'Bearer not-base64!!!' } });
    expect(ctx).toBeNull();
  });

  it.each(['Bearer', 'Bearer ', 'Bearer  token extra', 'Basic token', 'bearer token'])(
    'malformed authorization header %j → null',
    (authorization) => {
      expect(svc.resolve({ headers: { authorization } })).toBeNull();
    },
  );

  it('unsigned bearer cannot spoof a privileged role even with the dev flag enabled', () => {
    const forged = b64({ workspaceId: 'ws-1', userId: 'attacker', role: 'admin' });
    expect(svc.resolve({ headers: { authorization: `Bearer ${forged}` } })).toBeNull();
  });

  it.each(['production', 'prod', 'pilot', 'invalid'])('refuses unsigned tokens in %s even with the dev flag enabled', (mode) => {
    const previous = process.env.DEPLOYMENT_MODE;
    process.env.DEPLOYMENT_MODE = mode;
    try {
      const token = b64({ workspaceId: 'ws-1', userId: 'owner', role: 'sales' });
      expect(svc.resolve({ headers: { authorization: `Bearer ${token}` } })).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.DEPLOYMENT_MODE;
      else process.env.DEPLOYMENT_MODE = previous;
    }
  });

  it('unsigned Bearer token rejected unless dev flag is explicitly on (forgery guard)', () => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'false';
    try {
      const forged = b64({ workspaceId: 'ws-1', userId: 'attacker', role: 'admin' });
      expect(svc.resolve({ headers: { authorization: `Bearer ${forged}` } })).toBeNull();
    } finally {
      process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    }
  });
});

describe('AuthService — bootstrap + fallback paths (security-critical, 100% line target)', () => {
  const svc = new AuthService();
  const prev = process.env.BOOTSTRAP_TOKEN;

  it('one-time bootstrap token grants admin ONLY when it matches the env value', () => {
    process.env.BOOTSTRAP_TOKEN = 'sup3r-secret-bootstrap';
    try {
      const ctx = svc.resolve({ headers: { 'x-bootstrap-token': 'sup3r-secret-bootstrap' } });
      expect(ctx).toMatchObject({ workspaceId: 'bootstrap', userId: 'bootstrap-admin', role: 'admin', isDemo: false });
      // wrong value → no auth context at all (no partial grant, no role downgrade)
      expect(svc.resolve({ headers: { 'x-bootstrap-token': 'wrong' } })).toBeNull();
    } finally {
      if (prev === undefined) delete process.env.BOOTSTRAP_TOKEN;
      else process.env.BOOTSTRAP_TOKEN = prev;
    }
  });

  it('with BOOTSTRAP_TOKEN unset the header grants nothing (fail closed)', () => {
    delete process.env.BOOTSTRAP_TOKEN;
    expect(svc.resolve({ headers: { 'x-bootstrap-token': 'anything' } })).toBeNull();
  });

  it('bootstrap rejects empty, oversized, and near-match secrets', () => {
    process.env.BOOTSTRAP_TOKEN = 'bootstrap-secret';
    try {
      expect(svc.resolve({ headers: { 'x-bootstrap-token': '' } })).toBeNull();
      expect(svc.resolve({ headers: { 'x-bootstrap-token': 'bootstrap-secret ' } })).toBeNull();
      process.env.BOOTSTRAP_TOKEN = 'x'.repeat(4097);
      expect(svc.resolve({ headers: { 'x-bootstrap-token': 'x'.repeat(4097) } })).toBeNull();
    } finally {
      delete process.env.BOOTSTRAP_TOKEN;
    }
  });

  it('a base64 token missing userId is rejected; missing role defaults to sales, never admin', () => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
    const noUser = Buffer.from(JSON.stringify({ workspaceId: 'ws-1' })).toString('base64');
    expect(svc.resolve({ headers: { authorization: `Bearer ${noUser}` } })).toBeNull();
    const noRole = Buffer.from(JSON.stringify({ workspaceId: 'ws-1', userId: 'u' })).toString('base64');
    expect(svc.resolve({ headers: { authorization: `Bearer ${noRole}` } })?.role).toBe('sales');
  });
});
