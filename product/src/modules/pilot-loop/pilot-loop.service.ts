import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { createLead, type Lead, type LeadId } from '../../domain/lead/lead';
import { transitionLead } from '../../domain/lead/lead-state';
import { createHandoff, type Handoff } from '../../domain/handoff/handoff';
import { createOutcome, correctOutcome, type Outcome } from '../../domain/outcome/outcome';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { AuditStore } from '../../infra/audit/audit-store';

/**
 * P0 pilot loop — education B2C candidate flow, in-memory (PH1/PH2 domain + audit).
 *
 * Luồng: nhập tình huống → bàn giao → Sales nhận → ghi next action →
 * xác nhận thực hiện (kèm evidence status) → ghi kết quả tối thiểu.
 *
 * Phạm vi: CHỈ dùng state machine hypothesis ADR-001 (CE-1) và CommercialEvent
 * inferred-only (CE-2). Không tạo entity Journey/Obligation/Contact/Organization —
 * các work item dưới đây là candidate validation constructs cho Q3, không phải
 * canonical model (RFC-005 Q3 vẫn Draft, EXP-06 vẫn proposed).
 *
 * Guardrails đã mã hóa (V2 §§4, 7.3, 9.2–9.3, 9.6):
 * - Observation không đầy đủ: message observed ≠ hành động được mô tả observed.
 * - Kỳ vọng bên ngoài qua mốc → `no-observation`, KHÔNG bao giờ thành Overdue/thất bại.
 * - `occurredAt` không rõ → giữ UNKNOWN + `recordedAt` riêng; không backfill.
 * - AI/proposal không tự đóng việc: completion cần người xác nhận.
 * - Mọi mutation append-audited (I-05), raw envelope immutable (I-12), Lead ID stable (I-07).
 */

/** Q3 candidate axes — validation-only, not a frozen model. */
export type ResponsibleParty = 'internal' | 'external';
export type WorkOrigin = 'explicit-request' | 'explicit-commitment' | 'policy-sla' | 'inferred';
export type CompletionEvidence = 'observed' | 'declared' | 'inferred' | 'absent' | 'conflicted';
export type WorkStatus =
  | 'proposed'
  | 'accepted'
  | 'open'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'awaiting-external';

export interface WorkItem {
  readonly id: string;
  readonly leadId: LeadId;
  readonly workspaceId: string;
  readonly action: string;
  readonly responsibleParty: ResponsibleParty;
  readonly origin: WorkOrigin;
  readonly status: WorkStatus;
  readonly completionEvidence: CompletionEvidence;
  /** ISO time or UNKNOWN_SENTINEL — never filled from recordedAt (Q4). */
  readonly occurredAt: string;
  readonly dueAt?: string;
  readonly evidenceRef?: string;
  readonly recordedAt: string;
  /** Set when this item supersedes an earlier one (reschedule/cancel) — no stale reminders (I-05). */
  readonly supersedesWorkId?: string;
  readonly actor: string;
  readonly reason?: string;
}

export interface PilotLoopState {
  readonly lead: Lead;
  readonly handoff?: Handoff;
  readonly workItems: readonly WorkItem[];
  readonly outcomes: readonly Outcome[];
  /**
   * Current lead owner (I-09). Set to the intake operator on create;
   * updated on salesAccept — "conversation assignment ≠ Sales ownership"
   * but pilot needs a single accountable owner (DOMAIN_MODEL §3.4).
   */
  readonly ownerUserId?: string;
}

export interface ScenarioInput {
  readonly workspaceId: string;
  readonly displayName: string;
  readonly utterance: string;
  readonly speaker: 'customer' | 'staff';
  readonly connection: string;
  readonly externalRecordId: string;
  readonly conversationSource?: string;
  readonly isSynthetic?: boolean;
  /** Time asserted by evidence; omit or pass UNKNOWN_SENTINEL when unclear. */
  readonly occurredAt?: string;
  /** Server-derived operator (I-09) — never trusted from client body. */
  readonly ownerUserId?: string;
}

@Injectable()
export class PilotLoopService {
  private readonly adapter: ManualAdapter;
  private readonly audit: AuditStore;
  private readonly cases = new Map<string, PilotLoopState>();

  /** Test hook — inject collaborators; production DI uses the parameterless path. */
  constructor(adapter?: ManualAdapter, audit?: AuditStore) {
    this.adapter = adapter ?? new ManualAdapter();
    this.audit = audit ?? new AuditStore();
  }

