import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createLead, type Lead, type LeadId } from '../../domain/lead/lead';
import { transitionLead } from '../../domain/lead/lead-state';
import { createHandoff } from '../../domain/handoff/handoff';
import { createOutcome, correctOutcome } from '../../domain/outcome/outcome';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import type { AuditDraft, AuditHistoryEntry, CompletionEvidence, PilotLoopState, ResponsibleParty, ScenarioInput, WorkItem, WorkOrigin, WorkStatus } from './pilot.types';
import { PilotDomainError } from './pilot.types';
import type { PilotLoopStore } from './pilot.store';

/**
 * P0 pilot loop — education B2C candidate flow over a durable store (C-03).
 *
 * Luồng: nhập tình huống → bàn giao (cho người nhận B) → B nhận việc → ghi next
 * action → xác nhận thực hiện (kèm evidence status) → ghi kết quả tối thiểu.
 *
 * CHỈ dùng state machine hypothesis ADR-001 (CE-1) và CommercialEvent inferred-only
 * (CE-2). Không tạo entity Journey/Obligation/Contact/Organization — work axes là
 * candidate validation constructs cho Q3 (RFC-005 Draft, EXP-06 proposed).
 *
 * Guardrails đã mã hóa (V2 §§4, 7.3, 9.2–9.3, 9.6):
 * - Observation không đầy đủ: message observed ≠ hành động được mô tả observed.
 * - Kỳ vọng bên ngoài qua mốc → `no-observation`, KHÔNG bao giờ Overdue/thất bại.
 * - `occurredAt` không rõ → giữ UNKNOWN + `recordedAt` riêng; không backfill.
 * - AI/inferred completion không tự đóng: cần người xác nhận (I-03).
 * - Mọi mutation append-audited atomically với state (I-05, QA-35, qua store).
 * - Handoff A→B: tạo lead (A) bàn giao cho B; B (chưa phải owner) được xem + nhận
 *   gói bàn giao addressed to them. Quyền chi tiết vẫn OPEN: PM-1.
 */
@Injectable()
export class PilotLoopService {
  constructor(private readonly store: PilotLoopStore, private readonly adapter = new ManualAdapter()) {}

  /** CE-1 boundary violation is a business refusal (422), never a raw 500. */
  private ce1Transition(lead: Lead, input: { readonly to: Lead['status']; readonly actor: string; readonly reason: string }): Lead {
    try {
      return transitionLead(lead, input).lead;
    } catch (err) {
      if (err instanceof Error && /frozen boundary/.test(err.message)) {
        throw new PilotDomainError('CE1_BOUNDARY', 422, `transition ${lead.status} → ${input.to} is outside the CE-1 hypothesis (ADR-001)`);
      }
      throw err;
    }
  }

  /** Bước 1 — nhập tình huống: raw envelope immutable (I-12) + Lead create (I-07). */
  async ingestScenario(input: ScenarioInput): Promise<PilotLoopState> {
    if (!input.workspaceId) throw new PilotDomainError('INPUT_REQUIRED', 400, 'workspaceId is required');
    if (!input.utterance) throw new PilotDomainError('INPUT_REQUIRED', 400, 'utterance is required');

    const envelope = this.adapter.ingest({
      workspaceId: input.workspaceId,
      connection: input.connection,
      externalRecordId: input.externalRecordId,
      externalEventType: 'message',
      sourceCapturedAt: input.occurredAt ?? new Date().toISOString(),
      rawPayload: { utterance: input.utterance, speaker: input.speaker },
      isSynthetic: input.isSynthetic ?? true,
    });

    const lead: Lead = createLead({
      workspaceId: input.workspaceId,
      displayName: input.displayName,
      conversationSource: input.conversationSource,
      attribution: UNKNOWN_SENTINEL, // I-02/MM-1 — không suy lineage/attribution từ utterance
    });

    const state: PilotLoopState = {
      lead,
      workItems: [],
      outcomes: [],
      ownerUserId: input.ownerUserId ?? (input.speaker === 'staff' ? 'staff:intake' : 'operator:intake'),
      sourceEnvelopeId: envelope.envelopeId,
      envelope,
    };

    await this.store.save(state, [
      {
        entityType: 'lead',
        entityId: lead.id,
        workspaceId: lead.workspaceId,
        actor: state.ownerUserId!,
        newValue: JSON.stringify({ status: lead.status, envelopeId: envelope.envelopeId }),
        reason: 'scenario ingested',
        eventType: 'lead_created',
      },
    ]);
    return state;
  }

