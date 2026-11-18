import { Body, Controller, Headers, HttpException, Inject, Post } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { IntegrationIntake } from '../application/integration/intake';
import { AUTH_CONTEXT_RESOLVER, type AuthContext, type AuthContextResolver } from '../ports/auth';
import { IntegrationError } from '../ports/integration';

/**
 * Experimental research intake (default OFF via AIL_RESEARCH_ENABLED).
 * - `enrollments`, `enrollments/revoke`: principal resolved by AuthContextResolver from headers only
 *   (never the body). OPEN: PM-1 — reuses existing manager/admin workspace authority.
 * - `enroll`, `revoke`: DEPRECATED shared `x-integration-issuer` secret; disableable by config.
 * - `observations`: signed enrollment capability token.
 */
@Controller('integration')
export class IntegrationController {
    constructor(
    @Inject(IntegrationIntake)
    private readonly intake: IntegrationIntake,
    @Inject(AUTH_CONTEXT_RESOLVER)
    private readonly auth: AuthContextResolver) { }
    @RouteConfig({ bodyLimit: 8192 })
    @Post('enrollments')
    enrollAsPrincipal(
    @Headers()
    headers: Record<string, string | undefined>,
    @Body()
    body: unknown) { return this.call(() => this.intake.enrollAsPrincipal(this.principal(headers), body)); }
    @RouteConfig({ bodyLimit: 8192 })
    @Post('enrollments/revoke')
    revokeAsPrincipal(
    @Headers()
    headers: Record<string, string | undefined>,
    @Body()
    body: unknown) { return this.call(() => this.intake.revokeAsPrincipal(this.principal(headers), body)); }
    /** @deprecated shared issuer secret; prefer POST /integration/enrollments. */
    @RouteConfig({ bodyLimit: 8192 })
    @Post('enroll')
    enroll(
    @Headers('x-integration-issuer')
    issuer: unknown,
    @Body()
    body: unknown) { return this.call(() => this.intake.enroll(issuer, body)); }
    /** @deprecated shared issuer secret; prefer POST /integration/enrollments/revoke. */
    @RouteConfig({ bodyLimit: 8192 })
    @Post('revoke')
    revoke(
    @Headers('x-integration-issuer')
    issuer: unknown,
    @Body()
    body: unknown) { return this.call(() => this.intake.revoke(issuer, body)); }
    @RouteConfig({ bodyLimit: 8192 })
    @Post('observations')
    append(
    @Headers('authorization')
    auth: unknown,
    @Body()
    body: unknown) { return this.call(() => this.intake.append(auth, body)); }
    /** Headers only: the request body never participates in principal resolution. */
    private principal(headers: Record<string, string | undefined>): AuthContext | null {
        return this.auth.resolve({ headers: { ...headers } });
    }
    private async call<T>(fn: () => Promise<T>): Promise<T> {
        try {
            return await fn();
        }
        catch (e) {
            if (e instanceof IntegrationError)
                throw new HttpException({ code: e.code }, e.status);
            throw new HttpException({ code: 'INTAKE_UNAVAILABLE' }, 503);
        }
    }
}
