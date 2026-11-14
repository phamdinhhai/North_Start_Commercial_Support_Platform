import type { LeadId } from '../../domain/lead/lead';
import type { ManualIngestPort } from '../../ports/manual-ingest.port';
import type { AuditDraft, CompletionEvidence, PilotLoopState, ResponsibleParty, ScenarioInput, WorkItem, WorkOrigin, WorkStatus, AuditHistoryEntry, PilotQueuePage, PilotQueueQuery } from '../../ports/pilot-loop.types';
import { PilotDomainError } from '../../ports/pilot-loop.types';
import type { PilotLoopStore } from '../../ports/pilot-loop.store';
import { createHandoff } from '../../domain/handoff/handoff';
import { createOutcome, correctOutcome } from '../../domain/outcome/outcome';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import { randomUUID } from 'node:crypto';
import { IngestScenarioCommand } from '../../application/pilot/ingest-scenario.command';
import { PilotCommandContext } from '../../application/pilot/pilot-command-context';
import {
  CLOSED_BY_ENDPOINT,
  requireActionable,
  requireMutableWork,
  requireOwner,
  requireWork,
} from '../../application/pilot/work-mutation-policy';

// Compatibility export: the controller and existing consumers retain their import path.
export { activeWorkRecipients } from '../../application/pilot/work-mutation-policy';

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
export class PilotLoopService {
  private readonly context: PilotCommandContext;
  private readonly ingestCommand: IngestScenarioCommand;

  constructor(private readonly store: PilotLoopStore, private readonly adapter: ManualIngestPort) {
    this.context = new PilotCommandContext(store, adapter);
    this.ingestCommand = new IngestScenarioCommand(this.context);
  }

