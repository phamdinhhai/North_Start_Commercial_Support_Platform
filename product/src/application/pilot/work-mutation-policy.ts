import type { PilotLoopState, PilotErrorCode, WorkItem, WorkStatus } from '../../ports/pilot-loop.types';
import { PilotDomainError } from '../../ports/pilot-loop.types';

const ACTIONABLE_WORK_STATUSES: ReadonlySet<WorkStatus> = new Set([
  'proposed',
  'accepted',
  'open',
  'awaiting-external',
]);

/**
 * Recipient identities that still have an actionable work item on the lead.
 *
 * This is deliberately derived from work items rather than the latest handoff
 * recipient: an earlier recipient must retain lead-scoped access while their
 * own item remains actionable. PM-1 manager/admin semantics stay outside this
 * policy.
 */
export function activeWorkRecipients(state: PilotLoopState): readonly string[] {
  const recipients = new Set<string>();
  for (const workItem of state.workItems) {
    if (ACTIONABLE_WORK_STATUSES.has(workItem.status) && workItem.actor) {
      recipients.add(workItem.actor);
    }
  }
  return [...recipients];
}

/** Owner-only mutation authority. View and accept rights do not imply mutation. */
export function requireOwner(state: PilotLoopState, actor: string, action: string): void {
  if (!state.ownerUserId || state.ownerUserId !== actor) {
    throw new PilotDomainError(
      'NOT_OWNER',
      403,
      `${actor} may not ${action}: only the current lead owner (${state.ownerUserId ?? 'unassigned'}) may mutate work on this lead — view/accept rights do not imply it`,
    );
  }
}

/** Work-item lookup scoped to the lead being mutated. */
export function requireWork(state: PilotLoopState, workId: string): WorkItem {
  const item = state.workItems.find((workItem) => workItem.id === workId);
  if (!item) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'workId not found on this lead');
  return item;
}

/**
 * Reject closed-by-replacement items and preserve endpoint-specific errors for
 * completed items. A replacement is returned in details so callers can retry
 * against the item that remains live without guessing.
 */
export function requireActionable(
  state: PilotLoopState,
  item: WorkItem,
  closedCodes: Partial<Record<WorkStatus, PilotErrorCode>>,
): WorkItem {
  if (item.status === 'rescheduled' || item.status === 'cancelled') {
    const replacement = state.workItems.find(
      (workItem) =>
        workItem.supersedesWorkId === item.id &&
        workItem.status !== 'completed' &&
        workItem.status !== 'rescheduled' &&
        workItem.status !== 'cancelled',
    );
    const live = replacement ?? state.workItems.find((workItem) => workItem.supersedesWorkId === item.id);
    throw new PilotDomainError(
      'WORK_SUPERSEDED',
      409,
      `work ${item.id} is ${item.status} and is no longer actionable${live ? ' — act on the replacement instead' : ' — the chain has no live item'}`,
      {
        workId: item.id,
        status: item.status,
        replacementId: live?.id ?? null,
        ...(live ? { replacementStatus: live.status, dueAt: live.dueAt ?? null } : {}),
      },
    );
  }
  const code = closedCodes[item.status];
  if (code) {
    throw new PilotDomainError(code, 409, `work ${item.id} is ${item.status}; record a correction instead of mutating it`);
  }
  return item;
}

/**
 * Shared gate for complete/reschedule/no-observation. It composes lead-owner,
 * assigned-recipient, actionable-status, and accepted-state checks in the
 * existing order so status/error behavior remains stable.
 */
export function requireMutableWork(
  state: PilotLoopState,
  workId: string,
  actor: string,
  action: string,
  closedCodes: Partial<Record<WorkStatus, PilotErrorCode>>,
  options: { readonly requireAccepted?: boolean } = { requireAccepted: true },
): WorkItem {
  requireOwner(state, actor, action);
  const workItem = requireWork(state, workId);
  if (workItem.actor !== actor) {
    throw new PilotDomainError(
      'NOT_ASSIGNED_RECIPIENT',
      403,
      `${actor} may not ${action}: work ${workItem.id} is assigned to recipient ${workItem.actor}, not ${actor}`,
    );
  }
  const item = requireActionable(state, workItem, closedCodes);
  if (options.requireAccepted !== false && item.status === 'proposed') {
    throw new PilotDomainError(
      'NOT_ASSIGNED_RECIPIENT',
      403,
      `work ${item.id} is still proposed — recipient ${item.actor} must accept the handoff before it can be mutated`,
    );
  }
  return item;
}

/** Published endpoint-specific refusal codes for already completed items. */
export const CLOSED_BY_ENDPOINT = {
  complete: { completed: 'WORK_ALREADY_COMPLETED' },
  reschedule: { completed: 'WORK_ALREADY_CLOSED' },
  unobserved: { completed: 'WORK_ALREADY_CLOSED' },
  accept: { completed: 'WORK_ALREADY_CLOSED' },
} as const satisfies Record<string, Partial<Record<WorkStatus, PilotErrorCode>>>;
