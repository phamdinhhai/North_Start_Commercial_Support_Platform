import { randomBytes, createHash } from 'node:crypto';
import { BrowserSessionError, type BrowserHeaders, type BrowserSessionPort, type BrowserSessionPreparation } from '../../ports/browser-session';
import type { AuthContext } from '../../ports/auth';
import { developmentTokensAllowed, type BrowserSessionConfig } from './browser-session-config';
import { codeExchange, digestOpaque, equalOpaque, type BrowserCodeExchange } from './browser-session-protocol';
import type { OidcAuthenticator } from './oidc-authenticator';

interface LoginTransaction { readonly binding: string; readonly verifier: string; readonly nonce: string; readonly expires: number; readonly workspace?: string }
interface Session { readonly token: string; readonly csrf: string; readonly expires: number; readonly workspace: string }
const opaque = () => randomBytes(32).toString('base64url');
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const SESSION_COOKIE = 'north_session';
export const LOGIN_COOKIE = 'north_login';

/** Process-local sessions for the single-instance LVP. Membership is still verified on every request. */
export class BrowserSessionService implements BrowserSessionPort {
  private readonly transactions = new Map<string, LoginTransaction>();
  private readonly sessions = new Map<string, Session>();
  private readonly exchange: BrowserCodeExchange | null;
  readonly enabled: boolean;

  constructor(private readonly config: BrowserSessionConfig | null, private readonly authenticator: OidcAuthenticator | null,
    exchange?: BrowserCodeExchange, private readonly now: () => number = Date.now) {
    this.enabled = config !== null && authenticator !== null;
    this.exchange = config ? exchange ?? codeExchange(config) : null;
  }

