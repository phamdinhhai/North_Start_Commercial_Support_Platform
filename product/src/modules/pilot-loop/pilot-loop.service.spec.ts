import { beforeEach, describe, expect, it } from 'vitest';
import { AuditStore } from '../../infra/audit/audit-store';
import { InMemoryPilotStore } from './pilot.store';
import { PilotLoopService, activeWorkRecipients } from './pilot-loop.service';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import type { ScenarioInput } from './pilot.types';
import type { LeadId } from '../../domain/lead/lead';

const base: ScenarioInput = {
  workspaceId: 'ws-edu-1',
  displayName: 'Phụ huynh A — lớp tối thứ Bảy',
  utterance: 'Thứ Sáu em gọi lại cho chị nhé, chị trao đổi với bé đã.',
  speaker: 'customer',
  connection: 'manual-paste',
  externalRecordId: 'msg-001',
  conversationSource: 'Messenger',
  isSynthetic: true,
  ownerUserId: 'marketing-lan',
};

function make(): { svc: PilotLoopService; audit: AuditStore } {
  const audit = new AuditStore();
  const store = new InMemoryPilotStore(audit);
  return { svc: new PilotLoopService(store), audit };
}

describe('PilotLoopService — P0 education B2C loop (durable store port)', () => {
  let svc: PilotLoopService;
  let audit: AuditStore;

  beforeEach(() => {
    ({ svc, audit } = make());
  });

  it('runs the full loop: intake → handoff → accept → complete → outcome', async () => {
    const state = await svc.ingestScenario(base);
    expect(state.lead.status).toBe('New');
    expect(state.lead.attribution).toBe(UNKNOWN_SENTINEL); // MM-1 — không fabricate
    expect(state.sourceEnvelopeId).toBeDefined(); // I-12 raw pointer

    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'Phụ huynh muốn con học thử lớp tối; đã hỏi học phí.',
      proposedAction: 'Gọi lại chị A lúc 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    expect(handed.handoff).toBeDefined();
    expect(handed.workItems).toHaveLength(1);
    expect(handed.workItems[0].status).toBe('proposed'); // gửi bàn giao ≠ nhận trách nhiệm
    expect(handed.handoffRecipient).toBe('sales-hung');

    const workId = handed.workItems[0].id;
    const accepted = await svc.salesAccept(handed.lead.id, { workId, actor: 'sales-hung', reason: 'Sales xác nhận phụ trách' });
    expect(accepted.lead.status).toBe('Accepted');
    expect(accepted.workItems[0].status).toBe('accepted');
    expect(accepted.ownerUserId).toBe('sales-hung');

    const done = await svc.completeWork(accepted.lead.id, {
      workId,
      actor: 'sales-hung',
      evidence: 'declared',
      occurredAt: '2026-10-09T15:05:00+07:00',
      reason: 'Đã gọi, phụ huynh hẹn cuối tuần đăng ký',
    });
    expect(done.workItems[0].status).toBe('completed');
    expect(done.workItems[0].completionEvidence).toBe('declared');

    const advanced1 = await svc.advance(done.lead.id, { to: 'Contacting', actor: 'sales-hung', reason: 'đã gọi' });
    const advanced2 = await svc.advance(advanced1.lead.id, { to: 'Follow-up', actor: 'sales-hung', reason: 'chờ quyết định' });
    const result = await svc.recordOutcome(advanced2.lead.id, { value: 'Unknown', actor: 'sales-hung', reason: 'chưa chốt' });
    expect(result.lead.status).toBe('Unknown');
    expect(result.outcomes[0].assertionStatus).toBe('claimed');

    // audit append-only, đầy đủ chuỗi
    expect(audit.getByEntity('lead', state.lead.id).length).toBeGreaterThanOrEqual(4);
  });

  it('Marketing A bàn giao cho Sales B — B xem và nhận đúng gói, A mất quyền mutate sau khi B nhận', async () => {
    const state = await svc.ingestScenario(base); // owner = marketing-lan
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại chị A',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    // B xem được gói (đọc được context + evidence refs) dù chưa phải owner
    const view = await svc.get(handed.lead.id);
    expect(view?.handoff?.context).toBe('c');
    expect(view?.handoffRecipient).toBe('sales-b');
    expect(view?.ownerUserId).toBe('marketing-lan'); // chủ cũ vẫn là A tới khi B accept

    // Người thứ ba C không phải owner/recipient → service accept từ chối 403
    const workId = handed.workItems[0].id;
    await expect(svc.salesAccept(handed.lead.id, { workId, actor: 'sales-c', reason: 'x' })).rejects.toMatchObject({
      code: 'NOT_ASSIGNED_RECIPIENT',
      status: 403,
    });

    // B accept → owner chuyển B
    const accepted = await svc.salesAccept(handed.lead.id, { workId, actor: 'sales-b', reason: 'B nhận trách nhiệm' });
    expect(accepted.ownerUserId).toBe('sales-b');
    expect(accepted.workItems[0].status).toBe('accepted');

    // Sau khi B nhận, A không còn quyền mutate (ownership đã chuyển — I-09)
    await expect(svc.advance(accepted.lead.id, { to: 'Contacting', actor: 'marketing-lan', reason: 'x' })).rejects.toMatchObject({
      code: 'NOT_OWNER',
      status: 403,
    });
  });

  it('separates utterance speaker from responsible party for mixed propositions (Q3 conflict case)', async () => {
    const state = await svc.ingestScenario(base);
    const internal = await svc.handoffToSales(state.lead.id, {
      context: 'Yêu cầu gọi lại',
      proposedAction: 'Gọi lại chị A',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const withExternal = await svc.handoffToSales(internal.lead.id, {
      context: 'Kỳ vọng phía khách',
      proposedAction: 'Chị A trao đổi với bé',
      responsibleParty: 'external',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });

    const parties = withExternal.workItems.map((w) => w.responsibleParty);
    expect(parties).toEqual(expect.arrayContaining(['internal', 'external']));
    expect(withExternal.workItems.filter((w) => w.responsibleParty === 'external')).toHaveLength(1);
  });

  it('rejects "observed" completion without a system evidence pointer (message ≠ proof of action)', async () => {
    const state = await svc.ingestScenario({ ...base, utterance: 'Em gửi rồi nhé', externalRecordId: 'msg-002' });
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'Gửi thông tin học phí',
      proposedAction: 'Gửi bảng học phí',
      responsibleParty: 'internal',
      origin: 'explicit-commitment',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-hung', reason: 'B nhận' });
    await expect(svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'observed' })).rejects.toMatchObject({
      code: 'EVIDENCE_POINTER_REQUIRED',
      status: 422,
    });

    const declared = await svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'declared', reason: 'nhân viên báo đã gửi qua Zalo' });
    expect(declared.workItems[0].completionEvidence).toBe('declared');
  });

  it('refuses AI/inferred evidence closing work (I-03, V2 §9.6)', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'a',
      responsibleParty: 'internal',
      origin: 'inferred',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-hung', reason: 'B nhận' });
    await expect(
      svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'inferred' }),
    ).rejects.toMatchObject({ code: 'INFERRED_CANNOT_CLOSE', status: 422 });
  });

  it('reschedule supersedes the old item so no stale reminder remains', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const oldId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId: oldId, actor: 'sales-hung', reason: 'nhận' });
    const moved = await svc.rescheduleWork(state.lead.id, {
      workId: oldId,
      actor: 'sales-hung',
      newDueAt: '2026-10-12T16:00:00+07:00',
      reason: 'Phụ huynh dời sang thứ Hai',
    });

    const openDueBeforeOld = await svc.openInternalWorkDueBefore(state.lead.id, '2026-10-09T16:00:00+07:00');
    expect(openDueBeforeOld.map((w) => w.id)).not.toContain(oldId); // lịch cũ không còn nhắc
    const current = moved.workItems.find((w) => w.supersedesWorkId === oldId);
    expect(current?.dueAt).toBe('2026-10-12T16:00:00+07:00');
    expect(moved.workItems.find((w) => w.id === oldId)?.status).toBe('rescheduled');
  });

  it('refuses to reschedule completed work — corrections, not silent reopening (I-05)', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-hung', reason: 'nhận' });
    await svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'declared', reason: 'đã gọi' });
    await expect(
      svc.rescheduleWork(state.lead.id, { workId, actor: 'sales-hung', newDueAt: '2026-10-12T16:00:00+07:00', reason: 'lỡ tay' }),
    ).rejects.toMatchObject({ code: 'WORK_ALREADY_CLOSED', status: 409 });
  });

  it('treats an external expectation past its time as no-observation, never overdue/failure', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Chị A trao đổi với bé',
      responsibleParty: 'external',
      origin: 'explicit-request',
      dueAt: '2026-10-09T00:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-hung', reason: 'nhận' });
    const marked = await svc.markExternalUnobserved(state.lead.id, { workId, actor: 'sales-hung' });
    expect(marked.workItems[0].status).toBe('awaiting-external');
    expect(marked.workItems[0].completionEvidence).toBe('absent');
    expect(await svc.openInternalWorkDueBefore(state.lead.id, '2026-10-10T00:00:00+07:00')).toHaveLength(0);
    await expect(svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'declared' })).rejects.toMatchObject({
      code: 'EXTERNAL_NOT_DECLAREABLE',
      status: 422,
    });
  });

  it('keeps unknown event time unknown instead of backfilling from record time (Q4)', async () => {
    const state = await svc.ingestScenario({ ...base, utterance: 'Gọi lại trong chiều nay nhé', externalRecordId: 'msg-003' });
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại chiều nay',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-hung', reason: 'nhận' });
    const done = await svc.completeWork(state.lead.id, {
      workId,
      actor: 'sales-hung',
      evidence: 'declared',
      reason: 'nhập muộn hôm sau',
    });
    expect(done.workItems[0].occurredAt).toBe(UNKNOWN_SENTINEL);
    expect(new Date(done.workItems[0].recordedAt).getTime()).not.toBeNaN();
  });

  it('corrects an outcome by appending, preserving prior assertion and audit (I-05)', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'a',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-hung', reason: 'x' });
    await svc.advance(state.lead.id, { to: 'Contacting', actor: 'sales-hung', reason: 'đã gọi' });
    await svc.advance(state.lead.id, { to: 'Follow-up', actor: 'sales-hung', reason: 'chờ trả lời' });
    const won = await svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'sales-hung', reason: 'đã deposit' });
    expect(won.lead.status).toBe('Won');
    const corrected = await svc.correctOutcomeRecord(state.lead.id, {
      outcomeId: won.outcomes[0].id,
      newValue: 'Lost',
      actor: 'sales-hung',
      reason: 'khách rút, hoàn deposit',
    });
    expect(corrected.outcomes).toHaveLength(2);
    expect(corrected.outcomes[1].supersedesOutcomeId).toBe(won.outcomes[0].id);
    expect(corrected.lead.status).toBe('Lost');
  });

  it('aborts transitions beyond the frozen CE-1 hypothesis boundary (422, not 500)', async () => {
    const state = await svc.ingestScenario(base);
    await expect(svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'marketing-lan' })).rejects.toMatchObject({
      code: 'CE1_BOUNDARY',
      status: 422,
    });
  });
});

