import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowsTagMutation, allowsConversationTag } from './facebook-tag-research-policy.mjs';

const tagName = 'NSR-1115-A7C2';
const original = { id: 1, text: 'original', color: '#000', lighten_color: '#fff' };
const synthetic = { id: null, text: tagName, color: '#000', lighten_color: '#fff', is_lead_event: false };
const baseline = { current_settings_key: 'fixture-key', tags: [original] };
const fields = (changes, key = 'fixture-key') => ({ changes: JSON.stringify(changes), current_settings_key: key });

test('allows adding only one synthetic unassigned tag while preserving every existing tag', () => {
  assert.equal(allowsTagMutation(fields({ tags: [original, synthetic] }), baseline, 'create', tagName), true);
  for (const tags of [[synthetic], [{ ...original, text: 'changed' }, synthetic], [original, synthetic, synthetic]]) {
    assert.equal(allowsTagMutation(fields({ tags }), baseline, 'create', tagName), false);
  }
});

const conversationContext = () => ({
  membership: { id: 'fb-test', platform: 'facebook', role_in_page: 'ADMINISTER', tag_sync_group_id: null },
  settings: { auto_tagging: false, sync_tag_to_botcake: false, multi_tag: true, tags: [{ ...original, text: tagName }] },
  conversation: { page_id: 'fb-test', seen: true, unread_count: 0, tags: [], from_psid: 'sender-test' },
  shop: { settings: { sync_conversation_tags_pancake: false }, crm_settings: { auto_sync_tags: [], auto_create_by_pages: [] } },
  automations: [],
});
const conversationFields = { tag_id: '1', value: '1', psid: 'sender-test', 'tag[id]': '1', 'tag[text]': tagName,
  'tag[color]': '#000', 'tag[lighten_color]': '#fff' };
test('conversation experiment permits only the exact synthetic tag and selected read Facebook record', () => {
  assert.equal(allowsConversationTag(conversationFields, conversationContext(), 'attach', tagName), true);
  const context = conversationContext(); context.conversation.tags = [1];
  assert.equal(allowsConversationTag({ ...conversationFields, value: '0' }, context, 'detach', tagName), true);
  for (const bad of [{ ...conversationFields, value: '0' }, { ...conversationFields, psid: 'other' },
    { ...conversationFields, extra: 'field' }, { ...conversationFields, 'tag[text]': 'other' }]) {
    assert.equal(allowsConversationTag(bad, conversationContext(), 'attach', tagName), false);
  }
});
test('conversation experiment refuses unknown or enabled sync/automation and cross-platform scope', () => {
  for (const alter of [c => { c.automations = undefined; }, c => { c.automations = [{}]; },
    c => { c.shop.settings.sync_conversation_tags_pancake = true; }, c => { c.settings.multi_tag = false; },
    c => { c.membership.platform = 'tiktok_business_messaging'; }, c => { c.conversation.page_id = 'other'; },
    c => { c.conversation.seen = false; }, c => { c.membership.tag_sync_group_id = 'group'; },
    c => { c.shop.crm_settings.auto_create_by_pages = ['any']; }, c => { c.settings.tags = []; }]) {
    const context = conversationContext(); alter(context);
    assert.equal(allowsConversationTag(conversationFields, context, 'attach', tagName), false);
  }
});
test('blocks stale keys, arbitrary settings, malformed changes and redacted snapshots', () => {
  assert.equal(allowsTagMutation(fields({ tags: [original, synthetic] }, 'stale'), baseline, 'create', tagName), false);
  assert.equal(allowsTagMutation(fields({ tags: [original, synthetic], full_tag: true }), baseline, 'create', tagName), false);
  assert.equal(allowsTagMutation({ changes: '{', current_settings_key: 'fixture-key' }, baseline, 'create', tagName), false);
  assert.equal(allowsTagMutation(fields({ tags: [synthetic] }), { ...baseline, tags: [{ text: '[REDACTED:cookie]' }] }, 'create', tagName), false);
});
test('rollback removes only the synthetic tag and preserves call automation settings', () => {
  const after = { ...baseline, tags: [original, { ...synthetic, id: 2 }] };
  assert.equal(allowsTagMutation(fields({ tags: [original], toggle_tag_when_call_success: [], toggle_tag_when_call_fail: [] }), after, 'delete', tagName), true);
  assert.equal(allowsTagMutation(fields({ tags: [] }), after, 'delete', tagName), false);
  assert.equal(allowsTagMutation(fields({ tags: [original], toggle_tag_when_call_success: [1] }), after, 'delete', tagName), false);
  assert.equal(allowsTagMutation(fields({ tags: [original] }), baseline, 'delete', tagName), false);
});
