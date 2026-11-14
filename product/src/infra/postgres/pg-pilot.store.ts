import { Inject, Injectable } from '@nestjs/common';
import { PostgresService, type SqlExecutor } from '../../infra/postgres/postgres.service';
import type { AuditRecord } from '../../ports/audit';
import type { CommercialEnvelope } from '../../domain/envelope/envelope';
import {
  AuditDbRow,
  EnvelopeDbRow,
  HandoffDbRow,
  LeadDbRow,
  OutcomeDbRow,
  WorkDbRow,
  iso,
  toEnvelope,
  toHandoff,
  toLead,
  toOutcome,
  toWork,
} from '../../infra/postgres/repositories/pilot-persistence.types';
import { decodePilotQueueCursor, encodePilotQueueCursor, PilotStaleVersionError } from '../../ports/pilot-loop.types';
import { assertSameEnvelope } from '../../ports/pilot-loop.store';
import type { PilotLoopState, AuditHistoryEntry, PilotQueueItem, PilotQueuePage, PilotQueueQuery } from '../../ports/pilot-loop.types';
import type { EvidenceRefRecord, PilotLoopStore } from '../../ports/pilot-loop.store';

/**
 * Durable pilot-loop store (C-03, C-06, R-18) — PostgreSQL-backed.
 *
 * `save` runs ONE transaction: envelope insert (I-12 append), lead upsert
 * (version bump), handoff/outcome/work-item appends (immutable — ON CONFLICT
 * DO NOTHING), then audit appends. Any failure rolls back everything, so a
 * mutation is never persisted without its audit trail (QA-35).
 *
 * Durability contract proven by `scripts/pilot-smoke.sh` steps 12–14:
 * create → handle over HTTP → restart the process → read back full state+history.
 */
@Injectable()
export class PgPilotStore implements PilotLoopStore {
  constructor(@Inject(PostgresService) private readonly db: PostgresService) {}

  async load(leadId: string): Promise<PilotLoopState | undefined> {
    const leadRes = await this.db.query<LeadDbRow>(
      `SELECT id, workspace_id, customer_id, conversation_source, acquisition_lineage,
              attribution, status, display_name, created_at, owner_user_id, source_envelope_id, version
         FROM lead WHERE id = $1`,
      [leadId],
    );
    const leadRow = leadRes.rows[0];
    if (!leadRow) return undefined;

    const [handoffs, outcomes, works, envelopes] = await Promise.all([
      this.db.query<HandoffDbRow>(
        `SELECT id, lead_id, workspace_id, context, evidence_refs, proposed_next_action, created_at, recipient_user_id
           FROM handoff WHERE lead_id = $1 ORDER BY created_at`,
        [leadId],
      ),
      this.db.query<OutcomeDbRow>(
        `SELECT id, lead_id, workspace_id, value, acquisition_mode, assertion_status, actor, timestamp, reason, supersedes_outcome_id
           FROM outcome WHERE lead_id = $1 ORDER BY timestamp`,
        [leadId],
      ),
      this.db.query<WorkDbRow>(
        `SELECT id, lead_id, workspace_id, action, responsible_party, origin, status, completion_evidence,
                occurred_at, due_at, evidence_ref, recorded_at, supersedes_work_id, actor, reason
           FROM pilot_work_item WHERE lead_id = $1 ORDER BY recorded_at`,
        [leadId],
      ),
      leadRow.source_envelope_id
        ? this.db.query<EnvelopeDbRow>(
            `SELECT id, workspace_id, raw_payload, raw_payload_hash, source_captured_at, ingested_at, connection,
                    external_record_id, external_event_type, mapping_status, mapping_error, canonical_projection, is_synthetic,
                    acquisition_mode, acquisition_source
               FROM commercial_envelope WHERE id = $1`,
            [leadRow.source_envelope_id],
          )
        : Promise.resolve({ rows: [] as EnvelopeDbRow[] }),
    ]);

    const latestHandoff = handoffs.rows.at(-1);
    return {
      lead: toLead(leadRow),
      handoff: latestHandoff ? toHandoff(latestHandoff) : undefined,
      workItems: works.rows.map(toWork),
      outcomes: outcomes.rows.map(toOutcome),
      ownerUserId: leadRow.owner_user_id ?? undefined,
      sourceEnvelopeId: leadRow.source_envelope_id ?? undefined,
      version: leadRow.version,
      handoffRecipient: latestHandoff?.recipient_user_id ?? undefined,
      envelope: envelopes.rows[0] ? toEnvelope(envelopes.rows[0]) : undefined,
    };
  }