/**
 * P1-2 — view / accept / mutation là BA quyền tách biệt (I-09, PM-1 vẫn OPEN).
 * Lỗi cũ: controller gate mọi mutation bằng đúng `authorizedView` (quyền XEM), nên
 * người được bàn giao B hoàn thành/dời lịch/chuyển trạng thái lead TRƯỚC khi nhận
 * trách nhiệm, trong khi owner vẫn là A.
 */
describe('P1-2 — mutation authorization is per work item and handoff state', () => {
  let svc: PilotLoopService;

  beforeEach(async () => {
    ({ svc } = make());
  });

  async function handedOver() {
    const state = await svc.ingestScenario(base); // owner = marketing-lan
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại chị A',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    return { state, workId: handed.workItems[0].id };
  }

  it('recipient B may VIEW and ACCEPT, but every mutation is refused while owner is still A', async () => {
    const { state, workId } = await handedOver();

    // view — quyền đọc lead-scoped của recipient
    const view = await svc.get(state.lead.id);
    expect(view?.handoffRecipient).toBe('sales-b');
    expect(view?.ownerUserId).toBe('marketing-lan');

    // mutations trước khi nhận → 403, và state KHÔNG đổi
    await expect(svc.completeWork(state.lead.id, { workId, actor: 'sales-b', evidence: 'declared' })).rejects.toMatchObject({ code: 'NOT_OWNER', status: 403 });
    await expect(
      svc.rescheduleWork(state.lead.id, { workId, actor: 'sales-b', newDueAt: '2026-10-12T09:00:00+07:00', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'NOT_OWNER', status: 403 });
    await expect(svc.advance(state.lead.id, { to: 'Contacting', actor: 'sales-b', reason: 'x' })).rejects.toMatchObject({ code: 'NOT_OWNER', status: 403 });
    await expect(svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'sales-b' })).rejects.toMatchObject({ code: 'NOT_OWNER', status: 403 });

    const after = await svc.get(state.lead.id);
    expect(after?.lead.status).toBe('New'); // không có half-mutation
    expect(after?.workItems[0].status).toBe('proposed');
    expect(after?.ownerUserId).toBe('marketing-lan');
    expect(after?.outcomes).toHaveLength(0);

    // accept là quyền riêng của recipient → vẫn được
    const accepted = await svc.salesAccept(state.lead.id, { workId, actor: 'sales-b', reason: 'B nhận' });
    expect(accepted.ownerUserId).toBe('sales-b');
    // sau khi nhận, B mutate hợp lệ
    const done = await svc.completeWork(state.lead.id, { workId, actor: 'sales-b', evidence: 'declared', reason: 'đã gọi' });
    expect(done.workItems[0].status).toBe('completed');
  });

  it('a non-owner, non-recipient cannot even accept someone else’s handoff (already guarded) nor mutate', async () => {
    const { state, workId } = await handedOver();
    await expect(svc.salesAccept(state.lead.id, { workId, actor: 'sales-c', reason: 'x' })).rejects.toMatchObject({
      code: 'NOT_ASSIGNED_RECIPIENT',
      status: 403,
    });
    await expect(svc.completeWork(state.lead.id, { workId, actor: 'sales-c', evidence: 'declared' })).rejects.toMatchObject({
      code: 'NOT_OWNER',
      status: 403,
    });
  });

  it('external no-observation is a mutation too — refused for a not-yet-owner recipient', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Chị A trao đổi với bé',
      responsibleParty: 'external',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    const workId = handed.workItems[0].id;
    await expect(svc.markExternalUnobserved(state.lead.id, { workId, actor: 'sales-b' })).rejects.toMatchObject({
      code: 'NOT_OWNER',
      status: 403,
    });
    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-b', reason: 'nhận' });
    const marked = await svc.markExternalUnobserved(state.lead.id, { workId, actor: 'sales-b' });
    expect(marked.workItems[0].status).toBe('awaiting-external');
  });

  it('only the owner may hand off; P0 correction path is owner-only (manager/admin = PM-1, not widened here)', async () => {
    const { state, workId } = await handedOver();
    await expect(
      svc.handoffToSales(state.lead.id, {
        context: 'x',
        proposedAction: 'y',
        responsibleParty: 'internal',
        origin: 'explicit-request',
        actor: 'sales-b',
        recipientUserId: 'sales-c',
      }),
    ).rejects.toMatchObject({ code: 'NOT_OWNER', status: 403 });

    await svc.salesAccept(state.lead.id, { workId, actor: 'sales-b', reason: 'nhận' });
    await svc.advance(state.lead.id, { to: 'Contacting', actor: 'sales-b', reason: 'gọi' });
    await svc.advance(state.lead.id, { to: 'Follow-up', actor: 'sales-b', reason: 'chờ' });
    const won = await svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'sales-b', reason: 'deposit' });
    await expect(
      svc.correctOutcomeRecord(state.lead.id, { outcomeId: won.outcomes[0].id, newValue: 'Lost', actor: 'manager', reason: 'khách rút' }),
    ).rejects.toMatchObject({ code: 'NOT_OWNER', status: 403 });
    // owner vẫn sửa được bằng append (I-05)
    const fixed = await svc.correctOutcomeRecord(state.lead.id, {
      outcomeId: won.outcomes[0].id,
      newValue: 'Lost',
      actor: 'sales-b',
      reason: 'khách rút, hoàn deposit',
    });
    expect(fixed.outcomes).toHaveLength(2);
    // history cho thấy 'manager' chưa từng mutate thành công
    const history = await svc.auditHistory(state.lead.id as LeadId);
    expect(history.map((h) => h.actor)).not.toContain('manager');
  });

  it('work item of another lead cannot be mutated through this lead (per-item check)', async () => {
    const a = await handedOver();
    const stateB = await svc.ingestScenario({ ...base, displayName: 'Phụ huynh B', externalRecordId: 'msg-009' });
    // Owner hợp lệ của lead B, nhưng workId thuộc lead A → 404, không mutate chéo lead.
    await expect(
      svc.completeWork(stateB.lead.id, { workId: a.workId, actor: 'marketing-lan', evidence: 'declared' }),
    ).rejects.toMatchObject({ code: 'WORK_NOT_FOUND', status: 404 });
    await expect(
      svc.rescheduleWork(stateB.lead.id, { workId: a.workId, actor: 'marketing-lan', newDueAt: '2026-10-20T09:00:00+07:00', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'WORK_NOT_FOUND', status: 404 });
  });

  it('P1-2: current owner A cannot accept or complete a work item addressed to B, and a second handoff to C does not let C accept B’s item or drop B from active recipients', async () => {
    const { state, workId: workB } = await handedOver(); // owner = marketing-lan, workB recipient = sales-b

    // (a) Owner A cannot accept workB addressed to sales-b
    await expect(
      svc.salesAccept(state.lead.id, { workId: workB, actor: 'marketing-lan', reason: 'A tự nhận hộ B' }),
    ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });

    // (b) Owner A cannot complete or reschedule workB addressed to sales-b
    await expect(
      svc.completeWork(state.lead.id, { workId: workB, actor: 'marketing-lan', evidence: 'declared', reason: 'A tự đóng hộ B' }),
    ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });
    await expect(
      svc.rescheduleWork(state.lead.id, { workId: workB, actor: 'marketing-lan', newDueAt: '2026-10-20T09:00:00+07:00', reason: 'A tự dời hộ B' }),
    ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });

    // (c) Owner A creates a second handoff to sales-c while workB is still proposed
    const handedC = await svc.handoffToSales(state.lead.id, {
      context: 'bàn giao thêm cho C',
      proposedAction: 'C chuẩn bị tài liệu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-c',
    });
    const workC = handedC.workItems.find((w) => w.actor === 'sales-c')!.id;

    // Both B and C have actionable work items → neither loses recipient status
    expect(activeWorkRecipients(handedC)).toEqual(expect.arrayContaining(['sales-b', 'sales-c']));

    // C cannot accept B's work item, and B cannot accept C's work item
    await expect(
      svc.salesAccept(state.lead.id, { workId: workB, actor: 'sales-c', reason: 'C nhận nhầm việc của B' }),
    ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });
    await expect(
      svc.salesAccept(state.lead.id, { workId: workC, actor: 'sales-b', reason: 'B nhận nhầm việc của C' }),
    ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });

    // B can still accept workB, and C can still accept workC
    const afterB = await svc.salesAccept(state.lead.id, { workId: workB, actor: 'sales-b', reason: 'B nhận việc của B' });
    expect(afterB.workItems.find((w) => w.id === workB)?.status).toBe('accepted');
    const afterC = await svc.salesAccept(state.lead.id, { workId: workC, actor: 'sales-c', reason: 'C nhận việc của C' });
    expect(afterC.workItems.find((w) => w.id === workC)?.status).toBe('accepted');
  });
});

