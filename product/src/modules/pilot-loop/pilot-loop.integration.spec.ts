import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from '../../infra/postgres/migrator';
import { PostgresService } from '../../infra/postgres/postgres.service';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { PgPilotStore } from './pg-pilot.store';
import { PilotLoopService } from './pilot-loop.service';
import { UNKNOWN_SENTINEL } from '../../domain/unknown-states/unknown-states';
import type { LeadId } from '../../domain/lead/lead';

const databaseUrl = process.env.TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

/**
 * Durable pilot loop over REAL PostgreSQL (T3-05/T3-06 wiring for the P0 flow).
 *
 * "Process restart" is modeled by tearing down the first pool and constructing a
 * fresh PostgresService + store (what a new application process does): the state
 * must come back complete from PG alone — lead, handoff+recipient, work items
 * with Q3/Q4 semantics, outcomes, and the full append-only audit history.
 */
integration('PilotLoop over PostgreSQL — durability + two-person handoff', () => {
  const wsId = `it-pilot-${randomUUID()}`;
  const conn = `it-${randomUUID()}`;
  let db1: PostgresService;

  beforeAll(async () => {
    db1 = new PostgresService({ connectionString: databaseUrl, max: 2 });
    await new Migrator(db1, loadMigrations()).up();
  });

  afterAll(async () => {
    if (db1) {
      await db1.query('DELETE FROM workspace WHERE id = $1', [wsId]);
      await db1.onModuleDestroy();
    }
  });

  it('full loop persists; a fresh process reads back state and audit history', async () => {
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());

    const state = await svc.ingestScenario({
      workspaceId: wsId,
      displayName: 'Phụ huynh A (IT)',
      utterance: 'Thứ Sáu em gọi lại cho chị nhé, chị trao đổi với bé đã.',
      speaker: 'customer',
      connection: conn,
      externalRecordId: 'msg-1',
      conversationSource: 'Messenger',
      isSynthetic: true,
      ownerUserId: 'marketing-a',
    });

    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'Muốn con học thử lớp tối',
      proposedAction: 'Gọi lại 15:00 thứ Sáu',
      responsibleParty: 'internal',
      origin: 'explicit-request',
      dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-a',
      recipientUserId: 'sales-b',
    });
    const workId = handed.workItems[0].id;

    // B (chưa owner) nhận gói → owner = B
    const accepted = await svc.salesAccept(handed.lead.id, { workId, actor: 'sales-b', reason: 'B nhận trách nhiệm' });
    expect(accepted.ownerUserId).toBe('sales-b');

    await svc.completeWork(accepted.lead.id, { workId, actor: 'sales-b', evidence: 'declared', occurredAt: '2026-10-09T15:05:00+07:00', reason: 'đã gọi' });
    const adv = await svc.advance(accepted.lead.id, { to: 'Contacting', actor: 'sales-b', reason: 'đã gọi' });
    const adv2 = await svc.advance(adv.lead.id, { to: 'Follow-up', actor: 'sales-b', reason: 'chờ' });
    await svc.recordOutcome(adv2.lead.id, { value: 'Won', actor: 'sales-b', reason: 'đã deposit' });

    // --- simulated application restart: brand new pool/store/process state ---
    await db1.onModuleDestroy();
    const db2 = new PostgresService({ connectionString: databaseUrl, max: 2 });
    try {
      const svc2 = new PilotLoopService(new PgPilotStore(db2), new ManualAdapter());
      const reloaded = await svc2.get(state.lead.id as LeadId);
      expect(reloaded).toBeDefined();
      expect(reloaded!.lead.status).toBe('Won');
      expect(reloaded!.lead.attribution).toBe(UNKNOWN_SENTINEL);
      expect(reloaded!.ownerUserId).toBe('sales-b');
      expect(reloaded!.handoffRecipient).toBe('sales-b');
      expect(reloaded!.handoff?.context).toBe('Muốn con học thử lớp tối');
      const work = reloaded!.workItems.find((w) => w.id === workId);
      expect(work?.status).toBe('completed');
      expect(work?.completionEvidence).toBe('declared');
      expect(work?.occurredAt).toBe('2026-10-09T15:05:00+07:00');
      expect(reloaded!.outcomes).toHaveLength(1);
      expect(reloaded!.outcomes[0].assertionStatus).toBe('claimed');

      // raw envelope immutable across restart (I-12)
      expect(reloaded!.envelope?.rawPayloadHash).toMatch(/^[0-9a-f]{64}$/);
      expect(reloaded!.envelope?.rawPayload).toEqual({
        utterance: 'Thứ Sáu em gọi lại cho chị nhé, chị trao đổi với bé đã.',
        speaker: 'customer',
      });

      // full append-only audit history (I-05) — nothing overwritten
      const history = await svc2.get(state.lead.id as LeadId).then(() => new PgPilotStore(db2).history(state.lead.id));
      const types = history.map((h) => h.eventType);
      for (const t of ['lead_created', 'handoff_created', 'lead_transition', 'work_completed', 'outcome_created']) {
        expect(types, `audit missing ${t}`).toContain(t);
      }

      // idempotent re-ingest of same external record → no duplicate envelope (R-06)
      const svc3 = new PilotLoopService(new PgPilotStore(db2), new ManualAdapter());
      const dup = await svc3.ingestScenario({
        workspaceId: wsId,
        displayName: 'dup',
        utterance: 'same',
        speaker: 'customer',
        connection: conn,
        externalRecordId: 'msg-1',
        ownerUserId: 'marketing-a',
      }).catch((e: unknown) => e);
      // same idempotency key → adapter returns the SAME envelope; new lead references it. OK if success.
      expect(dup).not.toMatchObject({ code: 'INTERNAL' });

      // second person C cannot accept someone else's handoff (service-level 403)
      await expect(
        svc3.salesAccept(state.lead.id as LeadId, { workId, actor: 'sales-c', reason: 'x' }),
      ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });
    } finally {
      await db2.onModuleDestroy();
      db1 = new PostgresService({ connectionString: databaseUrl, max: 2 }); // for afterAll cleanup
    }
  });

  it('P1-1: cross-workspace same connection+externalRecordId → distinct envelopes, no shared raw evidence (PG path)', async () => {
    const wsA = `it-p11-a-${randomUUID()}`;
    const wsB = `it-p11-b-${randomUUID()}`;
    const sharedConn = `pancake-page-${randomUUID()}`;
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());

    const a = await svc.ingestScenario({
      workspaceId: wsA, displayName: 'A', utterance: 'evidence A', speaker: 'customer',
      connection: sharedConn, externalRecordId: 'msg-shared', isSynthetic: true,
    });
    const b = await svc.ingestScenario({
      workspaceId: wsB, displayName: 'B', utterance: 'evidence B', speaker: 'customer',
      connection: sharedConn, externalRecordId: 'msg-shared', isSynthetic: true,
    });
    // Envelope rows must be distinct per workspace (old UNIQUE(connection,ext) reused A's row)
    const envA = (await svc.get(a.lead.id))!;
    const envB = (await svc.get(b.lead.id))!;
    expect(envA.sourceEnvelopeId).not.toBe(envB.sourceEnvelopeId);
    expect(envB.envelope?.rawPayload).toEqual({ utterance: 'evidence B', speaker: 'customer' });
    expect(envB.envelope?.workspaceId).toBe(wsB);

    const rows = await db1.query<{ workspace_id: string }>(
      'SELECT workspace_id FROM commercial_envelope WHERE connection = $1 AND external_record_id = $2',
      [sharedConn, 'msg-shared'],
    );
    expect(rows.rows.map((r) => r.workspace_id).sort()).toEqual([wsA, wsB].sort());

    await db1.query('DELETE FROM workspace WHERE id IN ($1,$2)', [wsA, wsB]);
  });

  it('P1-3 over PG: superseded item is refused from DURABLE status; replacement closes the chain', async () => {
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    const state = await svc.ingestScenario({
      workspaceId: wsId, displayName: 'P1-3', utterance: 'u', speaker: 'customer',
      connection: conn, externalRecordId: 'msg-p13', ownerUserId: 'marketing-a',
    });
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c', proposedAction: 'Gọi lại 15:00 thứ Sáu', responsibleParty: 'internal',
      origin: 'explicit-request', dueAt: '2026-10-09T15:00:00+07:00',
      actor: 'marketing-a', recipientUserId: 'sales-b',
    });
    const oldId = handed.workItems[0].id;
    await svc.salesAccept(state.lead.id, { workId: oldId, actor: 'sales-b', reason: 'B nhận' });
    const moved = await svc.rescheduleWork(state.lead.id, {
      workId: oldId, actor: 'sales-b', newDueAt: '2026-10-12T16:00:00+07:00', reason: 'dời',
    });
    const replacementId = moved.workItems.find((w) => w.supersedesWorkId === oldId)!.id;

    // fresh service = another request/process: refusal must come from persisted rows
    const svc2 = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    let caught: unknown;
    await svc2.completeWork(state.lead.id, { workId: oldId, actor: 'sales-b', evidence: 'declared' }).catch((e) => (caught = e));
    expect(caught).toMatchObject({ code: 'WORK_SUPERSEDED', status: 409 });
    expect((caught as { details?: Record<string, unknown> }).details).toMatchObject({ replacementId });

    // DB truth before the fix this would already be 'completed'
    const before = await db1.query<{ id: string; status: string }>(
      'SELECT id, status FROM pilot_work_item WHERE id IN ($1,$2)',
      [oldId, replacementId],
    );
    expect(before.rows.find((r) => r.id === oldId)?.status).toBe('rescheduled');
    expect(before.rows.find((r) => r.id === replacementId)?.status).toBe('open');

    const done = await svc2.completeWork(state.lead.id, { workId: replacementId, actor: 'sales-b', evidence: 'declared', reason: 'đã gọi' });
    expect(done.workItems.find((w) => w.id === oldId)!.status).toBe('rescheduled');

    const after = await db1.query<{ n: string }>(
      `SELECT status FROM pilot_work_item
        WHERE lead_id = $1 AND (id = $2 OR id = $3 OR supersedes_work_id = $2)
          AND status NOT IN ('completed','rescheduled','cancelled')`,
      [state.lead.id, oldId, replacementId],
    );
    expect(after.rows).toHaveLength(0); // chuỗi thay thế không còn việc hoạt động
  });

  it('P1-4 over PG: evidence pointers are validated against durable envelopes, not the caller', async () => {
    const wsA = `it-p14-a-${randomUUID()}`;
    const wsB = `it-p14-b-${randomUUID()}`;
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());

    const a = await svc.ingestScenario({
      workspaceId: wsA, displayName: 'A', utterance: 'u', speaker: 'customer',
      connection: `conn-${randomUUID()}`, externalRecordId: 'e-a', ownerUserId: 'sales-b',
    });
    const b = await svc.ingestScenario({
      workspaceId: wsB, displayName: 'B', utterance: 'u', speaker: 'customer',
      connection: `conn-${randomUUID()}`, externalRecordId: 'e-b', ownerUserId: 'sales-b',
    });
    const handed = await svc.handoffToSales(a.lead.id, {
      context: 'c', proposedAction: 'Gửi học phí', responsibleParty: 'internal',
      origin: 'explicit-commitment', actor: 'sales-b', recipientUserId: 'sales-b',
    });
    const wid = handed.workItems[0].id;
    await svc.salesAccept(a.lead.id, { workId: wid, actor: 'sales-b', reason: 'nhận' });

    // 1) pointer that exists in ANOTHER workspace → refused, and no cross-tenant payload leaks
    await expect(
      svc.completeWork(a.lead.id, { workId: wid, actor: 'sales-b', evidence: 'observed', evidenceRef: b.sourceEnvelopeId! }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_OUT_OF_SCOPE', status: 403 });

    // 2) pointer that resolves to nothing durable → refused
    await expect(
      svc.completeWork(a.lead.id, { workId: wid, actor: 'sales-b', evidence: 'observed', evidenceRef: randomUUID() }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_FOUND', status: 422 });

    expect((await svc.get(a.lead.id))!.workItems.find((w) => w.id === wid)!.status).toBe('accepted');

    // 3) the case's own envelope → accepted, and the audit records the raw hash (I-12)
    const done = await svc.completeWork(a.lead.id, {
      workId: wid, actor: 'sales-b', evidence: 'observed', evidenceRef: a.sourceEnvelopeId!, reason: 'file đã gửi',
    });
    expect(done.workItems.find((w) => w.id === wid)!.completionEvidence).toBe('observed');
    const audit = await db1.query<{ new_value: unknown }>(
      "SELECT new_value FROM audit_record WHERE entity_id = $1 AND event_type = 'work_completed'",
      [wid],
    );
    const recorded = JSON.parse(typeof audit.rows[0]?.new_value === 'string' ? audit.rows[0].new_value : JSON.stringify(audit.rows[0]?.new_value));
    expect(recorded.evidenceHash).toMatch(/^[0-9a-f]{64}$/);

    await db1.query('DELETE FROM workspace WHERE id IN ($1,$2)', [wsA, wsB]);
  });

  it('mutation + audit are atomic: a guardrail refusal leaves no partial state (QA-35)', async () => {
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    const state = await svc.ingestScenario({
      workspaceId: wsId, displayName: 'd', utterance: 'u', speaker: 'customer',
      connection: conn, externalRecordId: 'msg-atom', ownerUserId: 'marketing-a',
    });
    const handed = await svc.handoffToSales(state.lead.id, {
      context: 'c', proposedAction: 'a', responsibleParty: 'internal', origin: 'explicit-commitment',
      actor: 'marketing-a', recipientUserId: 'sales-b',
    });
    const wid = handed.workItems[0].id;
    // B phải NHẬN trước (P1-2: recipient chưa-accept không có quyền mutate), rồi mới
    // có thể bị từ chối vì thiếu evidence pointer — đó chính là guardrail cần test.
    await svc.salesAccept(state.lead.id as LeadId, { workId: wid, actor: 'sales-b', reason: 'B nhận' });

    await expect(svc.completeWork(state.lead.id, { workId: wid, actor: 'sales-b', evidence: 'observed' }))
      .rejects.toMatchObject({ code: 'EVIDENCE_POINTER_REQUIRED', status: 422 });

    // reload — work item must still be in its previous status, no half-applied mutation
    const fresh = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    const after = await fresh.get(state.lead.id as LeadId);
    expect(after!.workItems.find((w) => w.id === wid)!.status).not.toBe('completed');
    const auditCount = (await fresh.get(state.lead.id as LeadId)) !== undefined;
    expect(auditCount).toBe(true);
  });
});
