// Child process for the bounded synthetic recovery rehearsal. Never a daemon or network client.
import{createRequire}from'node:module';import{randomBytes}from'node:crypto';import assert from'node:assert/strict';
const target=new URL(process.env.TEST_DATABASE_URL??'invalid:');
if(target.hostname!=='127.0.0.1'||!/^\/sync_recovery_[a-f0-9]{32}$/.test(target.pathname)||process.env.SYNC_REHEARSAL_CHILD!=='FABRICATED_ONLY')throw Error('Disposable child target required');
const require=createRequire(import.meta.url);
const{PostgresService}=require('../dist/infra/postgres/postgres.service.js');
const{PgSyncCheckpointStore}=require('../dist/infra/sync/pg-sync-checkpoint.store.js');
const{admitSyncObservation}=require('../dist/application/durable-sync/admission.js');
const{runDurableOfflineSync}=require('../dist/application/durable-sync/offline-sync.js');
const{bindSyncCredential}=require('../dist/application/durable-sync/credential-binding.js');
const{TestOnlyProviderCredentialStore}=require('../dist/application/provider-credentials/test-only-credential-store.js');
const{installContentDigester}=require('../dist/ports/content-digester-runtime.js');
const{configuredContentDigester}=require('../dist/infra/crypto/configured-content-digester.js');
installContentDigester(configuredContentDigester(process.env));
const w='recovery-synthetic',cid=process.env.SYNC_CONNECTION_ID,sid=process.env.SYNC_STREAM_ID,phase=process.argv[2];
const db=new PostgresService({connectionString:target.href,max:2,connectionTimeoutMillis:1000});
const credentials=new TestOnlyProviderCredentialStore('test',true),ctx={workspaceId:w,userId:'fixture-owner',role:'admin',isDemo:false};
const metadata=await credentials.configure(ctx,{workspaceId:w,connectionId:cid,provider:'pancake',accountId:'fabricated-page',scopes:['messages.read']},randomBytes(48).toString('base64'));
const principal=await credentials.issuePrincipal(ctx,metadata.credentialId),authorize=bindSyncCredential(credentials,principal);
const store=new PgSyncCheckpointStore(db,admitSyncObservation,authorize);
try{
 const response=await runDurableOfflineSync({mode:'offline-synthetic',connectionId:cid,provider:'pancake',accountId:'fabricated-page'},w,sid,'process-'+phase,
  {maxPages:phase==='crash'?2:3,maxItems:10,requestTimeoutMs:500,leaseMs:5000,authorizeFetch:async()=>authorize({workspaceId:w,connectionId:cid,provider:'pancake',accountId:'fabricated-page'})},async cursor=>{
   assert.equal(db.getPool().idleCount,db.getPool().totalCount);
   await authorize({workspaceId:w,connectionId:cid,provider:'pancake',accountId:'fabricated-page'});
   const n=cursor===null?1:cursor==='cursor-a'?2:3;
   return{status:'page',page:{pageKey:'page-'+n,nextCursor:n===3?null:n===1?'cursor-a':'cursor-b',completed:n===3,observations:[{
    schemaVersion:1,provider:'pancake',route:'pancake-synthetic',accountId:'fabricated-page',synthetic:true,sourceAuthority:'synthetic_fixture',verification:'UNVERIFIED',completeness:'UNKNOWN',receiptId:'recovery-receipt-'+n,
    native:{system:'pancake',pageId:'fabricated-page',conversationId:'conversation',messageId:'message-'+n,eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated recovery',rawPayload:{utterance:'Fabricated page '+n,speaker:'customer',original:{synthetic:true}}
   }]}};
  },store);
 if(phase==='crash'){assert.equal(response.pages,2);process.exit(73);}// Intentional abrupt process exit after two durable pages; no graceful pool cleanup.
 assert.equal(response.status,'complete');assert.equal(response.pages,1);
 console.log(JSON.stringify({child:'restarted',result:'PASS',pages:response.pages}));
}finally{await db.onModuleDestroy();}
