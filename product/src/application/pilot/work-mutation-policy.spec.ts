import { describe, expect, it } from 'vitest';
import { createLead } from '../../domain/lead/lead';
import { PilotDomainError } from '../../ports/pilot-loop.types';
import type { PilotLoopState, WorkItem } from '../../ports/pilot-loop.types';
import {
  activeWorkRecipients,
  CLOSED_BY_ENDPOINT,
  requireActionable,
  requireMutableWork,
  requireOwner,
  requireWork,
} from './work-mutation-policy';

const lead = createLead({ workspaceId: 'ws-policy', displayName: 'Policy test' });

function work(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'work-1',
    leadId: lead.id,
    workspaceId: lead.workspaceId,
    action: 'Call back',
    responsibleParty: 'internal',
    origin: 'explicit-request',
    status: 'accepted',
    completionEvidence: 'absent',
    occurredAt: 'unknown',
    recordedAt: '2026-11-12T00:00:00.000Z',
    actor: 'sales-b',
    ...overrides,
  };
}

function state(workItems: readonly WorkItem[] = [work()]): PilotLoopState {
  return { lead, workItems, outcomes: [], ownerUserId: 'sales-b' };
}

describe('work mutation policy', () => {
  it('derives all actionable recipients, including earlier handoffs', () => {
    expect(activeWorkRecipients(state([
      work({ id: 'b', actor: 'sales-b', status: 'accepted' }),
      work({ id: 'c', actor: 'sales-c', status: 'open' }),
      work({ id: 'closed', actor: 'sales-d', status: 'completed' }),
    ]))).toEqual(['sales-b', 'sales-c']);
  });

  it('keeps owner-only refusal and per-lead work lookup behavior', () => {
    expect(() => requireOwner(state(), 'sales-c', 'complete work')).toThrowError(
      expect.objectContaining({ code: 'NOT_OWNER', status: 403 }),
    );
    expect(() => requireWork(state(), 'missing')).toThrowError(
      expect.objectContaining({ code: 'WORK_NOT_FOUND', status: 404 }),
    );
  });

  it('returns the published superseded replacement refusal details', () => {
    const old = work({ status: 'rescheduled' });
    const replacement = work({ id: 'work-2', status: 'open', supersedesWorkId: old.id });
    try {
      requireActionable(state([old, replacement]), old, CLOSED_BY_ENDPOINT.complete);
      throw new Error('expected refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(PilotDomainError);
      expect(error).toMatchObject({ code: 'WORK_SUPERSEDED', status: 409, details: { replacementId: 'work-2' } });
    }
  });

  it('composes owner, recipient, actionable and accepted checks', () => {
    expect(() => requireMutableWork(state([work({ status: 'proposed' })]), 'work-1', 'sales-b', 'complete work', CLOSED_BY_ENDPOINT.complete))
      .toThrowError(expect.objectContaining({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 }));
    expect(() => requireMutableWork(state(), 'work-1', 'sales-c', 'complete work', CLOSED_BY_ENDPOINT.complete))
      .toThrowError(expect.objectContaining({ code: 'NOT_OWNER', status: 403 }));
  });
});
