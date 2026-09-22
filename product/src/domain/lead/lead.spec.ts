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
    it('Lead has optional customerId reference, NOT embedded customer data (I-01)', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'Test' });
      // I-01: Lead does not embed customer fields; customerId is just a reference
      expect(lead).not.toHaveProperty('customer');
      expect(lead).toHaveProperty('id');
      expect(lead).toHaveProperty('workspaceId');
      // customerId is optional — absent by default
      expect(lead.customerId).toBeUndefined();
    });

    it('Lead can reference a Customer via customerId (I-01 — reference, not ownership)', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'Test', customerId: 'cust-1' as any });
      expect(lead.customerId).toBe('cust-1');
    });
  });

  describe('I-02: Chain identity — source/lineage/attribution', () => {
    it('attribution defaults to UNKNOWN (MM-1) — no fabrication', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'T' });
      expect(lead.attribution).toBe('unknown');
    });

    it('conversationSource and acquisitionLineage are optional, never auto-filled', () => {
      const lead = createLead({ workspaceId: ws, displayName: 'T' });
      expect(lead.conversationSource).toBeUndefined();
      expect(lead.acquisitionLineage).toBeUndefined();
    });

    it('I-02: source and lineage stored separately — not collapsed', () => {
      const lead = createLead({
        workspaceId: ws,
        displayName: 'T',
        conversationSource: 'facebook_ad',
        acquisitionLineage: 'campaign_q4_2026',
      });
      expect(lead.conversationSource).toBe('facebook_ad');
      expect(lead.acquisitionLineage).toBe('campaign_q4_2026');
      expect(lead.conversationSource).not.toBe(lead.acquisitionLineage);
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
