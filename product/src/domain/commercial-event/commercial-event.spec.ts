import { describe, it, expect } from 'vitest';
import {
  createCommercialEvent,
  createAssertion,
  type CommercialEvent,
  type AssertionEnvelope,
  type ConfidenceMeta,
} from './commercial-event';

const confidence: ConfidenceMeta = {
  producer: 'ai-inference-service',
  model: 'kimi-k3',
  version: '0.1.0',
  rationale: 'customer expressed budget concern twice',
  score: 0.72,
};

const leadId = 'lead-123' as unknown as import('../lead/lead').LeadId;

describe('CommercialEvent — provenance envelope (R-16, I-04, CE-2 interim)', () => {
  it('creates an inferred-only CE with all required fields (R-16)', () => {
    const evt = createCommercialEvent({
      leadId,
      workspaceId: 'ws-1',
      eventType: 'OBJECTION_PRICE',
      inferredMeaning: 'price objection detected',
      confidence,
      evidenceRef: 'env-abc',
      sourceActor: 'ai-agent-1',
      createdBy: 'system',
    });
    expect(evt.id).toBeDefined();
    expect(evt.leadId).toBe(leadId);
    expect(evt.workspaceId).toBe('ws-1');
    expect(evt.eventType).toBe('OBJECTION_PRICE');
    expect(new Date(evt.timestamp).toISOString()).toBe(evt.timestamp);
    expect(evt.policyCheck).toBe('pending'); // I-03 — draft-only, policy gates action
  });

  it('provenance envelope carries assertion_id + actor + previous/new-ish + timestamp + reason (R-16)', () => {
    const evt = createCommercialEvent({
      leadId,
      workspaceId: 'ws-1',
      eventType: 'PURCHASE_INTENT_INCREASED',
      inferredMeaning: 'intent increasing',
      confidence,
      evidenceRef: 'env-abc',
      sourceActor: 'ai-agent-1',
      createdBy: 'system',
    });
    const p = evt.provenance;
    expect(p.assertionId).toBeDefined();
    expect(p.workspaceId).toBe('ws-1');
    expect(p.subjectType).toBe('lead');
    expect(p.subjectId).toBe(leadId);
    expect(p.eventType).toBe('PURCHASE_INTENT_INCREASED');
    expect(p.value).toBe('intent increasing');
    expect(p.assertionStatus).toBe('draft');
    expect(p.acquisitionMode).toBe('inferred');
    expect(p.sourceSystem).toBe('ai-inference');
    expect(p.sourceActor).toBe('ai-agent-1');
    expect(new Date(p.capturedAt).toISOString()).toBe(p.capturedAt);
    expect(new Date(p.ingestedAt).toISOString()).toBe(p.ingestedAt);
    expect(p.rawEvidencePointer).toBe('env-abc');
    expect(p.schemaVersion).toBe(1);
    expect(p.createdBy).toBe('system');
  });

  it('confidence metadata includes producer/model/version/rationale (R-16, I-04)', () => {
    const evt = createCommercialEvent({
      leadId,
      workspaceId: 'ws-1',
      eventType: 'OBJECTION_PRICE',
      inferredMeaning: 'price objection',
      confidence,
      evidenceRef: 'env-abc',
      sourceActor: 'ai',
      createdBy: 'system',
    });
    expect(evt.confidence.producer).toBe('ai-inference-service');
    expect(evt.confidence.model).toBe('kimi-k3');
    expect(evt.confidence.version).toBe('0.1.0');
    expect(evt.confidence.rationale).toContain('budget');
    expect(evt.confidence.score).toBe(0.72);
  });

  it('throws when inferredMeaning missing (I-04)', () => {
    expect(() =>
      createCommercialEvent({
        leadId,
        workspaceId: 'ws-1',
        eventType: 'WON',
        // @ts-expect-error — inferredMeaning required
        inferredMeaning: undefined,
        confidence,
        evidenceRef: 'env-abc',
        sourceActor: 'ai',
        createdBy: 'system',
      }),
    ).toThrow('inferredMeaning is required');
  });

  it('throws when confidence missing producer/model/version (I-04)', () => {
    expect(() =>
      createCommercialEvent({
        leadId,
        workspaceId: 'ws-1',
        eventType: 'LOST',
        inferredMeaning: 'lost',
        // @ts-expect-error — confidence missing fields
        confidence: { rationale: 'x' },
        evidenceRef: 'env-abc',
        sourceActor: 'ai',
        createdBy: 'system',
      }),
    ).toThrow('confidence');
  });

  it('throws when neither evidenceRef nor evidenceReason present (I-04)', () => {
    expect(() =>
      createCommercialEvent({
        leadId,
        workspaceId: 'ws-1',
        eventType: 'LOST',
        inferredMeaning: 'lost',
        confidence,
        sourceActor: 'ai',
        createdBy: 'system',
      }),
    ).toThrow('evidenceRef or evidenceReason is required');
  });

  it('rawEvidencePointer is preserved — raw immutable (I-12)', () => {
    const evt = createCommercialEvent({
      leadId,
      workspaceId: 'ws-1',
      eventType: 'BUYER_COMMITMENT',
      inferredMeaning: 'commitment',
      confidence,
      evidenceRef: 'env-xyz',
      sourceActor: 'ai',
      createdBy: 'system',
    });
    expect(evt.provenance.rawEvidencePointer).toBe('env-xyz');
  });

  it('suggestedMutation/suggestedAction are present but pending policy (I-03)', () => {
    const evt = createCommercialEvent({
      leadId,
      workspaceId: 'ws-1',
      eventType: 'FOLLOW_UP_DUE',
      inferredMeaning: 'follow-up due',
      confidence,
      evidenceRef: 'env-1',
      suggestedMutation: 'set status to Follow-up',
      suggestedAction: 'notify sales-1',
      sourceActor: 'ai',
      createdBy: 'system',
    });
    expect(evt.suggestedMutation).toBe('set status to Follow-up');
    expect(evt.suggestedAction).toBe('notify sales-1');
    expect(evt.policyCheck).toBe('pending');
  });
});

