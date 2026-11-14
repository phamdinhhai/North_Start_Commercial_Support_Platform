import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AuditStore, type AuditRecord } from '../audit/audit-store';
import { InMemoryPilotStore } from './in-memory-pilot.store';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
import type { ScenarioInput } from '../../ports/pilot-loop.types';

/**
 * P1-5 — the audit view must be LEAD-scoped (I-09, I-05).
 *
 * InMemoryPilotStore.history() used to append "every record in this workspace whose entityId
 * is not the lead id" — i.e. every OTHER lead's handoffs, work items and outcomes in the same
 * tenant showed up in one case's history. Two leads in one workspace are the normal case, not
 * an edge case, so this leaked another conversation's entire trail (including its reasons and
 * actors) to anyone allowed to read the first one.
 */
const intakeFor = (externalRecordId: string, displayName: string): ScenarioInput => ({
  workspaceId: 'ws-history',
  displayName,
  utterance: 'Thứ Sáu em gọi lại cho chị nhé',
  speaker: 'customer',
  connection: `conn-${randomUUID()}`,
  externalRecordId,
  isSynthetic: true,
  ownerUserId: 'marketing-lan',
});

async function twoLeadsInOneWorkspace() {
  const store = new InMemoryPilotStore(new AuditStore());
  const svc = new PilotLoopService(store, new ManualAdapter());
  const a = await svc.ingestScenario(intakeFor('msg-a', 'Phụ huynh A'));
  const b = await svc.ingestScenario(intakeFor('msg-b', 'Phụ huynh B'));

  await svc.handoffToSales(a.lead.id, {
    context: 'A cần gọi lại', proposedAction: 'A: gọi lại 15:00 thứ Sáu', responsibleParty: 'internal',
    origin: 'explicit-request', actor: 'marketing-lan', recipientUserId: 'sales-b',
  });
  const bHanded = await svc.handoffToSales(b.lead.id, {
    context: 'B bí mật — chỉ riêng B', proposedAction: 'B: gửi học phí', responsibleParty: 'internal',
    origin: 'explicit-commitment', actor: 'marketing-lan', recipientUserId: 'sales-b',
  });
  const wid = bHanded.workItems[0].id;
  await svc.salesAccept(b.lead.id, { workId: wid, actor: 'sales-b', reason: 'B nhận' });
  await svc.completeWork(b.lead.id, { workId: wid, actor: 'sales-b', evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, reason: 'B đã gửi bảng phí' });
  return { svc, a, b, bWorkId: wid };
}

