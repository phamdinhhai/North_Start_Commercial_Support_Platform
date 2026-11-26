import { validDeliveryEnvelope } from './assertion-envelope.validation';
import type { AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
import type { AssertionSink } from '../../ports/governed-action';
import type { SqlExecutor } from '../postgres/postgres.service';

export interface DeliveryStatus {
  readonly assertionId: string; readonly status: 'PENDING' | 'LEASED' | 'DELIVERED' | 'FAILED';
  readonly attempts: number; readonly nextAttemptAt: string; readonly lastError: string | null;
}
interface Claim { workspace_id: string; assertion_id: string; envelope: AssertionEnvelope; attempts: number; lease_token: string }

/**
 * ADR-005 / ADR-007 internal evidence delivery worker (at-least-once; sinks MUST deduplicate
 * `(workspaceId, assertionId)`). Operates strictly over immutable `assertion_outbox` rows; has NO
 * `ActionExecutor` dependency and can never dispatch or re-dispatch provider actions.
 */
export class PgAssertionDelivery {
  constructor(private readonly db: SqlExecutor, private readonly sink: AssertionSink,
    private readonly options = { batchSize: 20, maxAttempts: 5, leaseMs: 30_000, timeoutMs: 10_000, backoffMs: 1_000 }) {
    if (!Object.values(options).every((v) => Number.isSafeInteger(v) && v > 0) || options.batchSize > 100 ||
      options.maxAttempts > 20 || options.timeoutMs >= options.leaseMs) throw new Error('INVALID_DELIVERY_OPTIONS');
  }
  async runOnce(): Promise<number> {
    await this.db.query(`UPDATE assertion_outbox SET status='FAILED',last_error='LEASE_EXPIRED',lease_token=NULL,lease_until=NULL
      WHERE status='LEASED' AND lease_until <= clock_timestamp() AND attempts >= $1`, [this.options.maxAttempts]);
    const result = await this.db.query<Claim>(`WITH ready AS (
      SELECT workspace_id,assertion_id FROM assertion_outbox WHERE attempts < $1 AND
      ((status='PENDING' AND next_attempt_at <= clock_timestamp()) OR (status='LEASED' AND lease_until <= clock_timestamp()))
      ORDER BY next_attempt_at, created_at, assertion_id LIMIT $2 FOR UPDATE SKIP LOCKED)
      UPDATE assertion_outbox o SET status='LEASED',attempts=o.attempts+1,lease_token=gen_random_uuid(),
      lease_until=clock_timestamp()+$3*interval '1 millisecond' FROM ready r
      WHERE o.workspace_id=r.workspace_id AND o.assertion_id=r.assertion_id
      RETURNING o.workspace_id,o.assertion_id,o.envelope,o.attempts,o.lease_token`,
    [this.options.maxAttempts, this.options.batchSize, this.options.leaseMs]);
    await Promise.all(result.rows.map((row) => this.deliver(row)));
    return result.rowCount ?? 0;
  }
  private async deliver(row: Claim): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!validDeliveryEnvelope(row.envelope, row.workspace_id, row.assertion_id)) throw new Error('INVALID_ENVELOPE');
      await Promise.race([this.sink.emit(row.envelope), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SINK_TIMEOUT')), this.options.timeoutMs);
      })]);
      await this.db.query(`UPDATE assertion_outbox SET status='DELIVERED',delivered_at=clock_timestamp(),last_error=NULL,
        lease_token=NULL,lease_until=NULL WHERE workspace_id=$1 AND assertion_id=$2 AND lease_token=$3 AND status='LEASED'`,
      [row.workspace_id, row.assertion_id, row.lease_token]);
    } catch (error) {
      const code = error instanceof Error && ['INVALID_ENVELOPE', 'SINK_TIMEOUT', 'ENVELOPE_CONFLICT'].includes(error.message) ? error.message : 'SINK_FAILED';
      await this.db.query(`UPDATE assertion_outbox SET status=$4,last_error=$6,lease_token=NULL,lease_until=NULL,
        next_attempt_at=clock_timestamp()+$5*interval '1 millisecond' WHERE workspace_id=$1 AND assertion_id=$2 AND lease_token=$3 AND status='LEASED'`,
      [row.workspace_id, row.assertion_id, row.lease_token, code === 'INVALID_ENVELOPE' || code === 'ENVELOPE_CONFLICT' || row.attempts >= this.options.maxAttempts ? 'FAILED' : 'PENDING',
        Math.min(3_600_000, this.options.backoffMs * 2 ** (row.attempts - 1)), code]);
    } finally { if (timer) clearTimeout(timer); }
  }
  /** Internal admin tooling only; exposes no raw envelope/error. */
  async inspect(workspaceId: string): Promise<DeliveryStatus[]> {
    const rows = await this.db.query<{ assertion_id: string; status: DeliveryStatus['status']; attempts: number; next_attempt_at: Date; last_error: string | null }>(
      `SELECT assertion_id,status,attempts,next_attempt_at,last_error FROM assertion_outbox WHERE workspace_id=$1 ORDER BY created_at DESC, assertion_id DESC LIMIT 100`, [workspaceId]);
    return rows.rows.map((r) => ({ assertionId: r.assertion_id, status: r.status, attempts: r.attempts, nextAttemptAt: r.next_attempt_at.toISOString(), lastError: r.last_error }));
  }
}

/** Append-only durable evidence sink (ADR-005); never a Commercial State mutation. */
export class PgAssertionInbox implements AssertionSink {
  constructor(private readonly db: SqlExecutor) {}
  async emit(envelope: AssertionEnvelope): Promise<void> {
    if (!validDeliveryEnvelope(envelope, envelope.workspaceId, envelope.assertionId)) throw new Error('INVALID_ENVELOPE');
    const result = await this.db.query(`INSERT INTO assertion_inbox(workspace_id,assertion_id,envelope) VALUES ($1,$2,$3::jsonb)
      ON CONFLICT(workspace_id,assertion_id) DO NOTHING RETURNING assertion_id`, [envelope.workspaceId, envelope.assertionId, JSON.stringify(envelope)]);
    if (!result.rowCount) {
      const same = await this.db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2 AND envelope=$3::jsonb', [envelope.workspaceId, envelope.assertionId, JSON.stringify(envelope)]);
      if (same.rowCount !== 1) throw new Error('ENVELOPE_CONFLICT');
    }
  }
}
