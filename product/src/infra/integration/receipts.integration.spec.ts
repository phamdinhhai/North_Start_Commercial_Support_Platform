import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PgIntegrationStore } from './pg-integration.store';
import type { Enrollment, IssuanceAudit, RevocationRequest, Upload } from '../../ports/integration';
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('durable integration receipt transaction', () => {
    let db: PostgresService;
    let store: PgIntegrationStore;
    const enrollment = (): Enrollment => ({ id: randomUUID(), scope: { workspaceId: 'synthetic', connectionId: randomUUID(), accountId: 'a', providerSurface: 'pancake-conversations', pageId: 'p' }, expiresAt: new Date(Date.now() + 60000).toISOString() });
    const issued: IssuanceAudit = { issuance: 'principal', actorId: 'manager-1', role: 'manager', kid: 'k1' };
    const legacy: RevocationRequest = { issuance: 'issuer-secret', actorId: 'issuer-secret', role: null, workspaceId: null };
    const upload: Upload = { captureId: 'capture', sequence: 1, pageId: 'p', observation: { completeness: 'UNKNOWN' } };
    beforeAll(async () => { db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL }); await new Migrator(db, loadMigrations()).up(); store = new PgIntegrationStore(db); });
    afterAll(async () => { await db?.onModuleDestroy(); });
    it('concurrent retry commits one receipt and ACK survives a new pool', async () => {
        const e = enrollment();
        await store.enroll(e, issued);
        const acks = await Promise.all([store.append(e, upload, 'hash'), store.append(e, upload, 'hash')]);
        expect(acks.map(x => x.disposition).sort()).toEqual(['duplicate', 'stored']);
        expect(acks[0].receiptId).toBe(acks[1].receiptId);
        await db.onModuleDestroy();
        expect(await store.append(e, upload, 'hash')).toMatchObject({ disposition: 'duplicate', checkpoint: 1, captureId: 'capture', sequence: 1, enrollmentId: e.id, continuity: 'UNKNOWN' });
        await expect(store.append(e, upload, 'changed')).rejects.toMatchObject({ status: 409 });
        await expect(store.append(e, { ...upload, captureId: 'other' }, 'new')).rejects.toMatchObject({ code: 'CHECKPOINT_REGRESSION' });
    });
    it('rejects revoked, expired and forged tenant scope', async () => {
        await expect(store.revoke(randomUUID(), legacy)).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND', status: 404 });
        const e = enrollment();
        await store.enroll(e, issued);
        await expect(store.append({ ...e, scope: { ...e.scope, workspaceId: 'other' } }, upload, 'hash')).rejects.toMatchObject({ status: 401 });
        await store.revoke(e.id, legacy);
        await expect(store.append(e, upload, 'hash')).rejects.toMatchObject({ status: 401 });
        const expired = { ...enrollment(), expiresAt: '2000-01-01T00:00:00Z' };
        await store.enroll(expired, issued);
        await expect(store.append(expired, upload, 'hash')).rejects.toMatchObject({ status: 401 });
    });
    it('preserves missing delivery on out-of-order arrivals and binds late duplicate ACKs', async () => {
        const e = enrollment();
        await store.enroll(e, issued);
        const second = { ...upload, captureId: 'second', sequence: 2 };
        await expect(store.append(e, second, 'second')).rejects.toMatchObject({ code: 'SEQUENCE_GAP', status: 409 });
        expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.id])).rows[0].checkpoint).toBe('0');
        expect(await store.append(e, upload, 'first')).toMatchObject({ checkpoint: 1 });
        expect(await store.append(e, second, 'second')).toMatchObject({ checkpoint: 2 });
        expect(await store.append(e, upload, 'first')).toMatchObject({ disposition: 'duplicate', sequence: 1, checkpoint: 2 });
    });
    it('serializes concurrent sequence identity and revocation', async () => {
        const e = enrollment();
        await store.enroll(e, issued);
        const outcomes = await Promise.allSettled([store.append(e, upload, 'one'), store.append(e, { ...upload, captureId: 'other' }, 'two')]);
        expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
        expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1);
        await Promise.allSettled([store.append(e, { ...upload, captureId: 'next', sequence: 2 }, 'next'), store.revoke(e.id, legacy)]);
        await expect(store.append(e, { ...upload, captureId: 'after', sequence: 3 }, 'after')).rejects.toMatchObject({ status: 401 });
        const row = await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.id]);
        expect([1, 2]).toContain(Number(row.rows[0].checkpoint));
    });
    it('failure after receipt insertion rolls back receipt and checkpoint', async () => {
        const e = enrollment();
        await store.enroll(e, issued);
        // Force the final audit insert to fail in this isolated transaction only.
        const original = db.withTransaction.bind(db);
        const failing = { withTransaction: <T>(fn: Parameters<PostgresService['withTransaction']>[0]) => original(async (tx) => fn({ query: async (sql: string, args?: unknown[]) => { if (sql.includes("VALUES($1,'receipt')"))
                    throw new Error('injected crash before commit'); return tx.query(sql, args); } })) as Promise<T> } as PostgresService;
        await expect(new PgIntegrationStore(failing).append(e, upload, 'hash')).rejects.toThrow('injected crash');
        expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.id])).rows[0].checkpoint).toBe('0');
        expect((await db.query('SELECT id FROM integration_receipt WHERE enrollment_id=$1', [e.id])).rows).toHaveLength(0);
        expect(await store.append(e, upload, 'hash')).toMatchObject({ disposition: 'stored' });
    });
    it('audits issuance and scoped revocation by actor without token material', async () => {
        const e = enrollment();
        await store.enroll(e, issued);
        await expect(store.revoke(e.id, { issuance: 'principal', actorId: 'other-manager', role: 'manager', workspaceId: 'foreign' })).rejects.toMatchObject({ code: 'ENROLLMENT_NOT_FOUND', status: 404 });
        await store.revoke(e.id, { issuance: 'principal', actorId: 'manager-1', role: 'manager', workspaceId: 'synthetic' });
        const rows = await db.query<{ actor: string; workspace_id: string; event_type: string; new_value: Record<string, unknown> }>("SELECT actor,workspace_id,event_type,new_value FROM audit_record WHERE entity_type='integration-enrollment' AND entity_id=$1 ORDER BY timestamp", [e.id]);
        expect(rows.rows.map(r => [r.event_type, r.actor, r.workspace_id])).toEqual([['integration.enrollment.issued', 'manager-1', 'synthetic'], ['integration.enrollment.revoked', 'manager-1', 'synthetic']]);
        expect(rows.rows[0].new_value).toEqual({ issuance: 'principal', role: 'manager', scope: e.scope, kid: 'k1', capability: 'observation:append', expiresAt: e.expiresAt });
        expect(JSON.stringify(rows.rows)).not.toMatch(/token|secret/i);
    });
});
