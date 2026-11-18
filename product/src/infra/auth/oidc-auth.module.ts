import { Global, Inject, Logger, Module, type NestModule } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyAdapter } from '@nestjs/platform-fastify';
import { MEMBERSHIP_STORE, VERIFIED_CONTEXT_LOOKUP, type MembershipStore } from '../../ports/auth';
import { InMemoryMembershipStore } from '../membership/in-memory-membership.store';
import { PgMembershipStore } from '../membership/pg-membership.store';
import { PostgresService, resolvePilotStoreMode } from '../postgres/postgres.service';
import { httpJwksFetcher, JwksKeyStore } from './jwks-key-store';
import { OidcAuthenticator, type OidcDecision } from './oidc-authenticator';
import { loadOidcConfig, resolveAuthMode } from './oidc-config';
import { OidcTokenVerifier } from './oidc-token-verifier';
import { VerifiedContextRegistry } from './verified-context-registry';

/**
 * Experimental OIDC wiring (AUTH_MODE=oidc; default legacy = no behaviour change).
 * Bootstrap fails closed on any OIDC misconfiguration. In OIDC mode an `onRequest` hook
 * verifies the bearer token + server-side membership and attaches the resulting context to the
 * request; `AuthService.resolve` then reads it synchronously.
 * // OPEN: PM-1 — identity/membership only; no capability matrix or new authority.
 */
export const OIDC_AUTHENTICATOR = Symbol('OIDC_AUTHENTICATOR');

export function createOidcAuthenticator(store: MembershipStore, env: NodeJS.ProcessEnv = process.env): OidcAuthenticator | null {
  if (resolveAuthMode(env) !== 'oidc') return null;
  const config = loadOidcConfig(env);
  const keys = new JwksKeyStore(httpJwksFetcher(config.jwksUri), {
    cacheMaxAgeMs: config.jwksCacheMaxAgeMs,
    refetchCooldownMs: config.jwksRefetchCooldownMs,
  });
  return new OidcAuthenticator(new OidcTokenVerifier(config, keys), store);
}

/** Maps a decision to an early HTTP reply; `null` = continue (controllers still enforce 401). */
export function earlyReply(decision: OidcDecision): { status: number; body: Record<string, unknown> } | null {
  if (decision.kind === 'forbidden') {
    return { status: 403, body: { statusCode: 403, code: 'WORKSPACE_MEMBERSHIP_REQUIRED', message: 'forbidden' } };
  }
  if (decision.kind === 'invalid_request') {
    return { status: 400, body: { statusCode: 400, code: 'INPUT_INVALID', message: 'x-workspace-id is invalid' } };
  }
  return null;
}

@Global()
@Module({
  providers: [
    VerifiedContextRegistry,
    { provide: VERIFIED_CONTEXT_LOOKUP, useExisting: VerifiedContextRegistry },
    {
      provide: MEMBERSHIP_STORE,
      inject: [PostgresService],
      useFactory: (db: PostgresService): MembershipStore => {
        // Legacy mode never consults memberships; avoid touching store selection at all.
        if (resolveAuthMode() !== 'oidc') return new InMemoryMembershipStore();
        return resolvePilotStoreMode() === 'postgres' ? new PgMembershipStore(db) : new InMemoryMembershipStore();
      },
    },
    {
      provide: OIDC_AUTHENTICATOR,
      inject: [MEMBERSHIP_STORE],
      useFactory: (store: MembershipStore) => createOidcAuthenticator(store),
    },
  ],
  exports: [VERIFIED_CONTEXT_LOOKUP, MEMBERSHIP_STORE],
})
export class OidcAuthModule implements NestModule {
  private readonly logger = new Logger(OidcAuthModule.name);

  constructor(
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost<FastifyAdapter>,
    @Inject(OIDC_AUTHENTICATOR) private readonly authenticator: OidcAuthenticator | null,
    @Inject(VerifiedContextRegistry) private readonly registry: VerifiedContextRegistry,
  ) {}

  configure(): void {
    const authenticator = this.authenticator;
    if (!authenticator) return; // legacy mode: no hook, no behaviour change
    this.adapterHost.httpAdapter.getInstance().addHook('onRequest', async (request, reply) => {
      let decision: OidcDecision;
      try {
        decision = await authenticator.authenticate(request.raw.headers);
      } catch (error) {
        // Store/IdP failure: no context → protected routes answer 401. Never log the token.
        this.logger.warn(`OIDC authentication error: ${error instanceof Error ? error.name : 'unknown'}`);
        return;
      }
      if (decision.kind === 'authenticated') {
        this.registry.attach(request.raw.headers, decision.context);
        return;
      }
      if (decision.kind === 'unauthenticated') this.logger.debug(`OIDC rejected: ${decision.reason}`);
      const early = earlyReply(decision);
      if (early) return reply.code(early.status).send(early.body);
    });
  }
}
