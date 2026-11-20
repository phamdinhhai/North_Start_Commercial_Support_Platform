import { Body, Controller, Get, Header, Headers, HttpException, Inject, Param, Post } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { SOURCE_SYNTHETIC_MODE } from '../ports/source-fixture-decoder';
import { SourceIntegrationError, type SourceConnection } from '../ports/source-observation';
import { SourceIntegrationService } from '../application/source-integration/source-integration.service';
import { SourceFixtureIntake } from '../application/source-integration/fixture-intake';
import { PilotDomainError } from '../ports/pilot-loop.types';

@Controller('source-integrations')
export class SourceIntegrationController {
  constructor(@Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Inject(SourceIntegrationService) private readonly service: SourceIntegrationService,
    @Inject(SourceFixtureIntake) private readonly fixtures: SourceFixtureIntake,
    @Inject(SOURCE_SYNTHETIC_MODE) private readonly enabled: boolean) {}
  private async run<T>(headers: Record<string, string | undefined>, operation: (ctx: NonNullable<ReturnType<AuthContextResolver['resolve']>>) => Promise<T>) {
    try {
      if (!this.enabled) throw new SourceIntegrationError('SOURCE_INTEGRATION_DISABLED', 404);
      const ctx = this.auth.resolve({ headers });
      if (!ctx) throw new SourceIntegrationError('UNAUTHORIZED', 401);
      return await operation(ctx);
    } catch (error) {
      if (error instanceof SourceIntegrationError || error instanceof PilotDomainError) {
        throw new HttpException({ code: error.code }, error.status);
      }
      throw new HttpException({ code: 'SOURCE_UNAVAILABLE' }, 503);
    }
  }
  private id(value: string) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new SourceIntegrationError('INPUT_INVALID', 400);
    return value;
  }
  @Get('connections') @Header('Cache-Control', 'no-store') list(@Headers() h: Record<string, string | undefined>) {
    return this.run(h, async ctx => ({ items: await this.service.listConnections(ctx), limit: 100, completeness: 'UNKNOWN' }));
  }
  @Post('connections') @Header('Cache-Control', 'no-store') create(@Headers() h: Record<string, string | undefined>, @Body() body: Pick<SourceConnection, 'provider' | 'route' | 'pageId'>) {
    return this.run(h, ctx => this.service.createConnection(ctx, body));
  }
  @Post('connections/:id/revoke') @Header('Cache-Control', 'no-store') revoke(@Headers() h: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.run(h, ctx => {
      if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) throw new SourceIntegrationError('INPUT_INVALID', 400);
      return this.service.revokeConnection(ctx, this.id(id));
    });
  }
  @Get('connections/:id/example') @Header('Cache-Control', 'no-store') example(@Headers() h: Record<string, string | undefined>, @Param('id') id: string) {
    return this.run(h, ctx => this.fixtures.example(ctx, this.id(id)));
  }
  @Post('connections/:id/observations') @Header('Cache-Control', 'no-store') intake(@Headers() h: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.run(h, ctx => this.fixtures.intake(ctx, this.id(id), body));
  }
  @Get('leads/:id/evidence') @Header('Cache-Control', 'no-store') evidence(@Headers() h: Record<string, string | undefined>, @Param('id') id: string) {
    return this.run(h, ctx => this.service.evidence(ctx, this.id(id)));
  }
}
