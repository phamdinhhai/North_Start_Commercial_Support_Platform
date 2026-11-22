import type { PancakeHistoryTarget } from './pancake-history-readback';

const reject = (): never => { throw new Error('PANCAKE_MESSAGE_SCOPE_UNVERIFIED'); };
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' &&
  value.length > 0 && value.length <= 256 && !/[\x00-\x20\x7f/?#]/u.test(value);

/** Metadata-only result. No customer content, IDs, names or raw response escape this inspector. */
export interface PancakeMessageScopeInspection {
  readonly status: 'TARGET_MATCHED';
  readonly messageCount: number;
  readonly contactIdentity: 'PROVIDER_OBSERVED' | 'UNKNOWN';
  readonly completeness: 'UNKNOWN';
  readonly originalChannelIdentity: 'UNVERIFIED';
}

/**
 * Offline helper for the documented MessagesResponse subset. Transport must
 * authenticate first. A matched response proves neither Page alias ownership,
 * customer identity across providers, mutation rights nor complete history.
 * It never creates observations/checkpoints or stores provider/customer data.
 */
export function inspectPancakeMessageScope(target: PancakeHistoryTarget, payload: unknown,
  maxMessages: number): PancakeMessageScopeInspection {
  if (!target || !identity(target.pageId) || !identity(target.conversationId) ||
      !Number.isSafeInteger(maxMessages) || maxMessages < 1 || maxMessages > 1000 ||
      !record(payload) || payload.success !== true || payload.conversation_id !== target.conversationId ||
      !Array.isArray(payload.messages) || payload.messages.length > maxMessages) reject();
  const data = payload as Record<string, unknown>;
  const messages = data.messages as unknown[];
  for (const message of messages) {
    if (!record(message) || !identity(message.id) || message.page_id !== target.pageId ||
        message.conversation_id !== target.conversationId) reject();
  }
  const from = data.conv_from;
  if (from !== undefined && from !== null && (!record(from) || !identity(from.id))) reject();
  return Object.freeze({status: 'TARGET_MATCHED', messageCount: messages.length,
    contactIdentity: record(from) ? 'PROVIDER_OBSERVED' : 'UNKNOWN',
    completeness: 'UNKNOWN', originalChannelIdentity: 'UNVERIFIED'});
}
