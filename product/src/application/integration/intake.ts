import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AuthContext } from '../../ports/auth';
import type { Enrollment, EnrollmentActor, IntegrationScope, IntegrationStore } from '../../ports/integration';
import { fail, isId, isObject, loadConfig, type IntakeConfig } from './config';
import { CAPABILITY, sign, verify } from './token';
import { validateUpload } from './upload-validation';
import { validateHybridUpload } from './hybrid-upload';
import {receiptEnvelope} from './hybrid-envelope';
import {reconcileHybridSources, type HybridObservationEnvelope} from '../../ports/hybrid-observation';
import type {HybridFixtureReader} from '../../ports/hybrid-fixture-reader';
export { validateUpload } from './upload-validation';

const TTL_MS = 900000;
const SELECTORS = ['connectionId', 'accountId', 'pageId'] as const;
const equal = (a: string, b: string) => Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
// Actor ids may be IdP subjects or emails; only bound length and refuse control characters.
const actorId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v);
const ISSUER_ACTOR: EnrollmentActor = { issuance: 'issuer-secret', actorId: 'issuer-secret', role: null };

export class IntegrationIntake {
    constructor(private readonly store: IntegrationStore, private readonly env: NodeJS.ProcessEnv = process.env) { }

    /**
     * DEPRECATED shared issuer secret. Disabled unless `AIL_ISSUER_SECRET_ENABLED=true` (explicit
     * opt-in, A-m6); a disabled path is indistinguishable from a missing route (404).
     */
    private issuer(secret: unknown): IntakeConfig {
        const c = loadConfig(this.env);
        if (c.issuer === null)
            return fail('ISSUER_PATH_DISABLED', 404);
        if (typeof secret !== 'string' || secret.length > 4096 || !equal(secret, c.issuer))
            return fail('UNAUTHORIZED', 401);
        return c;
    }

    /**
     * ADR-006 capability matrix: "Enrollment connector issue/revoke" = admin of the
     * server-resolved workspace ONLY (manager → 403). Demo principals are never privileged.
     */
    private principal(ctx: AuthContext | null): AuthContext & { role: 'admin' } {
        if (!ctx || !actorId(ctx.userId) || !isId(ctx.workspaceId))
            return fail('UNAUTHORIZED', 401);
        if (ctx.isDemo || ctx.role !== 'admin')
            return fail('FORBIDDEN', 403);
        return ctx as AuthContext & { role: 'admin' };
    }

    private async issue(c: IntakeConfig, scope: IntegrationScope, actor: EnrollmentActor) {
        const value: Enrollment = { id: randomUUID(), scope, expiresAt: new Date(Date.now() + TTL_MS).toISOString() };
        await this.store.enroll(value, { ...actor, kid: c.active.kid });
        const token = sign(value, c.active);
        return { token, enrollmentId: value.id, expiresAt: value.expiresAt, scope: value.scope, capability: CAPABILITY };
    }

    async enroll(secret: unknown, body: unknown) {
        const c = this.issuer(secret);
        if (!isObject(body) || Object.keys(body).length)
            fail('EMPTY_BODY_REQUIRED');
        if (c.scopes.length !== 1)
            fail('SCOPE_AMBIGUOUS');
        return this.issue(c, c.scopes[0], ISSUER_ACTOR);
    }

    /**
     * Workspace comes only from the resolved AuthContext. The body may narrow among
     * server-allowlisted scopes for that workspace by connection/account/page; it can never
     * name a workspace or introduce a scope that is not configured server-side.
     */
    async enrollAsPrincipal(ctx: AuthContext | null, body: unknown) {
        const c = loadConfig(this.env);
        const p = this.principal(ctx);
        if (!isObject(body))
            return fail('INPUT_INVALID');
        if ('workspaceId' in body)
            return fail('WORKSPACE_FROM_CONTEXT');
        const keys = Object.keys(body);
        if (keys.some((k) => !(SELECTORS as readonly string[]).includes(k)) || !keys.every((k) => isId(body[k])))
            return fail('INPUT_INVALID');
        const matches = c.scopes.filter((s) => s.workspaceId === p.workspaceId && SELECTORS.every((k) => body[k] === undefined || body[k] === s[k]));
        if (!matches.length)
            return fail('SCOPE_NOT_ALLOWED', 403);
        if (matches.length > 1)
            return fail('SCOPE_AMBIGUOUS');
        return this.issue(c, matches[0], { issuance: 'principal', actorId: p.userId, role: p.role });
    }

