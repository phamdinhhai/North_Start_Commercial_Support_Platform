import type {PancakeHistoryTarget} from './pancake-history-readback';
import {inspectPancakeMessageScope, type PancakeMessageScopeInspection} from './pancake-message-scope';

export interface PancakeHistoryResponse {
  status: number;
  redirected?: boolean;
  contentType: string;
  payload: unknown;
}
export type PancakeHistoryResponseClassification =
  | {status: 'terminal'; reason: 'INVALID_STATUS' | 'REDIRECT' | 'AUTH_FAILURE' | 'RATE_LIMIT' |
    'HTTP_FAILURE' | 'NON_JSON' | 'SCOPE_UNVERIFIED'}
  | {status: 'accepted'; reason: 'TARGET_MATCHED'; inspection: PancakeMessageScopeInspection};

/** Pure offline response gate. Acceptance is scoped metadata, never authentication or mutation permission. */
export function classifyPancakeHistoryResponse(response: PancakeHistoryResponse,
  target: PancakeHistoryTarget, maxMessages: number): PancakeHistoryResponseClassification {
  const terminal = (reason: Extract<PancakeHistoryResponseClassification, {status: 'terminal'}>['reason']) =>
    ({status: 'terminal' as const, reason});
  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599)
    return terminal('INVALID_STATUS');
  if (response.redirected || (response.status >= 300 && response.status < 400)) return terminal('REDIRECT');
  if (response.status === 401 || response.status === 403) return terminal('AUTH_FAILURE');
  if (response.status === 429) return terminal('RATE_LIMIT');
  if (response.status !== 200) return terminal('HTTP_FAILURE');
  if (typeof response.contentType !== 'string' ||
    !/^application\/json(?:\s*;[^\r\n]*)?$/iu.test(response.contentType.trim())) return terminal('NON_JSON');
  try {
    return {status: 'accepted', reason: 'TARGET_MATCHED',
      inspection: inspectPancakeMessageScope(target, response.payload, maxMessages)};
  } catch { return terminal('SCOPE_UNVERIFIED'); }
}
