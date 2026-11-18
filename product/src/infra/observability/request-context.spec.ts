import { describe, expect, it } from 'vitest';
import {
  bindRequestContext, contextForRaw, createRequestContext, currentRequestContext, isValidRequestId,
  resolveRequestId, runWithRequestContext,
} from './request-context';

const UUID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';

describe('correlation id', () => {
  it('accepts only a single canonical UUID and normalises case', () => {
    expect(resolveRequestId(UUID)).toBe(UUID);
    expect(resolveRequestId(UUID.toUpperCase())).toBe(UUID);
  });

  it.each([
    ['empty', ''],
    ['free text', 'hello-world-request'],
    ['phone number', '0912345678'],
    ['email', 'a@example.com'],
    ['header injection', `${UUID}\r\nset-cookie: x=1`],
    ['too long', `${UUID}-${UUID}`],
    ['array (duplicate header)', [UUID, UUID]],
    ['undefined', undefined],
  ])('rejects %s and generates a fresh id', (_label, inbound) => {
    const generated = resolveRequestId(inbound, () => 'generated');
    expect(generated).toBe('generated');
    expect(isValidRequestId(resolveRequestId(inbound))).toBe(true);
  });

  it('propagates through async continuations and isolates concurrent requests', async () => {
    const a = createRequestContext(undefined);
    const b = createRequestContext(undefined);
    const seen = await Promise.all([a, b].map((ctx) => runWithRequestContext(ctx, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await Promise.resolve();
      return currentRequestContext()?.requestId;
    })));
    expect(seen).toEqual([a.requestId, b.requestId]);
    expect(a.requestId).not.toBe(b.requestId);
    expect(currentRequestContext()).toBeUndefined();
  });

  it('binds a context to the raw request object only', () => {
    const raw = {};
    const ctx = createRequestContext(UUID);
    bindRequestContext(raw, ctx);
    expect(contextForRaw(raw)).toBe(ctx);
    expect(contextForRaw({})).toBeUndefined();
    expect(contextForRaw(undefined)).toBeUndefined();
  });
});
