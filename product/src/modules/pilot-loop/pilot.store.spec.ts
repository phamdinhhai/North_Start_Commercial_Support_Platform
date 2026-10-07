import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AuditStore } from '../../infra/audit/audit-store';
import { InMemoryPilotStore } from './pilot.store';
import { PilotLoopService } from './pilot-loop.service';
import type { ScenarioInput } from './pilot.types';

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
  const svc = new PilotLoopService(store);
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
  await svc.completeWork(b.lead.id, { workId: wid, actor: 'sales-b', evidence: 'declared', reason: 'B đã gửi bảng phí' });
  return { svc, a, b, bWorkId: wid };
}

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
    const svc = new PilotLoopService(store);
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
