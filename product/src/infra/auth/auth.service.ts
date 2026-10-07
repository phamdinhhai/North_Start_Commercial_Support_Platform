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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Resolve auth context from request.
   * - Demo: cho phép không cần token (header x-demo-workspace).
   * - Non-demo: yêu cầu Authorization: Bearer <token> hoặc x-bootstrap-token (one-time env).
   * Không đọc email/workspace từ body để cấp quyền.
   */
  resolve(req: AuthRequestLike): AuthContext | null {
    const demoWs = req.headers['x-demo-workspace'] ?? req.query?.['demoWorkspace'];
    if (demoWs) {
      return { workspaceId: demoWs, userId: 'demo', role: 'viewer', isDemo: true };
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
