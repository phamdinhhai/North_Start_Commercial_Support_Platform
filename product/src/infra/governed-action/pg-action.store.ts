import { deepFreeze, parseCanonical } from '../../domain/governed-action/canonical-json';
import {
  GovernedActionError, type ActionConstraints, type ActionEvent, type ActionProposal, type ActionRefusal, type ActorKind,
  type ActionState, type GovernedActionErrorCode, type ProposalRefusal, type RiskClass, type TargetResource, type Transition,
} from '../../domain/governed-action/governed-action.types';
import type { ActionStore, CreateResult } from '../../ports/governed-action';
import type { TransactionRunner } from '../postgres/migrator';
import type { SqlExecutor } from '../postgres/postgres.service';

interface ProposalRow {
  id: string; workspace_id: string; request_key: string; capability_id: string; risk_class: RiskClass;
  target: TargetResource; arguments_canonical: string; argument_digest: string; proposer_kind: ActorKind;
  proposer_id: string; rationale: string; constraints: ActionConstraints; lead_id: string | null;
  commercial_event_ref: string | null; evidence_refs: string[];
  idempotency_key: string; created_at: Date; expires_at: Date; state: ActionState; version: number;
  attempts: number; projection: Pick<ActionProposal, 'preview' | 'approval' | 'execution' | 'outcome'>;
}

interface EventRow {
  workspace_id: string; proposal_id: string; sequence: number; event_type: ActionEvent['type'];
  from_state: ActionState | null; to_state: ActionState; actor_kind: ActorKind; actor_id: string;
  reason: string; data: ActionEvent['data']; recorded_at: Date;
}

interface ProposeRefusalRow {
  workspace_id: string; request_key: string; capability_id: string; lead_id: string | null; commercial_event_ref: string | null;
  code: GovernedActionErrorCode; actor_kind: ActorKind; actor_id: string; reason: string; details: string[]; recorded_at: Date;
}

interface RefusalRow {
  workspace_id: string; proposal_id: string; proposal_version: number; command: string; code: GovernedActionErrorCode;
  actor_kind: ActorKind; actor_id: string; reason: string; details: string[]; recorded_at: Date;
}

const PROPOSAL_COLUMNS = `id, workspace_id, request_key, capability_id, risk_class, target, arguments_canonical,
  argument_digest, proposer_kind, proposer_id, rationale, constraints, lead_id, idempotency_key, created_at,
  expires_at, state, version, attempts, projection, commercial_event_ref, evidence_refs`;

/**
 * PostgreSQL ActionStore (migration 011). Every transition is a single transaction:
 * CAS UPDATE on (workspace_id, id, version) + INSERT of the event with sequence = new version.
 * Events and refusals are append-only at the database level (triggers refuse UPDATE/DELETE/TRUNCATE).
 * Refusals are a separate table and never take part in the proposal CAS (A-m1).
 */
export class PgActionStore implements ActionStore {
  constructor(private readonly db: TransactionRunner & SqlExecutor) {}

  async create(t: Transition): Promise<CreateResult> {
    const p = t.proposal;
    if (p.version !== 1 || t.event.sequence !== 1) throw new GovernedActionError('INVALID_INPUT', 'new proposals start at version 1');
    return this.db.withTransaction(async (tx) => {
      const inserted = await tx.query(
        `INSERT INTO governed_action_proposal (${PROPOSAL_COLUMNS}, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21,$22::jsonb,$15)
         ON CONFLICT (workspace_id, request_key) DO NOTHING RETURNING id`,
        [p.id, p.workspaceId, p.requestKey, p.capabilityId, p.riskClass, JSON.stringify(p.target), p.canonicalArguments,
          p.argumentDigest, p.proposer.kind, p.proposer.id, p.rationale, JSON.stringify(p.constraints), p.leadId ?? null,
          p.idempotencyKey, p.createdAt, p.expiresAt, p.state, p.version, p.attempts, JSON.stringify(projectionOf(p)),
          p.commercialEventRef ?? null, JSON.stringify(p.evidenceRefs ?? [])],
      );
      if (inserted.rowCount === 0) {
        const existing = await tx.query<ProposalRow>(
          `SELECT ${PROPOSAL_COLUMNS} FROM governed_action_proposal WHERE workspace_id = $1 AND request_key = $2`,
          [p.workspaceId, p.requestKey],
        );
        if (!existing.rows[0]) throw new GovernedActionError('CONCURRENT_MODIFICATION', 'request key conflict could not be resolved');
        return { created: false, proposal: toProposal(existing.rows[0]) };
      }
      await insertEvent(tx, t.event);
      return { created: true, proposal: p };
    });
  }

