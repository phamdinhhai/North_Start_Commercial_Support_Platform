import { randomBytes } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { IntegrationIntake } from './intake';
import { issuerSecretPathAllowed } from './config';
import type { AuthContext } from '../../ports/auth';
import type { IntegrationStore } from '../../ports/integration';

const secret = () => randomBytes(32).toString('base64url');
const [k1, k2, issuer] = [secret(), secret(), secret()];
const allow = [
    { workspaceId: 'ws-a', connectionId: 'c1', accountId: 'a1', pageId: 'p1' },
    { workspaceId: 'ws-a', connectionId: 'c1', accountId: 'a1', pageId: 'p2' },
    { workspaceId: 'ws-b', connectionId: 'c9', accountId: 'a9', pageId: 'p9' },
];
const keys = (...k: unknown[]) => JSON.stringify(k);
const base: NodeJS.ProcessEnv = { AIL_RESEARCH_ENABLED: 'true', DEPLOYMENT_MODE: 'test', AIL_SCOPE_ALLOWLIST: JSON.stringify(allow), AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: k1, state: 'active' }) };
const who = (role: AuthContext['role'], workspaceId = 'ws-a', isDemo = false): AuthContext => ({ workspaceId, userId: `${role}-user`, role, isDemo });
const upload = (pageId: string, workspaceId = 'ws-a') => { const s = allow.find((a) => a.workspaceId === workspaceId)!; return { captureId: 'cap', sequence: 1, pageId, observation: { scope: { workspaceId, connectionId: s.connectionId, accountId: s.accountId, providerSurface: 'pancake-conversations' }, captureId: 'cap', sourceRevision: 'v1', externalEventId: null, externalObjectId: null, eventType: 'e', method: 'browser-websocket', evidenceType: 'client-observed', authenticity: 'UNKNOWN', completeness: 'UNKNOWN', occurredAt: null, observedAt: '2026-11-18T00:00:00Z' } }; };
const setup = (env: NodeJS.ProcessEnv = base) => {
    const store = { enroll: vi.fn().mockResolvedValue(undefined), revoke: vi.fn().mockResolvedValue(undefined), append: vi.fn().mockResolvedValue({ continuity: 'UNKNOWN' }) } satisfies IntegrationStore;
    return { store, env: { ...env }, svc: null as unknown as IntegrationIntake };
};
const make = (env: NodeJS.ProcessEnv = base) => { const s = setup(env); s.svc = new IntegrationIntake(s.store, s.env); return s; };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
const header = (token: string) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());

