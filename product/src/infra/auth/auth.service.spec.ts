import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from './auth.service';

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64');
}

describe('AuthService — PH3 T3-03 (1-A stub, OPEN: PM-1)', () => {
  const svc = new AuthService();
  const prev = process.env.AUTH_DEV_UNSIGNED_TOKENS;
  beforeAll(() => {
    process.env.AUTH_DEV_UNSIGNED_TOKENS = 'true';
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.AUTH_DEV_UNSIGNED_TOKENS;
    else process.env.AUTH_DEV_UNSIGNED_TOKENS = prev;
  });

  it('demo workspace allowed without token', () => {
    const ctx = svc.resolve({ headers: { 'x-demo-workspace': 'ws-demo' } });
    expect(ctx?.isDemo).toBe(true);
    expect(svc.isAuthenticated(ctx, false)).toBe(true);
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
