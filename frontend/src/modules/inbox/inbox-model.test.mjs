import test from 'node:test';
import assert from 'node:assert/strict';
import { filterDuplicateSourceMessages, getLastMessage, getReadMessages, getUnreadMessages } from './chatwoot-conversation-helper.mjs';
import { inboxFixtures, lastPreview, previewMessages, visibleConversations } from './inbox-model.ts';

test('Chatwoot source-message dedupe retains first observation without mutating source', () => {
  const first = { id: 'fixture-1', source_id: 'fixture-native-1', content: 'first', created_at: 1, message_type: 0 };
  const second = { ...first, id: 'fixture-2', content: 'later duplicate' };
  const unknown = { ...first, id: 'fixture-3', source_id: undefined };
  const source = [first, second, unknown, unknown];
  const result = filterDuplicateSourceMessages(source);
  assert.deepEqual(result, [first, unknown, unknown]);
  assert.equal(source.length, 4);
});
test('Chatwoot preview favors non-activity and newer API observation', () => {
  const incoming = { id: 'fixture-1', content: 'customer', created_at: 1, message_type: 0 };
  const activity = { ...incoming, id: 'fixture-2', content: 'activity', created_at: 3, message_type: 2 };
  const later = { ...incoming, id: 'fixture-3', content: 'newer', created_at: 2 };
  assert.equal(getLastMessage({ messages: [incoming, activity] }), incoming);
  assert.equal(getLastMessage({ messages: [incoming, activity], last_non_activity_message: later }), later);
  assert.equal(getLastMessage({ messages: [activity] }), activity);
  assert.equal(getLastMessage({ messages: [] }), undefined);
});
test('Chatwoot read partitions remain preview-only and do not alter messages', () => {
  const messages = inboxFixtures[0].messages;
  const cutoff = messages[1].created_at;
  assert.equal(getReadMessages(messages, cutoff).length, 2);
  assert.equal(getUnreadMessages(messages, cutoff).length, 2);
  assert.equal(messages.length, 4);
});
test('Vietnamese query and exact channel scope filter independent fixture threads', () => {
  assert.equal(visibleConversations(inboxFixtures, 'all', '').length, 3);
  assert.equal(visibleConversations(inboxFixtures, 'pancake', 'LÁ XANH')[0].id, 'demo-pancake-1');
  assert.equal(visibleConversations(inboxFixtures, 'meta', 'Lá Xanh').length, 0);
  assert.equal(visibleConversations(inboxFixtures, 'all', 'không tồn tại').length, 0);
});
test('all fixture timelines have stable explicit sample identifiers and meaningful preview', () => {
  const ids = new Set();
  for (const item of inboxFixtures) {
    assert.match(item.id, /^demo-/);
    assert.ok(lastPreview(item).length > 0);
    for (const message of previewMessages(item)) {
      assert.equal(ids.has(message.id), false);
      ids.add(message.id);
      assert.match(message.id, /^demo-message-/);
    }
  }
});
