import { Body, Controller, Header, Headers, HttpException, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import { DataLifecycleService } from '../application/data-lifecycle/data-lifecycle.service';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { DATA_LIFECYCLE_STORE, DataLifecycleError, type DataLifecycleStore } from '../ports/data-lifecycle';

@Controller('pilot/lifecycle')
export class DataLifecycleController {
  private readonly service: DataLifecycleService;
  constructor(@Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Inject(DATA_LIFECYCLE_STORE) store: DataLifecycleStore) { this.service = new DataLifecycleService(store); }
  private async run(headers: Record<string, string | undefined>, action: (ctx: NonNullable<ReturnType<AuthContextResolver['resolve']>>) => Promise<unknown>) {
    const ctx = this.auth.resolve({ headers });
    if (!ctx) throw new UnauthorizedException();
    try { return await action(ctx); } catch (error) {
      if (error instanceof DataLifecycleError) throw new HttpException({ code: error.code }, error.status);
      throw new HttpException({ code: 'INTERNAL' }, 500);
    }
  }
  @Post('policies')
  @Header('Cache-Control', 'no-store')
  configure(@Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    return this.run(headers, ctx => this.service.configure(ctx, body));
  }
  @Post('previews/:dataClass')
  @Header('Cache-Control', 'no-store')
  preview(@Headers() headers: Record<string, string | undefined>, @Param('dataClass') dataClass: string, @Body() body: unknown) {
    return this.run(headers, ctx => {
      if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0)) throw new DataLifecycleError('INVALID_INPUT', 400);
      return this.service.preview(ctx, dataClass);
    });
  }
}
