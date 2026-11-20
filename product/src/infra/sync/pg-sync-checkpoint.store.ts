import {randomUUID} from 'node:crypto';
import {canonicalizePayload} from '../../domain/envelope/envelope';
import {contentDigester} from '../../ports/content-digester-runtime';
import {SourceIntegrationError,type SourceReceipt} from '../../ports/source-observation';
import type {SyncCheckpointStore,SyncLease,SyncPage,SyncPageResult,SyncStream,SyncFailure,SyncObservationAdmission,SyncCommitAuthorization} from '../../ports/durable-sync';
import type {ContentDigest} from '../../ports/content-digester';
import {PgSourceIntegrationStore} from '../source-integration/pg-source-integration.store';
import {PostgresService,type SqlExecutor} from '../postgres/postgres.service';
type Row={id:string;workspace_id:string;connection_id:string;provider:'pancake'|'meta-page';account_id:string;capability:'synthetic-messages';mode:'offline-synthetic';status:SyncStream['status'];cursor:string|null;completed:boolean;cursor_version:number;schema_version:1;last_attempted_at:Date|string|null;last_committed_at:Date|string|null;retry_count:number;next_retry_at:Date|string|null;failure_code:SyncFailure|null;gap_status:SyncStream['gapStatus'];lease_owner:string|null;lease_token:string|null;lease_until:Date|string|null;page_count:number};
const iso=(v:Date|string|null)=>v===null?null:new Date(v).toISOString();
const map=(r:Row):SyncStream=>({id:r.id,workspaceId:r.workspace_id,connectionId:r.connection_id,provider:r.provider,accountId:r.account_id,capability:r.capability,mode:r.mode,status:r.status,cursor:r.cursor,completed:r.completed,cursorVersion:r.cursor_version,schemaVersion:1,lastAttemptedAt:iso(r.last_attempted_at),lastCommittedAt:iso(r.last_committed_at),retryCount:r.retry_count,nextRetryAt:iso(r.next_retry_at),failureCode:r.failure_code,gapStatus:r.gap_status,leaseOwner:r.lease_owner,leaseUntil:iso(r.lease_until),pageCount:r.page_count});
const fail=(code:string,status=409):never=>{throw new SourceIntegrationError(code,status);};
const cursor=(v:unknown)=>v===null||typeof v==='string'&&v.length>0&&v.length<=4096&&!/[\x00-\x1f\x7f]/.test(v);
export class PgSyncCheckpointStore implements SyncCheckpointStore {
 constructor(private readonly db:PostgresService,private readonly admit:SyncObservationAdmission,private readonly authorize:SyncCommitAuthorization){}
 async createStream(workspaceId:string,connectionId:string){
  return this.db.withTransaction(async tx=>{
   const r=await tx.query<Row>(`INSERT INTO sync_stream(id,workspace_id,connection_id,provider,account_id,capability,mode,status)
    SELECT $1,c.workspace_id,c.id,c.provider,c.page_id,'synthetic-messages','offline-synthetic','active' FROM source_connection c
    WHERE c.workspace_id=$2 AND c.id=$3::uuid AND c.status='active'
    ON CONFLICT(workspace_id,connection_id,capability) DO UPDATE SET updated_at=now() RETURNING *`,[randomUUID(),workspaceId,connectionId]);
   if(!r.rows[0])return fail('SYNC_CONNECTION_NOT_FOUND',404);return map(r.rows[0]);
  });
 }
 async getStream(w:string,id:string){const r=await this.db.query<Row>('SELECT * FROM sync_stream WHERE workspace_id=$1 AND id=$2::uuid',[w,id]);return r.rows[0]?map(r.rows[0]):null;}
 async claimLease(w:string,id:string,owner:string,ttlMs:number){
  if(!/^[\x21-\x7e]{1,128}$/.test(owner)||!Number.isSafeInteger(ttlMs)||ttlMs<100||ttlMs>60000)throw new SourceIntegrationError('INPUT_INVALID',400);
  const token=randomUUID();const r=await this.db.query<Row>(`UPDATE sync_stream SET lease_owner=$3,lease_token=$4::uuid,
   lease_until=now()+($5::int*interval '1 millisecond'),last_attempted_at=now(),updated_at=now()
   WHERE workspace_id=$1 AND id=$2::uuid AND status IN ('active','degraded') AND completed=false
   AND (next_retry_at IS NULL OR next_retry_at<=now()) AND (lease_until IS NULL OR lease_until<now())
   AND EXISTS(SELECT 1 FROM source_connection c WHERE c.workspace_id=sync_stream.workspace_id AND c.id=sync_stream.connection_id AND c.status='active') RETURNING *`,[w,id,owner,token,ttlMs]);
  return r.rows[0]?{stream:map(r.rows[0]),token,owner} as SyncLease:null;
 }
 async releaseLease(w:string,id:string,token:string){await this.db.query(`UPDATE sync_stream SET lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE workspace_id=$1 AND id=$2::uuid AND lease_token=$3::uuid`,[w,id,token]);}
 async commitPage(w:string,id:string,token:string,page:SyncPage):Promise<SyncPageResult>{
  if(!page||Object.keys(page).sort().join()!=='completed,expectedCursor,expectedVersion,nextCursor,observations,pageKey'||!Number.isSafeInteger(page.expectedVersion)||page.expectedVersion<0||
   !cursor(page.expectedCursor)||!cursor(page.nextCursor)||typeof page.completed!=='boolean'||page.completed!==(page.nextCursor===null)||!page.pageKey||page.pageKey.length>256||!Array.isArray(page.observations)||page.observations.length>100)return fail('SYNC_PAGE_INVALID',400);
  // Replay identity excludes the cursor position: the same page can be retried after
  // a crash with the stream's newly observed version, while its page key/content stays fixed.
  const canonical=canonicalizePayload({pageKey:page.pageKey,nextCursor:page.nextCursor,completed:page.completed,observations:page.observations});
  if(Buffer.byteLength(canonical)>1048576)return fail('SYNC_PAGE_INVALID',400);
  return this.db.withTransaction(async tx=>{
   // Match intake/revocation lock order: source connection first, then stream.
   const c=(await tx.query<{id:string;provider:'pancake'|'meta-page';route:'pancake-synthetic'|'meta-page-synthetic';page_id:string;status:'active'|'revoked'}>(`SELECT c.* FROM source_connection c JOIN sync_stream s ON s.workspace_id=c.workspace_id AND s.connection_id=c.id WHERE s.workspace_id=$1 AND s.id=$2::uuid FOR UPDATE OF c`,[w,id])).rows[0];
   if(!c)return fail('SYNC_STREAM_NOT_FOUND',404);if(c.status!=='active')return fail('CONNECTION_REVOKED',403);
   const s=(await tx.query<Row & {lease_valid:boolean}>('SELECT *,lease_until>clock_timestamp() AS lease_valid FROM sync_stream WHERE workspace_id=$1 AND id=$2::uuid FOR UPDATE',[w,id])).rows[0];
   if(!['active','degraded'].includes(s.status))return fail('SYNC_STREAM_NOT_ACTIVE');
   if(s.lease_token!==token||!s.lease_valid)return fail('SYNC_LEASE_LOST');
   await this.authorize({workspaceId:w,connectionId:c.id,provider:c.provider,accountId:c.page_id});
   const prior=(await tx.query<{page_digest:ContentDigest;accepted_count:number;duplicate_count:number;next_cursor:string|null;version:number}>('SELECT * FROM sync_page_commit WHERE workspace_id=$1 AND stream_id=$2::uuid AND page_key=$3',[w,id,page.pageKey])).rows[0];
   if(prior){if(contentDigester().matches(w,'command',canonical,prior.page_digest)!==true)return fail('SYNC_PAGE_COLLISION');await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value) VALUES('sync-stream',$1,$2,$3,'sync.page.replayed',$4::jsonb)`,[id,w,'sync-worker:'+id,JSON.stringify({version:prior.version})]);await tx.query('UPDATE sync_stream SET lease_owner=NULL,lease_token=NULL,lease_until=NULL WHERE workspace_id=$1 AND id=$2::uuid',[w,id]);return {accepted:prior.accepted_count,duplicates:prior.duplicate_count,cursor:s.cursor,version:s.cursor_version,replay:true,receipts:[]};}
   if(s.completed)return fail('SYNC_STREAM_COMPLETED');
   if(s.cursor_version!==page.expectedVersion||s.cursor!==page.expectedCursor)return fail('SYNC_CURSOR_CONFLICT');
   if(!page.completed){
    if(page.nextCursor===s.cursor)return fail('SYNC_CURSOR_LOOP');
    const visited=await tx.query('SELECT 1 FROM sync_page_commit WHERE workspace_id=$1 AND stream_id=$2::uuid AND (from_cursor=$3 OR next_cursor=$3) LIMIT 1',[w,id,page.nextCursor]);
    if(visited.rows.length)return fail('SYNC_CURSOR_LOOP');
   }
   const sameTx=new PgSourceIntegrationStore({withTransaction:<T>(fn:(executor:SqlExecutor)=>Promise<T>)=>fn(tx)} as PostgresService);
   let accepted=0,duplicates=0;const receipts:SourceReceipt[]=[];
   for(const value of page.observations){
    const o=this.admit(value,w,{id:c.id,workspaceId:w,provider:c.provider,route:c.route,pageId:c.page_id,status:c.status,health:'SYNTHETIC_ONLY'});
    // Service identity is deliberately not a human admin and cannot claim responsibility.
    const r=await sameTx.intake({workspaceId:w,userId:'sync-worker:'+s.id,role:'viewer',isDemo:false},c.id,o,{claimResponsibility:false});
    receipts.push(r);if(r.disposition==='receipt_duplicate')duplicates++;else accepted++;
   }
   const version=s.cursor_version+1,digest=contentDigester().digest(w,'command',canonical);
   await tx.query(`INSERT INTO sync_page_commit(id,workspace_id,stream_id,page_key,version,from_cursor,next_cursor,completed,page_digest,accepted_count,duplicate_count)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,[randomUUID(),w,id,page.pageKey,version,page.expectedCursor,page.nextCursor,page.completed,JSON.stringify(digest),accepted,duplicates]);
   await tx.query(`UPDATE sync_stream SET cursor=$3,cursor_version=$4,completed=$5,page_count=page_count+1,last_committed_at=now(),retry_count=0,next_retry_at=NULL,failure_code=NULL,gap_status='NONE',lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE workspace_id=$1 AND id=$2::uuid AND lease_token=$6::uuid`,[w,id,page.nextCursor,version,page.completed,token]);
   await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value) VALUES('sync-stream',$1,$2,$3,'sync.page.committed',$4::jsonb)`,[id,w,'sync-worker:'+id,JSON.stringify({version,accepted,duplicates,completed:page.completed,completeness:'UNKNOWN'})]);
   return {accepted,duplicates,cursor:page.nextCursor,version,replay:false,receipts};
  });
 }
 async recordFailure(w:string,id:string,token:string,failure:SyncFailure,nextRetryAt:string|null){await this.db.query(`UPDATE sync_stream SET status=CASE WHEN $4='AUTH_REVOKED' THEN 'revoked' WHEN $4 IN ('SCHEMA_INVALID','GAP_DETECTED','RETRY_EXHAUSTED') THEN 'blocked' ELSE 'degraded' END,retry_count=retry_count+1,next_retry_at=$5::timestamptz,failure_code=$4,gap_status=CASE WHEN $4='GAP_DETECTED' THEN 'DETECTED' ELSE gap_status END,updated_at=now() WHERE workspace_id=$1 AND id=$2::uuid AND lease_token=$3::uuid AND lease_until>clock_timestamp()`,[w,id,token,failure,nextRetryAt]);}
 async control(w:string,id:string,action:'pause'|'resume'|'revoke',actorId:string){if(!actorId)return fail('UNAUTHORIZED',401);const status=action==='pause'?'paused':action==='resume'?'active':'revoked';await this.db.withTransaction(async tx=>{const r=await tx.query(`UPDATE sync_stream SET status=$3,failure_code=CASE WHEN $3='revoked' THEN 'AUTH_REVOKED' ELSE NULL END,lease_owner=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE workspace_id=$1 AND id=$2::uuid AND status<>'revoked' RETURNING id`,[w,id,status]);if(!r.rowCount)return fail('SYNC_STREAM_NOT_FOUND',404);await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value) VALUES('sync-stream',$1,$2,$3,'sync.control',$4::jsonb)`,[id,w,actorId,JSON.stringify({action})]);});}
}