  async queue(query: PilotQueueQuery): Promise<PilotQueuePage> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const cursor = decodePilotQueueCursor(query, query.cursor);
    const params: unknown[] = [query.workspaceId];
    const where = ['w.workspace_id = $1'];
    if (query.actorRole !== 'admin' && query.actorRole !== 'manager') {
      params.push(query.actorId);
      where.push(`(l.owner_user_id = $${params.length} OR w.actor = $${params.length})`);
    }
    if (query.status) { params.push(query.status); where.push(`w.status = $${params.length}`); }
    if (query.ownerUserId) { params.push(query.ownerUserId); where.push(`l.owner_user_id = $${params.length}`); }
    if (query.recipientUserId) { params.push(query.recipientUserId); where.push(`w.actor = $${params.length}`); }
    if (query.dueBefore) { params.push(query.dueBefore); where.push(`w.due_at < $${params.length}`); }
    if (query.dueAfter) { params.push(query.dueAfter); where.push(`w.due_at > $${params.length}`); }
    if (cursor) {
      if (cursor.dueAt === null) {
        params.push(cursor.recordedAt, cursor.id);
        const cursorParam = params.length - 1;
        where.push(`w.due_at IS NULL AND (w.recorded_at, w.id) > ($${cursorParam}, $${cursorParam + 1})`);
      } else {
        params.push(cursor.dueAt, cursor.recordedAt, cursor.id);
        const cursorParam = params.length - 2;
        where.push(`(w.due_at IS NULL OR w.due_at > $${cursorParam} OR (w.due_at = $${cursorParam} AND (w.recorded_at, w.id) > ($${cursorParam + 1}, $${cursorParam + 2})))`);
      }
    }
    params.push(limit + 1);
    const result = await this.db.query<WorkDbRow & { lead_status: string; display_name: string; handoff_recipient: string | null }>(
      `SELECT w.id,w.lead_id,w.workspace_id,w.action,w.responsible_party,w.origin,w.status,w.completion_evidence,w.occurred_at,w.due_at,w.evidence_ref,w.recorded_at,w.supersedes_work_id,w.actor,w.reason,
              l.status AS lead_status,l.display_name,
              (SELECT h.recipient_user_id FROM handoff h WHERE h.lead_id = l.id ORDER BY h.created_at DESC LIMIT 1) AS handoff_recipient
         FROM pilot_work_item w JOIN lead l ON l.id = w.lead_id
        WHERE ${where.join(' AND ')}
        ORDER BY w.due_at NULLS LAST,w.recorded_at,w.id LIMIT $${params.length}`,
      params,
    );
    const rows = result.rows.map((row) => toQueueItem(row));
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return { items, ...(rows.length > limit && last ? { nextCursor: encodePilotQueueCursor(query, last) } : {}) };
  }

  async loadIngest(key: Pick<CommercialEnvelope, 'workspaceId' | 'connection' | 'externalRecordId'>): Promise<PilotLoopState | undefined> {
    const found = await this.db.query<{ lead_id: string }>(
      `SELECT pic.lead_id FROM pilot_ingest_command pic
         JOIN commercial_envelope ce ON ce.id = pic.envelope_id
        WHERE ce.workspace_id = $1 AND ce.connection = $2 AND ce.external_record_id = $3`,
      [key.workspaceId, key.connection, key.externalRecordId],
    );
    return found.rows[0] ? this.load(found.rows[0].lead_id) : undefined;
  }

  /**
   * P1-4: resolve an evidence pointer against the DURABLE envelope table. Returns only the
   * scope + hash fields needed to validate a reference — never another tenant's payload.
   */
  async loadEvidence(envelopeId: string): Promise<EvidenceRefRecord | undefined> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(envelopeId)) return undefined;
    const res = await this.db.query<{ workspace_id: string; raw_payload_hash: string; source_captured_at: Date | string; acquisition_mode: string; acquisition_source: string; speaker: string | null }>(
      "SELECT workspace_id, raw_payload_hash, source_captured_at, acquisition_mode, acquisition_source, raw_payload->>'speaker' AS speaker FROM commercial_envelope WHERE id = $1",
      [envelopeId],
    );
    const row = res.rows[0];
    if (!row) return undefined;
    return {
      envelopeId,
      workspaceId: row.workspace_id,
      rawPayloadHash: row.raw_payload_hash,
      sourceCapturedAt: iso(row.source_captured_at),
      speaker: row.speaker ?? null,
      acquisitionMode: row.acquisition_mode as EvidenceRefRecord['acquisitionMode'],
      acquisitionSource: row.acquisition_source as EvidenceRefRecord['acquisitionSource'],
    };
  }

  async history(leadId: string): Promise<readonly AuditHistoryEntry[]> {
    const res = await this.db.query<AuditDbRow>(
      `SELECT id, entity_type, entity_id, workspace_id, actor, event_type, previous_value, new_value, reason, timestamp, supersedes_record_id
         FROM audit_record
        WHERE workspace_id = (SELECT workspace_id FROM lead WHERE id = $1::uuid)
          AND (
            entity_id = $1::text
            OR entity_id IN (SELECT id::text FROM handoff WHERE lead_id = $1::uuid)
            OR entity_id IN (SELECT id::text FROM outcome WHERE lead_id = $1::uuid)
            OR entity_id IN (SELECT id::text FROM pilot_work_item WHERE lead_id = $1::uuid)
          )
        ORDER BY timestamp ASC, id ASC`,
      [leadId],
    );
    return res.rows.map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      workspaceId: r.workspace_id,
      actor: r.actor,
      eventType: r.event_type ?? '',
      previousValue: r.previous_value == null ? null : typeof r.previous_value === 'string' ? r.previous_value : JSON.stringify(r.previous_value),
      newValue: typeof r.new_value === 'string' ? r.new_value : JSON.stringify(r.new_value),
      reason: r.reason,
      timestamp: iso(r.timestamp),
      supersedesRecordId: r.supersedes_record_id,
      metadata: { trust: 'recorded' as const, provenance: 'audit_record' as const, unknown: ['business_truth', 'runtime_causality'] as const },
    }));
  }

  async save(state: PilotLoopState, audits: readonly Omit<AuditRecord, 'id' | 'timestamp'>[], options: { readonly checkSourceCapturedAt?: boolean } = {}): Promise<PilotLoopState> {
    let committed: PilotLoopState = state;
    let winningLeadId: string | undefined;
    await this.db.withTransaction(async (tx) => {
      // Demo/synthetic workspaces được seed tự động (idempotent) — production workspace
      // tạo qua provisioning path riêng; pilot không yêu cầu admin tạo trước.
      await tx.query('INSERT INTO workspace (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [
        state.lead.workspaceId,
        `pilot-${state.lead.workspaceId}`,
      ]);

      const persistedEnvelopeId = state.envelope && state.version === undefined
        ? await insertEnvelope(tx, state.envelope, options)
        : state.sourceEnvelopeId ?? null;

      // Exact intake command reservation. The envelope UNIQUE key serializes concurrent
      // writers; the command FK (deferred until COMMIT) binds the winning Lead atomically
      // with its envelope and audit. Reusing evidence outside this command is unrestricted.
      if (state.version === undefined && state.envelope) {
        const claimed = await tx.query<{ lead_id: string }>(
          `INSERT INTO pilot_ingest_command (envelope_id, lead_id) VALUES ($1,$2)
           ON CONFLICT (envelope_id) DO NOTHING RETURNING lead_id`,
          [persistedEnvelopeId, state.lead.id],
        );
        if (!claimed.rows[0]) {
          const winner = await tx.query<{ lead_id: string }>(
            'SELECT lead_id FROM pilot_ingest_command WHERE envelope_id = $1', [persistedEnvelopeId],
          );
          if (!winner.rows[0]) throw new Error('pilot ingest command reservation missing after conflict');
          // This transaction made no writes visible. The caller receives the CURRENT
          // committed aggregate (including later handoffs/outcomes), not a stale snapshot.
          winningLeadId = winner.rows[0].lead_id;
          return;
        }
      }

      const expectedVersion = state.version;
      const leadMutation = await tx.query<{ version: number }>(
        `INSERT INTO lead (id, workspace_id, conversation_source, acquisition_lineage, attribution,
                           status, display_name, created_at, owner_user_id, source_envelope_id, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1)
         ON CONFLICT (id) DO UPDATE
            SET status = EXCLUDED.status,
                owner_user_id = EXCLUDED.owner_user_id,
                updated_at = now(),
                version = lead.version + 1
          WHERE lead.version = $11
         RETURNING version`, [
          state.lead.id,
          state.lead.workspaceId,
          state.lead.conversationSource ?? null,
          state.lead.acquisitionLineage ?? null,
          state.lead.attribution,
          state.lead.status,
          state.lead.displayName,
          state.lead.createdAt,
          state.ownerUserId ?? null,
          persistedEnvelopeId,
          expectedVersion ?? 0,
        ],
      );
      if (!leadMutation.rows[0]) {
        const current = await tx.query<{ version: number }>('SELECT version FROM lead WHERE id = $1', [state.lead.id]);
        throw new PilotStaleVersionError(state.lead.id, expectedVersion, current.rows[0]?.version ?? 0);
      }
      committed = { ...state, sourceEnvelopeId: persistedEnvelopeId ?? undefined,
        ...(state.envelope && persistedEnvelopeId !== state.envelope.envelopeId
          ? { envelope: { ...state.envelope, envelopeId: persistedEnvelopeId as CommercialEnvelope['envelopeId'] } }
          : {}), version: leadMutation.rows[0].version };

      if (state.handoff) {
        await tx.query(
          `INSERT INTO handoff (id, lead_id, workspace_id, context, evidence_refs, proposed_next_action, created_at, recipient_user_id)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [
            state.handoff.id,
            state.handoff.leadId,
            state.handoff.workspaceId,
            state.handoff.context,
            JSON.stringify(state.handoff.evidenceRefs),
            state.handoff.proposedNextAction ? JSON.stringify(state.handoff.proposedNextAction) : null,
            state.handoff.createdAt,
            state.handoffRecipient ?? null,
          ],
        );
      }

      for (const w of state.workItems) {
        // Current-state projection upsert: immutable identity (lead, action, party,
        // origin, supersedes) set once; status/evidence/time are the evolving
        // projection — full history lives in audit_record (I-05, canonical
        // projection selects current state, like lead.status).
        await tx.query(
          `INSERT INTO pilot_work_item (id, lead_id, workspace_id, action, responsible_party, origin, status,
                                         completion_evidence, occurred_at, due_at, evidence_ref, recorded_at,
                                         supersedes_work_id, actor, reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
           ON CONFLICT (id) DO UPDATE
              SET status = EXCLUDED.status,
                  completion_evidence = EXCLUDED.completion_evidence,
                  occurred_at = EXCLUDED.occurred_at,
                  due_at = EXCLUDED.due_at,
                  evidence_ref = EXCLUDED.evidence_ref,
                  actor = EXCLUDED.actor,
                  reason = EXCLUDED.reason`,
          [
            w.id,
            w.leadId,
            w.workspaceId,
            w.action,
            w.responsibleParty,
            w.origin,
            w.status,
            w.completionEvidence,
            w.occurredAt,
            w.dueAt ?? null,
            w.evidenceRef ?? null,
            w.recordedAt,
            w.supersedesWorkId ?? null,
            w.actor,
            w.reason ?? null,
          ],
        );
      }

      for (const o of state.outcomes) {
        await tx.query(
          `INSERT INTO outcome (id, lead_id, workspace_id, value, acquisition_mode, assertion_status, actor,
                                timestamp, reason, supersedes_outcome_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
          [
            o.id,
            o.leadId,
            o.workspaceId,
            o.value,
            o.acquisitionMode,
            o.assertionStatus,
            o.actor,
            o.timestamp,
            o.reason ?? null,
            o.supersedesOutcomeId ?? null,
          ],
        );
      }

      for (const a of audits) {
        await tx.query(
          `INSERT INTO audit_record (entity_type, entity_id, workspace_id, actor, previous_value, new_value,
                                     reason, event_type, supersedes_record_id)
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9)`,
          [
            a.entityType,
            a.entityId,
            a.workspaceId,
            a.actor,
            a.previousValue !== undefined ? JSON.stringify(a.previousValue) : null,
            JSON.stringify(a.newValue),
            a.reason ?? null,
            a.eventType ?? null,
            a.supersedesRecordId ?? null,
          ],
        );
      }
    });
    if (winningLeadId) {
      const winner = await this.load(winningLeadId);
      if (!winner) throw new Error('pilot ingest command references a missing lead');
      return winner;
    }
    return committed;
  }
}