  /** Bước 1 — nhập tình huống: raw envelope immutable (I-12) + Lead create (I-07). */
  ingestScenario(input: ScenarioInput): PilotLoopState {
    if (!input.workspaceId) throw new Error('workspaceId is required');
    if (!input.utterance) throw new Error('utterance is required');

    const envelope = this.adapter.ingest({
      connection: input.connection,
      externalRecordId: input.externalRecordId,
      externalEventType: 'message',
      sourceCapturedAt: new Date().toISOString(),
      rawPayload: { utterance: input.utterance, speaker: input.speaker },
      isSynthetic: input.isSynthetic ?? true,
    });

    const lead = createLead({
      workspaceId: input.workspaceId,
      displayName: input.displayName,
      conversationSource: input.conversationSource,
      // Acquisition Lineage và Revenue Attribution giữ riêng (I-02) — không suy từ utterance.
      attribution: UNKNOWN_SENTINEL,
    });

    this.audit.append({
      entityType: 'lead',
      entityId: lead.id,
      workspaceId: lead.workspaceId,
      actor: input.speaker === 'staff' ? 'staff:intake' : 'operator:intake',
      newValue: JSON.stringify({ status: lead.status, envelopeId: envelope.envelopeId }),
      reason: 'scenario ingested',
      eventType: 'lead_created',
    });

    const state: PilotLoopState = {
      lead,
      workItems: [],
      outcomes: [],
      ownerUserId: input.ownerUserId ?? (input.speaker === 'staff' ? 'staff:intake' : 'operator:intake'),
    };
    this.cases.set(lead.id, state);
    return state;
  }

  /** Bước 2 — bàn giao: context + evidence refs + proposed next action (R-11). */
  handoffToSales(
    leadId: LeadId,
    input: {
      readonly context: string;
      readonly proposedAction: string;
      readonly responsibleParty: ResponsibleParty;
      readonly origin: WorkOrigin;
      readonly dueAt?: string;
      readonly actor: string;
      readonly evidenceRef?: string;
    },
  ): PilotLoopState {
    const state = this.require(leadId);
    const evidenceRefs = input.evidenceRef
      ? [{ envelopeId: input.evidenceRef, rawPayloadHash: 'pending', capturedAt: new Date().toISOString() }]
      : [];

    const handoff = createHandoff({
      leadId: state.lead.id,
      workspaceId: state.lead.workspaceId,
      context: input.context,
      evidenceRefs,
      proposedNextAction: { kind: 'follow-up', summary: input.proposedAction, ...(input.dueAt !== undefined && { dueAt: input.dueAt }) },
    });

    // Work item starts as PROPOSED — chưa phải trách nhiệm đã giao (V2 §9.2, khoảng trống trách nhiệm).
    const work: WorkItem = {
      id: randomUUID(),
      leadId: state.lead.id,
      workspaceId: state.lead.workspaceId,
      action: input.proposedAction,
      responsibleParty: input.responsibleParty,
      origin: input.origin,
      status: 'proposed',
      completionEvidence: 'absent',
      occurredAt: UNKNOWN_SENTINEL,
      ...(input.dueAt !== undefined && { dueAt: input.dueAt }),
      ...(input.evidenceRef !== undefined && { evidenceRef: input.evidenceRef }),
      recordedAt: new Date().toISOString(),
      actor: input.actor,
    };

    this.audit.append({
      entityType: 'handoff',
      entityId: handoff.id,
      workspaceId: handoff.workspaceId,
      actor: input.actor,
      newValue: JSON.stringify({ leadId: handoff.leadId, workStatus: work.status, origin: work.origin }),
      reason: 'handoff created with proposed work item',
      eventType: 'handoff_created',
    });

    const next: PilotLoopState = { ...state, handoff, workItems: [...state.workItems, work] };
    this.cases.set(leadId, next);
    return next;
  }

  /** Bước 3 — Sales nhận việc: transition New→Accepted (CE-1 hypothesis) + accept work. */
  salesAccept(leadId: LeadId, input: { readonly actor: string; readonly reason: string; readonly workId: string }): PilotLoopState {
    const state = this.require(leadId);
    const { lead } = transitionLead(state.lead, { to: 'Accepted', actor: input.actor, reason: input.reason });
    this.audit.append({
      entityType: 'lead',
      entityId: lead.id,
      workspaceId: lead.workspaceId,
      actor: input.actor,
      previousValue: state.lead.status,
      newValue: lead.status,
      reason: input.reason,
      eventType: 'lead_transition',
    });

    const workItems = state.workItems.map((w) =>
      w.id === input.workId ? { ...w, status: 'accepted' as WorkStatus, actor: input.actor } : w,
    );
    if (!workItems.some((w) => w.id === input.workId)) throw new Error('workId not found');

    const next: PilotLoopState = { ...state, lead, workItems, ownerUserId: input.actor };
    this.cases.set(leadId, next);
    return next;
  }

