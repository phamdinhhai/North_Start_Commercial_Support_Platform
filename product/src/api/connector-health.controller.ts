import { Controller, Get, Header, Headers, HttpException, Inject } from '@nestjs/common';
import { ConnectorHealthError, ConnectorHealthQuery } from '../application/observability/connector-health';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import type { ConnectorHealthReport } from '../ports/connector-health';
import { REQUEST_ANNOTATOR, type RequestAnnotator } from '../ports/request-context';

type RequestHeaders = Record<string, string | undefined>;

/**
 * GET /v1/integration/health — experimental connector health for the caller's workspace.
 * Transport, delivery and completeness are separate fields; completeness is always UNKNOWN
 * (no reconciliation exists). There is no single "healthy" verdict by design.
 * Operational telemetry only; not commercial evidence.
 */
@Controller('integration')
export class ConnectorHealthController {
  constructor(
    @Inject(ConnectorHealthQuery) private readonly query: ConnectorHealthQuery,
    @Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Inject(REQUEST_ANNOTATOR) private readonly annotator: RequestAnnotator,
  ) {}

  @Get('health')
  @Header('cache-control', 'no-store')
  async health(@Headers() headers: RequestHeaders): Promise<ConnectorHealthReport> {
    try {
      // Flag-off answers 404 before authentication, matching the intake routes.
      if (!this.query.enabled()) throw new ConnectorHealthError('AIL_DISABLED', 404);
      const ctx = this.query.authorize(this.auth.resolve({ headers }));
      this.annotator.annotateWorkspace(ctx.workspaceId);
      return await this.query.report(ctx);
    } catch (error) {
      if (error instanceof ConnectorHealthError) throw new HttpException({ code: error.code }, error.status);
      throw new HttpException({ code: 'HEALTH_UNAVAILABLE' }, 503);
    }
  }
}
