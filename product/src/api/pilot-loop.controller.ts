import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  HttpCode,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthService, type AuthContext, type AuthRequestLike } from '../infra/auth/auth.service';
import { RbacService } from '../infra/rbac/rbac.service';
import { PilotLoopService, type ScenarioInput } from '../modules/pilot-loop/pilot-loop.service';
import type { LeadId } from '../domain/lead/lead';

/**
 * P0 pilot HTTP surface — education B2C loop (T3-03/T3-04 wiring).
 *
 * - Auth (R-02): MỌI route yêu cầu resolve ctx; unauthenticated non-demo → 401.
 *   Demo (`x-demo-workspace`) là demo route. KHÔNG endpoint nào phát token từ
 *   email/workspaceId trong body (QA-28; credential model chờ RFC PM-1).
 * - RBAC (I-09, deny-by-default): cross-workspace → 404 (QA-32/AC-03),
 *   wrong owner → 403. workspaceId luôn server-derived từ AuthContext.
 * - Persistence: in-memory PilotLoopService hiện tại; PG-backed repo là phần
 *   wiring còn lại của T3-05/T3-06 — route này chưa claim [✓DB].
 */

function toRequestLike(headers: Record<string, string | undefined>): AuthRequestLike {
  return { headers };
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
  intake(
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: Omit<ScenarioInput, 'workspaceId'>,
  ) {
    const ctx = this.authCtx(headers);
    // Server-derived workspace — body không tự chọn workspace (QA-32, I-09).
    const input: ScenarioInput = {
      ...body,
      workspaceId: ctx.workspaceId,
      ownerUserId: ctx.userId,
      isSynthetic: ctx.isDemo ? true : (body.isSynthetic ?? false),
    };
    const state = this.loop.ingestScenario(input);
    return { leadId: state.lead.id, status: state.lead.status };
  }

  @Get('leads/:leadId')
  getLead(@Headers() headers: Record<string, string | undefined>, @Param('leadId') leadId: string) {
    const ctx = this.authCtx(headers);
    return this.authorizedView(ctx, leadId);
  }

  @Post('leads/:leadId/handoff')
  handoff(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { context: string; proposedAction: string; responsibleParty: 'internal' | 'external'; origin: 'explicit-request' | 'explicit-commitment' | 'policy-sla' | 'inferred'; dueAt?: string; evidenceRef?: string },
  ) {
    const ctx = this.authCtx(headers);
    this.authorizedView(ctx, leadId); // 404/403 trước khi mutate
    const state = this.loop.handoffToSales(leadId as LeadId, { ...body, actor: ctx.userId });
    return { workItemId: state.workItems[state.workItems.length - 1]?.id, leadStatus: state.lead.status };
  }

  @Post('leads/:leadId/accept')
  accept(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string; reason: string },
  ) {
    const ctx = this.authCtx(headers);
    this.authorizedView(ctx, leadId);
    const state = this.loop.salesAccept(leadId as LeadId, { workId: body.workId, actor: ctx.userId, reason: body.reason });
    return { leadStatus: state.lead.status, workStatus: state.workItems.find((w) => w.id === body.workId)?.status };
  }

  @Post('leads/:leadId/advance')
  @HttpCode(200)
  advance(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { to: 'Contacting' | 'Follow-up'; reason: string },
  ) {
    const ctx = this.authCtx(headers);
    this.authorizedView(ctx, leadId);
    const state = this.loop.advance(leadId as LeadId, { to: body.to, actor: ctx.userId, reason: body.reason });
    return { leadStatus: state.lead.status };
  }

  @Post('leads/:leadId/complete')
  @HttpCode(200)
  complete(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string; evidence: 'observed' | 'declared' | 'inferred' | 'absent' | 'conflicted'; evidenceRef?: string; occurredAt?: string; reason?: string },
  ) {
    const ctx = this.authCtx(headers);
    this.authorizedView(ctx, leadId);
    const state = this.loop.completeWork(leadId as LeadId, { ...body, actor: ctx.userId });
    const w = state.workItems.find((x) => x.id === body.workId);
    return { workStatus: w?.status, evidence: w?.completionEvidence, occurredAt: w?.occurredAt };
  }

  @Post('leads/:leadId/reschedule')
  @HttpCode(200)
  reschedule(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { workId: string; newDueAt: string; reason: string },
  ) {
    const ctx = this.authCtx(headers);
    this.authorizedView(ctx, leadId);
    const state = this.loop.rescheduleWork(leadId as LeadId, { ...body, actor: ctx.userId });
    return { leadStatus: state.lead.status, workCount: state.workItems.length };
  }

  @Post('leads/:leadId/outcome')
  outcome(
    @Headers() headers: Record<string, string | undefined>,
    @Param('leadId') leadId: string,
    @Body() body: { value: 'Won' | 'Lost' | 'Unknown'; reason?: string },
  ) {
    const ctx = this.authCtx(headers);
    this.authorizedView(ctx, leadId);
    const state = this.loop.recordOutcome(leadId as LeadId, { value: body.value, actor: ctx.userId, reason: body.reason });
    return { leadStatus: state.lead.status, assertionStatus: state.outcomes[state.outcomes.length - 1]?.assertionStatus };
  }

  /** R-02: reject unauthenticated non-demo; demo header = demo route pass. */
  private authCtx(headers: Record<string, string | undefined>): AuthContext {
    const ctx = this.auth.resolve(toRequestLike(headers));
    if (!ctx) throw new UnauthorizedException('unauthenticated');
    return ctx;
  }

  /** I-09/R-03 + QA-32/AC-03: cross-workspace 404 (invisible), unassigned 403. */
  private authorizedView(ctx: AuthContext, leadId: string) {
    const state = this.loop.get(leadId as LeadId);
    if (!state || state.lead.workspaceId !== ctx.workspaceId) throw new NotFoundException('lead not found');
    const resource = { id: leadId, workspaceId: state.lead.workspaceId, assignedTo: state.ownerUserId };
    if (!this.rbac.canAccessLead(ctx, resource)) throw new ForbiddenException('forbidden');
    return {
      lead: { id: state.lead.id, status: state.lead.status, workspaceId: state.lead.workspaceId, displayName: state.lead.displayName },
      handoff: state.handoff ? { id: state.handoff.id, context: state.handoff.context } : undefined,
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
