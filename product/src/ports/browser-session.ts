import type { AuthContext } from './auth';

export type BrowserHeaders = Record<string, string | string[] | undefined>;
export interface BrowserSessionView {
  readonly authenticated: boolean;
  readonly loginAvailable: boolean;
  readonly devTokensAllowed?: boolean;
  readonly context?: AuthContext;
  readonly csrfToken?: string;
  readonly expiresAt?: string;
}
export interface BrowserLoginStart { readonly location: string; readonly cookies: readonly string[] }
export type BrowserSessionPreparation = { readonly kind: 'none' | 'session' }
  | { readonly kind: 'rejected'; readonly status: 400 | 401 | 403; readonly code: string };
export interface BrowserSessionPort {
  readonly enabled: boolean;
  begin(workspace?: string): BrowserLoginStart;
  complete(query: { code?: string; state?: string; error?: string }, headers: BrowserHeaders): Promise<BrowserLoginStart>;
  prepare(headers: BrowserHeaders, method: string): BrowserSessionPreparation;
  view(headers: BrowserHeaders, context: AuthContext | null): BrowserSessionView;
  logout(headers: BrowserHeaders): string;
}
export const BROWSER_SESSION = Symbol('BROWSER_SESSION');
export class BrowserSessionError extends Error {
  constructor(readonly code: string, readonly status: number = 400) { super(code); this.name = 'BrowserSessionError'; }
}
