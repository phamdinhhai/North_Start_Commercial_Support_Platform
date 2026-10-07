import { Injectable, Logger } from '@nestjs/common';

/**
 * Auth stub — PH3 T3-03 (1-A).
 * Demo vs non-demo, reject unauthenticated non-demo.
 * KHÔNG phát token từ email/workspace caller gửi (QA-28).
 * // OPEN: PM-1 — invite one-use/expiring, password/SSO thật chờ RFC; hiện chỉ bootstrap stub.
 */
export interface AuthContext {
  workspaceId: string;
  userId: string;
  role: string;
  isDemo: boolean;
}

export interface AuthRequestLike {
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

/** Demo workspace names are sandboxed so the header can never address a real tenant (P1 review). */
const DEMO_PREFIX = 'demo:';
const sanitizeDemoName = (raw: string): string => raw.slice(0, 48).replace(/[^a-zA-Z0-9._-]/g, '_');

@Injectable()
export class AuthService {
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
    const auth = req.headers['authorization'] ?? req.headers['Authorization'];
    const bootstrap = req.headers['x-bootstrap-token'];
    const expectedBootstrap = process.env.BOOTSTRAP_TOKEN;
    if (expectedBootstrap && bootstrap === expectedBootstrap) {
      // One-time bootstrap — seed admin, phải rotate sau bootstrap (PM-1)
      return { workspaceId: 'bootstrap', userId: 'bootstrap-admin', role: 'admin', isDemo: false };
    }
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7).trim();
      if (!token) return null;
      // Token unsigned → ai cũng giả mạo được (kể cả role admin). Chỉ nhận khi bật cờ dev tường minh.
      if (process.env.AUTH_DEV_UNSIGNED_TOKENS !== 'true') return null;
      // Stub: token = base64 json {workspaceId,userId,role} — thay bằng JWT verify ở RFC PM-1
      try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8')) as Partial<AuthContext>;
        if (!decoded.workspaceId || !decoded.userId) return null;
        return {
          workspaceId: decoded.workspaceId,
          userId: decoded.userId,
          role: (decoded.role as string) ?? 'sales',
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
