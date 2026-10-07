import { beforeEach, describe, expect, it } from 'vitest';
import { PilotLoopService, type ScenarioInput } from './pilot-loop.service';
import type { LeadId } from '../../domain/lead/lead';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';

const base: ScenarioInput = {
  workspaceId: 'ws-edu-1',
  displayName: 'Phụ huynh A — lớp tối thứ Bảy',
  utterance: 'Thứ Sáu em gọi lại cho chị nhé, chị trao đổi với bé đã.',
  speaker: 'customer',
  connection: 'manual-paste',
  externalRecordId: 'msg-001',
  conversationSource: 'Messenger',
  isSynthetic: true,
};

describe('PilotLoopService — P0 education B2C loop', () => {
  let svc: PilotLoopService;

  beforeEach(() => {
    svc = new PilotLoopService();
  });

  it('runs the full loop: intake → handoff → accept → complete → outcome', () => {
    const state = svc.ingestScenario(base);
    expect(state.lead.status).toBe('New');
    expect(state.lead.attribution).toBe(UNKNOWN_SENTINEL); // MM-1 — không fabricate

    const handed = svc.handoffToSales(state.lead.id, {
      context: 'Phụ huynh muốn con học thử lớp tối; đã hỏi học phí.',
      proposedAction: 'Gọi lại chị A lúc 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'sales-hung',
      evidenceRef: state.handoff?.id ?? 'envelope-msg-001',
    });
    expect(handed.handoff).toBeDefined();
    expect(handed.workItems).toHaveLength(1);
    expect(handed.workItems[0].status).toBe('proposed'); // gửi bàn giao ≠ nhận trách nhiệm

    const workId = handed.workItems[0].id;
    const accepted = svc.salesAccept(handed.lead.id, { workId, actor: 'sales-hung', reason: 'Sales xác nhận phụ trách' });
    expect(accepted.lead.status).toBe('Accepted');
    expect(accepted.workItems[0].status).toBe('accepted');

    const done = svc.completeWork(accepted.lead.id, {
      workId,
      actor: 'sales-hung',
      evidence: 'declared',
      occurredAt: '2026-10-09T15:05:00+07:00',
      reason: 'Đã gọi, phụ huynh hẹn cuối tuần đăng ký',
    });
    expect(done.workItems[0].status).toBe('completed');
    expect(done.workItems[0].completionEvidence).toBe('declared');

    const result = svc.recordOutcome(done.lead.id, { value: 'Unknown', actor: 'sales-hung', reason: 'chưa chốt' });
    expect(result.lead.status).toBe('Unknown');
    expect(result.outcomes[0].assertionStatus).toBe('claimed');
  });

  it('separates utterance speaker from responsible party for mixed propositions (Q3 conflict case)', () => {
    const state = svc.ingestScenario(base);
    // Hai mệnh đề trong MỘT utterance: (a) khách trao đổi với bé = external expectation;
    // (b) khách yêu cầu doanh nghiệp gọi lại = internal work. Gán cả câu cho khách là sai.
    const internal = svc.handoffToSales(state.lead.id, {
      context: 'Yêu cầu gọi lại',
      proposedAction: 'Gọi lại chị A',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'marketing-lan',
    });
    const leadWithTwo: LeadId = internal.lead.id;
    const withExternal = svc.handoffToSales(leadWithTwo, {
      context: 'Kỳ vọng phía khách',
      proposedAction: 'Chị A trao đổi với bé',
      responsibleParty: 'external',
      origin: 'explicit-request',
      actor: 'marketing-lan',
    });

    const parties = withExternal.workItems.map((w) => w.responsibleParty);
    expect(parties).toEqual(expect.arrayContaining(['internal', 'external']));
    expect(withExternal.workItems.filter((w) => w.responsibleParty === 'external')).toHaveLength(1);
  });

  it('rejects "observed" completion without a system evidence pointer (message ≠ proof of action)', () => {
    const state = svc.ingestScenario({ ...base, utterance: 'Em gửi rồi chị nhé' });
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'Gửi thông tin học phí',
      proposedAction: 'Gửi bảng học phí',
      responsibleParty: 'internal',
      origin: 'explicit-commitment',
      actor: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    expect(() =>
      svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'observed' }),
    ).toThrow(/requires a system evidence pointer/);

    // Với khai báo → accepted, evidence=declared, không phải observed.
    const declared = svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'declared', reason: 'nhân viên báo đã gửi qua Zalo' });
    expect(declared.workItems[0].completionEvidence).toBe('declared');
  });

  it('refuses AI/inferred evidence closing work (I-03, V2 §9.6)', () => {
    const state = svc.ingestScenario(base);
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'a',
      responsibleParty: 'internal',
      origin: 'inferred',
      actor: 'marketing-lan',
    });
    expect(() =>
      svc.completeWork(state.lead.id, { workId: handed.workItems[0].id, actor: 'ai', evidence: 'inferred' }),
    ).toThrow(/inferred evidence cannot close work/);
  });

  it('reschedule supersedes the old item so no stale reminder remains', () => {
    const state = svc.ingestScenario(base);
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'sales-hung',
    });
    const oldId = handed.workItems[0].id;
    const moved = svc.rescheduleWork(state.lead.id, {
      workId: oldId,
      actor: 'sales-hung',
      newDueAt: '2026-10-12T16:00:00+07:00',
      reason: 'Phụ huynh dời sang thứ Hai',
    });

    const openDueBeforeOld = svc.openInternalWorkDueBefore(state.lead.id, '2026-10-09T16:00:00+07:00');
    expect(openDueBeforeOld.map((w) => w.id)).not.toContain(oldId); // lịch cũ không còn nhắc
    const current = moved.workItems.find((w) => w.supersedesWorkId === oldId);
    expect(current?.dueAt).toBe('2026-10-12T16:00:00+07:00');
    expect(moved.workItems.find((w) => w.id === oldId)?.status).toBe('rescheduled');
  });

  it('refuses to reschedule completed work — corrections, not silent reopening (I-05)', () => {
    const state = svc.ingestScenario(base);
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'declared', reason: 'đã gọi' });
    expect(() =>
      svc.rescheduleWork(state.lead.id, { workId, actor: 'sales-hung', newDueAt: '2026-10-12T16:00:00+07:00', reason: 'lỡ tay' }),
    ).toThrow(/cannot be rescheduled/);
  });

  it('treats an external expectation past its time as no-observation, never overdue/failure', () => {
    const state = svc.ingestScenario(base);
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Chị A trao đổi với bé',
      responsibleParty: 'external',
      origin: 'explicit-request',
      dueAt: '2026-10-09T00:00:00+07:00',
      actor: 'sales-hung',
    });
    const workId = handed.workItems[0].id;
    const marked = svc.markExternalUnobserved(state.lead.id, { workId, actor: 'sales-hung' });
    expect(marked.workItems[0].status).toBe('awaiting-external');
    expect(marked.workItems[0].completionEvidence).toBe('absent');
    // overdue chỉ áp dụng việc nội bộ → external không xuất hiện
    expect(svc.openInternalWorkDueBefore(state.lead.id, '2026-10-10T00:00:00+07:00')).toHaveLength(0);
    // không cho phép internal declare-complete hộ khách
    expect(() =>
      svc.completeWork(state.lead.id, { workId, actor: 'sales-hung', evidence: 'declared' }),
    ).toThrow(/external expectation/);
  });

  it('keeps unknown event time unknown instead of backfilling from record time (Q4)', () => {
    const state = svc.ingestScenario({ ...base, utterance: 'Gọi lại trong chiều nay nhé' });
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'Gọi lại chiều nay',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'sales-hung',
    });
    const done = svc.completeWork(state.lead.id, {
      workId: handed.workItems[0].id,
      actor: 'sales-hung',
      evidence: 'declared',
      reason: 'nhập muộn hôm sau',
    });
    expect(done.workItems[0].occurredAt).toBe(UNKNOWN_SENTINEL);
    expect(new Date(done.workItems[0].recordedAt).getTime()).not.toBeNaN();
  });

  it('corrects an outcome by appending, preserving prior assertion and audit (I-05)', () => {
    const state = svc.ingestScenario(base);
    const handed = svc.handoffToSales(state.lead.id, {
      context: 'c',
      proposedAction: 'a',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      actor: 'sales-hung',
    });
    let current = svc.salesAccept(state.lead.id, { workId: handed.workItems[0].id, actor: 'sales-hung', reason: 'x' });
    // CE-1 hypothesis path: New→Accepted→Contacting→Follow-up→Won.
    current = svc.advance(state.lead.id, { to: 'Contacting', actor: 'sales-hung', reason: 'đã gọi' });
    current = svc.advance(state.lead.id, { to: 'Follow-up', actor: 'sales-hung', reason: 'hẹn trả lời' });
    const won = svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'sales-hung', reason: 'đã deposit' });
    expect(won.lead.status).toBe('Won');
    const corrected = svc.correctOutcomeRecord(state.lead.id, {
      outcomeId: won.outcomes[0].id,
      newValue: 'Lost',
      actor: 'manager',
      reason: 'khách rút, hoàn deposit',
    });
    expect(corrected.outcomes).toHaveLength(2);
    expect(corrected.outcomes[1].supersedesOutcomeId).toBe(won.outcomes[0].id);
    expect(corrected.lead.status).toBe('Lost');
  });

  it('aborts transitions beyond the frozen CE-1 hypothesis boundary', () => {
    const state = svc.ingestScenario(base);
    expect(() => svc.recordOutcome(state.lead.id, { value: 'Won', actor: 'x' })).toThrow(/frozen boundary/);
  });
});
