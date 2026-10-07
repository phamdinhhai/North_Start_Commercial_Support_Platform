import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createLead, type Lead, type LeadId } from '../../domain/lead/lead';
import { transitionLead } from '../../domain/lead/lead-state';
import { createHandoff } from '../../domain/handoff/handoff';
import { createOutcome, correctOutcome } from '../../domain/outcome/outcome';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import type { AuditDraft, AuditHistoryEntry, CompletionEvidence, PilotErrorCode, PilotLoopState, ResponsibleParty, ScenarioInput, WorkItem, WorkOrigin, WorkStatus } from './pilot.types';
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
 *
 * BA quyền tách biệt (P1-2) — KHÔNG suy từ quyền xem ra quyền sửa:
 *   view     = owner, người được bàn giao (recipient), manager/admin cùng workspace
 *              (RBAC ở controller);
 *   accept   = chính người được bàn giao (recipient) hoặc owner hiện tại;
 *   mutation = CHỈ owner hiện tại của lead, kiểm tra theo TỪNG work item (workId
 *              phải thuộc lead đang xử lý) và theo trạng thái bàn giao.
 * Recipient chưa accept do đó không complete/dời lịch/advance/ghi kết quả hộ A.
 * Manager/admin mutation? PM-1 vẫn OPEN → P0 không tự nới: owner-only.
 */
@Injectable()
export class PilotLoopService {
  constructor(private readonly store: PilotLoopStore, private readonly adapter = new ManualAdapter()) {}

  /**
   * Mutation authority (P1-2): only the CURRENT owner of the lead may mutate, and
   * only on work items belonging to that lead. View/accept rights never imply this.
   */
  private requireOwner(state: PilotLoopState, actor: string, action: string): void {
    if (!state.ownerUserId || state.ownerUserId !== actor) {
      throw new PilotDomainError(
        'NOT_OWNER',
        403,
        `${actor} may not ${action}: only the current lead owner (${state.ownerUserId ?? 'unassigned'}) may mutate work on this lead — view/accept rights do not imply it`,
      );
    }
  }

  /** Work item must belong to THIS lead (per-item check, P1-2). */
  private requireWork(state: PilotLoopState, workId: string): WorkItem {
    const item = state.workItems.find((w) => w.id === workId);
    if (!item) throw new PilotDomainError('WORK_NOT_FOUND', 404, 'workId not found on this lead');
    return item;
  }