  /** CE-1 boundary violation is a business refusal (422), never a raw 500. */
  private ce1Transition(lead: Parameters<PilotCommandContext['transition']>[0], input: Parameters<PilotCommandContext['transition']>[1]) {
    return this.context.transition(lead, input);
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
  private resolveEvidence(state: PilotLoopState, pointer: string, action: string, options: { readonly requireRelation: boolean } = { requireRelation: true }) {
    return this.context.evidence(state, pointer, action, options.requireRelation);
  }

  /** Bước 1 — nhập tình huống: raw envelope immutable (I-12) + Lead create (I-07). */
  async ingestScenario(input: ScenarioInput): Promise<PilotLoopState> {
    return this.ingestCommand.execute(input);
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
    requireOwner(state, input.actor, 'hand off this lead');

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
    await this.persist(next, audits.map(stripDraft));
    return next;
  }

  /**
   * Bước 3 — người nhận B chấp nhận: transition New→Accepted (CE-1) + work→accepted
   * + owner := B. B có được xem/nhận là vì work item addressed to them (I-09 lead-
   * scope), KHÔNG vì mở rộng quyền. Quyền manager/admin chi tiết vẫn PM-1.
   *
   * P1-2: kiểm tra theo TỪNG work item (`target.actor === input.actor`), KHÔNG dùng
   * slot đơn `state.handoffRecipient` và KHÔNG cho phép owner hiện tại A nhận hộ B
   * hay người nhận C của bàn giao sau nhận hộ item của B.
   */
  async salesAccept(
    leadId: LeadId,
    input: { readonly actor: string; readonly reason: string; readonly workId: string },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    const workItem = requireWork(state, input.workId);
    // P1-2: kiểm tra quyền người nhận (403) TRƯỚC khi tiết lộ trạng thái sống/đóng của work item (409).
    // Chỉ ĐÚNG người nhận của work item này mới được accept nó (owner A không được accept hộ B;
    // recipient C của handoff thứ hai không được accept item của B).
    if (input.actor !== workItem.actor) {
      throw new PilotDomainError(
        'NOT_ASSIGNED_RECIPIENT',
        403,
        `only the recipient assigned to work ${workItem.id} (${workItem.actor}) may accept it`,
      );
    }
    // Item phải thuộc lead này và còn khả dụng — nhận một item đã superseded/completed
    // sẽ trao ownership dựa trên một work item không còn tồn tại thực thi (P1-3).
    const target = requireActionable(state, workItem, CLOSED_BY_ENDPOINT.accept);
    if (target.status !== 'proposed') {
      throw new PilotDomainError('WORK_ALREADY_CLOSED', 409, `work ${target.id} is already ${target.status}`);
    }

    // Nếu lead đang ở New → chuyển New→Accepted (CE-1). Nếu lead đã ở trạng thái đang
    // xử lý (Accepted / Contacting / Follow-up) và có bàn giao tiếp theo, giữ nguyên
    // trạng thái lead đang hiệu lực; nếu lead đã đóng (Won / Lost) thì ce1Transition
    // sẽ từ chối 422 CE1_BOUNDARY.
    const alreadyActiveStage =
      state.lead.status === 'Accepted' || state.lead.status === 'Contacting' || state.lead.status === 'Follow-up';
    const lead = alreadyActiveStage
      ? state.lead
      : this.ce1Transition(state.lead, { to: 'Accepted', actor: input.actor, reason: input.reason });
    const workItems = state.workItems.map((w) => (w.id === input.workId ? { ...w, status: 'accepted' as WorkStatus, actor: input.actor } : w));
    const next: PilotLoopState = { ...state, lead, workItems, ownerUserId: input.actor, handoffRecipient: input.actor };
    await this.persist(next, [
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
    requireOwner(state, input.actor, 'change the lead stage');
    const lead = this.ce1Transition(state.lead, { to: input.to, actor: input.actor, reason: input.reason });
    const next = { ...state, lead };
    await this.persist(next, [
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
      readonly declaration?: string;
      readonly confirmed?: boolean;
    },
  ): Promise<PilotLoopState> {
    const state = await this.require(leadId);
    // P1-2 owner + per-item lead scope (P1-2) + superseded/closed refusal (P1-3).
    const current = requireMutableWork(state, input.workId, input.actor, 'complete work', CLOSED_BY_ENDPOINT.complete);

    if (input.evidence === 'observed' && !input.evidenceRef) {
      throw new PilotDomainError('EVIDENCE_POINTER_REQUIRED', 422, 'observed completion requires a system evidence pointer');
    }
    if (input.evidence === 'declared' && (!input.declaration || input.declaration.trim() === '' || input.confirmed !== true)) {
      throw new PilotDomainError('INPUT_INVALID', 422, 'declared completion requires a nonblank declaration and explicit confirmation');
    }
    if (input.evidence === 'inferred') {
      throw new PilotDomainError('INFERRED_CANNOT_CLOSE', 422, 'inferred evidence cannot close work; require user confirmation');
    }
    if (input.evidence === 'absent' || input.evidence === 'conflicted') {
      throw new PilotDomainError(
        'EVIDENCE_INSUFFICIENT_TO_CLOSE',
        422,
        `${input.evidence} evidence cannot close work as completed — completion requires observed proof or a declared claim (TRUST_AND_EVIDENCE §4, V2 §9.3)`,
      );
    }
    if (current.responsibleParty === 'external' && input.evidence === 'declared') {
      throw new PilotDomainError('EXTERNAL_NOT_DECLAREABLE', 422, 'external expectation cannot be completed on internal declaration alone');
    }

    // P1-4: any pointer present must validate — not only `observed` ones, otherwise a bogus
    // ref could be parked on a declared record and reused later.
    const evidence = input.evidenceRef === undefined ? undefined : await this.resolveEvidence(state, input.evidenceRef, 'completion');
    // P1-4 ("message observed ≠ action observed", TRUST_AND_EVIDENCE §4, V2 §7.3/§9.3):
    // The intake envelope that opened the lead (or any customer-authored request message)
    // proves only that the customer spoke — NEVER that staff completed the follow-up action.
    // Manual P0 completion without separate system action proof must be recorded as `declared`.
    if (
      input.evidence === 'observed' &&
      evidence !== undefined &&
      (evidence.envelopeId === state.sourceEnvelopeId || evidence.speaker === 'customer' || evidence.acquisitionMode !== 'automatic_observation' || evidence.acquisitionSource !== 'system')
    ) {
      throw new PilotDomainError(
        'EVIDENCE_NOT_ACTION_PROOF',
        422,
        `evidence ${evidence.envelopeId} is the intake/customer request message, not observed proof that "${current.action}" was performed — record manual confirmation as "declared" instead (TRUST_AND_EVIDENCE §4, V2 §7.3)`,
      );
    }

    const workItems = state.workItems.map((w) =>
      w.id === input.workId
        ? {
            ...w,
            status: 'completed' as WorkStatus,
            completionEvidence: input.evidence,
            occurredAt: input.occurredAt ?? UNKNOWN_SENTINEL, // Q4: không backfill occurredAt
            ...(input.evidenceRef !== undefined && { evidenceRef: input.evidenceRef }),
            ...(input.declaration !== undefined && { declaration: input.declaration }),
            ...(input.confirmed !== undefined && { confirmed: input.confirmed }),
          }
        : w,
    );
    const next = { ...state, workItems };
    await this.persist(next, [
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
          ...(input.declaration !== undefined && { declaration: input.declaration }),
          ...(input.confirmed !== undefined && { confirmed: input.confirmed }),
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
    const old = requireMutableWork(state, input.workId, input.actor, 'reschedule work', CLOSED_BY_ENDPOINT.reschedule);

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
    await this.persist(next, [
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
    const item = requireMutableWork(state, input.workId, input.actor, 'record no-observation', CLOSED_BY_ENDPOINT.unobserved);
    if (item.responsibleParty !== 'external') throw new PilotDomainError('NOT_EXTERNAL_EXPECTATION', 422, 'only external expectations can be marked no-observation');
    if (item.completionEvidence === 'observed') throw new PilotDomainError('ALREADY_OBSERVED', 409, 'already observed; no-observation not applicable');

    const workItems = state.workItems.map((w) =>
      w.id === input.workId ? { ...w, status: 'awaiting-external' as WorkStatus, completionEvidence: 'absent' as CompletionEvidence } : w,
    );
    const next = { ...state, workItems };
    await this.persist(next, [
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
    requireOwner(state, input.actor, 'record the outcome');
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
    await this.persist(next, [
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
    requireOwner(state, input.actor, 'correct the outcome');
    const previous = state.outcomes.find((o) => o.id === input.outcomeId);
    if (!previous) throw new PilotDomainError('OUTCOME_NOT_FOUND', 404, 'outcomeId not found on this lead');

    const corrected = correctOutcome(previous, { newValue: input.newValue, actor: input.actor, reason: input.reason });
    const lead = this.ce1Transition(state.lead, { to: input.newValue, actor: input.actor, reason: input.reason });
    const next = { ...state, lead, outcomes: [...state.outcomes, corrected] };
    await this.persist(next, [
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

  private async persist(state: PilotLoopState, audits: readonly AuditDraft[]): Promise<PilotLoopState> {
    const saved = await this.store.save(state, audits.map(stripDraft));
    // Keep the request's returned aggregate carrying the committed revision without changing
    // domain semantics; callers must use this state for the next mutation.
    if (saved.version !== undefined) Object.assign(state, { version: saved.version });
    return saved;
  }

  async get(leadId: LeadId): Promise<PilotLoopState | undefined> {
    return this.store.load(leadId);
  }

  async queue(query: PilotQueueQuery): Promise<PilotQueuePage> {
    return this.store.queue(query);
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
