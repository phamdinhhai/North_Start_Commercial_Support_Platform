import { describe, it, expect } from 'vitest';
import { createHandoff, sameHandoffLead } from './handoff';
import type { LeadId } from '../lead/lead';

describe('Handoff package (R-11, I-07)', () => {
  const leadId = 'lead-001' as LeadId;
  const ws = 'ws-test-001';

  it('creates a handoff with stable leadId', () => {
    const h = createHandoff({ leadId, workspaceId: ws, context: 'Initial contact' });
    expect(h.leadId).toBe(leadId);
    expect(h.id).toBeTruthy();
  });

  it('handoff has unique ID', () => {
    const a = createHandoff({ leadId, workspaceId: ws, context: 'A' });
    const b = createHandoff({ leadId, workspaceId: ws, context: 'B' });
    expect(a.id).not.toBe(b.id);
  });

  it('preserves context string', () => {
    const h = createHandoff({ leadId, workspaceId: ws, context: 'VIP customer from ad campaign' });
    expect(h.context).toBe('VIP customer from ad campaign');
  });

  it('evidenceRefs defaults to empty array', () => {
    const h = createHandoff({ leadId, workspaceId: ws, context: 'Test' });
    expect(h.evidenceRefs).toEqual([]);
  });

  it('sameHandoffLead returns true for same lead', () => {
    const a = createHandoff({ leadId, workspaceId: ws, context: 'A' });
    const b = createHandoff({ leadId, workspaceId: ws, context: 'B' });
    expect(sameHandoffLead(a, b)).toBe(true);
  });

  it('sameHandoffLead returns false for different leads', () => {
    const a = createHandoff({ leadId, workspaceId: ws, context: 'A' });
    const b = createHandoff({ leadId: 'lead-002' as LeadId, workspaceId: ws, context: 'B' });
    expect(sameHandoffLead(a, b)).toBe(false);
  });

  it('sets createdAt as ISO string', () => {
    const before = Date.now();
    const h = createHandoff({ leadId, workspaceId: ws, context: 'Test' });
    expect(new Date(h.createdAt).getTime()).toBeGreaterThanOrEqual(before);
  });
});
