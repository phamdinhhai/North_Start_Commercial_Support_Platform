import {describe, expect, it} from 'vitest';
import {classifyPancakeHistoryResponse} from './pancake-history-response';
const target = {pageId: 'fabricated-page', conversationId: 'fabricated-conversation'};
const payload = () => ({success: true, conversation_id: target.conversationId,
  messages: [{id: 'fabricated-message', page_id: target.pageId, conversation_id: target.conversationId}]});
const response = (overrides = {}) => ({status: 200, contentType: 'application/json', payload: payload(), ...overrides});
describe('categorical Pancake history response gate', () => {
  it('accepts only matched metadata and excludes IDs from output', () => {
    const result = classifyPancakeHistoryResponse(response(), target, 10);
    expect(result.status).toBe('accepted');
    expect(JSON.stringify(result)).not.toMatch(/fabricated/u);
  });
  it.each([{status: 300}, {status: 302}, {status: 399}, {status: 401}, {status: 403}, {status: 429},
    {status: 500}, {status: 204}, {status: 99}, {status: 600}, {status: 200, redirected: true},
    {status: 200, contentType: 'text/html'}])('returns categorical terminal reason for unsafe response %#', input => {
    const result = classifyPancakeHistoryResponse(response(input), target, 10);
    expect(result.status).toBe('terminal');
    expect(Object.keys(result)).toEqual(['status', 'reason']);
  });
  it.each([{success: false}, {conversation_id: 'other'}, {messages: [{id: 'm', page_id: 'other', conversation_id: target.conversationId}]},
    {messages: [{id: 'm', page_id: target.pageId, conversation_id: 'other'}]}, {messages: [{id: ''}]}])('rejects provider false or mismatched body %#', payloadOverride => {
    const result = classifyPancakeHistoryResponse(response({payload: {...payload(), ...payloadOverride}}), target, 10);
    expect(result).toEqual({status: 'terminal', reason: 'SCOPE_UNVERIFIED'});
  });
});
