import type {OfflineConnection,TransportResponse} from '../../ports/provider-transport';
import type {SyncCheckpointStore,SyncPage,SyncFailure} from '../../ports/durable-sync';
import {SourceIntegrationError} from '../../ports/source-observation';
export interface DurableSyncOptions {readonly maxPages:number;readonly maxItems:number;readonly requestTimeoutMs:number;readonly leaseMs:number;readonly maxElapsedMs?:number;readonly maxFailures?:number;readonly authorizeFetch:()=>Promise<void>;}
const invalid=()=>{throw new SourceIntegrationError('INPUT_INVALID',400);};
const nextRetry=(retryAfter:string|undefined,count:number)=>{
 let ms=retryAfter!==undefined&&/^\d+$/.test(retryAfter)?Number(retryAfter)*1000:NaN;
 if(!Number.isFinite(ms)&&retryAfter!==undefined){const date=Date.parse(retryAfter);ms=Number.isFinite(date)?Math.max(0,date-Date.now()):NaN;}
 if(!Number.isFinite(ms))ms=1000*2**Math.min(count,6);
 return new Date(Date.now()+Math.min(Math.max(ms,1000),3600000)).toISOString();
};
/** Fetch outside PG; one fenced same-transaction commit reuses the established source intake. */
export async function runDurableOfflineSync(connection:OfflineConnection,workspaceId:string,streamId:string,owner:string,options:DurableSyncOptions,request:(cursor:string|null,signal:AbortSignal)=>Promise<TransportResponse>,store:SyncCheckpointStore){
 const maxElapsed=options.maxElapsedMs??Math.min(options.leaseMs,60000),maxFailures=options.maxFailures??5;
 if(connection.mode!=='offline-synthetic'||typeof options.authorizeFetch!=='function'||!Number.isSafeInteger(options.maxPages)||options.maxPages<1||options.maxPages>100||!Number.isSafeInteger(options.maxItems)||options.maxItems<1||options.maxItems>1000||
  !Number.isSafeInteger(options.requestTimeoutMs)||options.requestTimeoutMs<1||options.requestTimeoutMs>60000||!Number.isSafeInteger(options.leaseMs)||options.leaseMs<100||options.leaseMs>60000||!Number.isSafeInteger(maxElapsed)||maxElapsed<1||maxElapsed>60000||!Number.isSafeInteger(maxFailures)||maxFailures<1||maxFailures>10)invalid();
 const lease=await store.claimLease(workspaceId,streamId,owner,options.leaseMs);
 if(!lease)return {status:'lease-unavailable' as const,cursor:(await store.getStream(workspaceId,streamId))?.cursor??null,pages:0,items:0};
 let cursor=lease.stream.cursor,version=lease.stream.cursorVersion,pages=0,items=0,token=lease.token;
 const started=Date.now();
 const fail=async(failure:SyncFailure,status:string,retryAfter?:string)=>{
  const exhausted=lease.stream.retryCount+1>=maxFailures;
  await store.recordFailure(workspaceId,streamId,token,exhausted?'RETRY_EXHAUSTED':failure,exhausted?null:nextRetry(retryAfter,lease.stream.retryCount));
  return {status:exhausted?'retry-exhausted':status,cursor,pages,items};
 };
 try {
  if(lease.stream.workspaceId!==workspaceId||lease.stream.connectionId!==connection.connectionId||lease.stream.provider!==connection.provider||lease.stream.accountId!==connection.accountId)throw new SourceIntegrationError('SYNC_CONNECTION_BINDING_INVALID',403);
  const authorizeFetch=async()=>{try{await options.authorizeFetch();}catch{throw new SourceIntegrationError('CREDENTIAL_REVOKED',403);}};
  await authorizeFetch();
  while(pages<options.maxPages&&!lease.stream.completed){
   const remaining=maxElapsed-(Date.now()-started);if(remaining<=0)return {status:'bounded',cursor,pages,items};
   await authorizeFetch();
   const requestRemaining=maxElapsed-(Date.now()-started);if(requestRemaining<=0)return {status:'bounded',cursor,pages,items};
   const response=await requestWithDeadline(request,cursor,Math.min(requestRemaining,options.requestTimeoutMs));
   if(response.status==='timeout')return await fail('TIMEOUT','timeout');
   if(response.status==='rate-limited')return await fail('RATE_LIMITED','rate-limited',response.retryAfter);
   if(response.status!=='page')return await fail('TIMEOUT','provider-error');
   const p=response.page;
   if(!p||typeof p!=='object'||Array.isArray(p))return await fail('SCHEMA_INVALID','schema-poison');
   const page=p as {pageKey?:unknown;nextCursor?:unknown;completed?:unknown;observations?:unknown;gap?:unknown};
   if(page.gap===true)return await fail('GAP_DETECTED','gap');
   if(typeof page.pageKey!=='string'||(page.nextCursor!==null&&typeof page.nextCursor!=='string')||typeof page.completed!=='boolean'||!Array.isArray(page.observations)||page.observations.length>100)return await fail('SCHEMA_INVALID','schema-poison');
   if(items+page.observations.length>options.maxItems||Date.now()-started>=maxElapsed)return {status:'bounded',cursor,pages,items};
   const committed=await store.commitPage(workspaceId,streamId,token,{pageKey:page.pageKey,expectedVersion:version,expectedCursor:cursor,nextCursor:page.nextCursor,completed:page.completed,observations:page.observations} as SyncPage);
   pages++;items+=page.observations.length;cursor=committed.cursor;version=committed.version;
   if(committed.cursor===null)return {status:'complete',cursor,pages,items};
   if(pages<options.maxPages){const next=await store.claimLease(workspaceId,streamId,owner,options.leaseMs);if(!next)return {status:'lease-unavailable',cursor,pages,items};token=next.token;}
  }
  return {status:'bounded',cursor,pages,items};
 }catch(error){
  if(error instanceof SourceIntegrationError){
   if(error.status===401||error.status===403){await store.recordFailure(workspaceId,streamId,token,'AUTH_REVOKED',null);return {status:'auth-revoked',cursor,pages,items};}
   if(['INPUT_INVALID','SYNC_PAGE_INVALID','SYNC_CURSOR_CONFLICT','SYNC_CURSOR_LOOP','SYNC_PAGE_COLLISION','SOURCE_NATIVE_INVALID'].includes(error.code)){await store.recordFailure(workspaceId,streamId,token,'SCHEMA_INVALID',null);return {status:'schema-poison',cursor,pages,items};}
   throw error;
  }
  return await fail('DATABASE_UNAVAILABLE','persistence-failed');
 }finally{await store.releaseLease(workspaceId,streamId,token);}
}
async function requestWithDeadline(request:(cursor:string|null,signal:AbortSignal)=>Promise<TransportResponse>,cursor:string|null,ms:number){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve().then(()=>request(cursor,controller.signal)).catch(()=>({status:'provider-error'} as const)),new Promise<TransportResponse>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({status:'timeout'});},ms);})]);}
 finally{if(timer!==undefined)clearTimeout(timer);}
}
