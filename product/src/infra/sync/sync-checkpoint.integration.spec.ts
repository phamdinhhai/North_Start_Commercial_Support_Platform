import {beforeAll,afterAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PostgresService} from '../postgres/postgres.service';
import {Migrator,loadMigrations} from '../postgres/migrator';
import {PgSourceIntegrationStore} from '../source-integration/pg-source-integration.store';
import {PgSyncCheckpointStore} from './pg-sync-checkpoint.store';
import {admitSyncObservation} from '../../application/durable-sync/admission';
import {runDurableOfflineSync} from '../../application/durable-sync/offline-sync';
import {SourceIntegrationError,type SourceObservation} from '../../ports/source-observation';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('R4.12 durable sync checkpoint and replay',()=>{
 let db:PostgresService,sync:PgSyncCheckpointStore,cid:string,streamId:string;const workspace='r412-sync-'+randomUUID();
 const ctx={workspaceId:workspace,userId:'sync-test',role:'admin' as const,isDemo:false};
 const observation=(receiptId:string,messageId:string):SourceObservation=>({schemaVersion:1,accountId:'sync-page',provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',verification:'UNVERIFIED',completeness:'UNKNOWN',receiptId,native:{system:'pancake',pageId:'sync-page',conversationId:'conversation',messageId,eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated sync',rawPayload:{utterance:'Fabricated sync event '+messageId,speaker:'customer',original:{synthetic:true}}});
 beforeAll(async()=>{db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL,max:4});await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[workspace]);const source=new PgSourceIntegrationStore(db);cid=(await source.createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId:'sync-page'})).id;sync=new PgSyncCheckpointStore(db,admitSyncObservation,async()=>{});streamId=(await sync.createStream(workspace,cid)).id;});
 afterAll(async()=>db?.onModuleDestroy());
 const fresh=async()=>{const c=await new PgSourceIntegrationStore(db).createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId:'sync-page'});return {connectionId:c.id,stream:(await sync.createStream(workspace,c.id))};};
 it('commits source receipts and opaque checkpoint atomically, then replays page idempotently',async()=>{const lease=await sync.claimLease(workspace,streamId,'worker-a',5000);expect(lease).not.toBeNull();const page={pageKey:'page-1',expectedVersion:0,expectedCursor:null,nextCursor:'opaque-1',completed:false,observations:[observation('receipt-1','message-1'),observation('receipt-2','message-2')]};const result=await sync.commitPage(workspace,streamId,lease!.token,page);expect(result).toMatchObject({accepted:2,duplicates:0,cursor:'opaque-1',version:1,replay:false});const stream=await sync.getStream(workspace,streamId);expect(stream).toMatchObject({cursor:'opaque-1',cursorVersion:1,pageCount:1,gapStatus:'NONE'});const replay=await sync.claimLease(workspace,streamId,'worker-a',5000);const again=await sync.commitPage(workspace,streamId,replay!.token,{...page,expectedVersion:1,expectedCursor:'opaque-1'});expect(again).toMatchObject({accepted:2,replay:true,version:1});expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE workspace_id=$1',[workspace])).rows[0].n).toBe(2);await sync.releaseLease(workspace,streamId,replay!.token);});
 it('rolls back page and checkpoint when source processing fails',async()=>{const lease=await sync.claimLease(workspace,streamId,'worker-b',5000);const before=await sync.getStream(workspace,streamId);const bad=observation('receipt-bad','message-bad');const colliding={...bad,rawPayload:{...bad.rawPayload,utterance:'different meaning'}};await expect(sync.commitPage(workspace,streamId,lease!.token,{pageKey:'page-2',expectedVersion:before!.cursorVersion,expectedCursor:before!.cursor,nextCursor:'opaque-2',completed:false,observations:[bad,colliding]})).rejects.toMatchObject({code:'RECEIPT_COLLISION'});expect(await sync.getStream(workspace,streamId)).toMatchObject({cursor:before!.cursor,cursorVersion:before!.cursorVersion,pageCount:1});expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE workspace_id=$1 AND receipt_id=$2',[workspace,'receipt-bad'])).rows[0].n).toBe(0);await sync.releaseLease(workspace,streamId,lease!.token);});
 it('fences workers, revocation and malformed pages',async()=>{const first=await sync.claimLease(workspace,streamId,'worker-c',5000);expect(await sync.claimLease(workspace,streamId,'worker-d',5000)).toBeNull();await sync.control(workspace,streamId,'revoke','operator');expect(await sync.getStream(workspace,streamId)).toMatchObject({status:'revoked',failureCode:'AUTH_REVOKED'});await expect(sync.commitPage(workspace,streamId,first!.token,{pageKey:'page-x',expectedVersion:1,expectedCursor:'opaque-1',nextCursor:null,completed:true,observations:[]})).rejects.toMatchObject({code:'SYNC_STREAM_NOT_ACTIVE'});});
 it('restarts after two committed pages and never regresses checkpoint on old-page replay',async()=>{
  const f=await fresh(),lease=await sync.claimLease(workspace,f.stream.id,'before-crash',5000);
  const first={pageKey:randomUUID(),expectedVersion:0,expectedCursor:null,nextCursor:'opaque-a',completed:false,observations:[observation(randomUUID(),randomUUID())]};
  await sync.commitPage(workspace,f.stream.id,lease!.token,first);
  const next=await sync.claimLease(workspace,f.stream.id,'before-crash',5000);
  await sync.commitPage(workspace,f.stream.id,next!.token,{pageKey:randomUUID(),expectedVersion:1,expectedCursor:'opaque-a',nextCursor:'opaque-b',completed:false,observations:[observation(randomUUID(),randomUUID())]});
  const restartedDb=new PostgresService({connectionString:process.env.TEST_DATABASE_URL,max:1}),restarted=new PgSyncCheckpointStore(restartedDb,admitSyncObservation,async()=>{});
  try{
   const state=await restarted.getStream(workspace,f.stream.id);expect(state).toMatchObject({cursor:'opaque-b',cursorVersion:2,pageCount:2});
   const retry=await restarted.claimLease(workspace,f.stream.id,'after-crash',5000);
   expect(await restarted.commitPage(workspace,f.stream.id,retry!.token,{...first,expectedVersion:2,expectedCursor:'opaque-b'})).toMatchObject({replay:true,cursor:'opaque-b',version:2});
   await restarted.releaseLease(workspace,f.stream.id,retry!.token);
   const last=await restarted.claimLease(workspace,f.stream.id,'after-crash',5000);
   await restarted.commitPage(workspace,f.stream.id,last!.token,{pageKey:randomUUID(),expectedVersion:2,expectedCursor:'opaque-b',nextCursor:null,completed:true,observations:[]});
   expect(await restarted.getStream(workspace,f.stream.id)).toMatchObject({completed:true,cursor:null,cursorVersion:3});
  }finally{await restartedDb.onModuleDestroy();}
 });
 it('fences expired lease, rejects cursor loops and requires current service authorization',async()=>{
  const f=await fresh(),old=await sync.claimLease(workspace,f.stream.id,'old-worker',5000);
  await db.query("UPDATE sync_stream SET lease_until=now()-interval '1 second' WHERE id=$1",[f.stream.id]);
  const current=await sync.claimLease(workspace,f.stream.id,'new-worker',5000),page={pageKey:randomUUID(),expectedVersion:0,expectedCursor:null,nextCursor:'next',completed:false,observations:[observation(randomUUID(),randomUUID())]};
  await expect(sync.commitPage(workspace,f.stream.id,old!.token,page)).rejects.toMatchObject({code:'SYNC_LEASE_LOST'});
  const denied=new PgSyncCheckpointStore(db,admitSyncObservation,async()=>{throw new SourceIntegrationError('CREDENTIAL_REVOKED',403);});
  await expect(denied.commitPage(workspace,f.stream.id,current!.token,page)).rejects.toMatchObject({code:'CREDENTIAL_REVOKED'});
  expect(await sync.getStream(workspace,f.stream.id)).toMatchObject({cursorVersion:0});
  await sync.commitPage(workspace,f.stream.id,current!.token,page);
  const lease=await sync.claimLease(workspace,f.stream.id,'new-worker',5000);
  await expect(sync.commitPage(workspace,f.stream.id,lease!.token,{...page,pageKey:randomUUID(),expectedVersion:1,expectedCursor:'next'})).rejects.toMatchObject({code:'SYNC_CURSOR_LOOP'});
  await sync.releaseLease(workspace,f.stream.id,lease!.token);
 });
 it('checks source connection revocation and tenant before accepting receipts',async()=>{
  const f=await fresh(),lease=await sync.claimLease(workspace,f.stream.id,'worker',5000);
  await new PgSourceIntegrationStore(db).revokeConnection(ctx,f.connectionId);
  await expect(sync.commitPage(workspace,f.stream.id,lease!.token,{pageKey:randomUUID(),expectedVersion:0,expectedCursor:null,nextCursor:null,completed:true,observations:[]})).rejects.toMatchObject({code:'CONNECTION_REVOKED'});
  expect(await sync.claimLease(workspace,f.stream.id,'next-worker',5000)).toBeNull();
  expect(await sync.getStream('foreign',f.stream.id)).toBeNull();
  await expect(sync.createStream('foreign',f.connectionId)).rejects.toMatchObject({code:'SYNC_CONNECTION_NOT_FOUND'});
 });
 it('runs bounded polling outside transactions and resumes with a fresh worker after two pages',async()=>{
  const f=await fresh(),requests:(string|null)[]=[],connection={mode:'offline-synthetic' as const,connectionId:f.connectionId,provider:'pancake' as const,accountId:'sync-page'};
  const request=async(cursor:string|null)=>{
   requests.push(cursor);expect(db.getPool().idleCount).toBe(db.getPool().totalCount);
   const n=cursor===null?1:cursor==='opaque-poll-1'?2:3;
   return {status:'page' as const,page:{pageKey:'poll-page-'+n,nextCursor:n===3?null:'opaque-poll-'+n,completed:n===3,observations:[observation('poll-'+n,'poll-message-'+n)]}};
  };
  expect(await runDurableOfflineSync(connection,workspace,f.stream.id,'worker-first',{maxPages:2,maxItems:10,requestTimeoutMs:100,leaseMs:5000,authorizeFetch:async()=>{}},request,sync)).toMatchObject({status:'bounded',cursor:'opaque-poll-2',pages:2,items:2});
  expect(await runDurableOfflineSync(connection,workspace,f.stream.id,'worker-restarted',{maxPages:2,maxItems:10,requestTimeoutMs:100,leaseMs:5000,authorizeFetch:async()=>{}},request,new PgSyncCheckpointStore(db,admitSyncObservation,async()=>{}))).toMatchObject({status:'complete',cursor:null,pages:1,items:1});
  expect(requests).toEqual([null,'opaque-poll-1','opaque-poll-2']);
  expect(await sync.getStream(workspace,f.stream.id)).toMatchObject({completed:true,pageCount:3,cursorVersion:3});
  const leads=await db.query('SELECT owner_user_id FROM lead WHERE workspace_id=$1 AND id IN (SELECT lead_id FROM source_receipt WHERE connection_id=$2)',[workspace,f.connectionId]);
  expect(leads.rows).toHaveLength(3);expect(leads.rows.every(r=>r.owner_user_id===null)).toBe(true);
 });
 it('persists retry eligibility and explicit gaps while refusing malformed checkpoint pages',async()=>{
  const f=await fresh(),lease=await sync.claimLease(workspace,f.stream.id,'failure-worker',5000);
  await expect(sync.commitPage(workspace,f.stream.id,lease!.token,{pageKey:'bad',expectedCursor:null,expectedVersion:0,nextCursor:'not-terminal',completed:true,observations:[]})).rejects.toMatchObject({code:'SYNC_PAGE_INVALID'});
  const retryAt=new Date(Date.now()+60000).toISOString();
  await sync.recordFailure(workspace,f.stream.id,lease!.token,'RATE_LIMITED',retryAt);await sync.releaseLease(workspace,f.stream.id,lease!.token);
  expect(await sync.getStream(workspace,f.stream.id)).toMatchObject({status:'degraded',retryCount:1,failureCode:'RATE_LIMITED',nextRetryAt:retryAt,cursorVersion:0,pageCount:0});
  expect(await sync.claimLease(workspace,f.stream.id,'too-early',5000)).toBeNull();
  // Advance only disposable operational retry time to emulate a later worker invocation.
  await db.query("UPDATE sync_stream SET next_retry_at=clock_timestamp()-interval '1 second' WHERE id=$1",[f.stream.id]);
  const next=await sync.claimLease(workspace,f.stream.id,'gap-worker',5000);expect(next).not.toBeNull();
  await sync.recordFailure(workspace,f.stream.id,next!.token,'GAP_DETECTED',null);
  expect(await sync.getStream(workspace,f.stream.id)).toMatchObject({status:'blocked',gapStatus:'DETECTED',retryCount:2,cursorVersion:0});
  await sync.releaseLease(workspace,f.stream.id,next!.token);expect(await sync.claimLease(workspace,f.stream.id,'blocked-worker',5000)).toBeNull();
 });
});


