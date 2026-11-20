import type { OperatorSyncFailure, SyncHealthReader, SyncHealthSource } from '../../ports/operator-sync-health';
import type { SqlExecutor } from '../postgres/postgres.service';
type Row={id:string;workspace_id:string;connection_id:string;provider:'pancake'|'meta-page';mode:'offline-synthetic'|'provider-read-only';status:SyncHealthSource['status'];cursor_version:number;completed:boolean;last_attempted_at:Date|null;last_committed_at:Date|null;retry_count:number;next_retry_at:Date|null;failure_code:OperatorSyncFailure;gap_status:SyncHealthSource['gapStatus'];observed_at:Date};
const iso=(v:Date|null)=>v?new Date(v).toISOString():null;
/** Bounded, explicit SQL allowlist. No credential, cursor text, payload or lease token selected. */
export class PgOperatorSyncHealthReader implements SyncHealthReader {
 constructor(private readonly db:SqlExecutor){}
 async list(workspaceId:string,limit:number){
  const bounded=Math.max(1,Math.min(100,Math.floor(limit)));
  const result=await this.db.query<Row>(`SELECT id,workspace_id,connection_id,provider,mode,status,cursor_version,completed,
   last_attempted_at,last_committed_at,retry_count,next_retry_at,failure_code,gap_status,clock_timestamp() AS observed_at
   FROM sync_stream WHERE workspace_id=$1 ORDER BY created_at,id LIMIT $2`,[workspaceId,bounded+1]);
  const now=result.rows[0]?.observed_at??(await this.db.query<{observed_at:Date}>('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
  return {items:result.rows.slice(0,bounded).map(r=>({id:r.id,workspaceId:r.workspace_id,connectionId:r.connection_id,provider:r.provider,mode:r.mode,status:r.status,cursorVersion:r.cursor_version,completed:r.completed,lastAttemptedAt:iso(r.last_attempted_at),lastCommittedAt:iso(r.last_committed_at),retryCount:r.retry_count,nextRetryAt:iso(r.next_retry_at),failureCode:r.failure_code,gapStatus:r.gap_status})),observedAt:new Date(now).toISOString(),truncated:result.rows.length>bounded};
 }
}
