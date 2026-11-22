import type { OperatorSyncFailure, SyncHealthReader, SyncHealthSource } from '../../ports/operator-sync-health';
import type { SqlExecutor } from '../postgres/postgres.service';
type Row={id:string;workspace_id:string;connection_id:string;provider:'pancake'|'meta-page';mode:'offline-synthetic'|'provider-read-only';status:SyncHealthSource['status'];cursor_version:number;completed:boolean;last_attempted_at:Date|null;last_committed_at:Date|null;retry_count:number;next_retry_at:Date|null;failure_code:OperatorSyncFailure;gap_status:SyncHealthSource['gapStatus'];observed_at:Date;receipt_count:number;quarantine_count:number};
const iso=(v:Date|null)=>v?new Date(v).toISOString():null;
/** Bounded, explicit SQL allowlist. No credential, cursor text, payload or lease token selected. */
export class PgOperatorSyncHealthReader implements SyncHealthReader {
 constructor(private readonly db:SqlExecutor){}
 async list(workspaceId:string,limit:number){
  const bounded=Math.max(1,Math.min(100,Math.floor(limit)));
  const result=await this.db.query<Row>(`WITH page AS MATERIALIZED(SELECT * FROM sync_stream WHERE workspace_id=$1 ORDER BY created_at,id LIMIT $2)
   SELECT s.id,s.workspace_id,s.connection_id,s.provider,s.mode,CASE WHEN c.status='revoked' THEN 'revoked' ELSE s.status END AS status,s.cursor_version,s.completed,
   s.last_attempted_at,s.last_committed_at,s.retry_count,s.next_retry_at,s.failure_code,s.gap_status,clock_timestamp() AS observed_at,r.receipt_count,r.quarantine_count
   FROM page s JOIN source_connection c ON c.workspace_id=s.workspace_id AND c.id=s.connection_id
   CROSS JOIN LATERAL(SELECT count(*)::int receipt_count,count(*) FILTER(WHERE quarantine_reason IS NOT NULL)::int quarantine_count FROM source_receipt WHERE workspace_id=s.workspace_id AND connection_id=s.connection_id)r
   ORDER BY s.created_at,s.id`,[workspaceId,bounded+1]);
  const now=result.rows[0]?.observed_at??(await this.db.query<{observed_at:Date}>('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
  return {items:result.rows.slice(0,bounded).map(r=>({id:r.id,workspaceId:r.workspace_id,connectionId:r.connection_id,provider:r.provider,mode:r.mode,status:r.status,cursorVersion:r.cursor_version,completed:r.completed,lastAttemptedAt:iso(r.last_attempted_at),lastCommittedAt:iso(r.last_committed_at),retryCount:r.retry_count,nextRetryAt:iso(r.next_retry_at),failureCode:r.failure_code,gapStatus:r.gap_status,localReceiptCount:r.receipt_count,quarantineCount:r.quarantine_count})),observedAt:new Date(now).toISOString(),truncated:result.rows.length>bounded};
 }
}
