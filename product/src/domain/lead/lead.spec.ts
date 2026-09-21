import { describe, it, expect } from 'vitest';
import { createLead, sameLead } from './lead';

describe('Lead entity', () => {
  const ws = 'ws-test-001';

  describe('I-07: Stable Lead ID — immutable', () => {
    it('generates a unique ID on create', () => {
      const a = createLead({ workspaceId: ws, displayName: 'A' });
      const b = createLead({ workspaceId: ws, displayName: 'B' });
      expect(a.id).not.toBe(b.id);
    });

    it('sameLead returns true for same ID', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'X' });
      expect(sameLead(lead, lead)).toBe(true);
    });

    it('sameLead returns false for different IDs', () => {
      const a = createLead({ workspaceId: ws, displayName: 'A' });
      const b = createLead({ workspaceId: ws, displayName: 'B' });
      expect(sameLead(a, b)).toBe(false);
    });
  });

  describe('I-01: Customer ≠ Lead', () => {
    it('Lead has no customerId field — separate entity', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'Test' });
      expect(lead).not.toHaveProperty('customerId');
      expect(lead).toHaveProperty('id');
      expect(lead).toHaveProperty('workspaceId');
    });
  });

  describe('I-08: UNKNOWN valid state', () => {
    it('UNKNOWN is a valid status', () => {
      const lead = createLead({
        workspaceId: ws,
        displayName: 'Unknown Lead',
        status: 'Unknown',
      });
      expect(lead.status).toBe('Unknown');
    });

    it('default status is New', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'New' });
      expect(lead.status).toBe('New');
    });
  });

  describe('createLead', () => {
    it('sets createdAt as ISO string', () => {
      const before = Date.now();
      const lead = createLead({ workspaceId: ws, displayName: 'T' });
      const ts = new Date(lead.createdAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(Date.now());
    });

    it('preserves displayName', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'Acme Corp' });
      expect(lead.displayName).toBe('Acme Corp');
    });

    it('preserves workspaceId', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'S' });
      expect(lead.workspaceId).toBe(ws);
    });
  });
});
