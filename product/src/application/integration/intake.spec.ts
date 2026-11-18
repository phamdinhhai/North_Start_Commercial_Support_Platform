import { createHmac } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { IntegrationIntake, validateUpload } from './intake';
import type { IntegrationStore } from '../../ports/integration';
const env = { AIL_RESEARCH_ENABLED: 'true', DEPLOYMENT_MODE: 'test', AIL_ISSUER_SECRET_ENABLED: 'true', AIL_ISSUER_SECRET: 'i'.repeat(32), AIL_SIGNING_SECRET: 's'.repeat(32), AIL_WORKSPACE_ID: 'w', AIL_CONNECTION_ID: 'c', AIL_ACCOUNT_ID: 'a', AIL_PAGE_ID: 'p' };
const scope = { workspaceId: 'w', connectionId: 'c', accountId: 'a', providerSurface: 'pancake-conversations' as const, pageId: 'p' };
const upload = () => ({ captureId: 'capture1', sequence: 1, pageId: 'p', observation: { scope: { workspaceId: 'w', connectionId: 'c', accountId: 'a', providerSurface: 'pancake-conversations' }, captureId: 'capture1', sourceRevision: 'v1', externalEventId: null, externalObjectId: null, eventType: 'pages:update_messages', method: 'browser-websocket', evidenceType: 'client-observed', authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null, observedAt: '2026-11-16T00:00:00Z' } });
const setup = (config: NodeJS.ProcessEnv = env) => { const store = { enroll: vi.fn().mockResolvedValue(undefined), revoke: vi.fn().mockResolvedValue(undefined), append: vi.fn().mockResolvedValue({ continuity: 'UNKNOWN' }) } satisfies IntegrationStore; return { store, svc: new IntegrationIntake(store, config) }; };
describe('research enrollment boundary', () => {
    it('rejects missing authorization, malformed signed JSON and invalid revocation input', async () => {
        const { svc, store } = setup();
        for (const auth of [undefined, '', 'Basic ignored', 'Bearer ' + 'x'.repeat(4096)]) {
            await expect(svc.append(auth, upload())).rejects.toMatchObject({ status: 401 });
        }
        const payload = Buffer.from('{invalid-json').toString('base64url');
        const signature = createHmac('sha256', env.AIL_SIGNING_SECRET).update(payload).digest('base64url');
        await expect(svc.append(`Bearer ${payload}.${signature}`, upload())).rejects.toMatchObject({ status: 401 });
        for (const body of [null, {}, { enrollmentId: 'bad' }, { enrollmentId: 'x', workspaceId: 'other' }]) {
            await expect(svc.revoke(env.AIL_ISSUER_SECRET, body)).rejects.toMatchObject({ status: 400 });
        }
        expect(store.append).not.toHaveBeenCalled();
        expect(store.revoke).not.toHaveBeenCalled();
    });
    it('refuses disabled and production even with valid issuer', async () => {
        await expect(setup({ ...env, AIL_RESEARCH_ENABLED: 'false' }).svc.enroll(env.AIL_ISSUER_SECRET, {})).rejects.toMatchObject({ status: 404 });
        await expect(setup({ ...env, DEPLOYMENT_MODE: 'production' }).svc.enroll(env.AIL_ISSUER_SECRET, {})).rejects.toMatchObject({ status: 503 });
    });
    it('blocks NODE_ENV production and missing deployment explicitly', async () => {
        await expect(setup({ ...env, NODE_ENV: 'production' }).svc.enroll(env.AIL_ISSUER_SECRET, {})).rejects.toMatchObject({ status: 503 });
        await expect(setup({ ...env, DEPLOYMENT_MODE: '' }).svc.enroll(env.AIL_ISSUER_SECRET, {})).rejects.toMatchObject({ status: 503 });
    });
    it('rejects short and reused secrets and missing fixed scope', async () => {
        for (const patch of [{ AIL_ISSUER_SECRET: 'short' }, { AIL_SIGNING_SECRET: env.AIL_ISSUER_SECRET }, { AIL_PAGE_ID: '' }])
            await expect(setup({ ...env, ...patch }).svc.enroll(env.AIL_ISSUER_SECRET, {})).rejects.toMatchObject({ status: 503 });
    });
    it('enforces fifteen minute expiry and the only capability', async () => {
        const { svc, store } = setup();
        const start = Date.now();
        const result = await svc.enroll(env.AIL_ISSUER_SECRET, {});
        expect(Date.parse(result.expiresAt) - start).toBeGreaterThanOrEqual(899000);
        expect(Date.parse(result.expiresAt) - start).toBeLessThanOrEqual(901000);
        expect(result.capability).toBe('observation:append');
        vi.spyOn(Date, 'now').mockReturnValue(start + 901000);
        try {
            await expect(svc.append('Bearer ' + result.token, upload())).rejects.toMatchObject({ status: 401 });
            expect(store.append).not.toHaveBeenCalled();
        }
        finally {
            vi.restoreAllMocks();
        }
    });
    it('rejects signed malformed claims and changed capability', async () => {
        const { svc } = setup();
        for (const claim of [null, {}, { version: 1, capability: 'commercial:write' }]) {
            const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
            const token = payload + '.' + createHmac('sha256', env.AIL_SIGNING_SECRET).update(payload).digest('base64url');
            await expect(svc.append('Bearer ' + token, upload())).rejects.toMatchObject({ status: 401 });
        }
    });
    it('rejects cross page, raw nested fields, unsupported claims and unsafe sequences', () => {
        const value = upload();
        for (const body of [{ ...value, pageId: 'other' }, { ...value, sequence: Number.MAX_SAFE_INTEGER + 1 }, { ...value, observation: { ...value.observation, body: 'private' } }, { ...value, observation: { ...value.observation, authenticity: 'VERIFIED' } }])
            expect(() => validateUpload(body, scope)).toThrow();
    });
    it('refuses client scope selection and invalid issuer', async () => { const { svc, store } = setup(); await expect(svc.enroll('bad', {})).rejects.toMatchObject({ status: 401 }); await expect(svc.enroll(env.AIL_ISSUER_SECRET, { workspaceId: 'other' })).rejects.toMatchObject({ status: 400 }); expect(store.enroll).not.toHaveBeenCalled(); });
    it('issues bounded signed scope and rejects tampering', async () => { const { svc, store } = setup(); const result = await svc.enroll(env.AIL_ISSUER_SECRET, {}); expect(result.scope).toEqual(scope); await svc.append('Bearer ' + result.token, upload()); expect(store.append).toHaveBeenCalledOnce(); await expect(svc.append('Bearer ' + result.token + 'x', upload())).rejects.toMatchObject({ status: 401 }); });
    it('rejects cross tenant and raw field injection before persistence', () => { const value = upload(); value.observation.scope.workspaceId = 'other'; expect(() => validateUpload(value, scope)).toThrow('SCOPE_MISMATCH'); expect(() => validateUpload({ ...upload(), rawCookie: 'never-store' }, scope)).toThrow('INPUT_INVALID'); });
    it('canonicalizes property order but retains sequence/content conflict fingerprint inputs', () => { const first = upload(); const reordered = { ...first, observation: Object.fromEntries(Object.entries(first.observation).reverse()) }; expect(validateUpload(first, scope)).toEqual(validateUpload(reordered, scope)); expect(() => validateUpload({ ...first, sequence: 0 }, scope)).toThrow(); });
    it('does not ACK when persistence fails', async () => { const { svc, store } = setup(); const result = await svc.enroll(env.AIL_ISSUER_SECRET, {}); store.append.mockRejectedValue(new Error('commit failed')); await expect(svc.append('Bearer ' + result.token, upload())).rejects.toThrow('commit failed'); });
    it('revocation requires issuer and accepts only enrollment identity', async () => { const { svc, store } = setup(); await expect(svc.revoke('bad', { enrollmentId: 'x' })).rejects.toMatchObject({ status: 401 }); const result = await svc.enroll(env.AIL_ISSUER_SECRET, {}); await svc.revoke(env.AIL_ISSUER_SECRET, { enrollmentId: result.enrollmentId }); expect(store.revoke).toHaveBeenCalledWith(result.enrollmentId, { issuance: 'issuer-secret', actorId: 'issuer-secret', role: null, workspaceId: 'w' }); });
});