  /**
   * Bước 4 — ghi/xác nhận next action completion.
   * `observed` chỉ được đặt khi có evidenceRef là sự kiện hệ thống quan sát được
   * phù hợp tiêu chí hoàn thành; lời khai người dùng → `declared` (V2 §9.3).
   */
  completeWork(
    leadId: LeadId,
    input: {
      readonly workId: string;
      readonly actor: string;
      readonly evidence: CompletionEvidence;
      readonly evidenceRef?: string;
      readonly occurredAt?: string;
      readonly reason?: string;
    },
  ): PilotLoopState {
    const state = this.require(leadId);
    const current = state.workItems.find((w) => w.id === input.workId);
    if (!current) throw new Error('workId not found');
    if (current.status === 'completed') throw new Error('work already completed');

    // Q3 guardrail: một message observed không tự chứng minh hành động được mô tả.
    if (input.evidence === 'observed' && !input.evidenceRef) {
      throw new Error('observed completion requires a system evidence pointer');
    }
    // AI/inferred completion không được tự đóng (V2 §9.6).
    if (input.evidence === 'inferred') {
      throw new Error('inferred evidence cannot close work; require user confirmation');
    }
    // External expectation: không có "completion" phía khách — chỉ ghi nhận quan sát/khai báo.
    if (current.responsibleParty === 'external' && input.evidence === 'declared') {
      throw new Error('external expectation cannot be marked complete on internal declaration alone');
    }

    const workItems = state.workItems.map((w) =>
      w.id === input.workId
        ? {
            ...w,
            status: 'completed' as WorkStatus,
            completionEvidence: input.evidence,
            // Q4 guardrail: occurredAt không rõ → giữ UNKNOWN, không thay bằng recordedAt.
            occurredAt: input.occurredAt ?? UNKNOWN_SENTINEL,
            ...(input.evidenceRef !== undefined && { evidenceRef: input.evidenceRef }),
          }
        : w,
    );

    this.audit.append({
      entityType: 'commercial-event',
      entityId: input.workId,
      workspaceId: state.lead.workspaceId,
      actor: input.actor,
      previousValue: current.status,
      newValue: JSON.stringify({ status: 'completed', evidence: input.evidence, occurredAt: workItems.find((w) => w.id === input.workId)?.occurredAt }),
      reason: input.reason ?? 'work completed',
      eventType: 'work_completed',
    });

    const next = { ...state, workItems };
    this.cases.set(leadId, next);
    return next;
  }

  /** Bước 4b — dời lịch: item cũ superseded, item mới thay thế → không còn nhắc lịch cũ. */
  rescheduleWork(
    leadId: LeadId,
    input: { readonly workId: string; readonly actor: string; readonly newDueAt: string; readonly reason: string },
  ): PilotLoopState {
    const state = this.require(leadId);
    const old = state.workItems.find((w) => w.id === input.workId);
    if (!old) throw new Error('workId not found');
    // Một việc đã hoàn thành không còn lịch để dời — dời phải mở lại assertion mới (I-05).
    if (old.status === 'completed' || old.status === 'cancelled') {
      throw new Error('closed work cannot be rescheduled; record a correction instead');
    }

    const superseded: WorkItem = { ...old, status: 'rescheduled', completionEvidence: 'absent' };
    const replacement: WorkItem = {
      ...old,
      id: randomUUID(),
      status: old.status === 'proposed' ? 'proposed' : 'open',
      dueAt: input.newDueAt,
      supersedesWorkId: old.id,
      recordedAt: new Date().toISOString(),
      actor: input.actor,
      reason: input.reason,
    };

    const workItems = state.workItems
      .filter((w) => w.id !== old.id)
      .concat(superseded, replacement);

    this.audit.append({
      entityType: 'commercial-event',
      entityId: old.id,
      workspaceId: state.lead.workspaceId,
      actor: input.actor,
      previousValue: JSON.stringify({ dueAt: old.dueAt ?? null, status: old.status }),
      newValue: JSON.stringify({ dueAt: input.newDueAt, status: 'rescheduled', replacementId: replacement.id }),
      reason: input.reason,
      eventType: 'work_rescheduled',
      supersedesRecordId: undefined,
    });

    const next = { ...state, workItems };
    this.cases.set(leadId, next);
    return next;
  }

  /**
   * Bước 4c — mốc bên ngoài đã qua mà chưa có evidence → `no-observation`.
   * Không kết luận khách thất bại (V2 §8.3, §9.3).
   */
  markExternalUnobserved(leadId: LeadId, input: { readonly workId: string; readonly actor: string }): PilotLoopState {
    const state = this.require(leadId);
    const item = state.workItems.find((w) => w.id === input.workId);
    if (!item) throw new Error('workId not found');
    if (item.responsibleParty !== 'external') throw new Error('only external expectations can be marked no-observation');
    if (item.completionEvidence === 'observed') throw new Error('already observed; no-observation not applicable');

    const workItems = state.workItems.map((w) =>
      w.id === input.workId ? { ...w, status: 'awaiting-external' as WorkStatus, completionEvidence: 'absent' as CompletionEvidence } : w,
    );

    this.audit.append({
      entityType: 'commercial-event',
      entityId: item.id,
      workspaceId: state.lead.workspaceId,
      actor: input.actor,
      newValue: JSON.stringify({ status: 'awaiting-external', evidence: 'absent' }),
      reason: 'past expected time; outcome not observed — absence is not failure',
      eventType: 'external_no_observation',
    });

    const next = { ...state, workItems };
    this.cases.set(leadId, next);
    return next;
  }

