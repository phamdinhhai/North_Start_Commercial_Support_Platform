import { IntegrationError, type IntegrationScope } from '../../ports/integration';

export interface SigningKey { kid: string; secret?: string; state: 'active' | 'verify' | 'retired' }

/**
 * Experimental research-intake configuration, re-read per request from the injected
 * environment so operators can rotate keys without a code change. Every malformed or
 * ambiguous setting fails closed with 503; nothing here is echoed to callers or logs.
 * ADR-006 — scope allowlist is a server-side sandbox grant, not a permission matrix.
 */
export const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 4096;
const MAX_JSON_BYTES = 16384;
const MAX_KEYS = 16;
const MAX_SCOPES = 64;
const KID = /^[A-Za-z0-9._-]{1,64}$/;
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_./-]{1,256}$/.test(v);
export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const fail = (code: string, status = 400): never => { throw new IntegrationError(code, status); };
const misconfigured = (): never => fail('AIL_CONFIGURATION', 503);

export interface IntakeConfig {
    /** Legacy shared issuer secret; null unless `AIL_ISSUER_SECRET_ENABLED=true` (A-m6). */
    issuer: string | null;
    keys: SigningKey[];
    active: SigningKey & { secret: string };
    scopes: IntegrationScope[];
}

/** Canonical key order keeps signed claims and comparisons stable. */
export function canonicalScope(s: Pick<IntegrationScope, 'workspaceId' | 'connectionId' | 'accountId' | 'pageId'> & Partial<Pick<IntegrationScope, 'providerSurface' | 'target'>>): IntegrationScope {
    return { workspaceId: s.workspaceId, connectionId: s.connectionId, accountId: s.accountId, providerSurface: s.providerSurface ?? 'pancake-conversations', pageId: s.pageId, ...(s.target ? { target: { ...s.target } } : {}) };
}

function json(raw: string): unknown {
    if (Buffer.byteLength(raw) > MAX_JSON_BYTES) return misconfigured();
    try { return JSON.parse(raw); } catch { return misconfigured(); }
}

const secretOk = (s: unknown): s is string => typeof s === 'string' && Buffer.byteLength(s) >= MIN_SECRET_BYTES && Buffer.byteLength(s) <= MAX_SECRET_BYTES;

/**
 * `AIL_SIGNING_KEYS` = JSON array of `{kid, secret, state}` where state is `active` (exactly one;
 * signs and verifies), `verify` (verifies until retirement) or `retired` (secret omitted; tokens
 * carrying this kid are rejected). Fallback: single `AIL_SIGNING_SECRET` as kid `default`.
 */
function keyring(env: NodeJS.ProcessEnv): SigningKey[] {
    const raw = env.AIL_SIGNING_KEYS, single = env.AIL_SIGNING_SECRET;
    if (raw && single) return misconfigured();
    if (!raw) return secretOk(single) ? [{ kid: 'default', secret: single, state: 'active' }] : misconfigured();
    const list = json(raw);
    if (!Array.isArray(list) || !list.length || list.length > MAX_KEYS) return misconfigured();
    const keys = list.map((k): SigningKey => {
        if (!isObject(k) || typeof k.kid !== 'string' || !KID.test(k.kid)) return misconfigured();
        if (k.state === 'retired') return Object.keys(k).sort().join() === 'kid,state' ? { kid: k.kid, state: 'retired' } : misconfigured();
        if ((k.state !== 'active' && k.state !== 'verify') || Object.keys(k).sort().join() !== 'kid,secret,state' || !secretOk(k.secret)) return misconfigured();
        return { kid: k.kid, secret: k.secret, state: k.state };
    });
    const kids = new Set(keys.map((k) => k.kid));
    const secrets = keys.flatMap((k) => (k.secret ? [k.secret] : []));
    if (kids.size !== keys.length || new Set(secrets).size !== secrets.length || keys.filter((k) => k.state === 'active').length !== 1) return misconfigured();
    return keys;
}

/**
 * `AIL_SCOPE_ALLOWLIST` = JSON array of `{workspaceId, connectionId, accountId, pageId}`.
 * Fallback: the single legacy `AIL_WORKSPACE_ID/AIL_CONNECTION_ID/AIL_ACCOUNT_ID/AIL_PAGE_ID`.
 */