function toQueueItem(row: WorkDbRow & { lead_status: string; display_name: string; handoff_recipient: string | null }): PilotQueueItem {
  return {
    id: row.id, leadId: row.lead_id as PilotQueueItem['leadId'], workspaceId: row.workspace_id, action: row.action,
    responsibleParty: row.responsible_party as PilotQueueItem['responsibleParty'], origin: row.origin as PilotQueueItem['origin'],
    status: row.status as PilotQueueItem['status'], completionEvidence: row.completion_evidence as PilotQueueItem['completionEvidence'],
    occurredAt: row.occurred_at, ...(row.due_at !== null && { dueAt: iso(row.due_at) }), recordedAt: iso(row.recorded_at),
    ...(row.supersedes_work_id !== null && { supersedesWorkId: row.supersedes_work_id }), actor: row.actor,
    lead: { status: row.lead_status as PilotQueueItem['lead']['status'], displayName: row.display_name },
    ...(row.handoff_recipient ? { handoff: { recipientUserId: row.handoff_recipient } } : {}),
  };
}

async function insertEnvelope(tx: SqlExecutor, env: CommercialEnvelope, options: { readonly checkSourceCapturedAt?: boolean }): Promise<string> {
  // P1-1: idempotency scope = (workspace_id, connection, external_record_id) — R-06
  // within I-09. DO UPDATE (no-op) makes PG RETURN the id of the winning row whether
  // it was just inserted or already existed from a previous process — the lead FK must
  // reference THAT id. Different workspaces NEVER share a row.
  const res = await tx.query<{ id: string }>(
    `INSERT INTO commercial_envelope (id, schema_version, workspace_id, connection, external_record_id, external_event_type,
                                      source_captured_at, ingested_at, raw_payload, raw_payload_hash,
                                      mapping_status, mapping_error, canonical_projection, is_synthetic,
                                      acquisition_mode, acquisition_source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (workspace_id, connection, external_record_id) DO NOTHING
     RETURNING id`,
    [
      env.envelopeId,
      env.schemaVersion,
      env.workspaceId,
      env.connection,
      env.externalRecordId,
      env.externalEventType,
      env.sourceCapturedAt,
      env.ingestedAt,
      JSON.stringify(env.rawPayload),
      env.rawPayloadHash,
      env.mappingStatus,
      env.mappingError ?? null,
      env.canonicalProjection !== undefined ? JSON.stringify(env.canonicalProjection) : null,
      env.isSynthetic,
      env.acquisitionMode,
      env.acquisitionSource,
    ],
  );
  if (res.rows[0]) return res.rows[0].id;

  const existing = await tx.query<EnvelopeDbRow>(
    `SELECT id, workspace_id, raw_payload, raw_payload_hash, source_captured_at, ingested_at, connection,
            external_record_id, external_event_type, mapping_status, mapping_error, canonical_projection, is_synthetic,
            acquisition_mode, acquisition_source
       FROM commercial_envelope
      WHERE workspace_id = $1 AND connection = $2 AND external_record_id = $3`,
    [env.workspaceId, env.connection, env.externalRecordId],
  );
  const row = existing.rows[0];
  if (!row) throw new Error('idempotency conflict lookup found no envelope');
  assertSameEnvelope(toEnvelope(row), env, options);
  return row.id;
}