  /**
   * Bước 2 — bàn giao cho người nhận B: context + evidence refs + proposed next
   * action. Work item starts `proposed` (gửi bàn giao ≠ nhận trách nhiệm, V2 §6).
   */
  async handoffToSales(
    leadId: LeadId,
    input: {
      readonly context: string;
      readonly proposedAction: string;
      readonly responsibleParty: ResponsibleParty;
      readonly origin: WorkOrigin;
      readonly dueAt?: string;
      readonly actor: string;
      readonly recipientUserId: string;
      readonly evidenceRef?: string;
    },
  ): Promise<PilotLoopState> {
    if (!input.recipientUserId) {
      throw new PilotDomainError('INPUT_REQUIRED', 400, 'recipientUserId is required — a handoff must name the receiver');
    }
    const state = await this.require(leadId);
    const evidenceRefs = input.evidenceRef
      ? [{ envelopeId: input.evidenceRef, rawPayloadHash: 'pending', capturedAt: new Date().toISOString() }]
      : state.envelope
        ? [{ envelopeId: state.envelope.envelopeId, rawPayloadHash: state.envelope.rawPayloadHash, capturedAt: state.envelope.sourceCapturedAt }]
        : [];

    const handoff = createHandoff({
      leadId: state.lead.id,
      workspaceId: state.lead.workspaceId,
      context: input.context,
      evidenceRefs,
      proposedNextAction: { kind: 'follow-up', summary: input.proposedAction, ...(input.dueAt !== undefined && { dueAt: input.dueAt }) },
    });

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
      actor: input.recipientUserId, // receiver is accountable once accepted
    };

    const next: PilotLoopState = {
      ...state,
      handoff,
      workItems: [...state.workItems, work],
      handoffRecipient: input.recipientUserId,
    };

