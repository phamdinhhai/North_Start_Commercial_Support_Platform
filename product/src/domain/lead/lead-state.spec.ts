import { describe, it, expect } from 'vitest';
import { createLead, type Lead } from './lead';
import {
  canTransition,
  transitionLead,
  VALID_TRANSITIONS,
  type LeadTransition,
} from './lead-state';

const ws = 'ws-test-001';

function newLead(status?: Lead['status']): Lead {
  return createLead({ workspaceId: ws, displayName: 'T', status });
}

describe('Lead State Machine (CE-1 interim — ADR-001)', () => {
  describe('canTransition', () => {
    it('New → Accepted is valid', () => {
      expect(canTransition('New', 'Accepted')).toBe(true);
    });

    it('Accepted → Contacting is valid', () => {
      expect(canTransition('Accepted', 'Contacting')).toBe(true);
    });

    it('Contacting → Follow-up is valid', () => {
      expect(canTransition('Contacting', 'Follow-up')).toBe(true);
    });

    it('Follow-up → Won and Follow-up → Lost are valid', () => {
      expect(canTransition('Follow-up', 'Won')).toBe(true);
      expect(canTransition('Follow-up', 'Lost')).toBe(true);
    });

    it('New → Won is INVALID (skip states)', () => {
      expect(canTransition('New', 'Won')).toBe(false);
    });

    it('New → Follow-up is INVALID (skip states)', () => {
      expect(canTransition('New', 'Follow-up')).toBe(false);
    });

    it('UNKNOWN reachable from any state', () => {
      for (const from of Object.keys(VALID_TRANSITIONS) as Array<keyof typeof VALID_TRANSITIONS>) {
        expect(canTransition(from, 'Unknown')).toBe(true);
      }
    });

    it('Won and Lost are reversible via correction (I-05)', () => {
      expect(canTransition('Won', 'Lost')).toBe(true);
      expect(canTransition('Won', 'Follow-up')).toBe(true);
      expect(canTransition('Lost', 'Won')).toBe(true);
      expect(canTransition('Lost', 'Follow-up')).toBe(true);
    });

    it('UNKNOWN can transition to any valid starting state', () => {
      expect(canTransition('Unknown', 'New')).toBe(true);
      expect(canTransition('Unknown', 'Accepted')).toBe(true);
      expect(canTransition('Unknown', 'Contacting')).toBe(true);
      expect(canTransition('Unknown', 'Follow-up')).toBe(true);
      expect(canTransition('Unknown', 'Won')).toBe(true);
      expect(canTransition('Unknown', 'Lost')).toBe(true);
    });
  });

  describe('transitionLead', () => {
    it('returns new Lead with updated status', () => {
      const lead = newLead();
      const result = transitionLead(lead, { actor: 'sales-1', reason: 'accepted', to: 'Accepted' });
      expect(result.lead.status).toBe('Accepted');
      expect(lead.status).toBe('New'); // original unchanged
    });

    it('preserves all Lead fields across transition', () => {
      const lead = newLead();
      const result = transitionLead(lead, { actor: 's', reason: 'r', to: 'Accepted' });
      expect(result.lead.id).toBe(lead.id);
      expect(result.lead.workspaceId).toBe(lead.workspaceId);
      expect(result.lead.displayName).toBe(lead.displayName);
    });

    it('transition record has all audit fields (I-05)', () => {
      const lead = newLead();
      const { transition } = transitionLead(lead, { actor: 'sales-1', reason: 'accepted', to: 'Accepted' });
      expect(transition.leadId).toBe(lead.id);
      expect(transition.workspaceId).toBe(ws);
      expect(transition.from).toBe('New');
      expect(transition.to).toBe('Accepted');
      expect(transition.actor).toBe('sales-1');
      expect(transition.reason).toBe('accepted');
      expect(new Date(transition.timestamp).toISOString()).toBe(transition.timestamp);
    });

    it('throws on invalid transition (frozen boundary enforcement)', () => {
      const lead = newLead();
      expect(() =>
        transitionLead(lead, { actor: 's', reason: 'r', to: 'Won' }),
      ).toThrow('Invalid transition');
    });

    it('throws when actor is missing', () => {
      const lead = newLead();
      expect(() =>
        transitionLead(lead, { actor: '', reason: 'r', to: 'Accepted' }),
      ).toThrow('actor is required');
    });

    it('throws when reason is missing', () => {
      const lead = newLead();
      expect(() =>
        transitionLead(lead, { actor: 's', reason: '', to: 'Accepted' }),
      ).toThrow('reason is required');
    });

    it('UNKNOWN is reachable from New state', () => {
      const lead = newLead();
      const result = transitionLead(lead, { actor: 'sys', reason: 'unclear intent', to: 'Unknown' });
      expect(result.lead.status).toBe('Unknown');
      expect(result.transition.from).toBe('New');
      expect(result.transition.to).toBe('Unknown');
    });

    it('correction: Won → Follow-up is valid (reversible, I-05)', () => {
      const lead = newLead('Won');
      const result = transitionLead(lead, { actor: 'mgr', reason: 'deal reopened', to: 'Follow-up' });
      expect(result.lead.status).toBe('Follow-up');
      expect(result.transition.from).toBe('Won');
      expect(result.transition.to).toBe('Follow-up');
    });

    it('sequential transitions are append-audited', () => {
      let lead = newLead();
      const transitions: LeadTransition[] = [];

      for (const to of ['Accepted', 'Contacting', 'Follow-up', 'Won'] as const) {
        const result = transitionLead(lead, { actor: 's', reason: `to ${to}`, to });
        transitions.push(result.transition);
        lead = result.lead;
      }

      expect(transitions).toHaveLength(4);
      expect(transitions.map((t) => t.to)).toEqual(['Accepted', 'Contacting', 'Follow-up', 'Won']);
      // All timestamps are ISO
      for (const t of transitions) {
        expect(new Date(t.timestamp).toISOString()).toBe(t.timestamp);
      }
    });
  });
});
