import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  HttpCode,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService, type AuthContext, type AuthRequestLike } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService } from '../modules/pilot-loop/pilot-loop.service';
import { PilotDomainError, type ScenarioInput } from '../modules/pilot-loop/pilot.types';
import type { LeadId } from '../domain/lead/lead';

/**
 * P0 pilot HTTP surface — education B2C loop (T3-03/T3-04 wiring).
 *
 * - Auth (R-02): MỌI route yêu cầu resolve ctx; unauthenticated non-demo → 401.
 *   Demo (`x-demo-workspace`) là demo route. KHÔNG endpoint nào phát token từ
 *   email/workspaceId trong body (QA-28; credential model chờ RFC PM-1).
 * - RBAC (I-09, deny-by-default): workspace mismatch → 404 (invisible, QA-32/AC-03);
 *   lead không assigned cho sales → 403. "Assigned" = owner hiện tại HOẶC người
 *   được bàn giao (recipient) — B xem/nhận gói addressed to them mà KHÔNG cần mở
 *   rộng quyền manager/admin (PM-1 vẫn OPEN, không tự nới ở đây).
 * - Errors: guardrail từ chối = business code + 4xx (không phải raw 500):
 *   EVIDENCE_POINTER_REQUIRED/INFERRED_CANNOT_CLOSE/EXTERNAL_NOT_DECLAREABLE/
 *   NOT_EXTERNAL_EXPECTATION → 422; WORK_ALREADY_*→409; *_NOT_FOUND→404; 403.
 * - Persistence: PgPilotStore (durable) ở production; in-memory cho unit tests.
 */

function toRequestLike(headers: Record<string, string | undefined>): AuthRequestLike {
  return { headers };
}

/** Map domain refusal codes to a proper HTTP exception envelope (never raw 500). */
function toHttpException(err: unknown): HttpException {
  if (err instanceof PilotDomainError) {
    // `details` carries machine-readable context — e.g. replacementId for WORK_SUPERSEDED
    // (P1-3) — so a client can retry against the item that is actually live.
    const body = { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) };
    return new HttpException(body, err.status);
  }
  if (err instanceof UnauthorizedException || err instanceof NotFoundException || err instanceof ForbiddenException) {
    return err;
  }
  // Unexpected → 500 (fail closed) nhưng phải là lỗi thật, không phải guardrail.
  return new HttpException({ code: 'INTERNAL', message: err instanceof Error ? err.message : 'internal error' }, HttpStatus.INTERNAL_SERVER_ERROR);
}

@Controller('pilot')
export class PilotLoopController {
  constructor(
    private readonly auth: AuthService,
    private readonly rbac: RbacService,
    private readonly loop: PilotLoopService,
  ) {}

