import { describe, it, expect } from 'vitest';
import { createOutcome, correctOutcome } from './outcome';
import type { LeadId } from '../lead/lead';

const leadId = 'lead-123' as unknown as LeadId;

describe('Outcome — R-15, I-08, I-05', () => {
  it('Won/Lost/Unknown are all valid (I-08)', () => {
    expect(createOutcome({ leadId, workspaceId: 'ws-1', value: 'Won', actor: 'sales-1' }).value).toBe('Won');
    expect(createOutcome({ leadId, workspaceId: 'ws-1', value: 'Lost', actor: 'sales-1' }).value).toBe('Lost');
    expect(createOutcome({ leadId, workspaceId: 'ws-1', value: 'Unknown', actor: 'sales-1' }).value).toBe('Unknown');
  });

  it('defaults acquisitionMode to user_confirmed, assertionStatus to claimed (R-15)', () => {
    const o = createOutcome({ leadId, workspaceId: 'ws-1', value: 'Won', actor: 'sales-1' });
    expect(o.acquisitionMode).toBe('user_confirmed');
    expect(o.assertionStatus).toBe('claimed');
    expect(o.actor).toBe('sales-1');
    expect(new Date(o.timestamp).toISOString()).toBe(o.timestamp);
  });

  it('UNKNOWN not collapsed to null (I-08)', () => {
    const o = createOutcome({ leadId, workspaceId: 'ws-1', value: 'Unknown', actor: 'sales-1' });
    expect(o.value).toBe('Unknown');
    expect(o.value).not.toBeNull();
    expect((o.value as string)).not.toBe('');
  });

  it('correction appends new assertion, old preserved (I-05)', () => {
    const won = createOutcome({ leadId, workspaceId: 'ws-1', value: 'Won', actor: 'sales-1', reason: 'deal signed' });
    const corrected = correctOutcome(won, { newValue: 'Lost', actor: 'sales-1', reason: 'payment failed' });
    expect(corrected.value).toBe('Lost');
    expect(corrected.supersedesOutcomeId).toBe(won.id);
    expect(corrected.id).not.toBe(won.id);
    expect(corrected.reason).toBe('payment failed');
    // Original preserved
    expect(won.value).toBe('Won');
  });

  it('correction requires actor and reason', () => {
    const o = createOutcome({ leadId, workspaceId: 'ws-1', value: 'Won', actor: 'sales-1' });
    expect(() => correctOutcome(o, { newValue: 'Lost', actor: '', reason: 'r' })).toThrow('actor is required');
    expect(() => correctOutcome(o, { newValue: 'Lost', actor: 's', reason: '' })).toThrow('reason is required');
  });

  it('createOutcome requires actor', () => {
    expect(() =>
      createOutcome({ leadId, workspaceId: 'ws-1', value: 'Won', actor: '' }),
    ).toThrow('actor is required');
  });

  it('history: both original + correction visible (I-05)', () => {
    const original = createOutcome({ leadId, workspaceId: 'ws-1', value: 'Won', actor: 'sales-1' });
    const c1 = correctOutcome(original, { newValue: 'Lost', actor: 'sales-1', reason: 're-evaluated' });
    const c2 = correctOutcome(c1, { newValue: 'Unknown', actor: 'mgr', reason: 'needs review' });
    // All three remain distinct — append, not overwrite
    expect(new Set([original.id, c1.id, c2.id]).size).toBe(3);
    expect(c1.supersedesOutcomeId).toBe(original.id);
    expect(c2.supersedesOutcomeId).toBe(c1.id);
  });
});
