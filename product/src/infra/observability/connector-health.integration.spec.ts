import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService } from '../postgres/postgres.service';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PgIntegrationStore } from '../integration/pg-integration.store';
import { PgConnectorHealthReader, type ReadOnlySql } from './pg-connector-health.reader';
import { ConnectorHealthQuery } from '../../application/observability/connector-health';
import type { Enrollment, Upload } from '../../ports/integration';
import type { AuthContext } from '../../ports/auth';

// Explicit database opt-in; CI (ci-integration.mjs) requires every test here to run.
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;

suite('connector health read model over migration 008 tables (PostgreSQL)', () => {
  let db: PostgresService;
  let store: PgIntegrationStore;
  let reader: PgConnectorHealthReader;
  const wsA = `ws-a${randomUUID().slice(0, 8)}`;
  const wsB = `ws-b${randomUUID().slice(0, 8)}`;
  const enrollment = (workspaceId: string, expiresInMs = 600_000): Enrollment => ({
    id: randomUUID(),
    scope: { workspaceId, connectionId: `conn-${workspaceId}`, accountId: 'acct', providerSurface: 'pancake-conversations', pageId: 'page' },
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  });
  const upload = (sequence: number): Upload => ({
    captureId: `cap-${sequence}`, sequence, pageId: 'page',
    observation: { completeness: 'UNKNOWN', marker: 'PRIVATE-OBSERVATION-CONTENT' },
  });
  const manager = (workspaceId: string): AuthContext => ({ workspaceId, userId: 'm1', role: 'manager', isDemo: false });
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    db = new PostgresService({ connectionString: process.env.TEST_DATABASE_URL });
    await new Migrator(db, loadMigrations()).up();
    store = new PgIntegrationStore(db);
    reader = new PgConnectorHealthReader(db);

    const active = enrollment(wsA);
    await store.enroll(active);
    await store.append(active, upload(1), 'f1');
    await store.append(active, upload(2), 'f2');
    // A rejected gap must not move the checkpoint (and is not persisted as a count).
    await expect(store.append(active, upload(4), 'f4')).rejects.toMatchObject({ status: 409 });
    ids.active = active.id;

    const revoked = enrollment(wsA);
    await store.enroll(revoked);
    await store.append(revoked, upload(1), 'r1');
    await store.revoke(revoked.id);
    ids.revoked = revoked.id;

    const expired = enrollment(wsA, -60_000);
    await store.enroll(expired);
    ids.expired = expired.id;

    const foreign = enrollment(wsB);
    await store.enroll(foreign);
    await store.append(foreign, upload(1), 'b1');
    ids.foreign = foreign.id;
  });
  afterAll(async () => { await db?.onModuleDestroy(); });

  it('derives transport, delivery and checkpoint facts per enrollment for the workspace only', async () => {
    const page = await reader.listByWorkspace(wsA, 100);
    expect(page.truncated).toBe(false);
    expect(page.rows.map((r) => r.enrollmentId).sort()).toEqual([ids.active, ids.revoked, ids.expired].sort());
    expect(page.rows.every((r) => r.workspaceId === wsA)).toBe(true);
    const byId = Object.fromEntries(page.rows.map((r) => [r.enrollmentId, r]));
    expect(byId[ids.active]).toMatchObject({ checkpoint: 2, receiptCount: 2, lastAuditOperation: 'receipt', revokedAt: null, connectionId: `conn-${wsA}` });
    expect(byId[ids.active].checkpointAdvancedAt).toBeInstanceOf(Date);
    expect(byId[ids.active].checkpointAdvancedAt!.getTime()).toBe(byId[ids.active].lastReceiptAt!.getTime());
    expect(byId[ids.revoked]).toMatchObject({ checkpoint: 1, receiptCount: 1, lastAuditOperation: 'revoke' });
    expect(byId[ids.revoked].revokedAt).toBeInstanceOf(Date);
    expect(byId[ids.expired]).toMatchObject({ checkpoint: 0, receiptCount: 0, checkpointAdvancedAt: null, lastReceiptAt: null, lastAuditOperation: 'enroll' });
  });

  it('application report: states, UNKNOWN completeness and tenant isolation against real rows', async () => {
    const query = new ConnectorHealthQuery(reader, { AIL_RESEARCH_ENABLED: 'true' });
    const report = await query.report(manager(wsA));
    const states = Object.fromEntries(report.enrollments.map((e) => [e.enrollmentId, e.transport.state]));
    expect(states).toEqual({ [ids.active]: 'active', [ids.revoked]: 'revoked', [ids.expired]: 'expired' });
    expect(report.completeness).toBe('UNKNOWN');
    expect(report.enrollments.every((e) => e.completeness === 'UNKNOWN')).toBe(true);
    const json = JSON.stringify(report);
    expect(json).not.toContain(ids.foreign);
    expect(json).not.toContain('PRIVATE-OBSERVATION-CONTENT');
    expect(json).not.toMatch(/fingerprint|"f1"|acct|healthy/i);

    const foreign = await query.report(manager(`ws-z${randomUUID().slice(0, 8)}`));
    expect(foreign.enrollments).toEqual([]);
    const other = await query.report(manager(wsB));
    expect(other.enrollments.map((e) => e.enrollmentId)).toEqual([ids.foreign]);
  });

  it('is read-only: issues only SELECT statements and leaves every table unchanged', async () => {
    const counts = async () => (await db.query<{ e: string; r: string; a: string }>(
      'SELECT (SELECT count(*) FROM integration_enrollment) e, (SELECT count(*) FROM integration_receipt) r, (SELECT count(*) FROM integration_audit) a')).rows[0];
    const before = await counts();
    const statements: string[] = [];
    const spy: ReadOnlySql = { query: (text, params) => { statements.push(text); return db.query(text, params); } };
    await new PgConnectorHealthReader(spy).listByWorkspace(wsA, 100);
    await new PgConnectorHealthReader(spy).listByWorkspace('ws-empty-nothing', 100);
    expect(statements.length).toBeGreaterThan(0);
    for (const sql of statements) {
      expect(sql.trim()).toMatch(/^SELECT/i);
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|metadata|fingerprint)\b/i);
    }
    expect(await counts()).toEqual(before);
  });

  it('bounds results and flags truncation; parameter binding defeats injection', async () => {
    const page = await reader.listByWorkspace(wsA, 2);
    expect(page.rows).toHaveLength(2);
    expect(page.truncated).toBe(true);
    const injected = await reader.listByWorkspace(`${wsA}' OR '1'='1`, 100);
    expect(injected.rows).toEqual([]);
    expect(injected.observedAt).toBeInstanceOf(Date);
    await expect(reader.listByWorkspace('', 10)).rejects.toThrow();
  });
});