    const audits: AuditDraft[] = [
      {
        entityType: 'handoff',
        entityId: handoff.id,
        workspaceId: handoff.workspaceId,
        actor: input.actor,
        newValue: JSON.stringify({ leadId: handoff.leadId, recipient: input.recipientUserId, workStatus: 'proposed', origin: work.origin }),
        reason: 'handoff created with proposed work item',
        eventType: 'handoff_created',
      },
    ];
    await this.store.save(next, audits.map(stripDraft));
    return next;
  }

  /**
   * Bước 3 — người nhận B chấp nhận: transition New→Accepted (CE-1) + work→accepted
   * + owner := B. B có được xem/n nhận là vì handoff addressed to them (I-09 lead-
   * scope), KHÔNG vì mở rộng quyền. Quyền manager/admin chi tiết vẫn PM-1.
   */
  async salesAccept(
    leadId: LeadId,
    input: { readonly actor: string; readonly reason: string; readonly workId: string },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const target = state.workItems.find((w) => w.id === input.workId);
    if (!target) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'workId not found');
    // Chỉ người được bàn giao (recipient) hoặc owner hiện tại mới được accept.
    if (input.actor !== state.handoffRecipient && input.actor !== state.ownerUserId) {
      throw new PilotDomainError('NOT_ASSIGNED_RECIPIENT', 403, 'only the handoff recipient or current owner may accept this work');
    }

    const lead = this.ce1Transition(state.lead, { to: 'Accepted', actor: input.actor, reason: input.reason });
    const workItems = state.workItems.map((w) => (w.id === input.workId ? { ...w, status: 'accepted' as WorkStatus, actor: input.actor } : w));
    const next: PilotLoopState = { ...state, lead, workItems, ownerUserId: input.actor };
    await this.store.save(next, [
      {
        entityType: 'lead',
        entityId: lead.id,
        workspaceId: lead.workspaceId,
        actor: input.actor,
        previousValue: state.lead.status,
        newValue: lead.status,
        reason: input.reason,
        eventType: 'lead_transition',
      },
    ]);
    return next;
  }

  /** Bước 3b — advance Contacting/Follow-up (CE-1 hypothesis; abort ngoài boundary). */
  async advance(leadId: LeadId, input: { readonly to: 'Contacting' | 'Follow-up'; readonly actor: string; readonly reason: string }): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const lead = this.ce1Transition(state.lead, { to: input.to, actor: input.actor, reason: input.reason });
    const next = { ...state, lead };
    await this.store.save(next, [
      {
        entityType: 'lead',
        entityId: lead.id,
        workspaceId: lead.workspaceId,
        actor: input.actor,
        previousValue: state.lead.status,
        newValue: lead.status,
        reason: input.reason,
        eventType: 'lead_transition',
      },
    ]);
    return next;
  }

  /**
   * Bước 4 — complete. `observed` CẦN evidence pointer (message observed ≠ hành động);
   * `inferred` không tự đóng (V2 §9.6); external không declare-complete hộ khách.
   */
  async completeWork(
    leadId: LeadId,
    input: {
      readonly workId: string;
      readonly actor: string;
      readonly evidence: CompletionEvidence;
      readonly evidenceRef?: string;
      readonly occurredAt?: string;
      readonly reason?: string;
    },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const current = state.workItems.find((w) => w.id === input.workId);
    if (!current) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'workId not found');
    if (current.status === 'completed') throw new PilotDomainError('WORK_ALREADY_COMPLETED', 409, 'work already completed');

    if (input.evidence === 'observed' && !input.evidenceRef) {
      throw new PilotDomainError('EVIDENCE_POINTER_REQUIRED', 422, 'observed completion requires a system evidence pointer');
    }
    if (input.evidence === 'inferred') {
      throw new PilotDomainError('INFERRED_CANNOT_CLOSE', 422, 'inferred evidence cannot close work; require user confirmation');
    }
    if (current.responsibleParty === 'external' && input.evidence === 'declared') {
      throw new PilotDomainError('EXTERNAL_NOT_DECLAREABLE', 422, 'external expectation cannot be completed on internal declaration alone');
    }

    const workItems = state.workItems.map((w) =>
      w.id === input.workId
        ? {
            ...w,
            status: 'completed' as WorkStatus,
            completionEvidence: input.evidence,
            occurredAt: input.occurredAt ?? UNKNOWN_SENTINEL, // Q4: không backfill occurredAt
            ...(input.evidenceRef !== undefined && { evidenceRef: input.evidenceRef }),
          }
        : w,
    );
    const next = { ...state, workItems };
    await this.store.save(next, [
      {
        entityType: 'commercial-event',
        entityId: input.workId,
        workspaceId: state.lead.workspaceId,
        actor: input.actor,
        previousValue: current.status,
        newValue: JSON.stringify({ status: 'completed', evidence: input.evidence }),
        reason: input.reason ?? 'work completed',
        eventType: 'work_completed',
      },
    ]);
    return next;
  }

  /** Bước 4b — dời lịch (chỉ việc còn mở): item cũ superseded, item mới thay thế. */
  async rescheduleWork(
    leadId: LeadId,
    input: { readonly workId: string; readonly actor: string; readonly newDueAt: string; readonly reason: string },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const old = state.workItems.find((w) => w.id === input.workId);
    if (!old) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'workId not found');
    if (old.status === 'completed' || old.status === 'cancelled') {
      throw new PilotDomainError('WORK_ALREADY_CLOSED', 409, 'closed work cannot be rescheduled; record a correction instead');
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
    const workItems = state.workItems.filter((w) => w.id !== old.id).concat(superseded, replacement);
    const next = { ...state, workItems };
    await this.store.save(next, [
      {
        entityType: 'commercial-event',
        entityId: old.id,
        workspaceId: state.lead.workspaceId,
        actor: input.actor,
        previousValue: JSON.stringify({ dueAt: old.dueAt ?? null, status: old.status }),
        newValue: JSON.stringify({ dueAt: input.newDueAt, status: 'rescheduled', replacementId: replacement.id }),
        reason: input.reason,
        eventType: 'work_rescheduled',
      },
    ]);
    return next;
  }

  /** Bước 4c — external qua mốc chưa có evidence → `awaiting-external`, không thất bại. */
  async markExternalUnobserved(leadId: LeadId, input: { readonly workId: string; readonly actor: string }): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const item = state.workItems.find((w) => w.id === input.workId);
    if (!item) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'workId not found');
    if (item.responsibleParty !== 'external') throw new PilotDomainError('NOT_EXTERNAL_EXPECTATION', 422, 'only external expectations can be marked no-observation');
    if (item.completionEvidence === 'observed') throw new PilotDomainError('ALREADY_OBSERVED', 409, 'already observed; no-observation not applicable');

    const workItems = state.workItems.map((w) =>
      w.id === input.workId ? { ...w, status: 'awaiting-external' as WorkStatus, completionEvidence: 'absent' as CompletionEvidence } : w,
    );
    const next = { ...state, workItems };
    await this.store.save(next, [
      {
        entityType: 'commercial-event',
        entityId: item.id,
        workspaceId: state.lead.workspaceId,
        actor: input.actor,
        newValue: JSON.stringify({ status: 'awaiting-external', evidence: 'absent' }),
        reason: 'past expected time; outcome not observed — absence is not failure',
        eventType: 'external_no_observation',
      },
    ]);
    return next;
  }

  /** Bước 5 — ghi kết quả tối thiểu (R-15, claimed) + transition → Won/Lost/Unknown. */
  async recordOutcome(
    leadId: LeadId,
    input: { readonly value: 'Won' | 'Lost' | 'Unknown'; readonly actor: string; readonly reason?: string },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const outcome = createOutcome({
      leadId: state.lead.id,
      workspaceId: state.lead.workspaceId,
      value: input.value,
      actor: input.actor,
      acquisitionMode: 'user_confirmed',
      ...(input.reason !== undefined && { reason: input.reason }),
    });
    const lead = this.ce1Transition(state.lead, { to: input.value, actor: input.actor, reason: input.reason ?? 'outcome recorded' });
    const next = { ...state, lead, outcomes: [...state.outcomes, outcome] };
    await this.store.save(next, [
      {
        entityType: 'outcome',
        entityId: outcome.id,
        workspaceId: outcome.workspaceId,
        actor: input.actor,
        previousValue: state.lead.status,
        newValue: JSON.stringify({ outcome: outcome.value, assertionStatus: outcome.assertionStatus }),
        reason: input.reason ?? 'outcome recorded',
        eventType: 'outcome_created',
      },
    ]);
    return next;
  }

  /** Sửa kết quả — append assertion mới, giữ lịch sử (I-05). */
  async correctOutcomeRecord(
    leadId: LeadId,
    input: { readonly outcomeId: string; readonly newValue: 'Won' | 'Lost' | 'Unknown'; readonly actor: string; readonly reason: string },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const previous = state.outcomes.find((o) => o.id === input.outcomeId);
    if (!previous) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'outcomeId not found');

    const corrected = correctOutcome(previous, { newValue: input.newValue, actor: input.actor, reason: input.reason });
    const lead = this.ce1Transition(state.lead, { to: input.newValue, actor: input.actor, reason: input.reason });
    const next = { ...state, lead, outcomes: [...state.outcomes, corrected] };
    await this.store.save(next, [
      {
        entityType: 'outcome',
        entityId: corrected.id,
        workspaceId: corrected.workspaceId,
        actor: input.actor,
        previousValue: previous.value,
        newValue: corrected.value,
        reason: input.reason,
        eventType: 'outcome_corrected',
        supersedesRecordId: previous.id,
      },
    ]);
    return next;
  }

  async get(leadId: LeadId): Promise<PilotLoopState | undefined> {
    return this.store.load(leadId);
  }

  /** Append-only audit history for a case (I-05) — durable in PG, ordered by time. */
  async auditHistory(leadId: LeadId): Promise<readonly AuditHistoryEntry[]> {
    await this.require(leadId);
    return this.store.history(leadId);
  }

  /** Overdue chỉ áp dụng cho việc NỘI BỘ còn mở và có hạn hợp lệ (V2 §9.3). */
  async openInternalWorkDueBefore(leadId: LeadId, at: string): Promise<readonly WorkItem[]> {
    const state = await this.require(leadId);
    return state.workItems.filter(
      (w) => w.responsibleParty === 'internal' && (w.status === 'open' || w.status === 'accepted') && w.dueAt !== undefined && w.dueAt < at,
    );
  }

  private async require(leadId: LeadId): Promise<PilotLoopState> {
    const state = await this.store.load(leadId);
    if (!state) throw new PilotDomainError('LEAD_NOT_FOUND', 404, 'lead not found in pilot loop');
    return state;
  }
}

const stripDraft = (d: AuditDraft) => d;
