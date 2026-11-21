import {describe, expect, it} from 'vitest';
import {PancakeRequestPolicy, type PancakeRequestIntent, type PancakeRouteAdmission} from './pancake-request-policy';

const target = {accountId: 'fabricated-account', pageId: 'fabricated-page', conversationId: 'fabricated-conversation',
  contactId: 'fabricated-contact', verificationEvidenceId: 'fabricated-unverified-reference'};
const route: PancakeRouteAdmission = {capability: 'fabricated-send', method: 'POST', url: 'https://pancake.vn/fabricated-send',
  contractEvidenceId: 'fabricated-contract', classification: 'PRIVATE_OBSERVED', effect: 'OUTGOING_MESSAGE'};
const intent = (): PancakeRequestIntent => ({capability: route.capability, method: route.method, url: route.url, target: {...target},
  recovery: {preconditionEvidenceId: 'fabricated-precondition', expectedEffect: 'fabricated-effect',
    readbackPlan: 'fabricated-readback', cleanupPlan: 'fabricated-cleanup'}, recipientPermissionEvidenceId: 'fabricated-permission'});

describe('offline policy limitations requiring a trusted executor (not send authorization)', () => {
  it('accepts shaped references without authenticating identity; live send must remain blocked outside this helper', () => {
    expect(new PancakeRequestPolicy(target, [route]).admit(intent(), 0)).toEqual({attempt: 1, classification: 'PRIVATE_OBSERVED'});
  });
  it('has an in-flight guard but no durable duplicate-send guard after successful observation', () => {
    const policy = new PancakeRequestPolicy(target, [route]);
    policy.admit(intent(), 0);
    expect(() => policy.admit(intent(), 1000)).toThrow(/^PANCAKE_REQUEST_DENIED$/u);
    policy.observe({status: 200});
    expect(policy.admit(intent(), 1000).attempt).toBe(2);
  });
  it.each([401, 403, 429, 300, 302, 307, 308])('terminally refuses send after status %i', status => {
    const policy = new PancakeRequestPolicy(target, [route]);
    policy.admit(intent(), 0); policy.observe({status});
    expect(() => policy.admit(intent(), 1000)).toThrow(/^PANCAKE_REQUEST_DENIED$/u);
  });
  it('returns only categorical receipts and errors without request or target identifiers', () => {
    const policy = new PancakeRequestPolicy(target, [route]);
    expect(Object.keys(policy.admit(intent(), 0)).sort()).toEqual(['attempt', 'classification']);
    expect(() => policy.admit({...intent(), url: 'https://pancake.vn/fabricated-private-target'}, 1000))
      .toThrow(/^PANCAKE_REQUEST_DENIED$/u);
  });
});
