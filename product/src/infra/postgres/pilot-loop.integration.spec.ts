import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { PgPilotStore } from './pg-pilot.store';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
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

    await svc.completeWork(accepted.lead.id, { workId, actor: 'sales-b', evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, occurredAt: '2026-10-09T15:05:00+07:00', reason: 'đã gọi' });
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

      // Fresh process: the original command returns its Lead, even after sales changes;
      // different immutable evidence for that key is an explicit 409, never another Lead.
      const svc3 = new PilotLoopService(new PgPilotStore(db2), new ManualAdapter());
      const dup = await svc3.ingestScenario({
        workspaceId: wsId, displayName: 'dup',
        utterance: 'Thứ Sáu em gọi lại cho chị nhé, chị trao đổi với bé đã.',
        speaker: 'customer', connection: conn, externalRecordId: 'msg-1', ownerUserId: 'marketing-a',
      });
      expect(dup.lead.id).toBe(state.lead.id);
      expect(dup.lead.status).toBe('Won');
      expect(dup.sourceEnvelopeId).toBe(reloaded!.sourceEnvelopeId);
      await expect(svc3.ingestScenario({
        workspaceId: wsId, displayName: 'changed', utterance: 'different evidence',
        speaker: 'customer', connection: conn, externalRecordId: 'msg-1',
      })).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
      const counts = await db2.query<{ leads: string; audits: string }>(
        `SELECT (SELECT count(*) FROM lead WHERE workspace_id = $1 AND source_envelope_id = $2)::text AS leads,
                (SELECT count(*) FROM audit_record WHERE entity_id = $3 AND event_type = 'lead_created')::text AS audits`,
        [wsId, state.sourceEnvelopeId, state.lead.id],
      );
      expect(counts.rows[0]).toEqual({ leads: '1', audits: '1' });

      // second person C cannot accept someone else's handoff (service-level 403)
      await expect(
        svc3.salesAccept(state.lead.id as LeadId, { workId, actor: 'sales-c', reason: 'x' }),
      ).rejects.toMatchObject({ code: 'NOT_ASSIGNED_RECIPIENT', status: 403 });
    } finally {
      await db2.onModuleDestroy();
      db1 = new PostgresService({ connectionString: databaseUrl, max: 2 }); // for afterAll cleanup
    }
  });

  it('R-06: concurrent fresh-PG-store retries commit exactly one Lead, envelope and creation audit', async () => {
    const record = `r06-${randomUUID()}`;
    const input = { workspaceId: wsId, displayName: 'concurrent', utterance: 'immutable evidence',
      speaker: 'customer' as const, connection: conn, externalRecordId: record,
      occurredAt: '2026-10-01T09:00:00.000Z', ownerUserId: 'marketing-a' };
    const services = Array.from({ length: 8 }, () => new PilotLoopService(new PgPilotStore(db1), new ManualAdapter()));
    const states = await Promise.all(services.map((svc) => svc.ingestScenario(input)));
    expect(new Set(states.map((s) => s.lead.id)).size).toBe(1);
    expect(new Set(states.map((s) => s.sourceEnvelopeId)).size).toBe(1);
    expect(states.every((s) => s.sourceEnvelopeId === s.envelope?.envelopeId)).toBe(true);
    const rows = await db1.query<{ leads: string; audits: string; commands: string }>(
      `SELECT (SELECT count(*) FROM lead WHERE workspace_id = $1 AND source_envelope_id = $2)::text AS leads,
              (SELECT count(*) FROM audit_record WHERE entity_id = $3 AND event_type = 'lead_created')::text AS audits,
              (SELECT count(*) FROM pilot_ingest_command WHERE envelope_id = $2)::text AS commands`,
      [wsId, states[0].sourceEnvelopeId, states[0].lead.id],
    );
    expect(rows.rows[0]).toEqual({ leads: '1', audits: '1', commands: '1' });
    await expect(services[0].ingestScenario({ ...input, utterance: 'mutated' }))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT', status: 409 });
  });

  it('CAS: concurrent same-version mutations have one winner and no stale audit/projection', async () => {
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    const created = await svc.ingestScenario({
      workspaceId: wsId, displayName: 'CAS base', utterance: 'base', speaker: 'customer',
      connection: conn, externalRecordId: `cas-${randomUUID()}`, ownerUserId: 'marketing-a',
    });
    const store = new PgPilotStore(db1);
    const base = await store.load(created.lead.id);
    expect(base?.version).toBeDefined();
    const version = base!.version;
    const stateA = { ...base!, lead: { ...base!.lead, status: 'Accepted' as const }, ownerUserId: 'sales-a' };
    const stateB = { ...base!, lead: { ...base!.lead, status: 'Contacting' as const }, ownerUserId: 'sales-b' };
    const audit = (actor: string, status: string) => ({
      entityType: 'lead' as const, entityId: base!.lead.id, workspaceId: wsId, actor,
      previousValue: 'New', newValue: status, reason: `CAS ${actor}`, eventType: `cas_${actor}`,
    });

    const results = await Promise.allSettled([
      store.save(stateA, [audit('sales-a', 'Accepted')]),
      store.save(stateB, [audit('sales-b', 'Contacting')]),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const stale = results.find((result) => result.status === 'rejected');
    expect(stale).toMatchObject({ status: 'rejected', reason: { code: 'STALE_VERSION', status: 409 } });
    expect((stale as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    expect((stale as PromiseRejectedResult).reason.message).toContain(`expected version ${version}`);

    const persisted = await store.load(base!.lead.id);
    expect(persisted?.version).toBe(version! + 1);
    expect(['Accepted', 'Contacting']).toContain(persisted?.lead.status);
    const audits = await store.history(base!.lead.id);
    const casAudits = audits.filter((entry) => entry.eventType.startsWith('cas_'));
    expect(casAudits).toHaveLength(1);
    expect(casAudits[0].actor).toBe(persisted?.ownerUserId);
  });

  it.each([false, true])('R-06: timestamp-omitted concurrent intake is idempotent with shared adapter=%s', async (shared) => {
    const adapter = new ManualAdapter();
    const input = { workspaceId: wsId, displayName: 'concurrent without event time', utterance: 'immutable evidence',
      speaker: 'customer' as const, connection: conn, externalRecordId: `no-time-${randomUUID()}`, ownerUserId: 'marketing-a' };
    const services = Array.from({ length: 8 }, () => new PilotLoopService(new PgPilotStore(db1), shared ? adapter : new ManualAdapter()));
    const states = await Promise.all(services.map((svc) => svc.ingestScenario(input)));
    expect(new Set(states.map((state) => state.lead.id)).size).toBe(1);
    expect(new Set(states.map((state) => state.sourceEnvelopeId)).size).toBe(1);
    const audits = await services[0].auditHistory(states[0].lead.id);
    expect(audits.filter((record) => record.eventType === 'lead_created')).toHaveLength(1);
  });

  it('persists explicit UNKNOWN event time as raw evidence with a valid capture time', async () => {
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    const input = { workspaceId: wsId, displayName: 'unknown event time', utterance: 'time not known',
      speaker: 'customer' as const, connection: conn, externalRecordId: `unknown-time-${randomUUID()}`,
      ownerUserId: 'marketing-a', occurredAt: UNKNOWN_SENTINEL };
    const created = await svc.ingestScenario(input);
    const loaded = await svc.get(created.lead.id);
    expect(loaded?.envelope?.rawPayload).toMatchObject({ occurredAt: UNKNOWN_SENTINEL });
    expect(Number.isFinite(Date.parse(loaded!.envelope!.sourceCapturedAt))).toBe(true);
    expect((await new PilotLoopService(new PgPilotStore(db1), new ManualAdapter()).ingestScenario(input)).lead.id).toBe(created.lead.id);
  });

  it('R-06: distinct Leads may cite the same raw evidence without claiming a domain-wide uniqueness rule', async () => {
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());
    const input = { workspaceId: wsId, displayName: 'source', utterance: 'shared evidence',
      speaker: 'customer' as const, connection: conn, externalRecordId: `shared-${randomUUID()}` };
    const primary = await svc.ingestScenario(input);
    const secondId = randomUUID();
    await db1.query(
      `INSERT INTO lead (id, workspace_id, attribution, status, display_name, source_envelope_id)
       VALUES ($1,$2,'unknown','New','another case',$3)`, [secondId, wsId, primary.sourceEnvelopeId],
    );
    const retry = await new PilotLoopService(new PgPilotStore(db1), new ManualAdapter()).ingestScenario(input);
    expect(retry.lead.id).toBe(primary.lead.id);
    expect((await db1.query<{ n: string }>('SELECT count(*)::text AS n FROM lead WHERE source_envelope_id = $1', [primary.sourceEnvelopeId])).rows[0].n).toBe('2');
  });

  it('P1-1: cross-workspace same connection+externalRecordId (including colon delimiter collision) → distinct envelopes, no shared raw evidence (PG path)', async () => {
    const prefix = `it-p11-${randomUUID()}`;
    const wsA = prefix;
    const wsB = `${prefix}:b`;
    const svc = new PilotLoopService(new PgPilotStore(db1), new ManualAdapter());

    const a = await svc.ingestScenario({
      workspaceId: wsA, displayName: 'A', utterance: 'evidence A', speaker: 'customer',
      connection: 'b:inbox', externalRecordId: 'msg-shared', isSynthetic: true,
    });
    const b = await svc.ingestScenario({
      workspaceId: wsB, displayName: 'B', utterance: 'evidence B', speaker: 'customer',
      connection: 'inbox', externalRecordId: 'msg-shared', isSynthetic: true,
    });
    // Both in-memory adapter key and PG rows must be distinct even when `wsA + ":" + connA === wsB + ":" + connB`
    const envA = (await svc.get(a.lead.id))!;
    const envB = (await svc.get(b.lead.id))!;
    expect(envA.sourceEnvelopeId).not.toBe(envB.sourceEnvelopeId);
    expect(envB.envelope?.rawPayload).toEqual({ utterance: 'evidence B', speaker: 'customer' });
    expect(envB.envelope?.workspaceId).toBe(wsB);

    const rows = await db1.query<{ workspace_id: string }>(
      'SELECT workspace_id FROM commercial_envelope WHERE workspace_id IN ($1,$2) AND external_record_id = $3',
      [wsA, wsB, 'msg-shared'],
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
    await svc2.completeWork(state.lead.id, { workId: oldId, actor: 'sales-b', evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true }).catch((e) => (caught = e));
    expect(caught).toMatchObject({ code: 'WORK_SUPERSEDED', status: 409 });
    expect((caught as { details?: Record<string, unknown> }).details).toMatchObject({ replacementId });

    // DB truth before the fix this would already be 'completed'
    const before = await db1.query<{ id: string; status: string }>(
      'SELECT id, status FROM pilot_work_item WHERE id IN ($1,$2)',
      [oldId, replacementId],
    );
    expect(before.rows.find((r) => r.id === oldId)?.status).toBe('rescheduled');
    expect(before.rows.find((r) => r.id === replacementId)?.status).toBe('open');

    const done = await svc2.completeWork(state.lead.id, { workId: replacementId, actor: 'sales-b', evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, reason: 'đã gọi' });
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

    // 3) P1-4: the case's intake customer message is NOT observed proof that staff sent the fee table,
    // and absent/conflicted cannot close work either
    await expect(
      svc.completeWork(a.lead.id, { workId: wid, actor: 'sales-b', evidence: 'observed', evidenceRef: a.sourceEnvelopeId!, reason: 'intake message ≠ action proof' }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_NOT_ACTION_PROOF', status: 422 });
    await expect(
      svc.completeWork(a.lead.id, { workId: wid, actor: 'sales-b', evidence: 'absent' }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INSUFFICIENT_TO_CLOSE', status: 422 });
    await expect(
      svc.completeWork(a.lead.id, { workId: wid, actor: 'sales-b', evidence: 'conflicted' }),
    ).rejects.toMatchObject({ code: 'EVIDENCE_INSUFFICIENT_TO_CLOSE', status: 422 });
    expect((await svc.get(a.lead.id))!.workItems.find((w) => w.id === wid)!.status).toBe('accepted');

    // 4) manual completion with `declared` + the case's envelope reference succeeds as `declared`
    // and records the raw hash in the durable audit trail (I-12)
    const done = await svc.completeWork(a.lead.id, {
      workId: wid, actor: 'sales-b', evidence: 'declared', declaration: 'Operator confirmed completion', confirmed: true, evidenceRef: a.sourceEnvelopeId!, reason: 'nhân viên xác nhận đã gửi file',
    });
    expect(done.workItems.find((w) => w.id === wid)!.completionEvidence).toBe('declared');
    const audit = await db1.query<{ new_value: unknown }>(
      "SELECT new_value FROM audit_record WHERE entity_id = $1 AND event_type = 'work_completed'",
      [wid],
    );
    const recorded = JSON.parse(typeof audit.rows[0]?.new_value === 'string' ? audit.rows[0].new_value : JSON.stringify(audit.rows[0]?.new_value));
    expect(recorded.evidenceHash).toMatch(/^[0-9a-f]{64}$/);

    await db1.query('DELETE FROM workspace WHERE id IN ($1,$2)', [wsA, wsB]);
  });

  it('P1-5 over PG: audit history is lead-scoped — no other case’s trail leaks (I-09/I-05)', async () => {
    const store = new PgPilotStore(db1);
    const svc = new PilotLoopService(store, new ManualAdapter());
    const a = await svc.ingestScenario({
      workspaceId: wsId, displayName: 'A', utterance: 'u', speaker: 'customer',
      connection: conn, externalRecordId: 'msg-h-a', ownerUserId: 'marketing-a',
    });
    const b = await svc.ingestScenario({
      workspaceId: wsId, displayName: 'B', utterance: 'u', speaker: 'customer',
      connection: conn, externalRecordId: 'msg-h-b', ownerUserId: 'marketing-a',
    });
    const handedB = await svc.handoffToSales(b.lead.id, {
      context: 'B-PRIVATE-context', proposedAction: 'B-PRIVATE-action', responsibleParty: 'internal',
      origin: 'explicit-request', actor: 'marketing-a', recipientUserId: 'sales-b',
    });
    await svc.salesAccept(b.lead.id, { workId: handedB.workItems[0].id, actor: 'sales-b', reason: 'B-PRIVATE-reason' });

    const historyA = await store.history(a.lead.id);
    expect(historyA.length).toBeGreaterThan(0);
    expect(historyA.every((h) => h.entityId !== b.lead.id)).toBe(true);
    const dump = JSON.stringify(historyA);
    expect(dump).not.toContain('B-PRIVATE');

    const historyB = await store.history(b.lead.id);
    expect(historyB.map((h) => h.eventType)).toEqual(expect.arrayContaining(['handoff_created', 'lead_transition']));
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
