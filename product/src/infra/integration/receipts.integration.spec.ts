import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PgIntegrationStore } from './pg-integration.store';
import type { Enrollment, Upload } from '../../ports/integration';
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('durable integration receipt transaction', () => {
    let db: PostgresService;
    let store: PgIntegrationStore;
    const enrollment = (): Enrollment => ({ id: randomUUID(), scope: { workspaceId: 'synthetic', connectionId: randomUUID(), accountId: 'a', providerSurface: 'pancake-conversations', pageId: 'p' }, expiresAt: new Date(Date.now() + 60000).toISOString() });
    const upload: Upload = { captureId: 'capture', sequence: 1, pageId: 'p', observation: { completeness: 'UNKNOWN' } };
    beforeAll(async () => { db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL }); await new Migrator(db, loadMigrations()).up(); store = new PgIntegrationStore(db); });
    afterAll(async () => { await db?.onModuleDestroy(); });
    it('concurrent retry commits one receipt and ACK survives a new pool', async () => {
        const e = enrollment();
        await store.enroll(e);
        const acks = await Promise.all([store.append(e, upload, 'hash'), store.append(e, upload, 'hash')]);
        expect(acks.map(x => x.disposition).sort()).toEqual(['duplicate', 'stored']);
        expect(acks[0].receiptId).toBe(acks[1].receiptId);
        await db.onModuleDestroy();
        expect(await store.append(e, upload, 'hash')).toMatchObject({ disposition: 'duplicate', checkpoint: 1, captureId: 'capture', sequence: 1, enrollmentId: e.id, continuity: 'UNKNOWN' });
        await expect(store.append(e, upload, 'changed')).rejects.toMatchObject({ status: 409 });
        await expect(store.append(e, { ...upload, captureId: 'other' }, 'new')).rejects.toMatchObject({ code: 'CHECKPOINT_REGRESSION' });
    });
    it('rejects revoked, expired and forged tenant scope', async () => {
        const e = enrollment();
        await store.enroll(e);
        await expect(store.append({ ...e, scope: { ...e.scope, workspaceId: 'other' } }, upload, 'hash')).rejects.toMatchObject({ status: 401 });
        await store.revoke(e.id);
        await expect(store.append(e, upload, 'hash')).rejects.toMatchObject({ status: 401 });
        const expired = { ...enrollment(), expiresAt: '2000-01-01T00:00:00Z' };
        await store.enroll(expired);
        await expect(store.append(expired, upload, 'hash')).rejects.toMatchObject({ status: 401 });
    });
    it('serializes concurrent sequence identity and revocation', async () => {
        const e = enrollment();
        await store.enroll(e);
        const outcomes = await Promise.allSettled([store.append(e, upload, 'one'), store.append(e, { ...upload, captureId: 'other' }, 'two')]);
        expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
        expect(outcomes.filter(x => x.status === 'rejected')).toHaveLength(1);
        await Promise.allSettled([store.append(e, { ...upload, captureId: 'next', sequence: 2 }, 'next'), store.revoke(e.id)]);
        await expect(store.append(e, { ...upload, captureId: 'after', sequence: 3 }, 'after')).rejects.toMatchObject({ status: 401 });
        const row = await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.id]);
        expect([1, 2]).toContain(Number(row.rows[0].checkpoint));
    });
    it('failure after receipt insertion rolls back receipt and checkpoint', async () => {
        const e = enrollment();
        await store.enroll(e);
        // Force the final audit insert to fail in this isolated transaction only.
        const original = db.withTransaction.bind(db);
        const failing = { withTransaction: <T>(fn: Parameters<PostgresService['withTransaction']>[0]) => original(async (tx) => fn({ query: async (sql: string, args?: unknown[]) => { if (sql.includes("VALUES($1,'receipt')"))
                    throw new Error('injected crash before commit'); return tx.query(sql, args); } })) as Promise<T> } as PostgresService;
        await expect(new PgIntegrationStore(failing).append(e, upload, 'hash')).rejects.toThrow('injected crash');
        expect((await db.query('SELECT checkpoint FROM integration_enrollment WHERE id=$1', [e.id])).rows[0].checkpoint).toBe('0');
        expect((await db.query('SELECT id FROM integration_receipt WHERE enrollment_id=$1', [e.id])).rows).toHaveLength(0);
        expect(await store.append(e, upload, 'hash')).toMatchObject({ disposition: 'stored' });
    });
});
