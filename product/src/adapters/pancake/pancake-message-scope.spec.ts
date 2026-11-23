import {describe, expect, it} from 'vitest';
import {inspectPancakeMessageScope} from './pancake-message-scope';

const target = {pageId: 'fabricated-page', conversationId: 'fabricated-conversation'};
const response = () => ({success: true, conversation_id: target.conversationId,
  messages: [{id: 'fabricated-message', page_id: target.pageId, conversation_id: target.conversationId,
    message: 'FABRICATED CONTENT', from: {name: 'FABRICATED NAME'}}],
  conv_from: {id: 'fabricated-contact', name: 'FABRICATED NAME'}});

describe('metadata-only Pancake message scope inspection', () => {
  it('keeps native observation separate from commercial identity and emits no content or IDs', () => {
    const input = response(); const original = structuredClone(input);
    const result = inspectPancakeMessageScope(target, input, 30);
    expect(result).toEqual({status: 'TARGET_MATCHED', messageCount: 1,
      contactIdentity: 'PROVIDER_OBSERVED', completeness: 'UNKNOWN', originalChannelIdentity: 'UNVERIFIED'});
    expect(Object.isFrozen(result)).toBe(true);
    expect(input).toEqual(original);
    expect(JSON.stringify(result)).not.toMatch(/fabricated|FABRICATED/u);
  });
  it('an empty response has unknown contact and completeness', () => {
    expect(inspectPancakeMessageScope(target, {success: true, conversation_id: target.conversationId,
      messages: []}, 1)).toMatchObject({messageCount: 0, contactIdentity: 'UNKNOWN', completeness: 'UNKNOWN'});
  });
  it('accepts null contact as unknown, never infers it from the conversation ID', () => {
    expect(inspectPancakeMessageScope(target, {...response(), conv_from: null}, 30).contactIdentity).toBe('UNKNOWN');
  });
  it.each([
    null, [], {success: false}, {...response(), success: 'true'},
    {...response(), conversation_id: 'another-conversation'}, {...response(), messages: null},
    {...response(), messages: [null]}, {...response(), messages: [{id: 'fabricated-message'}]},
    {...response(), messages: [{...response().messages[0], page_id: 'another-page'}]},
    {...response(), messages: [{...response().messages[0], conversation_id: 'another-conversation'}]},
    {...response(), messages: [{...response().messages[0], id: ''}]},
    {...response(), conv_from: {}}, {...response(), conv_from: []}, {...response(), conv_from: {id: 'bad\nidentity'}},
  ])('rejects unsafe/provider-failed/out-of-scope response categorically %#', input => {
    expect(() => inspectPancakeMessageScope(target, input, 30)).toThrow(/^PANCAKE_MESSAGE_SCOPE_UNVERIFIED$/u);
  });
  it.each([0, 1001, 1.5, Number.NaN])('rejects unsafe resource bound %s', bound => {
    expect(() => inspectPancakeMessageScope(target, response(), bound)).toThrow();
  });
  it('rejects invalid expected identities and oversized pages', () => {
    expect(() => inspectPancakeMessageScope({...target, pageId: ''}, response(), 30)).toThrow();
    expect(() => inspectPancakeMessageScope({...target, conversationId: 'unsafe/path'}, response(), 30)).toThrow();
    expect(() => inspectPancakeMessageScope(target, {...response(), messages: [response().messages[0],
      response().messages[0]]}, 1)).toThrow();
  });
  it('does not deduplicate equal IDs or discard revisions as a business effect', () => {
    const input = response(); input.messages.push({...input.messages[0], message: 'FABRICATED EDIT'});
    expect(inspectPancakeMessageScope(target, input, 30).messageCount).toBe(2);
  });
});
