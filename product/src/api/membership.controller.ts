import { Body, Controller, Get, Headers, HttpCode, HttpException, Inject, Optional, Param, Post, Query } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { MembershipAdminError, MembershipAdminService } from '../application/membership/membership-admin';
import {
  AUTH_CONTEXT_RESOLVER,
  MEMBERSHIP_ADMIN_CONFIG,
  MEMBERSHIP_STORE,
  type AuthContext,
  type AuthContextResolver,
  type MembershipAdminConfig,
  type MembershipStore,
} from '../ports/auth';

/**
 * ADR-006 admin membership API — admin of the server-resolved workspace only; every change is
 * audited in `membership_audit` with the acting admin's internal user id.
 * - `POST /v1/workspace/memberships`            grant {issuer, subject, baseRole} (provisions the identity link)
 * - `POST /v1/workspace/memberships/:id/revoke` terminal revoke
 * - `POST /v1/workspace/memberships/:id/role`   {baseRole} → revoke + grant in one transaction
 * - `GET  /v1/workspace/memberships[?status=active|revoked]`
 * Principal resolved by AUTH_CONTEXT_RESOLVER from the request's own headers object (never the
 * body); workspace never from the body; 8 KiB body limit like the integration routes.
 */
@Controller('workspace/memberships')
export class MembershipController {
  private readonly service: MembershipAdminService;

  constructor(
    @Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver,
    @Inject(MEMBERSHIP_STORE) store: MembershipStore,
    @Optional() @Inject(MEMBERSHIP_ADMIN_CONFIG) config?: MembershipAdminConfig | null,
  ) {
    this.service = new MembershipAdminService(store, config ?? null);
  }

  @RouteConfig({ bodyLimit: 8192 })
  @Post()
  grant(@Headers() headers: Record<string, string | undefined>, @Body() body: unknown) {
    return this.call(() => this.service.grant(this.principal(headers), body));
  }

  @RouteConfig({ bodyLimit: 8192 })
  @Post(':id/revoke')
  @HttpCode(200)
  revoke(@Headers() headers: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.call(() => this.service.revoke(this.principal(headers), id, body));
  }

  @RouteConfig({ bodyLimit: 8192 })
  @Post(':id/role')
  @HttpCode(200)
  changeRole(@Headers() headers: Record<string, string | undefined>, @Param('id') id: string, @Body() body: unknown) {
    return this.call(() => this.service.changeRole(this.principal(headers), id, body));
  }

  @Get()
  list(@Headers() headers: Record<string, string | undefined>, @Query() query: unknown) {
    return this.call(() => this.service.list(this.principal(headers), query));
  }

  /** Pass the request's own headers object: the verified OIDC context is bound to it (A-M5). */
  private principal(headers: Record<string, string | undefined>): AuthContext | null {
    return this.auth.resolve({ headers });
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MembershipAdminError) throw new HttpException({ code: error.code }, error.status);
      throw new HttpException({ code: 'MEMBERSHIP_UNAVAILABLE' }, 503);
    }
  }
}