describe('principal-authenticated enrollment issuance', () => {
    it('ADR-006: denies unauthenticated, manager, sales, viewer and demo principals before persistence', async () => {
        const { svc, store } = make();
        await expect(svc.enrollAsPrincipal(null, {})).rejects.toMatchObject({ status: 401 });
        await expect(svc.enrollAsPrincipal({ ...who('admin'), userId: 'm\nforged' }, { pageId: 'p1' })).rejects.toMatchObject({ status: 401 });
        // ADR-006: enrollment connector issue/revoke is admin-only — manager is now 403.
        for (const ctx of [who('manager'), who('sales'), who('viewer'), who('admin', 'ws-a', true)])
            await expect(svc.enrollAsPrincipal(ctx, { pageId: 'p1' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
        for (const ctx of [who('manager'), who('sales')])
            await expect(svc.revokeAsPrincipal(ctx, { enrollmentId: '0'.repeat(36) })).rejects.toMatchObject({ status: 403 });
        expect(store.enroll).not.toHaveBeenCalled();
        expect(store.revoke).not.toHaveBeenCalled();
    });
    it('denies an admin whose workspace has no allowlisted scope, or selects another workspace page', async () => {
        const { svc, store } = make();
        await expect(svc.enrollAsPrincipal(who('admin', 'ws-other'), {})).rejects.toMatchObject({ status: 403, code: 'SCOPE_NOT_ALLOWED' });
        await expect(svc.enrollAsPrincipal(who('admin', 'ws-b'), { pageId: 'p1' })).rejects.toMatchObject({ status: 403, code: 'SCOPE_NOT_ALLOWED' });
        await expect(svc.enrollAsPrincipal(who('admin'), { pageId: 'not-allowed' })).rejects.toMatchObject({ status: 403 });
        expect(store.enroll).not.toHaveBeenCalled();
    });
    it('rejects body-supplied workspace, unknown keys and ambiguous selection', async () => {
        const { svc, store } = make();
        await expect(svc.enrollAsPrincipal(who('admin'), { workspaceId: 'ws-a', pageId: 'p1' })).rejects.toMatchObject({ status: 400, code: 'WORKSPACE_FROM_CONTEXT' });
        for (const body of [null, [], { scope: allow[0] }, { pageId: 7 }, { providerSurface: 'other' }])
            await expect(svc.enrollAsPrincipal(who('admin'), body)).rejects.toMatchObject({ status: 400 });
        await expect(svc.enrollAsPrincipal(who('admin'), {})).rejects.toMatchObject({ status: 400, code: 'SCOPE_AMBIGUOUS' });
        expect(store.enroll).not.toHaveBeenCalled();
    });
    it('issues for an admin of the same workspace with server scope and audits actor without token', async () => {
        const { svc, store } = make();
        const r = await svc.enrollAsPrincipal(who('admin'), { pageId: 'p2' });
        expect(r.scope).toEqual({ workspaceId: 'ws-a', connectionId: 'c1', accountId: 'a1', providerSurface: 'pancake-conversations', pageId: 'p2' });
        expect(header(r.token)).toEqual({ alg: 'HS256', typ: 'AIL-ENROLLMENT', kid: 'k1' });
        expect(store.enroll).toHaveBeenCalledWith({ id: r.enrollmentId, scope: r.scope, expiresAt: r.expiresAt }, { issuance: 'principal', actorId: 'admin-user', role: 'admin', kid: 'k1' });
        expect(JSON.stringify(store.enroll.mock.calls)).not.toContain(r.token.split('.')[2]);
        await svc.append('Bearer ' + r.token, upload('p2'));
        expect(store.append).toHaveBeenCalledOnce();
        await expect(svc.append('Bearer ' + r.token, upload('p1'))).rejects.toMatchObject({ status: 400 });
        const admin = await make().svc.enrollAsPrincipal(who('admin', 'ws-b'), {});
        expect(admin.scope.pageId).toBe('p9');
    });
    it('principal revocation is bound to the resolved workspace', async () => {
        const { svc, store } = make();
        const enrollmentId = '11111111-1111-4111-8111-111111111111';
        await svc.revokeAsPrincipal(who('admin', 'ws-b'), { enrollmentId });
        expect(store.revoke).toHaveBeenCalledWith(enrollmentId, { issuance: 'principal', actorId: 'admin-user', role: 'admin', workspaceId: 'ws-b' });
        await expect(svc.revokeAsPrincipal(who('admin'), { enrollmentId, workspaceId: 'ws-b' })).rejects.toMatchObject({ status: 400 });
    });
    it('disables the deprecated issuer-secret path by config while principal issuance keeps working', async () => {
        // A-m6: explicit opt-in — a configured secret alone no longer enables the path.
        for (const patch of [{}, { AIL_ISSUER_SECRET: issuer }, { AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'false' }, { AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: '' }]) {
            const { svc, store } = make({ ...base, ...patch });
            await expect(svc.enroll(issuer, {})).rejects.toMatchObject({ status: 404, code: 'ISSUER_PATH_DISABLED' });
            await expect(svc.revoke(issuer, { enrollmentId: '0'.repeat(36) })).rejects.toMatchObject({ status: 404 });
            await svc.enrollAsPrincipal(who('admin', 'ws-b'), {});
            expect(store.enroll).toHaveBeenCalledOnce();
        }
        const legacy = make({ ...base, AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'true' });
        await expect(legacy.svc.enroll(issuer, {})).rejects.toMatchObject({ status: 400, code: 'SCOPE_AMBIGUOUS' });
    });
    it('A-m6: issuer-secret revoke is bound to the single allowlisted workspace, never cross-workspace', async () => {
        const enrollmentId = '22222222-2222-4222-8222-222222222222';
        const single = make({ ...base, AIL_SCOPE_ALLOWLIST: JSON.stringify([allow[2]]), AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'true' });
        await single.svc.revoke(issuer, { enrollmentId });
        expect(single.store.revoke).toHaveBeenCalledWith(enrollmentId, { issuance: 'issuer-secret', actorId: 'issuer-secret', role: null, workspaceId: 'ws-b' });
        // Two scopes of ONE workspace still bind that workspace.
        const sameWs = make({ ...base, AIL_SCOPE_ALLOWLIST: JSON.stringify(allow.slice(0, 2)), AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'true' });
        await sameWs.svc.revoke(issuer, { enrollmentId });
        expect(sameWs.store.revoke).toHaveBeenCalledWith(enrollmentId, expect.objectContaining({ workspaceId: 'ws-a' }));
        // Allowlist spanning several workspaces: the shared secret cannot be bound → refused, no store call.
        const multi = make({ ...base, AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'true' });
        await expect(multi.svc.revoke(issuer, { enrollmentId })).rejects.toMatchObject({ status: 400, code: 'SCOPE_AMBIGUOUS' });
        expect(multi.store.revoke).not.toHaveBeenCalled();
        expect(single.store.revoke.mock.calls.every(([, req]) => req.workspaceId !== null)).toBe(true);
    });
});

describe('ADR-006 R2-P-08 — issuer-secret enrollment only in local/test and only when opted in', () => {
    const enrollmentId = '33333333-3333-4333-8333-333333333333';
    const opted = { ...base, AIL_SCOPE_ALLOWLIST: JSON.stringify([allow[2]]), AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'true' };
    it('fails closed (503) in pilot, production, unknown/unset deployment and NODE_ENV=production even when opted in', async () => {
        for (const patch of [{ DEPLOYMENT_MODE: 'pilot' }, { DEPLOYMENT_MODE: 'production' }, { DEPLOYMENT_MODE: 'staging' }, { DEPLOYMENT_MODE: undefined }, { DEPLOYMENT_MODE: 'test', NODE_ENV: 'production' }]) {
            const s = make({ ...opted, ...patch });
            await expect(s.svc.enroll(issuer, {})).rejects.toMatchObject({ status: 503 });
            await expect(s.svc.revoke(issuer, { enrollmentId })).rejects.toMatchObject({ status: 503 });
            expect(s.store.enroll).not.toHaveBeenCalled();
            expect(s.store.revoke).not.toHaveBeenCalled();
        }
    });
    it('works in local and test only with AIL_ISSUER_SECRET_ENABLED=true', async () => {
        for (const mode of ['local', 'test']) {
            const s = make({ ...opted, DEPLOYMENT_MODE: mode });
            await expect(s.svc.enroll(issuer, {})).resolves.toMatchObject({ scope: expect.objectContaining({ workspaceId: 'ws-b' }) });
            expect(s.store.enroll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ issuance: 'issuer-secret' }));
            await expect(make({ ...opted, DEPLOYMENT_MODE: mode, AIL_ISSUER_SECRET_ENABLED: undefined }).svc.enroll(issuer, {})).rejects.toMatchObject({ status: 404, code: 'ISSUER_PATH_DISABLED' });
        }
    });
    it('the issuer-path gate is independent of the research gate (defence in depth)', () => {
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'test', AIL_ISSUER_SECRET_ENABLED: 'true' })).toBe(true);
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'local', AIL_ISSUER_SECRET_ENABLED: 'true' })).toBe(true);
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'pilot', AIL_ISSUER_SECRET_ENABLED: 'true' })).toBe(false);
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'production', AIL_ISSUER_SECRET_ENABLED: 'true' })).toBe(false);
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'test', NODE_ENV: 'production', AIL_ISSUER_SECRET_ENABLED: 'true' })).toBe(false);
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'test' })).toBe(false);
        expect(issuerSecretPathAllowed({ DEPLOYMENT_MODE: 'test', AIL_ISSUER_SECRET_ENABLED: 'TRUE' })).toBe(false);
    });
});

