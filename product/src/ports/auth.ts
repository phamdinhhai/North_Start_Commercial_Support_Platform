export type AuthRole = 'admin' | 'manager' | 'sales' | 'viewer';

export interface AuthContext {
  workspaceId: string;
  userId: string;
  role: AuthRole;
  isDemo: boolean;
}

export interface AuthRequestLike {
  headers: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
}

export interface AuthContextResolver {
  resolve(request: AuthRequestLike): AuthContext | null;
}

export const AUTH_CONTEXT_RESOLVER = Symbol('AUTH_CONTEXT_RESOLVER');