    private enrollmentId(body: unknown): string {
        if (!isObject(body) || Object.keys(body).join() !== 'enrollmentId' || typeof body.enrollmentId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.enrollmentId))
            return fail('INPUT_INVALID');
        return body.enrollmentId;
    }

    /**
     * DEPRECATED. A-m6: the shared secret is a deployment-level credential whose only workspace
     * binding is the server scope allowlist, so revocation is bound to the single workspace that
     * allowlist names (an enrollment of any other workspace answers 404 like a missing id). An
     * allowlist spanning several workspaces cannot bind the secret → 400 SCOPE_AMBIGUOUS; use the
     * principal route. Never `workspaceId: null` (cross-workspace) any more.
     */
    async revoke(secret: unknown, body: unknown) {
        const c = this.issuer(secret);
        const id = this.enrollmentId(body);
        const workspaces = [...new Set(c.scopes.map((s) => s.workspaceId))];
        if (workspaces.length !== 1)
            return fail('SCOPE_AMBIGUOUS');
        await this.store.revoke(id, { ...ISSUER_ACTOR, workspaceId: workspaces[0] });
        return { revoked: true };
    }

    /** Immediate revocation by an admin of the enrollment's own workspace (ADR-006). */
    async revokeAsPrincipal(ctx: AuthContext | null, body: unknown) {
        loadConfig(this.env);
        const p = this.principal(ctx);
        await this.store.revoke(this.enrollmentId(body), { issuance: 'principal', actorId: p.userId, role: p.role, workspaceId: p.workspaceId });
        return { revoked: true };
    }

    async append(auth: unknown, body: unknown, expectedEnrollmentId?: string) {
        const claim = verify(auth, loadConfig(this.env));
        if(claim.scope.target)return fail('HYBRID_ROUTE_REQUIRED',403);
        if (expectedEnrollmentId !== undefined && (typeof expectedEnrollmentId !== 'string' || claim.id !== expectedEnrollmentId)) return fail('ENROLLMENT_MISMATCH', 401);
        const upload = validateUpload(body, claim.scope);
        const fingerprint = createHash('sha256').update(JSON.stringify(upload)).digest('hex');
        return this.store.append({ id: claim.id, scope: claim.scope, expiresAt: claim.expiresAt }, upload, fingerprint);
    }
    async appendHybrid(auth:unknown,body:unknown) {
        if(this.env.HYBRID_FIXTURE_ENABLED!=='true')return fail('HYBRID_DISABLED',404);
        const claim=verify(auth,loadConfig(this.env));
        const upload=validateHybridUpload(body,claim);
        const fingerprint=createHash('sha256').update(JSON.stringify(upload)).digest('hex');
        return this.store.append({id:claim.id,scope:claim.scope,expiresAt:claim.expiresAt},upload,fingerprint);
    }
    private hybridClaim(auth:unknown) {
        if(this.env.HYBRID_FIXTURE_ENABLED!=='true')return fail('HYBRID_DISABLED',404);
        const claim=verify(auth,loadConfig(this.env));
        if(!claim.scope.target||Object.values(claim.scope.target).some(v=>!v.startsWith('fixture-')))return fail('FIXTURE_TARGET_REQUIRED',403);
        return claim;
    }
    /** API observations are built from a server-owned reader, never client authority fields. */
    async appendHybridProvider(auth:unknown,body:unknown,reader:HybridFixtureReader) {
        const claim=this.hybridClaim(auth);
        if(!isObject(body)||Object.keys(body).sort().join()!=='captureId,enrollmentId,sequence'||body.enrollmentId!==claim.id||!isId(body.captureId)||!Number.isSafeInteger(body.sequence)||(body.sequence as number)<1)return fail('INPUT_INVALID');
        if(!this.store.readHybrid)return fail('HYBRID_READ_UNAVAILABLE',503);
        const prior=await this.store.readHybrid(claim); // revalidate principal before credential use
        const existing=prior.find(u=>u.captureId===body.captureId);
        if(existing) {
            if(existing.sequence!==body.sequence||existing.observation.method!=='official-api')return fail('RECEIPT_CONFLICT',409);
            return this.store.append(claim,existing,createHash('sha256').update(JSON.stringify(existing)).digest('hex'));
        }
        const result=await reader.read(claim.scope);
        if(result.native.accountId!==claim.scope.accountId||Object.entries(claim.scope.target!).some(([k,v])=>result.native[k]!==v))return fail('TARGET_SCOPE_MISMATCH',403);
        const upload={captureId:body.captureId,sequence:body.sequence as number,pageId:claim.scope.pageId,observation:{method:'official-api',fixture:true,sourceAuthority:'synthetic_fixture',observedAt:new Date().toISOString(),native:result.native,...(result.facts?{facts:result.facts}:{}),hybridEnvelope:{} as HybridObservationEnvelope}};
        upload.observation.hybridEnvelope=receiptEnvelope(claim,upload,'official_api');
        return this.store.append(claim,upload,createHash('sha256').update(JSON.stringify(upload)).digest('hex'));
    }
    async reconcileHybrid(auth:unknown) {
        const claim=this.hybridClaim(auth);
        if(!this.store.readHybrid)return fail('HYBRID_READ_UNAVAILABLE',503);
        const receipts=await this.store.readHybrid(claim,true);
        const envelopes=receipts.map(u=>u.observation.hybridEnvelope).filter(Boolean) as HybridObservationEnvelope[];
        return reconcileHybridSources(envelopes,claim.scope);
    }
}
