import { Injectable, Logger } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { AuthContext, AuthRequestLike, AuthRole, AuthContextResolver } from '../../ports/auth';
export type { AuthContext, AuthRequestLike, AuthRole } from '../../ports/auth';

/**
 * Auth stub — PH3 T3-03 (1-A).
 * Demo vs non-demo, reject unauthenticated non-demo.
 * KHÔNG phát token từ email/workspace caller gửi (QA-28).
 * // OPEN: PM-1 — invite one-use/expiring, password/SSO thật chờ RFC; hiện chỉ bootstrap stub.
 */
/** Demo workspace names are sandboxed so the header can never address a real tenant (P1 review). */
const DEMO_PREFIX = 'demo:';
const MAX_TOKEN_BYTES = 4096;
const MAX_BOOTSTRAP_TOKEN_BYTES = 4096;
const UNSIGNED_TOKEN_ROLES = new Set<AuthRole>(['sales', 'viewer']);
const sanitizeDemoName = (raw: string): string => raw.slice(0, 48).replace(/[^a-zA-Z0-9._-]/g, '_');

function asSingleHeader(value: string | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

@Injectable()
export class AuthService implements AuthContextResolver {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Resolve auth context from request.
   * - Demo: `x-demo-workspace` — DEMO-ONLY and OPT-IN (`DEMO_WORKSPACES=true`). The value is a
   *   SANDBOX LABEL, not a workspace selector: it always resolves to `demo:<name>`, so a caller
   *   cannot read or write a real tenant's case by guessing that tenant's id. Flag off by
   *   default → a deployment that forgets it simply has no demo path (fail closed).
   * - Non-demo: yêu cầu Authorization: Bearer <token> hoặc x-bootstrap-token (one-time env).
   * Không đọc email/workspace từ body để cấp quyền.
   */
  resolve(req: AuthRequestLike): AuthContext | null {
    const demoWs = req.headers['x-demo-workspace'] ?? req.query?.['demoWorkspace'];
    if (demoWs !== undefined && demoWs !== '') {
      if (process.env.DEMO_WORKSPACES !== 'true') {
        this.logger.warn('demo header presented while DEMO_WORKSPACES is not enabled — treated as unauthenticated');
        return null;
      }
      const sandbox = `${DEMO_PREFIX}${sanitizeDemoName(demoWs) || 'anon'}`;
      return { workspaceId: sandbox, userId: `${sandbox}:viewer`, role: 'viewer', isDemo: true };
    }
    const auth = asSingleHeader(req.headers['authorization'] ?? req.headers['Authorization']);
    const bootstrap = asSingleHeader(req.headers['x-bootstrap-token']);
    const expectedBootstrap = process.env.BOOTSTRAP_TOKEN;
    // Bootstrap is deliberately narrow: an explicit, bounded secret is required. It is
    // still a PM-1 seed hook, not a general session or credential model.
    if (
      expectedBootstrap &&
      expectedBootstrap.length <= MAX_BOOTSTRAP_TOKEN_BYTES &&
      bootstrap &&
      bootstrap.length <= MAX_BOOTSTRAP_TOKEN_BYTES &&
      safeEqual(bootstrap, expectedBootstrap)
    ) {
      return { workspaceId: 'bootstrap', userId: 'bootstrap-admin', role: 'admin', isDemo: false };
    }
    if (auth !== undefined) {
      // Only the exact Bearer scheme is accepted; malformed auth must not fall through.
      if (!/^Bearer\s/.test(auth) || !/^Bearer\s+[^\s]+$/.test(auth)) return null;
      const token = auth.slice(7).trim();
      // Unsigned tokens are strictly test/development-only and intentionally cannot grant
      // privileged roles. PM-1 must define signed credentials before broader roles exist.
      const deployment = (process.env.DEPLOYMENT_MODE ?? process.env.APP_MODE ?? process.env.NODE_ENV ?? 'local').trim().toLowerCase();
      if (process.env.AUTH_DEV_UNSIGNED_TOKENS !== 'true' || token.length > MAX_TOKEN_BYTES ||
          !['local', 'development', 'dev', 'test', 'demo'].includes(deployment) || process.env.NODE_ENV === 'production') return null;
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as Record<string, unknown>;
        if (!isNonEmptyString(decoded.workspaceId) || !isNonEmptyString(decoded.userId)) return null;
        const role = decoded.role === undefined ? 'sales' : decoded.role;
        if (typeof role !== 'string' || !UNSIGNED_TOKEN_ROLES.has(role as AuthRole)) return null;
        return {
          workspaceId: decoded.workspaceId,
          userId: decoded.userId,
          role: role as AuthRole,
          isDemo: false,
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  isAuthenticated(ctx: AuthContext | null, isDemoRoute: boolean): boolean {
    if (isDemoRoute) return true;
    return ctx !== null;
  }
}
