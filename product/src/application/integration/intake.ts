import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { IntegrationError, type IntegrationScope, type Enrollment, type Upload, type IntegrationStore } from '../../ports/integration';
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9:_./-]{1,256}$/.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const equal = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const fail = (code: string, status = 400): never => { throw new IntegrationError(code, status); };
export class IntegrationIntake {
    constructor(private readonly store: IntegrationStore, private readonly env: NodeJS.ProcessEnv = process.env) { }
    private config() {
        if (this.env.AIL_RESEARCH_ENABLED !== 'true')
            return fail('AIL_DISABLED', 404);
        if (!['local', 'test'].includes(this.env.DEPLOYMENT_MODE ?? '') || this.env.NODE_ENV === 'production')
            return fail('RESEARCH_ONLY', 503);
        const issuer = this.env.AIL_ISSUER_SECRET ?? '', signing = this.env.AIL_SIGNING_SECRET ?? '';
        if (Buffer.byteLength(issuer) < 32 || Buffer.byteLength(signing) < 32 || issuer === signing)
            return fail('AIL_CONFIGURATION', 503);
        const scope: IntegrationScope = { workspaceId: this.env.AIL_WORKSPACE_ID!, connectionId: this.env.AIL_CONNECTION_ID!, accountId: this.env.AIL_ACCOUNT_ID!, pageId: this.env.AIL_PAGE_ID!, providerSurface: 'pancake-conversations' };
        if (!Object.values(scope).every(id))
            return fail('AIL_CONFIGURATION', 503);
        return { issuer, signing, scope };
    }
    private issuer(secret: unknown) { const c = this.config(); if (typeof secret !== 'string' || secret.length > 4096 || !equal(secret, c.issuer))
        fail('UNAUTHORIZED', 401); return c; }
    async enroll(secret: unknown, body: unknown) {
        const c = this.issuer(secret);
        if (!object(body) || Object.keys(body).length)
            fail('EMPTY_BODY_REQUIRED');
        const value: Enrollment = { id: randomUUID(), scope: c.scope, expiresAt: new Date(Date.now() + 900000).toISOString() };
        await this.store.enroll(value);
        const payload = Buffer.from(JSON.stringify({ version: 1, ...value, capability: 'observation:append' })).toString('base64url');
        const token = payload + '.' + createHmac('sha256', c.signing).update(payload).digest('base64url');
        return { token, enrollmentId: value.id, expiresAt: value.expiresAt, scope: value.scope, capability: 'observation:append' };
    }
    async revoke(secret: unknown, body: unknown) {
        this.issuer(secret);
        if (!object(body) || Object.keys(body).join() !== 'enrollmentId' || typeof body.enrollmentId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.enrollmentId))
            fail('INPUT_INVALID');
        await this.store.revoke((body as {
            enrollmentId: string;
        }).enrollmentId);
        return { revoked: true };
    }
    async append(auth: unknown, body: unknown) {
        const c = this.config();
        if (typeof auth !== 'string' || auth.length > 4096 || !auth.startsWith('Bearer '))
            return fail('UNAUTHORIZED', 401);
        const parts = auth.slice(7).split('.');
        if (parts.length !== 2 || !equal(createHmac('sha256', c.signing).update(parts[0]).digest('base64url'), parts[1]))
            return fail('UNAUTHORIZED', 401);
        let claim: Enrollment & {
            version: number;
            capability: string;
        };
        try {
            claim = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
        }
        catch {
            return fail('UNAUTHORIZED', 401);
        }
        if (!object(claim) || claim.version !== 1 || claim.capability !== 'observation:append' || !id(claim.id) || !Number.isFinite(Date.parse(claim.expiresAt)) || Date.parse(claim.expiresAt) <= Date.now() || JSON.stringify(claim.scope) !== JSON.stringify(c.scope))
            return fail('UNAUTHORIZED', 401);
        const upload = validateUpload(body, c.scope);
        const fingerprint = createHash('sha256').update(JSON.stringify(upload)).digest('hex');
        return this.store.append(claim, upload, fingerprint);
    }
}
export function validateUpload(body: unknown, scope: IntegrationScope): Upload {
    if (!object(body) || Object.keys(body).sort().join() !== 'captureId,observation,pageId,sequence' || !id(body.captureId) || !Number.isSafeInteger(body.sequence) || (body.sequence as number) < 1 || body.pageId !== scope.pageId || !object(body.observation))
        return fail('INPUT_INVALID');
    const o = body.observation;
    const keys = ['scope', 'captureId', 'sourceRevision', 'externalEventId', 'externalObjectId', 'eventType', 'method', 'evidenceType', 'authenticity', 'completeness', 'occurredAt', 'observedAt', 'payloadHash'];
    if (Object.keys(o).sort().join() !== [...keys].sort().join() || !object(o.scope) || Object.keys(o.scope).sort().join() !== 'accountId,connectionId,providerSurface,workspaceId')
        return fail('INPUT_INVALID');
    for (const k of ['workspaceId', 'connectionId', 'accountId', 'providerSurface'] as const)
        if (o.scope[k] !== scope[k])
            return fail('SCOPE_MISMATCH', 403);
    if (o.captureId !== body.captureId || !id(o.sourceRevision) || !id(o.eventType) || o.externalEventId !== null || !(o.externalObjectId === null || id(o.externalObjectId)) || o.method !== 'browser-websocket' || o.evidenceType !== 'client-observed' || o.authenticity !== 'UNKNOWN' || o.completeness !== 'UNKNOWN' || o.occurredAt !== null || typeof o.observedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(o.observedAt) || !Number.isFinite(Date.parse(o.observedAt)) || typeof o.payloadHash !== 'string' || !/^[a-f0-9]{64}$/.test(o.payloadHash))
        return fail('INPUT_INVALID');
    // Canonical key order makes property-order-only retries identical. Scope is server-derived.
    const observation: Record<string, unknown> = {};
    for (const key of keys)
        observation[key] = key === 'scope' ? { workspaceId: scope.workspaceId, connectionId: scope.connectionId, accountId: scope.accountId, providerSurface: scope.providerSurface } : o[key];
    return { captureId: body.captureId, sequence: body.sequence as number, pageId: scope.pageId, observation };
}