function allowlist(env: NodeJS.ProcessEnv): IntegrationScope[] {
    const legacyKeys = ['AIL_WORKSPACE_ID', 'AIL_CONNECTION_ID', 'AIL_ACCOUNT_ID', 'AIL_PAGE_ID'] as const;
    const raw = env.AIL_SCOPE_ALLOWLIST;
    if (raw && legacyKeys.some((k) => env[k])) return misconfigured();
    const entries: unknown[] = raw ? (() => { const v = json(raw); return Array.isArray(v) ? v : misconfigured(); })()
        : [{ workspaceId: env.AIL_WORKSPACE_ID, connectionId: env.AIL_CONNECTION_ID, accountId: env.AIL_ACCOUNT_ID, pageId: env.AIL_PAGE_ID }];
    if (!entries.length || entries.length > MAX_SCOPES) return misconfigured();
    const scopes = entries.map((e) => {
        const keys = isObject(e) ? Object.keys(e).sort().join() : '';
        if (!isObject(e) || !['accountId,connectionId,pageId,workspaceId', 'accountId,connectionId,pageId,providerSurface,workspaceId', 'accountId,connectionId,pageId,providerSurface,target,workspaceId', 'accountId,connectionId,pageId,target,workspaceId'].includes(keys)) return misconfigured();
        if (![e.workspaceId, e.connectionId, e.accountId, e.pageId].every(isId)) return misconfigured();
        if (e.providerSurface !== undefined && !['pancake-conversations', 'meta-ads', 'hubspot-crm'].includes(e.providerSurface as string)) return misconfigured();
        if (e.target !== undefined && (!isObject(e.target) || Object.keys(e.target).some(k => !['pageId', 'conversationId', 'campaignId', 'adsetId', 'adId', 'contactId', 'companyId', 'dealId'].includes(k)) || Object.values(e.target).some(v => !isId(v)))) return misconfigured();
        return canonicalScope(e as unknown as IntegrationScope);
    });
    if (new Set(scopes.map((s) => JSON.stringify(s))).size !== scopes.length) return misconfigured();
    return scopes;
}

/**
 * ADR-006 (R2-P-08): the deprecated shared issuer-secret path may run ONLY when the deployment is
 * `local` or `test` (and NODE_ENV is not production) AND `AIL_ISSUER_SECRET_ENABLED=true` (exact).
 * Checked independently of the research gate so pilot/production stay closed even if research
 * intake is ever opened there. To be removed once the OIDC path is verified on pilot.
 */
export function issuerSecretPathAllowed(env: NodeJS.ProcessEnv): boolean {
    return ['local', 'test'].includes(env.DEPLOYMENT_MODE ?? '') && env.NODE_ENV !== 'production' && env.AIL_ISSUER_SECRET_ENABLED === 'true';
}

export function loadConfig(env: NodeJS.ProcessEnv): IntakeConfig {
    if (env.AIL_RESEARCH_ENABLED !== 'true')
        return fail('AIL_DISABLED', 404);
    if (!['local', 'test'].includes(env.DEPLOYMENT_MODE ?? '') || env.NODE_ENV === 'production')
        return fail('RESEARCH_ONLY', 503);
    const keys = keyring(env);
    // Deprecated shared issuer secret (A-m6): EXPLICIT opt-in. Enabled only when
    // `AIL_ISSUER_SECRET_ENABLED=true`; unset/empty/`false` = disabled (any configured secret is
    // ignored); any other value is ambiguous → 503. Enabled without a valid secret → 503.
    // ADR-006 (R2-P-08): opted in outside local/test → 503 (fail closed, never silently enabled).
    const toggle = env.AIL_ISSUER_SECRET_ENABLED ?? '';
    if (!['', 'false', 'true'].includes(toggle))
        return misconfigured();
    if (toggle === 'true' && !issuerSecretPathAllowed(env))
        return fail('RESEARCH_ONLY', 503);
    const issuer = toggle === 'true' ? (env.AIL_ISSUER_SECRET ?? '') : null;
    if (issuer !== null && (!secretOk(issuer) || keys.some((k) => k.secret === issuer)))
        return misconfigured();
    const active = keys.find((k): k is SigningKey & { secret: string } => k.state === 'active' && !!k.secret)!;
    return { issuer, keys, active, scopes: allowlist(env) };
}
