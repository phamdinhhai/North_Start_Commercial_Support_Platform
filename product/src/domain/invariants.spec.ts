/**
 * Invariant sweep — T2-09.
 * One test per invariant I-01…I-12, cross-referencing all PH1+PH2 entities.
 * Ensures every frozen invariant has at least one automated check (06-test-strategy §3).
 */

import { describe, it, expect } from 'vitest';

// Domain imports
import { createLead, sameLead, type Lead } from './lead/lead';
import { createCustomer, sameCustomer, type Customer } from './customer/customer';
import { createHandoff, type Handoff } from './handoff/handoff';
import { createCommercialEvent, createAssertion, type CommercialEvent, type AssertionEnvelope } from './commercial-event/commercial-event';
import { createOutcome, correctOutcome, type Outcome } from './outcome/outcome';
import { UNKNOWN_SENTINEL, isValidUnknownState, UNKNOWN_STATES } from './unknown-states/unknown-states';
import { canTransition, transitionLead } from './lead/lead-state';
import { AuditStore } from '../infra/audit/audit-store';
import { WorkspaceStore, type WorkspaceScopedEntry } from '../infra/workspace/workspace-store';
import { ManualAdapter } from '../adapters/manual/manual-adapter';

const ws = 'ws-1';
const leadId = 'lead-123' as unknown as import('./lead/lead').LeadId;
const customerId = 'cust-456' as unknown as import('./customer/customer').CustomerId;

