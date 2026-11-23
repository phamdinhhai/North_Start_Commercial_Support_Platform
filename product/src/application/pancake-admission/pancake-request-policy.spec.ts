import {describe, expect, it} from 'vitest';
import {PancakeRequestPolicy, type PancakeRequestIntent, type PancakeRouteAdmission} from './pancake-request-policy';

const target = {accountId: 'fabricated-account', pageId: 'fabricated-page', conversationId: 'fabricated-conversation',
  contactId: 'fabricated-contact', verificationEvidenceId: 'fabricated-verification'};
const read: PancakeRouteAdmission = {capability: 'read-conversation', method: 'GET',
  url: 'https://pancake.vn/fabricated-exact-conversation', contractEvidenceId: 'fabricated-contract',
  classification: 'PRIVATE_OBSERVED', effect: 'READ'};
const write: PancakeRouteAdmission = {...read, capability: 'send-test', method: 'POST', effect: 'OUTGOING_MESSAGE'};
const intent = (): PancakeRequestIntent => ({capability: read.capability, method: 'GET', url: read.url, target: {...target}});
const mutation = (): PancakeRequestIntent => ({...intent(), capability: write.capability, method: 'POST',
  recovery: {preconditionEvidenceId: 'snapshot-reference', expectedEffect: 'fabricated-message',
    readbackPlan: 'read-exact-message', cleanupPlan: 'remove-agent-created-content-if-supported'},
  recipientPermissionEvidenceId: 'owner-permission-reference'});

describe('bounded offline Pancake request admission', () => {
  it('admits only exact reviewed requests and emits categorical audit data', () => {
    const policy = new PancakeRequestPolicy(target, [read]);
    expect(policy.admit(intent(), 0)).toEqual({attempt: 1, classification: 'PRIVATE_OBSERVED'});
  });
  it.each([
    {url: 'http://pancake.vn/fabricated-exact-conversation'},
    {url: 'https://pancake.vn.evil.invalid/fabricated-exact-conversation'},
    {url: 'https://pancake.vn/fabricated-exact-conversation?secret=fabricated'},
    {url: 'https://pancake.vn/fabricated-exact-conversation#fragment'},
    {url: 'https://fabricated:p@pancake.vn/fabricated-exact-conversation'},
    {url: 'https://pancake.vn/another-conversation'},
    {method: 'DELETE'}, {capability: 'list-inbox'},
    {target: {...target, pageId: 'other-page'}},
    {target: {...target, accountId: 'other-account'}},
    {target: {...target, conversationId: 'other-conversation'}},
    {target: {...target, contactId: 'other-contact'}},
  ])('denies mismatched or unsafe request without leaking input: %j', change => {
    const policy = new PancakeRequestPolicy(target, [read]);
    expect(() => policy.admit({...intent(), ...change}, 0)).toThrow(/^PANCAKE_REQUEST_DENIED$/u);
  });
  it('does not admit anything with an empty server-owned route registry', () => {
    expect(() => new PancakeRequestPolicy(target, []).admit(intent(), 0)).toThrow('PANCAKE_REQUEST_DENIED');
  });
  it('requires mutation precondition, effect, readback, cleanup and recipient permission', () => {
    for (const field of ['preconditionEvidenceId', 'expectedEffect', 'readbackPlan', 'cleanupPlan'] as const) {
      const request = mutation(); request.recovery![field] = '';
      expect(() => new PancakeRequestPolicy(target, [write]).admit(request, 0)).toThrow('PANCAKE_REQUEST_DENIED');
    }
    const request = mutation(); delete request.recipientPermissionEvidenceId;
    expect(() => new PancakeRequestPolicy(target, [write]).admit(request, 0)).toThrow('PANCAKE_REQUEST_DENIED');
    expect(new PancakeRequestPolicy(target, [write]).admit(mutation(), 0).attempt).toBe(1);
  });
  it('enforces pacing and ceiling, including backwards time', () => {
    const policy = new PancakeRequestPolicy(target, [read], 2);
    policy.admit(intent(), 1000);
    expect(() => policy.admit(intent(), 2000)).toThrow('PANCAKE_REQUEST_DENIED');
    policy.observe({status: 200});
    expect(() => policy.admit(intent(), 1999)).toThrow('PANCAKE_REQUEST_DENIED');
    expect(() => policy.admit(intent(), 0)).toThrow('PANCAKE_REQUEST_DENIED');
    policy.admit(intent(), 2000);
    policy.observe({status: 200});
    expect(() => policy.admit(intent(), 3000)).toThrow('PANCAKE_REQUEST_DENIED');
  });
  it.each([{status: 401}, {status: 403}, {status: 429}, {status: 302, redirected: true},
    {status: 200, scopeMismatch: true}])('terminally stops on %j', response => {
    const policy = new PancakeRequestPolicy(target, [read]);
    policy.admit(intent(), 0); policy.observe(response);
    expect(() => policy.admit(intent(), 1000)).toThrow('PANCAKE_REQUEST_DENIED');
  });
  it('does not accept mutable caller configuration after construction', () => {
    const copiedTarget = {...target}; const copiedRoute = {...read};
    const policy = new PancakeRequestPolicy(copiedTarget, [copiedRoute]);
    copiedTarget.pageId = 'other'; copiedRoute.url = 'https://pancake.vn/other';
    expect(policy.admit(intent(), 0).attempt).toBe(1);
  });
  it('rejects missing verification and unsafe limits', () => {
    expect(() => new PancakeRequestPolicy({...target, verificationEvidenceId: ''}, [read])).toThrow();
    expect(() => new PancakeRequestPolicy(target, [read], 26)).toThrow();
    expect(() => new PancakeRequestPolicy(target, [read], 25, 0)).toThrow();
  });
});