/**
 * P1-3 — a superseded work item is closed-by-replacement. Completing/rescheduling the OLD ID
 * used to return 200 while the live replacement stayed open: the chain looked done and was not.
 * Mutations on a superseded item are refused with WORK_SUPERSEDED + replacementId, and the
 * replacement must be the object of the caller's next action.
 */
describe('P1-3 — superseded items are not actionable; callers get replacementId', () => {
  let svc: PilotLoopService;

  beforeEach(() => {
    ({ svc } = make());
  });

  async function rescheduledChain() {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    const oldId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId: oldId, actor: 'sales-b', reason: 'B nhận' });
    const moved = await svc.rescheduleWork(state.lead.id, {
      workId: oldId,
      actor: 'sales-b',
      newDueAt: '2026-10-12T16:00:00+07:00',
      reason: 'Phụ huynh dời sang thứ Hai',
    });
    const replacementId = moved.workItems.find((w) => w.supersedesWorkId === oldId)!.id;
    return { leadId: state.lead.id, oldId, replacementId };
  }

  it('completing the OLD (superseded) ID is refused and names the replacement', async () => {
    const { leadId, oldId, replacementId } = await rescheduledChain();

    let caught: unknown;
    await svc.completeWork(leadId, { workId: oldId, actor: 'sales-b', evidence: 'declared' }).catch((e) => (caught = e));
    expect(caught).toMatchObject({ code: 'WORK_SUPERSEDED', status: 409 });
    expect((caught as { details?: Record<string, unknown> }).details).toMatchObject({
      workId: oldId,
      status: 'rescheduled',
      replacementId,
      replacementStatus: 'open',
      dueAt: '2026-10-12T16:00:00+07:00',
    });

    // THE POINT OF THE FIX: the old item must still be rescheduled and the replacement still open.
    const after = await svc.get(leadId);
    expect(after!.workItems.find((w) => w.id === oldId)!.status).toBe('rescheduled');
    expect(after!.workItems.find((w) => w.id === replacementId)!.status).toBe('open');
  });

  it('completing the replacement closes the chain and leaves no active item behind', async () => {
    const { leadId, oldId, replacementId } = await rescheduledChain();
    const done = await svc.completeWork(leadId, { workId: replacementId, actor: 'sales-b', evidence: 'declared', reason: 'đã gọi hôm thứ Hai' });

    const old = done.workItems.find((w) => w.id === oldId)!;
    const current = done.workItems.find((w) => w.id === replacementId)!;
    expect(old.status).toBe('rescheduled');
    expect(current.status).toBe('completed');
    // "không còn việc hoạt động của chuỗi thay thế đó"
    const activeInChain = done.workItems.filter(
      (w) => (w.id === oldId || w.id === replacementId || w.supersedesWorkId === oldId) && w.status !== 'completed' && w.status !== 'rescheduled' && w.status !== 'cancelled',
    );
    expect(activeInChain).toHaveLength(0);
    expect(done.workItems.some((w) => w.status === 'open' || w.status === 'accepted' || w.status === 'proposed')).toBe(false);
  });

  it('rescheduling a superseded item is refused too (no orphaned second replacement)', async () => {
    const { leadId, oldId, replacementId } = await rescheduledChain();
    await expect(
      svc.rescheduleWork(leadId, { workId: oldId, actor: 'sales-b', newDueAt: '2026-10-20T09:00:00+07:00', reason: 'lẫn ID' }),
    ).rejects.toMatchObject({ code: 'WORK_SUPERSEDED', status: 409 });
    // only ONE live item in the chain
    const after = await svc.get(leadId);
    expect(after!.workItems.filter((w) => w.supersedesWorkId === oldId)).toHaveLength(1);
    expect(after!.workItems.find((w) => w.id === replacementId)!.dueAt).toBe('2026-10-12T16:00:00+07:00');
  });

  it('markExternalUnobserved and accept on a superseded item are refused, not silently applied', async () => {
    const state = await svc.ingestScenario(base);
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Chị A trao đổi với bé',
      responsibleParty: 'external',
      origin: 'explicit-request',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    const oldId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId: oldId, actor: 'sales-b', reason: 'nhận' });
    const moved = await svc.rescheduleWork(state.lead.id, { workId: oldId, actor: 'sales-b', newDueAt: '2026-10-12T09:00:00+07:00', reason: 'dời' });
    const replacementId = moved.workItems.find((w) => w.supersedesWorkId === oldId)!.id;

    await expect(svc.markExternalUnobserved(state.lead.id, { workId: oldId, actor: 'sales-b' })).rejects.toMatchObject({
      code: 'WORK_SUPERSEDED',
      status: 409,
    });
    // accepting an already-superseded item would re-hand ownership on a dead item
    await expect(svc.salesAccept(state.lead.id, { workId: oldId, actor: 'sales-b', reason: 'nhận lại' })).rejects.toMatchObject({
      code: 'WORK_SUPERSEDED',
      status: 409,
    });
    // the live replacement is still actionable
    const marked = await svc.markExternalUnobserved(state.lead.id, { workId: replacementId, actor: 'sales-b' });
    expect(marked.workItems.find((w) => w.id === replacementId)!.status).toBe('awaiting-external');
  });

  it('refusal is computed from RELOADED state, not the caller-cached object (store round-trip)', async () => {
    const audit = new AuditStore();
    const store = new InMemoryPilotStore(audit);
    const svcA = new PilotLoopService(store);
    const state = await svcA.ingestScenario(base);
    const handed = await svcA.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-lan',
      recipientUserId: 'sales-b',
    });
    const oldId = handed.workItems[0].id;
    await svcA.salesAccept(state.lead.id, { workId: oldId, actor: 'sales-b', reason: 'nhận' });
    const moved = await svcA.rescheduleWork(state.lead.id, { workId: oldId, actor: 'sales-b', newDueAt: '2026-10-12T16:00:00+07:00', reason: 'dời' });
    const replacementId = moved.workItems.find((w) => w.supersedesWorkId === oldId)!.id;

    // A SECOND service instance over the same store = another request/process: it must
    // refuse the old ID from persisted status and point at the persisted successor.
    const svcB = new PilotLoopService(store);
    let caught: unknown;
    await svcB.completeWork(state.lead.id, { workId: oldId, actor: 'sales-b', evidence: 'declared' }).catch((e) => (caught = e));
    expect(caught).toMatchObject({ code: 'WORK_SUPERSEDED', status: 409 });
    expect((caught as { details?: Record<string, unknown> }).details).toMatchObject({ workId: oldId, replacementId });
  });
});
