import { describe, it, expect } from 'vitest';
import { createCustomer, sameCustomer, type Customer } from './customer';

describe('Customer entity (I-01, R-07)', () => {
  it('creates a Customer with stable unique ID', () => {
    const c = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme Corp' });
    expect(c.id).toBeDefined();
    expect(typeof c.id).toBe('string');
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('creates distinct IDs for distinct Customers', () => {
    const a = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    const b = createCustomer({ workspaceId: 'ws-1', displayName: 'Beta' });
    expect(a.id).not.toBe(b.id);
  });

  it('Customer has NO leadId field (I-01 — separate entity)', () => {
    const c = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    // I-01: Customer must not own leads — no leadId / leadIds member
    expect('leadId' in c).toBe(false);
    expect('leadIds' in c).toBe(false);
  });

  it('requires workspaceId', () => {
    const c = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    expect(c.workspaceId).toBe('ws-1');
  });

  it('sets createdAt as ISO string', () => {
    const c = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    expect(new Date(c.createdAt).toISOString()).toBe(c.createdAt);
  });

  it('preserves displayName', () => {
    const c = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme Corp' });
    expect(c.displayName).toBe('Acme Corp');
  });

  it('sameCustomer returns true for same ID (I-07 stable identity)', () => {
    const c1 = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    const c2: Customer = { ...c1 };
    expect(sameCustomer(c1, c2)).toBe(true);
  });

  it('sameCustomer returns false for different IDs', () => {
    const a = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    const b = createCustomer({ workspaceId: 'ws-1', displayName: 'Acme' });
    expect(sameCustomer(a, b)).toBe(false);
  });
});