  begin(workspace?: string) {
    const config = this.requireConfig(); this.prune();
    if (workspace !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(workspace)) throw new BrowserSessionError('WORKSPACE_INVALID');
    if (this.transactions.size >= 200) throw new BrowserSessionError('LOGIN_BUSY', 429);
    const state = opaque(), binding = opaque(), verifier = opaque(), nonce = opaque();
    this.transactions.set(digestOpaque(state), { binding: digestOpaque(binding), verifier, nonce,
      expires: this.now() + 5 * 60_000, ...(workspace ? { workspace } : {}) });
    const target = new URL(config.authorizationEndpoint);
    target.search = new URLSearchParams({ response_type: 'code', client_id: config.clientId, redirect_uri: config.redirectUri,
      scope: 'openid', state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
    return { location: target.href, cookies: [this.cookie(LOGIN_COOKIE, binding, 300)] };
  }

  async complete(query: { code?: string; state?: string; error?: string }, headers: BrowserHeaders) {
    const config = this.requireConfig(); this.prune();
    const state = typeof query.state === 'string' && OPAQUE.test(query.state) ? query.state : '';
    const key = digestOpaque(state), transaction = this.transactions.get(key);
    this.transactions.delete(key); // One attempt only, including failed token exchanges.
    const binding = cookieValue(headers, LOGIN_COOKIE);
    if (!transaction || !binding || !equalOpaque(transaction.binding, digestOpaque(binding)) || transaction.expires <= this.now() ||
        query.error !== undefined || typeof query.code !== 'string' || query.code.length < 1 || query.code.length > 2048 ||
        /[\u0000-\u0020\u007f]/.test(query.code)) throw new BrowserSessionError('LOGIN_STATE_INVALID', 401);
    let tokens;
    try { tokens = await this.exchange!(query.code, transaction.verifier, transaction.nonce); }
    catch { throw new BrowserSessionError('LOGIN_EXCHANGE_FAILED', 401); }
    const decision = await this.authenticator!.authenticate({ authorization: `Bearer ${tokens.accessToken}`,
      ...(transaction.workspace ? { 'x-workspace-id': transaction.workspace } : {}) });
    if (decision.kind !== 'authenticated') throw new BrowserSessionError('LOGIN_MEMBERSHIP_REQUIRED', 403);
    if (this.sessions.size >= 1000) throw new BrowserSessionError('LOGIN_BUSY', 429);
    const expires = Math.min(tokens.expiresAt, this.now() + 900_000);
    if (expires <= this.now()) throw new BrowserSessionError('LOGIN_EXPIRED', 401);
    const id = opaque();
    this.sessions.set(digestOpaque(id), { token: tokens.accessToken, csrf: opaque(), expires, workspace: decision.context.workspaceId });
    return { location: `${config.origin}/v1/operator`, cookies: [this.cookie(LOGIN_COOKIE, '', 0),
      this.cookie(SESSION_COOKIE, id, Math.max(1, Math.floor((expires - this.now()) / 1000)))] };
  }

  prepare(headers: BrowserHeaders, method: string): BrowserSessionPreparation {
    if (!this.enabled) return { kind: 'none' };
    const id = cookieValue(headers, SESSION_COOKIE);
    if (!id && typeof headers.cookie === 'string' && headers.cookie.split(';').some(part => part.trim().startsWith(`${SESSION_COOKIE}=`))) {
      return { kind: 'rejected', status: 400, code: 'SESSION_COOKIE_INVALID' };
    }
    if (!id) return { kind: 'none' };
    const session = this.lookup(id);
    if (!session) return { kind: 'rejected', status: 401, code: 'SESSION_EXPIRED' };
    if (headers.authorization !== undefined || headers['x-demo-workspace'] !== undefined ||
        (headers['x-workspace-id'] !== undefined && headers['x-workspace-id'] !== session.workspace)) {
      return { kind: 'rejected', status: 400, code: 'AMBIGUOUS_AUTHENTICATION' };
    }
    if (!SAFE_METHODS.has(method.toUpperCase()) && (headers.origin !== this.config!.origin ||
        typeof headers['x-csrf-token'] !== 'string' || !equalOpaque(session.csrf, headers['x-csrf-token']))) {
      return { kind: 'rejected', status: 403, code: 'CSRF_REQUIRED' };
    }
    headers.authorization = `Bearer ${session.token}`;
    headers['x-workspace-id'] = session.workspace;
    return { kind: 'session' };
  }

  view(headers: BrowserHeaders, context: AuthContext | null) {
    const id = cookieValue(headers, SESSION_COOKIE), session = id ? this.lookup(id) : undefined;
    if (!session || !context || context.workspaceId !== session.workspace) return { authenticated: false, loginAvailable: this.enabled,
      devTokensAllowed: developmentTokensAllowed() };
    return { authenticated: true, loginAvailable: this.enabled, context: { ...context }, csrfToken: session.csrf,
      expiresAt: new Date(session.expires).toISOString() };
  }

  logout(headers: BrowserHeaders): string {
    const id = cookieValue(headers, SESSION_COOKIE);
    if (id) this.sessions.delete(digestOpaque(id));
    return this.cookie(SESSION_COOKIE, '', 0);
  }

  private lookup(id: string) {
    const key = digestOpaque(id), session = this.sessions.get(key);
    if (session && session.expires <= this.now()) { this.sessions.delete(key); return undefined; }
    return session;
  }
  private prune() {
    for (const [key, value] of this.transactions) if (value.expires <= this.now()) this.transactions.delete(key);
    for (const [key, value] of this.sessions) if (value.expires <= this.now()) this.sessions.delete(key);
  }
  private requireConfig(): BrowserSessionConfig {
    if (!this.enabled || !this.config) throw new BrowserSessionError('LOGIN_NOT_CONFIGURED', 503);
    return this.config;
  }
  private cookie(name: string, value: string, maxAge: number) {
    return `${name}=${value}; Path=/v1; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.config?.secure ? '; Secure' : ''}`;
  }
}

function cookieValue(headers: BrowserHeaders, name: string): string | undefined {
  if (typeof headers.cookie !== 'string' || headers.cookie.length > 8192) return undefined;
  const found = headers.cookie.split(';').map(p => p.trim()).filter(p => p.startsWith(`${name}=`));
  if (found.length !== 1) return undefined;
  const value = found[0].slice(name.length + 1);
  return OPAQUE.test(value) ? value : undefined;
}