  /**
   * Work item must still be actionable for THIS endpoint.
   *
   * P1-3: `rescheduled`/`cancelled` items are closed-by-replacement — completing one used to
   * return 200 while the live successor stayed open, so the chain looked done and was not.
   * They are refused with WORK_SUPERSEDED + `details.replacementId`, letting the caller retry
   * against the item that actually survives instead of guessing IDs.
   * `closedCodes` preserves each endpoint's published contract for `completed` work
   * (`complete` → WORK_ALREADY_COMPLETED; `reschedule`/`unobserved`/`accept` → WORK_ALREADY_CLOSED).
   */
  private requireActionable(state: PilotLoopState, item: WorkItem, closedCodes: Partial<Record<WorkStatus, PilotErrorCode>>): WorkItem {
    if (item.status === 'rescheduled' || item.status === 'cancelled') {
      const replacement = state.workItems.find((w) => w.supersedesWorkId === item.id && w.status !== 'completed' && w.status !== 'rescheduled' && w.status !== 'cancelled');
      const live = replacement ?? state.workItems.find((w) => w.supersedesWorkId === item.id);
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

  /** Owner-checked, lead-scoped, actionable work item — the single gate every work mutation passes. */
  private requireMutableWork(
    state: PilotLoopState,
    workId: string,
    actor: string,
    action: string,
    closedCodes: Partial<Record<WorkStatus, PilotErrorCode>>,
  ): WorkItem {
    this.requireOwner(state, actor, action);
    return this.requireActionable(state, this.requireWork(state, workId), closedCodes);
  }

  /**
   * Closed statuses per endpoint, as they were published before P1-3 — `complete` calls a
   * finished item WORK_ALREADY_COMPLETED, the other work mutations call it WORK_ALREADY_CLOSED.
   */
  private static readonly CLOSED_BY_ENDPOINT = {
    complete: { completed: 'WORK_ALREADY_COMPLETED' } as Partial<Record<WorkStatus, PilotErrorCode>>,
    reschedule: { completed: 'WORK_ALREADY_CLOSED' } as Partial<Record<WorkStatus, PilotErrorCode>>,
    unobserved: { completed: 'WORK_ALREADY_CLOSED' } as Partial<Record<WorkStatus, PilotErrorCode>>,
    accept: { completed: 'WORK_ALREADY_CLOSED' } as Partial<Record<WorkStatus, PilotErrorCode>>,
  };

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

  /**
   * P1-4 — an evidence pointer is a REFERENCE to immutable raw evidence (I-12), never a way
   * to promote a claim. A pointer must (a) resolve in durable storage, (b) live in the SAME
   * workspace (I-09), and (c) relate to THIS case — the lead's source envelope, an envelope a
   * handoff already cites, or one an existing work item cites. Anything else is refused so a
   * fabricated/unrelated string can never close work as `observed`.
   *
   * Cross-tenant existence is answered 403 rather than 404 on purpose: the pointer was
   * supplied by an already-authorized participant of THIS lead, and the failure is about the
   * referenced object's scope, not about hiding another workspace's existence.
   */
  private async resolveEvidence(
    state: PilotLoopState,
    pointer: string,
    action: string,
    options: { readonly requireRelation: boolean } = { requireRelation: true },
  ) {
    const record = await this.store.loadEvidence(pointer);
    if (!record) {
      throw new PilotDomainError('EVIDENCE_NOT_FOUND', 422, `evidence pointer "${pointer}" does not resolve to stored raw evidence — ${action} needs a real envelope reference (I-12)`);
    }
    if (record.workspaceId !== state.lead.workspaceId) {
      throw new PilotDomainError('EVIDENCE_OUT_OF_SCOPE', 403, `evidence ${pointer} belongs to another workspace — it cannot evidence this case (I-09)`);
    }
    const related =
      pointer === state.sourceEnvelopeId ||
      state.handoff?.evidenceRefs.some((r) => r.envelopeId === pointer) === true ||
      state.workItems.some((w) => w.evidenceRef === pointer);
    if (options.requireRelation && !related) {
      throw new PilotDomainError('EVIDENCE_NOT_RELATED', 422, `evidence ${pointer} exists in this workspace but is not referenced by this lead, its handoff or its work items — it cannot evidence ${action}`);
    }
    return record;
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
    // Bàn giao là mutation trên lead → chỉ owner hiện tại được tạo (P1-2).
    this.requireOwner(state, input.actor, 'hand off this lead');

    // P1-4 + I-12: một evidence ref phải trỏ tới raw evidence THẬT trong cùng workspace.
    // Mã cũ ghi `rawPayloadHash: 'pending'` cho ref do caller cung cấp — tức là bịa placeholder
    // vào dấu vết bằng chứng; ref không resolve thì bị từ chối thay vì được lưu mờ.
    const cited = input.evidenceRef
      ? await this.resolveEvidence(state, input.evidenceRef, 'handoff', { requireRelation: false })
      : undefined;
    const evidenceRefs = cited
      ? [{ envelopeId: cited.envelopeId, rawPayloadHash: cited.rawPayloadHash, capturedAt: cited.sourceCapturedAt }]
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
    // accept là quyền RIÊNG (P1-2): người được bàn giao hoặc owner hiện tại — rộng hơn
    // mutation (chỉ owner) nhưng vẫn hẹp hơn view (mọi recipient được xem).
    if (input.actor !== state.handoffRecipient && input.actor !== state.ownerUserId) {
      throw new PilotDomainError('NOT_ASSIGNED_RECIPIENT', 403, 'only the handoff recipient or current owner may accept this work');
    }
    // Item phải thuộc lead này và còn khả dụng — nhận một item đã superseded/completed
    // sẽ trao ownership dựa trên một work item không còn tồn tại thực thi (P1-3).
    const target = this.requireActionable(state, this.requireWork(state, input.workId), PilotLoopService.CLOSED_BY_ENDPOINT.accept);

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
    this.requireOwner(state, input.actor, 'change the lead stage');
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
   * Bước 4 — complete. `observed` CẦN evidence pointer resolve được, đúng workspace và đúng
   * quan hệ với hồ sơ này (P1-4; message observed ≠ hành động); `inferred` không tự đóng
   * (V2 §9.6); external không declare-complete hộ khách.
   * Pointer đi kèm `declared` chỉ được GHI LẠI như một tham chiếu — nó không nâng lời khai
   * thành observed (provenance thuộc về dữ kiện, không suy từ sự hiện diện của con trỏ).
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
    // P1-2 owner + per-item lead scope (P1-2) + superseded/closed refusal (P1-3).
    const current = this.requireMutableWork(state, input.workId, input.actor, 'complete work', PilotLoopService.CLOSED_BY_ENDPOINT.complete);

    if (input.evidence === 'observed' && !input.evidenceRef) {
      throw new PilotDomainError('EVIDENCE_POINTER_REQUIRED', 422, 'observed completion requires a system evidence pointer');
    }
    if (input.evidence === 'inferred') {
      throw new PilotDomainError('INFERRED_CANNOT_CLOSE', 422, 'inferred evidence cannot close work; require user confirmation');
    }
    if (current.responsibleParty === 'external' && input.evidence === 'declared') {
      throw new PilotDomainError('EXTERNAL_NOT_DECLAREABLE', 422, 'external expectation cannot be completed on internal declaration alone');
    }

    // P1-4: any pointer present must validate — not only `observed` ones, otherwise a bogus
    // ref could be parked on a declared record and reused later.
    const evidence = input.evidenceRef === undefined ? undefined : await this.resolveEvidence(state, input.evidenceRef, 'completion');

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
        // audit carries the RAW HASH of the referenced evidence (I-12) so the trail is
        // traceable to the immutable object, not just to a pointer string that could drift.
        newValue: JSON.stringify({
          status: 'completed',
          evidence: input.evidence,
          ...(input.evidenceRef !== undefined && { evidenceRef: input.evidenceRef, evidenceHash: evidence?.rawPayloadHash }),
        }),
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
    const old = this.requireMutableWork(state, input.workId, input.actor, 'reschedule work', PilotLoopService.CLOSED_BY_ENDPOINT.reschedule);

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
    // no-observation là một mutation (đổi status/evidence) → cùng gate owner + per-item
    // + superseded/closed (P1-2/P1-3). Item đã có evidence observed thì không áp dụng.
    const item = this.requireMutableWork(state, input.workId, input.actor, 'record no-observation', PilotLoopService.CLOSED_BY_ENDPOINT.unobserved);
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
    // Outcome + lead-stage transition là mutation → chỉ owner hiện tại (P1-2).
    this.requireOwner(state, input.actor, 'record the outcome');
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
    // Correction is a mutation on the case → owner-only in P0. Manager/admin correction is a
    // PM-1 capability and is deliberately NOT widened here (the audit trail below proves it).
    this.requireOwner(state, input.actor, 'correct the outcome');
    const previous = state.outcomes.find((o) => o.id === input.outcomeId);
    if (!previous) throw new PilotDomainError('OUTCOME_NOT_FOUND', 404, 'outcomeId not found on this lead');

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
