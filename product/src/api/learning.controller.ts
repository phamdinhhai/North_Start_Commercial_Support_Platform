import { Body, Controller, Headers, HttpException, Inject, Post } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { LEAD_ACCESS_POLICY, type LeadAccessPolicy } from '../ports/rbac';
import { LEARNING_TELEMETRY_SERVICE, LEARNING_EVENT_TYPES, type LearningTelemetryPort } from '../ports/telemetry';
import { DURABILITY, type DurabilityPort } from '../ports/durability';
import { PilotLoopService } from '../application/pilot/pilot-loop.service';
import { requirePilotLeadAccess } from '../application/pilot/lead-access';
import { PilotDomainError } from '../ports/pilot-loop.types';
import type { LeadId } from '../domain/lead/lead';

export const LEARNING_EVENTS = LEARNING_EVENT_TYPES;
/** Behavioral self-reports, never evidence or commercial truth. Server resolves scope and synthetic classification. */
@Controller('pilot')
export class LearningController {
  constructor(@Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Inject(LEAD_ACCESS_POLICY) private readonly rbac: LeadAccessPolicy,
    @Inject(PilotLoopService) private readonly loop: PilotLoopService,
    @Inject(LEARNING_TELEMETRY_SERVICE) private readonly telemetry: LearningTelemetryPort,
    @Inject(DURABILITY) private readonly durability: DurabilityPort) {}

  @Post('learning')
  async record(@Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    const ctx = this.auth.resolve({ headers });
    if (!ctx) throw new HttpException({ code: 'UNAUTHENTICATED' }, 401);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw this.invalid();
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some(k => !['leadId', 'eventType', 'releaseVersion'].includes(k)) ||
        typeof input.leadId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.leadId) ||
        typeof input.eventType !== 'string' || !LEARNING_EVENTS.has(input.eventType) ||
        (input.releaseVersion !== undefined && input.releaseVersion !== '0.1.0')) throw this.invalid();
    const state = await this.loop.get(input.leadId as LeadId);
    try { requirePilotLeadAccess(ctx, state, this.rbac); }
    catch (error) { if (error instanceof PilotDomainError) throw new HttpException({ code: error.code }, error.status); throw error; }
    // Missing classification is unknown, not permission to count it as customer learning.
    if (ctx.isDemo || state?.envelope?.isSynthetic !== false) return { recorded: false, reason: 'SYNTHETIC_OR_UNKNOWN_EXCLUDED' };
    if (!this.durability.durable) throw new HttpException({ code: 'DURABLE_STORAGE_REQUIRED' }, 503);
    await this.telemetry.recordLearning({ workspaceId: ctx.workspaceId, eventType: input.eventType, releaseVersion: '0.1.0',
      flagExposure: { pancake_sync: 'off' }, payload: { safe: 'ok' } });
    return { recorded: true, classification: 'BEHAVIORAL_SELF_REPORT_NOT_BUSINESS_EVIDENCE' };
  }
  private invalid() { return new HttpException({ code: 'INPUT_INVALID' }, 400); }
}