describe('AssertionEnvelope — non-inferred path (§2.3 RFC, CE-2 boundary)', () => {
  it('creates an assertion with observed/claimed/imported mode (never inferred)', () => {
    const a = createAssertion({
      workspaceId: 'ws-1',
      subjectType: 'lead',
      subjectId: leadId,
      eventType: 'SALES_CONTACTED',
      value: 'contacted via phone at 10:00',
      acquisitionMode: 'observed',
      sourceSystem: 'manual',
      sourceActor: 'sales-1',
      createdBy: 'sales-1',
    });
    expect(a.acquisitionMode).toBe('observed');
    expect(a.assertionStatus).toBe('claimed');
    expect(a.value).toBe('contacted via phone at 10:00');
    expect(a.schemaVersion).toBe(1);
  });

  it('assertion does NOT carry inferredMeaning or confidence (CE-2 boundary)', () => {
    const a = createAssertion({
      workspaceId: 'ws-1',
      subjectType: 'lead',
      subjectId: leadId,
      eventType: 'SALES_CONTACTED',
      value: 'called',
      acquisitionMode: 'claimed',
      sourceActor: 'sales-1',
      createdBy: 'sales-1',
    });
    expect('inferredMeaning' in a).toBe(false);
    expect('confidence' in a).toBe(false);
  });

  it('throws when acquisitionMode is inferred (must use CommercialEvent)', () => {
    expect(() =>
      createAssertion({
        workspaceId: 'ws-1',
        subjectType: 'lead',
        subjectId: leadId,
        eventType: 'WON',
        value: 'won',
        acquisitionMode: 'inferred' as never,
        sourceActor: 'ai',
        createdBy: 'system',
      }),
    ).toThrow('AssertionEnvelope must not use inferred');
  });

  it('supports supersedesAssertionId for corrections (I-05 append)', () => {
    const original = createAssertion({
      workspaceId: 'ws-1',
      subjectType: 'lead',
      subjectId: leadId,
      eventType: 'WON',
      value: 'won',
      acquisitionMode: 'user_confirmed',
      sourceActor: 'sales-1',
      createdBy: 'sales-1',
    });
    const correction = createAssertion({
      workspaceId: 'ws-1',
      subjectType: 'lead',
      subjectId: leadId,
      eventType: 'WON',
      value: 'lost after re-review',
      acquisitionMode: 'user_confirmed',
      sourceActor: 'sales-1',
      createdBy: 'sales-1',
      supersedesAssertionId: original.assertionId,
    });
    expect(correction.supersedesAssertionId).toBe(original.assertionId);
    expect(correction.assertionId).not.toBe(original.assertionId);
    // Both remain present (append, no overwrite — I-05)
    expect(original.value).toBe('won');
    expect(correction.value).toBe('lost after re-review');
  });

  it('CE and AssertionEnvelope are distinct types (CE-2 scope boundary)', () => {
    const evt = createCommercialEvent({
      leadId,
      workspaceId: 'ws-1',
      eventType: 'OBJECTION_PRICE',
      inferredMeaning: 'price objection',
      confidence,
      evidenceRef: 'env-1',
      sourceActor: 'ai',
      createdBy: 'system',
    });
    const assertion = createAssertion({
      workspaceId: 'ws-1',
      subjectType: 'lead',
      subjectId: leadId,
      eventType: 'SALES_CONTACTED',
      value: 'called',
      acquisitionMode: 'observed',
      sourceActor: 'sales-1',
      createdBy: 'sales-1',
    });
    const evtKeys = Object.keys(evt).sort();
    const assertKeys = Object.keys(assertion).sort();
    expect(evtKeys).not.toEqual(assertKeys); // different shapes
    // CommercialEvent has inferredMeaning + confidence; AssertionEnvelope does not
    expect(evt).toHaveProperty('inferredMeaning');
    expect(assertion).not.toHaveProperty('inferredMeaning');
  });
});