  async get(workspaceId: string, proposalId: string): Promise<ActionProposal | undefined> {
    if (!isUuid(proposalId)) return undefined;
    const result = await this.db.query<ProposalRow>(
      `SELECT ${PROPOSAL_COLUMNS} FROM governed_action_proposal WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, proposalId],
    );
    return result.rows[0] ? toProposal(result.rows[0]) : undefined;
  }

  async transition(expectedVersion: number, t: Transition): Promise<void> {
    const p = t.proposal;
    if (p.version !== expectedVersion + 1 || t.event.sequence !== p.version) {
      throw new GovernedActionError('CONCURRENT_MODIFICATION', 'transition version is not contiguous');
    }
    await this.db.withTransaction(async (tx) => {
      const updated = await tx.query(
        `UPDATE governed_action_proposal
            SET state = $4, version = $5, attempts = $6, projection = $7::jsonb, updated_at = $8
          WHERE workspace_id = $1 AND id = $2 AND version = $3 AND argument_digest = $9`,
        [p.workspaceId, p.id, expectedVersion, p.state, p.version, p.attempts, JSON.stringify(projectionOf(p)),
          t.event.at, p.argumentDigest],
      );
      if (updated.rowCount !== 1) throw new GovernedActionError('CONCURRENT_MODIFICATION', 'proposal was modified concurrently');
      await insertEvent(tx, t.event);
    });
  }

  async events(workspaceId: string, proposalId: string): Promise<ActionEvent[]> {
    if (!isUuid(proposalId)) return [];
    const result = await this.db.query<EventRow>(
      `SELECT workspace_id, proposal_id, sequence, event_type, from_state, to_state, actor_kind, actor_id, reason, data, recorded_at
         FROM governed_action_event WHERE workspace_id = $1 AND proposal_id = $2 ORDER BY sequence`,
      [workspaceId, proposalId],
    );
    return result.rows.map((r) => deepFreeze({
      proposalId: r.proposal_id, workspaceId: r.workspace_id, sequence: r.sequence, type: r.event_type,
      fromState: r.from_state, toState: r.to_state, actor: { kind: r.actor_kind, id: r.actor_id },
      at: r.recorded_at.toISOString(), reason: r.reason, data: r.data,
    }));
  }

  async appendRefusal(r: ActionRefusal): Promise<void> {
    if (!isUuid(r.proposalId)) throw new GovernedActionError('NOT_FOUND', 'proposal not found');
    await this.db.query(
      `INSERT INTO governed_action_refusal
         (workspace_id, proposal_id, proposal_version, command, code, actor_kind, actor_id, reason, details, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [r.workspaceId, r.proposalId, r.proposalVersion, r.command, r.code, r.actor.kind, r.actor.id, r.reason,
        JSON.stringify(r.details), r.at],
    );
  }

  async appendProposalRefusal(r: ProposalRefusal): Promise<void> {
    await appendProposalRefusalRow(this.db, r);
  }

  async proposalRefusals(workspaceId: string): Promise<ProposalRefusal[]> {
    return readProposalRefusals(this.db, workspaceId);
  }

  async refusals(workspaceId: string, proposalId: string): Promise<ActionRefusal[]> {
    if (!isUuid(proposalId)) return [];
    const result = await this.db.query<RefusalRow>(
      `SELECT workspace_id, proposal_id, proposal_version, command, code, actor_kind, actor_id, reason, details, recorded_at
         FROM governed_action_refusal WHERE workspace_id = $1 AND proposal_id = $2 ORDER BY id`,
      [workspaceId, proposalId],
    );
    return result.rows.map((r) => deepFreeze({
      proposalId: r.proposal_id, workspaceId: r.workspace_id, proposalVersion: r.proposal_version, command: r.command,
      code: r.code, actor: { kind: r.actor_kind, id: r.actor_id }, at: r.recorded_at.toISOString(), reason: r.reason,
      details: r.details,
    }));
  }
}

/** Refused PROPOSE commands (ADR-005 R2-P-01): append-only table, no proposal FK. */
export async function appendProposalRefusalRow(db: SqlExecutor, r: ProposalRefusal): Promise<void> {
  await db.query(
    `INSERT INTO governed_action_propose_refusal
       (workspace_id, request_key, capability_id, lead_id, commercial_event_ref, code, actor_kind, actor_id, reason, details, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [r.workspaceId, r.requestKey, r.capabilityId, r.leadId ?? null, r.commercialEventRef ?? null, r.code, r.actor.kind, r.actor.id,
      r.reason, JSON.stringify(r.details), r.at],
  );
}

export async function readProposalRefusals(db: SqlExecutor, workspaceId: string): Promise<ProposalRefusal[]> {
  const result = await db.query<ProposeRefusalRow>(
    `SELECT workspace_id, request_key, capability_id, lead_id, commercial_event_ref, code, actor_kind, actor_id, reason, details, recorded_at
       FROM governed_action_propose_refusal WHERE workspace_id = $1 ORDER BY id`,
    [workspaceId],
  );
  return result.rows.map((r) => deepFreeze({
    workspaceId: r.workspace_id, requestKey: r.request_key, capabilityId: r.capability_id,
    ...(r.lead_id ? { leadId: r.lead_id } : {}), ...(r.commercial_event_ref ? { commercialEventRef: r.commercial_event_ref } : {}),
    code: r.code, actor: { kind: r.actor_kind, id: r.actor_id }, at: r.recorded_at.toISOString(), reason: r.reason, details: r.details,
  }));
}

async function insertEvent(tx: SqlExecutor, e: ActionEvent): Promise<void> {
  await tx.query(
    `INSERT INTO governed_action_event
       (workspace_id, proposal_id, sequence, event_type, from_state, to_state, actor_kind, actor_id, reason, data, recorded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)`,
    [e.workspaceId, e.proposalId, e.sequence, e.type, e.fromState, e.toState, e.actor.kind, e.actor.id, e.reason,
      JSON.stringify(e.data), e.at],
  );
}

function projectionOf(p: ActionProposal): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.preview) out.preview = p.preview;
  if (p.approval) out.approval = p.approval;
  if (p.execution) out.execution = p.execution;
  if (p.outcome) out.outcome = p.outcome;
  return out;
}

function toProposal(r: ProposalRow): ActionProposal {
  return deepFreeze({
    id: r.id, workspaceId: r.workspace_id, requestKey: r.request_key, capabilityId: r.capability_id,
    riskClass: r.risk_class, target: r.target, arguments: parseCanonical(r.arguments_canonical),
    canonicalArguments: r.arguments_canonical, argumentDigest: r.argument_digest,
    proposer: { kind: r.proposer_kind, id: r.proposer_id }, rationale: r.rationale, constraints: r.constraints,
    ...(r.lead_id ? { leadId: r.lead_id } : {}),
    ...(r.commercial_event_ref ? { commercialEventRef: r.commercial_event_ref } : {}), evidenceRefs: r.evidence_refs ?? [],
    idempotencyKey: r.idempotency_key,
    createdAt: r.created_at.toISOString(), expiresAt: r.expires_at.toISOString(), state: r.state,
    version: r.version, attempts: r.attempts, ...r.projection,
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
