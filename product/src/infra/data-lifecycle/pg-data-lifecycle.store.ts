import { randomUUID } from 'node:crypto';
import { DataLifecycleError, type DataLifecycleStore, type LifecycleDataClass, type LifecyclePolicy, type LifecyclePolicyInput, type LifecyclePreview } from '../../ports/data-lifecycle';
import type { TransactionRunner } from '../postgres/migrator';
import type { SqlExecutor } from '../postgres/postgres.service';

export class PgDataLifecycleStore implements DataLifecycleStore {
  constructor(private readonly db: TransactionRunner) {}
  private async audit(tx: SqlExecutor, workspace: string, actor: string, id: string, event: string, metadata: unknown) {
    await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value)
      VALUES ('data-lifecycle',$1,$2,$3,$4,$5::jsonb)`, [id, workspace, actor, event, JSON.stringify(metadata)]);
  }
  async configure(workspaceId: string, actorId: string, input: LifecyclePolicyInput): Promise<LifecyclePolicy> {
    return this.db.withTransaction(async tx => {
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`lifecycle:${workspaceId}:${input.dataClass}`]);
      const current = await tx.query<{ revision: number }>(`SELECT revision FROM data_lifecycle_policy
        WHERE workspace_id=$1 AND data_class=$2 ORDER BY revision DESC LIMIT 1`, [workspaceId, input.dataClass]);
      const revision = current.rows[0]?.revision ?? 0;
      if (revision !== input.expectedRevision) throw new DataLifecycleError('REVISION_CONFLICT', 409);
      await tx.query(`INSERT INTO data_lifecycle_policy(workspace_id,data_class,revision,retention_seconds,approval_ref,actor_id)
        VALUES ($1,$2,$3,$4,$5,$6)`, [workspaceId, input.dataClass, revision + 1, input.retentionSeconds, input.approvalRef, actorId]);
      await this.audit(tx, workspaceId, actorId, input.dataClass, 'DATA_LIFECYCLE_POLICY_CONFIGURED', { ...input, revision: revision + 1, planningOnly: true });
      return { ...input, revision: revision + 1 };
    });
  }
  async preview(workspaceId: string, actorId: string, dataClass: LifecycleDataClass): Promise<LifecyclePreview> {
    return this.db.withTransaction(async tx => {
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const policy = await tx.query<{ revision: number; retention_seconds: number }>(`SELECT revision,retention_seconds FROM data_lifecycle_policy
        WHERE workspace_id=$1 AND data_class=$2 ORDER BY revision DESC LIMIT 1`, [workspaceId, dataClass]);
      if (!policy.rows[0]) throw new DataLifecycleError('POLICY_REQUIRED', 409);
      // Server transaction time only; accepted evidence age starts at ingestion, never external timestamps.
      const clock = await tx.query<{ as_of: Date }>('SELECT transaction_timestamp() AS as_of');
      const asOf = clock.rows[0].as_of.toISOString();
      const table = dataClass === 'accepted_evidence' ? 'commercial_envelope' : 'audit_record';
      const column = dataClass === 'accepted_evidence' ? 'ingested_at' : 'timestamp';
      const count = await tx.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}
        WHERE workspace_id=$1 AND ${column} <= $2::timestamptz - ($3::integer * interval '1 second')`,
      [workspaceId, asOf, policy.rows[0].retention_seconds]);
      const eligibleCount = Number(count.rows[0].count);
      if (!Number.isSafeInteger(eligibleCount)) throw new Error('lifecycle count exceeds supported range');
      const result: LifecyclePreview = { id: randomUUID(), dataClass, policyRevision: policy.rows[0].revision, asOf, eligibleCount,
        disposition: 'BLOCKED_IMMUTABLE_HISTORY', executionAvailable: false };
      await tx.query(`INSERT INTO data_lifecycle_preview(id,workspace_id,data_class,policy_revision,actor_id,as_of,eligible_count,disposition)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [result.id, workspaceId, dataClass, result.policyRevision, actorId, asOf, eligibleCount, result.disposition]);
      await this.audit(tx, workspaceId, actorId, result.id, 'DATA_LIFECYCLE_PREVIEWED', result);
      return result;
    });
  }
}