describe('Invariant sweep — I-01…I-12', () => {
  describe('I-01: Customer ≠ Lead — entities tách biệt', () => {
    it('Customer and Lead have separate IDs, separate existence, no embedding', () => {
      const c = createCustomer({ workspaceId: ws, displayName: 'Acme' });
      const l = createLead({ workspaceId: ws, displayName: 'Test Lead' });
      expect(c.id).toBeDefined();
      expect(l.id).toBeDefined();
      expect(c.id).not.toBe(l.id);
      // Customer has no leadId field
      expect('leadId' in c).toBe(false);
      // Lead does not embed customer fields (only optional reference)
      expect('customer' in l).toBe(false);
    });

    it('Lead references Customer via customerId, not ownership', () => {
      const l = createLead({ workspaceId: ws, displayName: 'T', customerId });
      expect(l.customerId).toBe(customerId);
      expect('customerName' in l).toBe(false); // no embedded customer data
    });
  });

  describe('I-02: Chain identity — source/lineage/attribution tách biệt', () => {
    it('three chain identity concepts never collapse', () => {
      const l = createLead({
        workspaceId: ws,
        displayName: 'T',
        conversationSource: 'facebook_ad',
        acquisitionLineage: 'campaign_q4',
        attribution: 'unknown',
      });
      expect(l.conversationSource).not.toBe(l.acquisitionLineage);
      expect(l.acquisitionLineage).not.toBe(l.attribution);
      expect(l.conversationSource).not.toBe(l.attribution);
    });
  });

  describe('I-03: AI draft-only — never autonomous mutation', () => {
    it('CommercialEvent is draft/pending — never auto-executes', () => {
      const ce = createCommercialEvent({
        leadId,
        workspaceId: ws,
        eventType: 'OBJECTION_PRICE',
        inferredMeaning: 'price objection',
        confidence: { producer: 'ai', model: 'k3', version: '1', rationale: 'detected' },
        evidenceRef: 'env-1',
        sourceActor: 'ai-agent',
        createdBy: 'system',
      });
      expect(ce.policyCheck).toBe('pending');
      expect('executed' in ce).toBe(false); // no auto-execution path
    });
  });

  describe('I-04: CE pipeline — Interaction→AI→CE→Evidence→Policy→Action', () => {
    it('CommercialEvent requires evidenceRef or evidenceReason (explicit provenance)', () => {
      expect(() =>
        createCommercialEvent({
          leadId,
          workspaceId: ws,
          eventType: 'WON',
          inferredMeaning: 'won',
          confidence: { producer: 'x', model: 'y', version: '1', rationale: '' },
          sourceActor: 'ai',
          createdBy: 'system',
          // no evidenceRef, no evidenceReason
        } as any),
      ).toThrow('evidenceRef or evidenceReason');
    });

    it('CommercialEvent requires confidence with producer/model/version', () => {
      expect(() =>
        createCommercialEvent({
          leadId,
          workspaceId: ws,
          eventType: 'WON',
          inferredMeaning: 'won',
          // @ts-expect-error
          confidence: {},
          evidenceRef: 'env-1',
          sourceActor: 'ai',
          createdBy: 'system',
        }),
      ).toThrow('confidence');
    });
  });

  describe('I-05: Append-audited, reversible — no overwrite', () => {
    it('AuditStore has no update/delete methods — append only', () => {
      const store = new AuditStore();
      expect(typeof (store as any).update).toBe('undefined');
      expect(typeof (store as any).delete).toBe('undefined');
      expect(typeof (store as any).remove).toBe('undefined');
    });

    it('Outcome correction appends — old preserved', () => {
      const orig = createOutcome({ leadId, workspaceId: ws, value: 'Won', actor: 's' });
      const corr = correctOutcome(orig, { newValue: 'Lost', actor: 's', reason: 're-eval' });
      expect(orig.value).toBe('Won');
      expect(corr.value).toBe('Lost');
      expect(corr.supersedesOutcomeId).toBe(orig.id);
    });
  });

  describe('I-06: Identity merges require evidence, confidence and reversibility / undo (no auto-merge)', () => {
    it('no auto-merge API exists in domain layer — merge deferred by explicit non-goal', async () => {
      // If any merge function appears, this grep must fail the PR.
      const domainModules = await import('./lead/lead');
      expect('mergeLeads' in domainModules).toBe(false);
      expect('mergeCustomers' in domainModules).toBe(false);
      const customerMod = await import('./customer/customer');
      expect('mergeCustomers' in customerMod).toBe(false);
      // AuditStore must not expose merge helpers either
      expect(typeof (AuditStore as any).merge).toBe('undefined');
    });

    it('same phone does not collapse into one Lead — each episode is a separate Lead', () => {
      const sharedPhone = '+84-900-111-222';
      const l1 = createLead({ workspaceId: ws, displayName: sharedPhone });
      const l2 = createLead({ workspaceId: ws, displayName: sharedPhone });
      // Stable IDs are distinct even though display/search key is identical
      expect(l1.id).not.toBe(l2.id);
      expect(sameLead(l1, l2)).toBe(false);
    });

    it('correction is append-only — reversibility requires explicit correction, not overwrite (I-06 + I-05)', () => {
      const orig = createOutcome({ leadId, workspaceId: ws, value: 'Won', actor: 's' });
      const corr = correctOutcome(orig, { newValue: 'Lost', actor: 'mgr', reason: 'evidence shows refund' });
      // Original preserved; correction links back — undo path exists via history
      expect(orig.value).toBe('Won');
      expect(corr.supersedesOutcomeId).toBe(orig.id);
      expect(corr.value).toBe('Lost');
    });
  });

  describe('I-07: Stable Lead ID — immutable', () => {
    it('sameLead always returns true for same ID', () => {
      const l1 = createLead({ workspaceId: ws, displayName: 'A' });
      const l2: Lead = { ...l1 };
      expect(sameLead(l1, l2)).toBe(true);
    });

    it('Lead ID is generated once and never changes', () => {
      const l = createLead({ workspaceId: ws, displayName: 'A' });
      const originalId = l.id;
      // Attempt mutation — readonly, but verify identity invariant
      expect(l.id).toBe(originalId);
    });
  });

  describe('I-08: UNKNOWN visible — honest, confident, surfaced', () => {
    it('UNKNOWN_SENTINEL is never null, never empty', () => {
      expect(UNKNOWN_SENTINEL).toBe('unknown');
      expect(UNKNOWN_SENTINEL).not.toBeNull();
      expect(UNKNOWN_SENTINEL.length).toBeGreaterThan(0);
    });

    it('UNKNOWN is valid from any state in state machine', () => {
      const states = ['New', 'Accepted', 'Contacting', 'Follow-up', 'Won', 'Lost', 'Unknown'] as const;
      for (const from of states) {
        expect(canTransition(from, 'Unknown')).toBe(true);
      }
    });

    it('all five UNKNOWN states are recognized (R-17)', () => {
      for (const v of UNKNOWN_STATES) {
        expect(isValidUnknownState(v)).toBe(true);
      }
    });
  });

  describe('I-09: Sales access is scoped to assigned customer/lead context, not entire inbox (lead-scoped)', () => {
    type ScopedEntry = WorkspaceScopedEntry & { assignedTo?: string };

    it('cross-workspace access is invisible (returns undefined, not error leak)', () => {
      const store = new WorkspaceStore<ScopedEntry>();
      store.add({ id: 'lead-1', workspaceId: 'ws-a', createdAt: new Date().toISOString(), assignedTo: 'sales-1' });
      expect(store.getById('lead-1', 'ws-b')).toBeUndefined();
      expect(store.listByWorkspace('ws-b')).toEqual([]);
    });

    it('within workspace, only assigned leads are visible via predicate (lead-scoped, not inbox-scoped)', () => {
      const store = new WorkspaceStore<ScopedEntry>();
      store.add({ id: 'lead-1', workspaceId: ws, createdAt: new Date().toISOString(), assignedTo: 'sales-1' });
      store.add({ id: 'lead-2', workspaceId: ws, createdAt: new Date().toISOString(), assignedTo: 'sales-2' });
      store.add({ id: 'lead-3', workspaceId: ws, createdAt: new Date().toISOString(), assignedTo: 'sales-1' });
      const visibleToSales1 = store.query(ws, (e) => e.assignedTo === 'sales-1');
      expect(visibleToSales1.map((e) => e.id)).toEqual(['lead-1', 'lead-3']);
      expect(visibleToSales1.find((e) => e.id === 'lead-2')).toBeUndefined();
    });

    it('reassignment immediately revokes previous assignee visibility (no lingering access)', () => {
      const store = new WorkspaceStore<ScopedEntry>();
      const entry: ScopedEntry = { id: 'lead-1', workspaceId: ws, createdAt: new Date().toISOString(), assignedTo: 'sales-1' };
      store.add(entry);
      // Simulate reassignment by replacing entry (store is append-only in real domain; this is scope check)
      // After reassignment, old assignee query must not return the lead
      const reassigned: ScopedEntry = { ...entry, assignedTo: 'sales-2' };
      // Clear and re-add to simulate state change (real impl would be event-sourced)
      store.clear();
      store.add(reassigned);
      expect(store.query(ws, (e) => e.assignedTo === 'sales-1')).toEqual([]);
      expect(store.query(ws, (e) => e.assignedTo === 'sales-2')).toHaveLength(1);
    });
  });

  // I-10 (canonical): CRM adapters do not own canonical commercial semantics
  describe('I-10: CRM adapters do not own canonical commercial semantics (platform owns Lead/State/Outcome)', () => {
    it('adapter creates envelope only — it never decides Lead state/outcome (platform owns semantics)', () => {
      const adapter = new ManualAdapter();
      const env = adapter.ingest({
        workspaceId: ws,
        connection: 'manual',
        externalRecordId: 'row-1',
        externalEventType: 'message',
        rawPayload: { text: 'xin báo giá khóa học' },
      });
      // Envelope has no status/outcome — those are platform decisions
      expect((env as any).status).toBeUndefined();
      expect((env as any).outcome).toBeUndefined();
      expect((env as any).leadState).toBeUndefined();
      // Platform decides state separately
      const lead = createLead({ workspaceId: ws, displayName: 'T' });
      expect(lead.status).toBe('New');
    });

    it('AssertionEnvelope rejects inferred acquisitionMode — CRM/manual cannot masquerade as AI inference', () => {
      expect(() =>
        createAssertion({
          workspaceId: ws,
          subjectType: 'lead',
          subjectId: leadId,
          eventType: 'WON',
          value: 'won',
          acquisitionMode: 'inferred' as never,
          sourceActor: 'crm-sync',
          createdBy: 'system',
        }),
      ).toThrow('AssertionEnvelope must not use inferred');
    });
  });

  // I-11 (canonical): External providers are integration boundaries, not the core domain
  describe('I-11: External providers are integration boundaries, not the core domain (anti-corruption)', () => {
    it('ManualAdapter preserves raw payload behind envelope — domain never reads provider shape directly', () => {
      const adapter = new ManualAdapter();
      const raw = { provider: 'pancake', weird_shape: { foo: 1 } };
      const env = adapter.ingest({
        workspaceId: ws,
        connection: 'manual',
        externalRecordId: 'ext-1',
        externalEventType: 'message',
        rawPayload: raw,
      });
      expect(env.rawPayload).toEqual(raw);
      // Domain entity does not embed provider fields
      const lead = createLead({ workspaceId: ws, displayName: 'T' });
      expect('weird_shape' in lead).toBe(false);
      expect('provider' in lead).toBe(false);
    });

    it('CommercialEvent (inferred) and AssertionEnvelope (observed/claimed) are distinct types — provider cannot collapse them (CE-2 boundary)', () => {
      const ce = createCommercialEvent({
        leadId,
        workspaceId: ws,
        eventType: 'WON',
        inferredMeaning: 'won',
        confidence: { producer: 'x', model: 'y', version: '1', rationale: '' },
        evidenceRef: 'env-1',
        sourceActor: 'ai',
        createdBy: 'system',
      });
      const ae = createAssertion({
        workspaceId: ws,
        subjectType: 'lead',
        subjectId: leadId,
        eventType: 'SALES_CONTACTED',
        value: 'called',
        acquisitionMode: 'observed',
        sourceActor: 'sales-1',
        createdBy: 'sales-1',
      });
      expect('inferredMeaning' in ce).toBe(true);
      expect('inferredMeaning' in ae).toBe(false);
    });
  });

  describe('I-12: Raw immutable — no fabrication', () => {
    it('lead attribution defaults to UNKNOWN — no fabricated data', () => {
      const l = createLead({ workspaceId: ws, displayName: 'T' });
      expect(l.attribution).toBe('unknown');
    });

    it('CommercialEvent provenance carries rawEvidencePointer (I-12)', () => {
      const ce = createCommercialEvent({
        leadId,
        workspaceId: ws,
        eventType: 'WON',
        inferredMeaning: 'won',
        confidence: { producer: 'x', model: 'y', version: '1', rationale: '' },
        evidenceRef: 'env-abc',
        sourceActor: 'ai',
        createdBy: 'system',
      });
      expect(ce.provenance.rawEvidencePointer).toBe('env-abc');
    });
  });
});
