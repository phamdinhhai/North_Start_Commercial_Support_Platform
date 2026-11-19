import { resolveDeploymentMode } from '../postgres/postgres.service';
import { loadOidcConfig, resolveAuthMode, type OidcConfig } from './oidc-config';

export interface BrowserSessionConfig {
  readonly oidc: OidcConfig;
  readonly origin: string;
  readonly authorizationEndpoint: string;
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly secure: boolean;
}
export function developmentTokensAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    return resolveAuthMode(env) === 'legacy' && env.AUTH_DEV_UNSIGNED_TOKENS === 'true' && env.NODE_ENV !== 'production' &&
      ['local', 'test', 'demo'].includes(resolveDeploymentMode(env));
  } catch { return false; }
}
export function loadBrowserSessionConfig(env: NodeJS.ProcessEnv = process.env): BrowserSessionConfig | null {
  const enabled = env.OIDC_BROWSER_ENABLED ?? '';
  if (!['', 'false', 'true'].includes(enabled)) throw new Error('Invalid OIDC_BROWSER_ENABLED');
  if (enabled !== 'true') return null;
  if (resolveAuthMode(env) !== 'oidc') throw new Error('Browser login requires AUTH_MODE=oidc');
  const mode = resolveDeploymentMode(env);
  const local = mode === 'local' || mode === 'test';
  const endpoint = (name: string): URL => {
    let url: URL;
    try { url = new URL(env[name] ?? ''); } catch { throw new Error(`Invalid ${name}`); }
    const loopback = local && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!loopback && url.protocol !== 'https:') || url.username || url.password || url.hash) throw new Error(`Invalid ${name}`);
    return url;
  };
  const origin = endpoint('OIDC_BROWSER_ORIGIN');
  if (origin.pathname !== '/' || origin.search) throw new Error('OIDC_BROWSER_ORIGIN must be an origin');
  const authorization = endpoint('OIDC_AUTHORIZATION_ENDPOINT');
  const token = endpoint('OIDC_TOKEN_ENDPOINT');
  if (authorization.search || token.search) throw new Error('OIDC browser endpoints must not contain query parameters');
  const clientId = env.OIDC_CLIENT_ID ?? '';
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(clientId)) throw new Error('Invalid OIDC_CLIENT_ID');
  return Object.freeze({ oidc: loadOidcConfig(env), origin: origin.origin, authorizationEndpoint: authorization.href,
    tokenEndpoint: token.href, clientId, redirectUri: `${origin.origin}/v1/auth/callback`, secure: origin.protocol === 'https:' });
}
