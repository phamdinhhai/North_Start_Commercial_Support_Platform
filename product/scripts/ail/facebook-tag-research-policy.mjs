import { isDeepStrictEqual } from 'node:util';

/** Local experiment guard, not a tenant authorization service. */
export function allowsTagMutation(fields, baseline, operation, tagName) {
  if (!/^NSR-[0-9]{4}-[A-F0-9]{4}$/.test(tagName) || !baseline?.current_settings_key ||
      !Array.isArray(baseline.tags) || JSON.stringify(baseline.tags).includes('[REDACTED:') ||
      !['create', 'delete'].includes(operation)) return false;
  if (Object.keys(fields).some((key) => !['changes', 'current_settings_key'].includes(key)) ||
      fields.current_settings_key !== String(baseline.current_settings_key)) return false;
  let changes;
  try { changes = JSON.parse(fields.changes); } catch { return false; }
  const allowedKeys = operation === 'create' ? ['tags'] : ['tags', 'toggle_tag_when_call_success', 'toggle_tag_when_call_fail'];
  if (!changes || Object.keys(changes).some((key) => !allowedKeys.includes(key)) || !Array.isArray(changes.tags)) return false;
  const oldMatches = baseline.tags.filter((tag) => tag.text === tagName);
  const newMatches = changes.tags.filter((tag) => tag?.text === tagName);
  if (operation === 'create') {
    const tag = newMatches[0];
    return oldMatches.length === 0 && newMatches.length === 1 && tag.id === null &&
      tag.is_lead_event === false && typeof tag.color === 'string' && typeof tag.lighten_color === 'string' &&
      Object.keys(tag).every((key) => ['id', 'text', 'is_lead_event', 'color', 'lighten_color'].includes(key)) &&
      isDeepStrictEqual(changes.tags.filter((item) => item !== tag), baseline.tags);
  }
  return oldMatches.length === 1 && newMatches.length === 0 &&
    isDeepStrictEqual(changes.tags, baseline.tags.filter((tag) => tag.text !== tagName)) &&
    ['toggle_tag_when_call_success', 'toggle_tag_when_call_fail'].every((key) =>
      !Object.hasOwn(changes, key) || isDeepStrictEqual(changes[key], baseline[key] ?? []));
}

export function tagExperimentActions(operation, tagName) {
  const css = (selector) => ({ kind: 'css', selector });
  const click = (step_id, selector) => ({ step_id, action: 'click', locator: css(selector), timeout_ms: 10000 });
  const ready = { step_id: 'tags_ready', action: 'wait_for', locator: css('.setting-tag-container'), state: 'visible', timeout_ms: 15000 };
  if (operation === 'create') return [ready, click('open_new_tag', '.btn-create-tags'),
    { step_id: 'name_synthetic_tag', action: 'fill', locator: css('.modal-edit-tag input.edit-tag-input[type="text"]'),
      value: { source: 'literal', value: tagName }, timeout_ms: 10000 },
    { step_id: 'dispatch_name_input', action: 'press', locator: css('.modal-edit-tag input.edit-tag-input[type="text"]'), key: 'Space', timeout_ms: 10000 },
    { step_id: 'finish_name_input', action: 'press', locator: css('.modal-edit-tag input.edit-tag-input[type="text"]'), key: 'Backspace', timeout_ms: 10000 },
    { step_id: 'wait_for_react_state', action: 'wait_for_timeout', duration_ms: 750 },
    click('save_synthetic_tag', '.modal-edit-tag .ant-modal-footer button.color-primary'),
    { step_id: 'settle', action: 'wait_for_timeout', duration_ms: 2500 }];
  if (operation === 'delete') return [ready,
    { step_id: 'find_synthetic_tag', action: 'fill', locator: css('.input-search-tag input'),
      value: { source: 'literal', value: tagName }, timeout_ms: 10000 },
    { step_id: 'wait_for_search_state', action: 'wait_for_timeout', duration_ms: 750 },
    click('enable_selection', '.btn-edit-tags'),
    { step_id: 'select_only_synthetic_tag', action: 'check', locator: css('.list-tag-container input[type="checkbox"]'), timeout_ms: 10000 },
    click('preview_delete', '.btn-delete-tags'),
    { step_id: 'confirm_synthetic_delete', action: 'check', locator: css('.sure-remove-tags input[type="checkbox"]'), timeout_ms: 10000 },
    click('delete_synthetic_tag', '.modal-confirm-save-settings .ant-modal-footer button.color-primary'),
    { step_id: 'settle', action: 'wait_for_timeout', duration_ms: 2500 }];
  throw new Error('invalid_tag_operation');
}

// A local experiment only. Recheck current provider snapshots before each click.
export function allowsConversationTag(fields, { membership, settings, conversation, shop, automations }, operation, tagName) {
  if (!['attach', 'detach'].includes(operation) || !/^NSR-[0-9]{4}-[A-F0-9]{4}$/.test(tagName)) return false;
  if (membership?.platform !== 'facebook' || membership.role_in_page !== 'ADMINISTER' || membership.tag_sync_group_id ||
      settings?.auto_tagging !== false || settings.sync_tag_to_botcake !== false || settings.multi_tag !== true ||
      !Array.isArray(automations) || automations.length !== 0 || shop?.settings?.sync_conversation_tags_pancake !== false ||
      !Array.isArray(shop.crm_settings?.auto_sync_tags) || shop.crm_settings.auto_sync_tags.length !== 0 ||
      !Array.isArray(shop.crm_settings?.auto_create_by_pages) || shop.crm_settings.auto_create_by_pages.length !== 0) return false;
  if (conversation?.page_id !== membership.id || conversation.seen !== true || conversation.unread_count !== 0 ||
      !Array.isArray(conversation.tags)) return false;
  const matches = settings.tags?.filter((tag) => tag.text === tagName);
  if (matches?.length !== 1) return false;
  const tag = matches[0];
  if (typeof tag.id !== 'number' || tag.id < 0 || !Number.isSafeInteger(tag.id)) return false;
  if (conversation.tags.includes(tag.id) !== (operation === 'detach')) return false;
  const expected = { tag_id: String(tag.id), value: operation === 'attach' ? '1' : '0', psid: conversation.from_psid,
    ...Object.fromEntries(Object.entries(tag).map(([key, value]) => [`tag[${key}]`, String(value)])) };
  return isDeepStrictEqual(fields, expected);
}
