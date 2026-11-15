import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversationSnapshotFingerprint, summarizeFacebookCapture } from './facebook-research-summary.mjs';

test('state comparison ignores object property order and conversation listing order', () => {
  const first = [{ id: 'b', nested: { count: 2, status: 'open' } }, { id: 'a', count: 1 }];
  const second = [{ count: 1, id: 'a' }, { nested: { status: 'open', count: 2 }, id: 'b' }];
  assert.equal(conversationSnapshotFingerprint(first), conversationSnapshotFingerprint(second));
});

test('state comparison retains changed values and the order of nested event arrays', () => {
  const first = [{ id: 'a', messages: ['first', 'second'] }];
  assert.notEqual(conversationSnapshotFingerprint(first), conversationSnapshotFingerprint([{ id: 'a', messages: ['second', 'first'] }]));
  assert.notEqual(conversationSnapshotFingerprint(first), conversationSnapshotFingerprint([{ id: 'a', messages: ['first', 'changed'] }]));
});

const spec = { runId: 'fixture', actions: [
  { action: 'request', method: 'GET', path: '/api/v1/pages' },
  { action: 'request', method: 'GET', path: '/api/v1/pages/fb-test/settings' },
] };
const response = (path, status = 200) => ({ kind: 'response', step_index: 1,
  method: 'GET', status, transaction_id: path, url: { url: `https://pancake.vn${path}` } });
const content = (path, body) => ({ kind: 'network-content', phase: 'response', transaction_id: path,
  body: { state: 'captured', content: Buffer.from(JSON.stringify(body)).toString('base64') } });
const evidence = (items, statuses = ['completed', 'failed', 'cancelled']) => ({ evidence_id: 'fixture-evidence',
  normalized_result: { steps: statuses.map((status, i) => ({ step_id: `step-${i}`, status })),
    events: { items, dropped: 0 }, completeness: { status: 'incomplete' } } });

test('failed request plus successful background settings read remains a failed scenario', () => {
  const settings = '/api/v1/pages/fb-test/settings';
  const result = summarizeFacebookCapture(evidence([
    response('/api/v1/pages', 429), response(settings),
    content(settings, { success: true, settings: { tags: [{ text: 'private-tag' }], current_settings_key: 'private-key' } }),
  ]), spec, 'fb-test');
  assert.equal(result.result, 'failed');
  assert.equal(result.observedResponses[0].coincidesWithDeclaredEndpoint, true);
  assert.equal(result.observedResponses[1].coincidesWithDeclaredEndpoint, false);
  assert.equal(result.observedResponses[1].tagCount, 1);
  assert.equal(result.observedResponses[1].hasConcurrencyKey, true);
  assert.doesNotMatch(JSON.stringify(result), /private-tag|private-key/);
});

test('excludes unrelated provider identities, query values, foreign origins and arbitrary keys', () => {
  const result = summarizeFacebookCapture(evidence([
    response('/api/v1/pages/tt-private/avatar?secret=private-query'),
    { ...response('/api/v1/pages'), url: { url: 'https://other.invalid/api/v1/pages' } },
    response('/api/v1/pages'), content('/api/v1/pages', { success: true, 'private-customer-name': 'PII' }),
  ]), spec, 'fb-test');
  assert.equal(result.observedResponses.length, 1);
  assert.deepEqual(result.observedResponses[0].keys, ['success']);
  assert.doesNotMatch(JSON.stringify(result), /tt-private|private-query|private-customer|PII|other.invalid/);
});

test('missing or malformed captured bodies stay unknown', () => {
  const result = summarizeFacebookCapture(evidence([response('/api/v1/pages'),
    content('/api/v1/pages', null)], ['completed', 'completed', 'completed']), spec, 'fb-test');
  assert.equal(result.result, 'completed');
  assert.equal(result.observedResponses[0].success, null);
  assert.equal(result.observedResponses[0].conversationCount, null);
});

test('message and POS summaries expose schema counts without leaking object, customer or shop values', () => {
  const messages = '/api/v1/pages/fb-test/conversations/private-conversation/messages?customer_id=private-customer&current_count=25';
  const shop = '/pos-api/api/v1/shops/123456789';
  const declared = { runId: 'fixture', actions: [{ action: 'request', method: 'GET', path: messages }] };
  const result = summarizeFacebookCapture(evidence([
    response(messages), content(messages, { success: true, messages: [{ id: 'private-message', message: 'private-content' }] }),
    response(shop), content(shop, { success: true, shop: { account_keys: ['private-key'], name: 'private-shop' } }),
  ], ['completed']), declared, 'fb-test');
  assert.equal(result.observedResponses.length, 2);
  assert.equal(result.observedResponses[0].coincidesWithDeclaredEndpoint, true);
  assert.equal(result.observedResponses[0].messageCount, 1);
  assert.equal(result.observedResponses[1].path, '/pos-api/api/v1/shops/:shop');
  assert.doesNotMatch(JSON.stringify(result), /private-|123456789/);
});
