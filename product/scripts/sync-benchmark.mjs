// Bounded synthetic checkpoint benchmark; never target a pilot database.
import{randomUUID}from'node:crypto';import{createRequire}from'node:module';import{execFileSync}from'node:child_process';import{performance}from'node:perf_hooks';
const target=new URL(process.env.TEST_DATABASE_URL??'invalid:');
if(target.hostname!=='127.0.0.1'||!target.port||!/^\/(north_start_ci|r412_root)$/.test(target.pathname)||process.env.DATABASE_URL)throw Error('Explicit isolated loopback test target required');
const require=createRequire(import.meta.url),{Client}=require('pg');
const{PostgresService}=require('../dist/infra/postgres/postgres.service.js'),{Migrator,loadMigrations}=require('../dist/infra/postgres/migrator.js');
const{PgSourceIntegrationStore}=require('../dist/infra/source-integration/pg-source-integration.store.js'),{PgSyncCheckpointStore}=require('../dist/infra/sync/pg-sync-checkpoint.store.js');
const{admitSyncObservation}=require('../dist/application/durable-sync/admission.js'),{installContentDigester}=require('../dist/ports/content-digester-runtime.js'),{configuredContentDigester}=require('../dist/infra/crypto/configured-content-digester.js');
const name='sync_bench_'+randomUUID().replaceAll('-',''),url=n=>{const u=new URL(target);u.pathname='/'+n;return u.href;},admin=new Client({connectionString:url('postgres')});
let db,created=false;
const timeout=setTimeout(()=>{console.error('Bounded benchmark exceeded120s');process.exit(2);},120000);
const ctx={workspaceId:'sync-benchmark',userId:'fixture-operator',role:'admin',isDemo:false},results={};
installContentDigester(configuredContentDigester({NODE_ENV:'test'}));
const observation=()=>({schemaVersion:1,provider:'pancake',route:'pancake-synthetic',accountId:'page',synthetic:true,sourceAuthority:'synthetic_fixture',verification:'UNVERIFIED',completeness:'UNKNOWN',receiptId:randomUUID(),native:{system:'pancake',pageId:'page',conversationId:null,messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated benchmark',rawPayload:{utterance:'Fabricated only',speaker:'customer',original:{synthetic:true}}});
async function workload(label,count,workers,fn){let next=0,maxQueued=0;const times=[],start=performance.now();await Promise.all(Array.from({length:workers},async(_,worker)=>{while(next<count){const n=next++,t=performance.now();await fn(n,worker);times.push(performance.now()-t);maxQueued=Math.max(maxQueued,db.getPool().waitingCount);}}));times.sort((a,b)=>a-b);results[label]={samples:count,workers,p50Ms:times[Math.ceil(count*.5)-1],p95Ms:times[Math.ceil(count*.95)-1],elapsedMs:performance.now()-start,maxObservedPoolQueue:maxQueued};}
try{
 await admin.connect();await admin.query('CREATE DATABASE '+name);created=true;db=new PostgresService({connectionString:url(name),max:8,statement_timeout:10000});await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name)VALUES($1,$1)',[ctx.workspaceId]);
 const source=new PgSourceIntegrationStore(db),store=new PgSyncCheckpointStore(db,admitSyncObservation,async()=>{}),streams=[];
 for(let n=0;n<8;n++){const c=await source.createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId:'page'});streams.push(await store.createStream(ctx.workspaceId,c.id));}
 let replayPage;
 async function commit(index){const s=streams[index],lease=await store.claimLease(ctx.workspaceId,s.id,'bench-'+index,10000);if(!lease)throw Error('Unexpected lease rejection');const page={pageKey:randomUUID(),expectedVersion:lease.stream.cursorVersion,expectedCursor:lease.stream.cursor,nextCursor:randomUUID(),completed:false,observations:[observation()]};const r=await store.commitPage(ctx.workspaceId,s.id,lease.token,page);if(index===0)replayPage=page;if(r.accepted!==1)throw Error('Unexpected page effect');}
 await workload('sequentialSameStream',32,1,()=>commit(0));
 await workload('parallelEightStreams',64,8,(_n,worker)=>commit(worker));
 await workload('samePageReplay',32,1,async()=>{const lease=await store.claimLease(ctx.workspaceId,streams[0].id,'replay',10000);if(!lease)throw Error('Unexpected replay lease');const r=await store.commitPage(ctx.workspaceId,streams[0].id,lease.token,{...replayPage,expectedVersion:lease.stream.cursorVersion,expectedCursor:lease.stream.cursor});if(!r.replay)throw Error('Replay duplicated');});
 const receipts=(await db.query('SELECT count(*)::int n FROM source_receipt')).rows[0].n,deadlocks=(await db.query('SELECT deadlocks FROM pg_stat_database WHERE datname=current_database()')).rows[0].deadlocks;
 if(receipts!==96||Number(deadlocks)!==0)throw Error('Benchmark integrity mismatch');
 console.log(JSON.stringify({result:'PASS',sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),syntheticOnly:true,results,receipts,deadlocks:Number(deadlocks),limitations:'Single local run,32/64samples,claim+commit latency,8workers; no production throughput/SLO or p99 claim'}));
}finally{clearTimeout(timeout);await db?.onModuleDestroy();if(created&&/^sync_bench_[a-f0-9]{32}$/.test(name))await admin.query('DROP DATABASE '+name+' WITH(FORCE)');await admin.end();}