  @Post('scenarios')
  @HttpCode(201)
  async intake(
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: Omit<ScenarioInput, 'workspaceId' | 'ownerUserId'>,
  ) {
    try {
      const ctx = this.authCtx(headers);
      // Server-derived workspace — body không tự chọn workspace (QA-32, I-09).
      const input: ScenarioInput = {
        ...body,
        workspaceId: ctx.workspaceId,
        ownerUserId: ctx.userId,
        isSynthetic: ctx.isDemo ? true : (body.isSynthetic ?? false),
      };
      const state = await this.loop.ingestScenario(input);
      return { leadId: state.lead.id, status: state.lead.status };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Get('leads/:leadId')
  async getLead(@Headers() headers: Record<string, string | undefined>, @Param('leadId') leadId: string) {
    try {
      const ctx = this.authCtx(headers);
      return await this.authorizedView(ctx, leadId);
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/handoff')
  async handoff(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body()
    body: {
      context: string;
      proposedAction: string;
      responsibleParty: 'internal' | 'external';
      origin: 'explicit-request' | 'explicit-commitment' | 'policy-sla' | 'inferred';
      recipientUserId: string;
      dueAt?: string;
      evidenceRef?: string;
    },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId); // 404/403 trước khi mutate
      const state = await this.loop.handoffToSales(leadId as LeadId, { ...body, actor: ctx.userId });
      return { workItemId: state.workItems[state.workItems.length - 1]?.id, leadStatus: state.lead.status, recipient: state.handoffRecipient };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/accept')
  async accept(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string; reason: string },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      const state = await this.loop.salesAccept(leadId as LeadId, { workId: body.workId, actor: ctx.userId, reason: body.reason });
      return { leadStatus: state.lead.status, workStatus: state.workItems.find((w) => w.id === body.workId)?.status, owner: state.ownerUserId };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/advance')
  @HttpCode(200)
  async advance(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { to: 'Contacting' | 'Follow-up'; reason: string },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      const state = await this.loop.advance(leadId as LeadId, { to: body.to, actor: ctx.userId, reason: body.reason });
      return { leadStatus: state.lead.status };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/complete')
  @HttpCode(200)
  async complete(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string; evidence: 'observed' | 'declared' | 'inferred' | 'absent' | 'conflicted'; evidenceRef?: string; occurredAt?: string; reason?: string },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      const state = await this.loop.completeWork(leadId as LeadId, { ...body, actor: ctx.userId });
      const w = state.workItems.find((x) => x.id === body.workId);
      return { workStatus: w?.status, evidence: w?.completionEvidence, occurredAt: w?.occurredAt };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/reschedule')
  @HttpCode(200)
  async reschedule(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string; newDueAt: string; reason: string },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      const state = await this.loop.rescheduleWork(leadId as LeadId, { ...body, actor: ctx.userId });
      // P1-3: the old ID is now superseded — return the live successor so the caller (and the
      // UI) never keeps operating on the dead ID.
      const superseded = state.workItems.find((w) => w.id === body.workId);
      const replacement = state.workItems.find((w) => w.supersedesWorkId === body.workId);
      return {
        leadStatus: state.lead.status,
        workCount: state.workItems.length,
        supersededWorkId: superseded?.id ?? body.workId,
        supersededStatus: superseded?.status,
        replacementId: replacement?.id,
        replacementStatus: replacement?.status,
        dueAt: replacement?.dueAt,
      };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/unobserved')
  @HttpCode(200)
  async unobserved(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      const state = await this.loop.markExternalUnobserved(leadId as LeadId, { workId: body.workId, actor: ctx.userId });
      const w = state.workItems.find((x) => x.id === body.workId);
      return { workStatus: w?.status, evidence: w?.completionEvidence };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Post('leads/:leadId/outcome')
  async outcome(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { value: 'Won' | 'Lost' | 'Unknown'; reason?: string },
  ) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      const state = await this.loop.recordOutcome(leadId as LeadId, { value: body.value, actor: ctx.userId, reason: body.reason });
      return { leadStatus: state.lead.status, assertionStatus: state.outcomes[state.outcomes.length - 1]?.assertionStatus };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  @Get('leads/:leadId/audit')
  async auditHistory(@Headers() headers: Record<string, string | undefined>, @Param('leadId') leadId: string) {
    try {
      const ctx = this.authCtx(headers);
      await this.authorizedView(ctx, leadId);
      return { history: await this.loop.auditHistory(leadId as LeadId) };
    } catch (err) {
      throw toHttpException(err);
    }
  }

  /** R-02: reject unauthenticated non-demo; demo header = demo route pass. */
  private authCtx(headers: Record<string, string | undefined>): AuthContext {
    const ctx = this.auth.resolve(toRequestLike(headers));
    if (!ctx) throw new UnauthorizedException('unauthenticated');
    return ctx;
  }

  /**
   * I-09/R-03 + QA-32/AC-03: cross-workspace → 404 (invisible);
   * right workspace but neither owner NOR handoff recipient → 403.
   * Recipient access là lead-scoped cho đúng gói được bàn giao tới họ (PM-1 vẫn OPEN).
   */
  private async authorizedView(ctx: AuthContext, leadId: string) {
    const state = await this.loop.get(leadId as LeadId);
    if (!state || state.lead.workspaceId !== ctx.workspaceId) throw new NotFoundException('lead not found');
    const resource = {
      id: leadId,
      workspaceId: state.lead.workspaceId,
      assignedTo: state.ownerUserId,
      recipients: state.handoffRecipient ? [state.handoffRecipient] : [],
    };
    if (!this.rbac.canAccessLead(ctx, resource)) throw new ForbiddenException('forbidden');
    return {
      lead: { id: state.lead.id, status: state.lead.status, workspaceId: state.lead.workspaceId, displayName: state.lead.displayName, owner: state.ownerUserId, handoffRecipient: state.handoffRecipient },
      handoff: state.handoff ? { id: state.handoff.id, context: state.handoff.context, evidenceRefs: state.handoff.evidenceRefs } : undefined,
      workItems: state.workItems.map((w) => ({
        id: w.id,
        action: w.action,
        responsibleParty: w.responsibleParty,
        origin: w.origin,
        status: w.status,
        completionEvidence: w.completionEvidence,
        occurredAt: w.occurredAt,
        dueAt: w.dueAt,
      })),
      outcomes: state.outcomes.map((o) => ({ id: o.id, value: o.value, assertionStatus: o.assertionStatus })),
    };
  }
}