  /**
   * Bước 3b — ghi nhận bước nghiệp vụ trung gian (contact attempt → Contacting,
   * hẹn follow-up → Follow-up). Chỉ đi trong hypothesis CE-1; transitionLead abort
   * nếu vượt frozen boundary.
   */
  advance(leadId: LeadId, input: { readonly to: 'Contacting' | 'Follow-up'; readonly actor: string; readonly reason: string }): PilotLoopState {
    const state = this.require(leadId);
    const { lead } = transitionLead(state.lead, { to: input.to, actor: input.actor, reason: input.reason });
    this.audit.append({
      entityType: 'lead',
      entityId: lead.id,
      workspaceId: lead.workspaceId,
      actor: input.actor,
      previousValue: state.lead.status,
      newValue: lead.status,
      reason: input.reason,
      eventType: 'lead_transition',
    });
    const next = { ...state, lead };
    this.cases.set(leadId, next);
    return next;
  }

  /** Bước 5 — ghi kết quả tối thiểu kèm evidence (R-15) + transition Follow-up→Won/Lost/Unknown. */
  recordOutcome(
    leadId: LeadId,
    input: { readonly value: 'Won' | 'Lost' | 'Unknown'; readonly actor: string; readonly reason?: string },
  ): PilotLoopState {
    const state = this.require(leadId);
    const outcome = createOutcome({
      leadId: state.lead.id,
      workspaceId: state.lead.workspaceId,
      value: input.value,
      actor: input.actor,
      acquisitionMode: 'user_confirmed',
      ...(input.reason !== undefined && { reason: input.reason }),
    });

    // Outcome là claim cho tới khi có bằng chứng độc lập (TRUST §4) — assertionStatus 'claimed'.
    const to = input.value;
    const { lead } = transitionLead(state.lead, { to, actor: input.actor, reason: input.reason ?? 'outcome recorded' });

    this.audit.append({
      entityType: 'outcome',
      entityId: outcome.id,
      workspaceId: outcome.workspaceId,
      actor: input.actor,
      previousValue: state.lead.status,
      newValue: JSON.stringify({ outcome: outcome.value, assertionStatus: outcome.assertionStatus }),
      reason: input.reason ?? 'outcome recorded',
      eventType: 'outcome_created',
    });

    const next = { ...state, lead, outcomes: [...state.outcomes, outcome] };
    this.cases.set(leadId, next);
    return next;
  }

  /** Sửa kết quả — append assertion mới, giữ lịch sử (I-05). */
  correctOutcomeRecord(
    leadId: LeadId,
    input: { readonly outcomeId: string; readonly newValue: 'Won' | 'Lost' | 'Unknown'; readonly actor: string; readonly reason: string },
  ): PilotLoopState {
    const state = this.require(leadId);
    const previous = state.outcomes.find((o) => o.id === input.outcomeId);
    if (!previous) throw new Error('outcomeId not found');

    const corrected = correctOutcome(previous, { newValue: input.newValue, actor: input.actor, reason: input.reason });
    const { lead } = transitionLead(state.lead, { to: input.newValue, actor: input.actor, reason: input.reason });

    this.audit.append({
      entityType: 'outcome',
      entityId: corrected.id,
      workspaceId: corrected.workspaceId,
      actor: input.actor,
      previousValue: previous.value,
      newValue: corrected.value,
      reason: input.reason,
      eventType: 'outcome_corrected',
      supersedesRecordId: previous.id,
    });

    const next = { ...state, lead, outcomes: [...state.outcomes, corrected] };
    this.cases.set(leadId, next);
    return next;
  }

  get(leadId: LeadId): PilotLoopState | undefined {
    return this.cases.get(leadId);
  }

  /** Overdue chỉ áp dụng cho việc NỘI BỘ còn mở và có hạn hợp lệ (V2 §9.3). */
  openInternalWorkDueBefore(leadId: LeadId, at: string): readonly WorkItem[] {
    const state = this.require(leadId);
    return state.workItems.filter(
      (w) => w.responsibleParty === 'internal' && (w.status === 'open' || w.status === 'accepted') && w.dueAt !== undefined && w.dueAt < at,
    );
  }

  private require(leadId: LeadId): PilotLoopState {
    const state = this.cases.get(leadId);
    if (!state) throw new Error('lead not found in pilot loop');
    return state;
  }
}