describe('signing keyring rotation', () => {
    const rotated = { ...base, AIL_SIGNING_KEYS: keys({ kid: 'k2', secret: k2, state: 'active' }, { kid: 'k1', secret: k1, state: 'verify' }) };
    it('keeps unexpired tokens from a still-verifying key valid and signs new ones with the active kid', async () => {
        const s = make();
        const old = await s.svc.enrollAsPrincipal(who('admin', 'ws-b'), {});
        Object.assign(s.env, rotated);
        await s.svc.append('Bearer ' + old.token, upload('p9', 'ws-b'));
        const fresh = await s.svc.enrollAsPrincipal(who('admin', 'ws-b'), {});
        expect(header(fresh.token).kid).toBe('k2');
        expect(s.store.enroll).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ kid: 'k2' }));
        await s.svc.append('Bearer ' + fresh.token, upload('p9', 'ws-b'));
        expect(s.store.append).toHaveBeenCalledTimes(2);
    });
    it('rejects retired, unknown, tampered kid and kid/claim mismatch with uniform 401', async () => {
        const s = make();
        const old = await s.svc.enrollAsPrincipal(who('admin', 'ws-b'), {});
        const [h, p, sig] = old.token.split('.');
        Object.assign(s.env, { AIL_SIGNING_KEYS: keys({ kid: 'k2', secret: k2, state: 'active' }, { kid: 'k1', state: 'retired' }) });
        await expect(s.svc.append('Bearer ' + old.token, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
        Object.assign(s.env, { AIL_SIGNING_KEYS: keys({ kid: 'k2', secret: k2, state: 'active' }) });
        await expect(s.svc.append('Bearer ' + old.token, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401 });
        Object.assign(s.env, rotated);
        const swapped = b64({ ...header(old.token), kid: 'k2' });
        await expect(s.svc.append(`Bearer ${swapped}.${p}.${sig}`, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401 });
        const unknown = b64({ ...header(old.token), kid: 'nope' });
        await expect(s.svc.append(`Bearer ${unknown}.${p}.${sig}`, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401 });
        await expect(s.svc.append(`Bearer ${p}.${sig}`, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401 });
        await expect(s.svc.append(`Bearer ${h}.${p}.${sig}.x`, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401 });
        expect(s.store.append).not.toHaveBeenCalled();
    });
    it('rejects a token whose scope was removed from the server allowlist', async () => {
        const s = make();
        const t = await s.svc.enrollAsPrincipal(who('admin', 'ws-b'), {});
        s.env.AIL_SCOPE_ALLOWLIST = JSON.stringify(allow.slice(0, 2));
        await expect(s.svc.append('Bearer ' + t.token, upload('p9', 'ws-b'))).rejects.toMatchObject({ status: 401 });
    });
    it('fails closed on unsafe keyring and allowlist configuration', async () => {
        const bad: NodeJS.ProcessEnv[] = [
            { AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: 'short', state: 'active' }) },
            { AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: k1, state: 'active' }, { kid: 'k2', secret: k2, state: 'active' }) },
            { AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: k1, state: 'verify' }) },
            { AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: k1, state: 'active' }, { kid: 'k1', secret: k2, state: 'verify' }) },
            { AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: k1, state: 'active' }, { kid: 'k2', secret: k1, state: 'verify' }) },
            { AIL_SIGNING_KEYS: keys({ kid: 'bad kid', secret: k1, state: 'active' }) },
            { AIL_SIGNING_KEYS: keys({ kid: 'k1', secret: k1, state: 'active' }, { kid: 'k0', secret: k2, state: 'retired' }) },
            { AIL_SIGNING_KEYS: '{not json' },
            { AIL_SIGNING_SECRET: k2 },
            { AIL_ISSUER_SECRET: k1, AIL_ISSUER_SECRET_ENABLED: 'true' },
            { AIL_ISSUER_SECRET: 'short-issuer', AIL_ISSUER_SECRET_ENABLED: 'true' },
            { AIL_ISSUER_SECRET_ENABLED: 'true' },
            { AIL_ISSUER_SECRET: issuer, AIL_ISSUER_SECRET_ENABLED: 'yes' },
            { AIL_SCOPE_ALLOWLIST: JSON.stringify([{ ...allow[0], extra: 'x' }]) },
            { AIL_SCOPE_ALLOWLIST: JSON.stringify([allow[0], allow[0]]) },
            { AIL_SCOPE_ALLOWLIST: '[]' },
            { AIL_WORKSPACE_ID: 'ws-a' },
        ];
        for (const patch of bad)
            await expect(make({ ...base, ...patch }).svc.enrollAsPrincipal(who('admin', 'ws-b'), {})).rejects.toMatchObject({ status: 503, code: 'AIL_CONFIGURATION' });
    });
});