describe('InMemoryPilotStore CAS persistence hardening', () => {
  it('rejects two writes based on the same aggregate version and keeps the winner', async () => {
    const audit = new AuditStore();
    const store = new InMemoryPilotStore(audit);
    const svc = new PilotLoopService(store, new ManualAdapter());
    const initial = await svc.ingestScenario(intakeFor('cas-a', 'CAS'));
    expect(initial.version).toBe(1);
    const first = { ...initial, lead: { ...initial.lead, displayName: 'winner' } };
    const second = { ...initial, lead: { ...initial.lead, displayName: 'stale' } };
    const committed = await store.save(first, []);
    expect(committed.version).toBe(2);
    await expect(store.save(second, [])).rejects.toMatchObject({ code: 'STALE_VERSION', status: 409 });
    expect((await store.load(initial.lead.id))?.lead.displayName).toBe('winner');
  });

  it('lets exactly one concurrent service mutation win and leaves no stale projection or audit', async () => {
    const audit = new AuditStore();
    const store = new InMemoryPilotStore(audit);
    const first = new PilotLoopService(store, new ManualAdapter());
    const second = new PilotLoopService(store, new ManualAdapter());
    const initial = await first.ingestScenario(intakeFor('cas-concurrent', 'CAS concurrent'));
    const handed = await first.handoffToSales(initial.lead.id, {
      context: 'c',
      proposedAction: 'gọi lại',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    const workId = handed.workItems[0].id;
    await first.salesAccept(initial.lead.id, { workId, actor: 'sales-b', reason: 'nhận' });

    const results = await Promise.allSettled([
      first.advance(initial.lead.id, { to: 'Contacting', actor: 'sales-b', reason: 'winner candidate' }),
      second.advance(initial.lead.id, { to: 'Contacting', actor: 'sales-b', reason: 'stale candidate' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'STALE_VERSION', status: 409 } });

    const committed = await first.get(initial.lead.id);
    expect(committed?.lead.status).toBe('Contacting');
    expect(committed?.version).toBe(4);
    const transitions = audit.getByEntity('lead', initial.lead.id).filter((record) => record.eventType === 'lead_transition');
    expect(transitions).toHaveLength(2); // Accepted + one Contacting winner
    expect(transitions.filter((record) => record.newValue === 'Contacting')).toHaveLength(1);
    expect(transitions.map((record) => record.reason)).not.toContain('stale candidate');
  });

  it('rolls back audit appends when an append fails before publishing state', async () => {
    class FailingAuditStore extends AuditStore {
      override append(input: Parameters<AuditStore['append']>[0]): AuditRecord {
        if (input.eventType === 'fail') throw new Error('audit failure');
        return super.append(input);
      }
    }
    const audit = new FailingAuditStore();
    const store = new InMemoryPilotStore(audit);
    const svc = new PilotLoopService(store, new ManualAdapter());
    const state = await svc.ingestScenario(intakeFor('rollback-a', 'rollback'));
    const before = audit.count;
    const next = { ...state, lead: { ...state.lead, displayName: 'not published' } };
    await expect(store.save(next, [
      { entityType: 'lead', entityId: state.lead.id, workspaceId: state.lead.workspaceId, actor: 'test', newValue: '{}', eventType: 'ok' },
      { entityType: 'lead', entityId: state.lead.id, workspaceId: state.lead.workspaceId, actor: 'test', newValue: '{}', eventType: 'fail' },
    ])).rejects.toThrow('audit failure');
    expect(audit.count).toBe(before);
    expect((await store.load(state.lead.id))?.lead.displayName).toBe(state.lead.displayName);
  });
});

describe('InMemoryPilotStore.history — lead-scoped audit (P1-5)', () => {
  it('returns only this lead’s own trail, not other leads’ records in the same workspace', async () => {
    const { svc, a, b } = await twoLeadsInOneWorkspace();
    const historyA = await svc.auditHistory(a.lead.id);

    expect(historyA.length).toBeGreaterThan(0);
    const entityIds = new Set(historyA.map((h) => h.entityId));
    // lead A's own record is present
    expect(entityIds).toContain(a.lead.id);
    // nothing from lead B: not its lead id, not its work item, not its handoff/outcome
    expect(entityIds.has(b.lead.id)).toBe(false);

    // and B's content must not be readable through A's history at all
    const serialized = JSON.stringify(historyA);
    expect(serialized).not.toContain('B bí mật');
    expect(serialized).not.toContain('B đã gửi bảng phí');
    expect(serialized).not.toContain('B: gửi học phí');
  });

  it('still includes every entity that BELONGS to the lead (handoff, work item)', async () => {
    const { svc, a } = await twoLeadsInOneWorkspace();
    const historyA = await svc.auditHistory(a.lead.id);
    const types = historyA.map((h) => h.entityType);
    expect(types).toContain('lead');
    expect(types).toContain('handoff');
    // ordered by time, append-only (I-05)
    const stamps = historyA.map((h) => h.timestamp);
    expect([...stamps].sort()).toEqual(stamps);
    expect(historyA.every((h) => h.workspaceId === a.lead.workspaceId)).toBe(true);
    expect(historyA.every((h) => h.metadata.trust === 'recorded' && h.metadata.provenance === 'audit_record')).toBe(true);
    expect(historyA.every((h) => h.metadata.unknown.includes('business_truth'))).toBe(true);
  });

  it("B's history contains B's trail and none of A's", async () => {
    const { svc, a, b, bWorkId } = await twoLeadsInOneWorkspace();
    const historyB = await svc.auditHistory(b.lead.id);
    const entityIds = new Set(historyB.map((h) => h.entityId));
    expect(entityIds).toContain(b.lead.id);
    expect(entityIds).toContain(bWorkId);
    expect(entityIds.has(a.lead.id)).toBe(false);
    expect(JSON.stringify(historyB)).not.toContain('A cần gọi lại');
  });

  it('a lead in ANOTHER workspace is never mixed in either', async () => {
    const store = new InMemoryPilotStore(new AuditStore());
    const svc = new PilotLoopService(store, new ManualAdapter());
    const mine = await svc.ingestScenario(intakeFor('msg-mine', 'của tôi'));
    const other = await svc.ingestScenario({ ...intakeFor('msg-other', 'của người khác'), workspaceId: 'ws-other' });
    await svc.handoffToSales(other.lead.id, {
      context: 'không liên quan', proposedAction: 'x', responsibleParty: 'internal',
      origin: 'explicit-request', actor: 'marketing-lan', recipientUserId: 'sales-b',
    });
    const history = await svc.auditHistory(mine.lead.id);
    expect(new Set(history.map((h) => h.entityId))).toEqual(new Set([mine.lead.id]));
  });

  it('unknown lead has no history (no full-table dump fallback)', async () => {
    const store = new InMemoryPilotStore(new AuditStore());
    expect(await store.history(randomUUID())).toEqual([]);
  });
});
