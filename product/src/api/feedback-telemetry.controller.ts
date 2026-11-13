import {
  BadRequestException, Body, Controller, Get, Headers, HttpException, Inject, Post, ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER, type AuthContext, type AuthContextResolver } from '../ports/auth';
import { FEEDBACK_SERVICE, type FeedbackServicePort } from '../ports/feedback';
import { TELEMETRY_SERVICE, type TelemetryServicePort } from '../ports/telemetry';
import { DURABILITY, type DurabilityPort } from '../ports/durability';
import { boundaryRejection } from './pilot-validation';
import { validateFeedbackBody, validateTelemetryBody } from './feedback-telemetry.validation';

type RequestHeaders = Record<string, string | undefined>;

@Controller('pilot')
export class FeedbackTelemetryController {
  constructor(
    @Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Inject(FEEDBACK_SERVICE) private readonly feedback: FeedbackServicePort,
    @Inject(TELEMETRY_SERVICE) private readonly telemetry: TelemetryServicePort,
    @Inject(DURABILITY) private readonly durability: DurabilityPort,
  ) {}

  @Post('feedback')
  async submitFeedback(@Headers() headers: RequestHeaders, @Body() body: unknown) {
    const ctx = this.authContext(headers);
    this.requireDurable();
    const issues = validateFeedbackBody(body);
    if (issues.length) throw this.invalid(issues);
    const input = body as Record<string, unknown>;
    return this.feedback.submit({
      workspaceId: ctx.workspaceId,
      actor: ctx.userId,
      leadId: input.leadId as string | undefined,
      rating: input.rating as number | undefined,
      body: input.body as string | undefined,
      context: input.context as Record<string, unknown> | undefined,
    });
  }

  @Get('feedback')
  async listFeedback(@Headers() headers: RequestHeaders) {
    const ctx = this.authContext(headers);
    this.requireDurable();
    return { items: await this.feedback.listByWorkspace(ctx.workspaceId) };
  }

  @Post('telemetry')
  async recordTelemetry(@Headers() headers: RequestHeaders, @Body() body: unknown) {
    const ctx = this.authContext(headers);
    this.requireDurable();
    const issues = validateTelemetryBody(body);
    if (issues.length) throw this.invalid(issues);
    const input = body as Record<string, unknown>;
    return this.telemetry.record({
      workspaceId: ctx.workspaceId,
      eventType: input.eventType as string,
      payload: input.payload as Record<string, unknown> | undefined,
      releaseVersion: input.releaseVersion as string | undefined,
      flagExposure: input.flagExposure as Record<string, string> | undefined,
    });
  }

  @Get('telemetry')
  async listTelemetry(@Headers() headers: RequestHeaders) {
    const ctx = this.authContext(headers);
    this.requireDurable();
    return { items: await this.telemetry.listByWorkspace(ctx.workspaceId) };
  }

  private authContext(headers: RequestHeaders): AuthContext {
    const ctx = this.auth.resolve({ headers });
    if (!ctx) throw new UnauthorizedException('unauthenticated');
    return ctx;
  }

  private requireDurable(): void {
    if (!this.durability.durable) {
      throw new ServiceUnavailableException({ code: 'DURABLE_STORAGE_REQUIRED', message: 'PostgreSQL durable mode is required for this route' });
    }
  }

  private invalid(issues: ReturnType<typeof validateFeedbackBody>): HttpException {
    const rejection = boundaryRejection(issues);
    return new BadRequestException({ code: rejection.code, message: rejection.message, details: rejection.details });
  }
}
