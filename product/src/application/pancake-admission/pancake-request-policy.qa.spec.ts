import {describe, expect, it} from 'vitest';
import {PancakeRequestPolicy, type PancakeRouteAdmission, type VerifiedPancakeTarget} from './pancake-request-policy';

const target = {accountId: 'qa-fabricated-account', pageId: 'qa-fabricated-page',
  conversationId: 'qa-fabricated-conversation', contactId: 'qa-fabricated-contact',
  verificationEvidenceId: 'qa-provider-verification-reference'};
const route = {capability: 'qa-read', method: 'GET' as const,
  url: 'https://pages.fm/qa-fabricated-conversation', contractEvidenceId: 'qa-contract-reference',
  classification: 'OFFICIAL' as const, effect: 'READ' as const};
const request = {capability: route.capability, method: route.method, url: route.url, target};

describe('independent Pancake request admission negatives', () => {
  it('rejects invalid route authority at the configuration boundary', () => {
    const invalid = {...route, classification: 'UNVERIFIED'} as unknown as PancakeRouteAdmission;
    expect(() => new PancakeRequestPolicy(target, [invalid])).toThrow('PANCAKE_REQUEST_DENIED');
  });
  it('honors emergency stop even before the first request', () => {
    const policy = new PancakeRequestPolicy(target, [route]); policy.stop();
    expect(() => policy.admit(request, 0)).toThrow('PANCAKE_REQUEST_DENIED');
  });
  it.each(Object.keys(target))('rejects a missing target field %s replaced by an unknown key', key => {
    const malformed: Record<string, string> = {...target};
    delete malformed[key]; malformed.unrelated = 'fabricated-extra';
    expect(() => new PancakeRequestPolicy(malformed as unknown as VerifiedPancakeTarget, [route]))
      .toThrow('PANCAKE_REQUEST_DENIED');
  });
  it.each([300, 301, 302, 303, 307, 308, 399])('stops manual redirect status %i without a redirected flag', status => {
    const policy = new PancakeRequestPolicy(target, [route]);
    policy.admit(request, 0);
    // Fetch redirect:manual returns the redirect response without following it.
    policy.observe({status, redirected: false});
    expect(() => policy.admit(request, 1000)).toThrow('PANCAKE_REQUEST_DENIED');
  });
  it.each([0, 99, 600, Number.NaN])('terminally stops unknown transport status %s', status => {
    const policy = new PancakeRequestPolicy(target, [route]);
    policy.admit(request, 0); policy.observe({status});
    expect(() => policy.admit(request, 1000)).toThrow('PANCAKE_REQUEST_DENIED');
  });
});
