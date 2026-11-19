import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AssertionDeliveryOps } from './assertion-delivery.ops';
import { randomUUID } from 'node:crypto';
import { GovernedActionService } from '../../application/governed-action/governed-action.service';
import { createSyntheticActionPorts } from './synthetic-runtime';
import { PgActionStore } from './pg-action.store';
import { PgAssertionDelivery, PgAssertionInbox } from './pg-assertion-delivery';
import { PostgresService } from '../postgres/postgres.service';
import { loadMigrations, Migrator } from '../postgres/migrator';
import type { AssertionEnvelope } from '../../domain/commercial-event/commercial-event';
const suite=process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('durable assertion delivery PostgreSQL',()=>{
 let db:PostgresService;
 const ws=`delivery-${randomUUID()}`;
 const schema=`delivery_${randomUUID().replaceAll('-','')}`;
 const config={connectionString:process.env.TEST_DATABASE_URL,options:`-c search_path=${schema}`};
 const opts={batchSize:10,maxAttempts:2,leaseMs:1000,timeoutMs:100,backoffMs:1};
 const adminId=randomUUID();
 const opsActor={workspaceId:ws,userId:adminId,role:'admin' as const,isDemo:false};
 const actor={kind:'human' as const,id:'alice',workspaceId:ws};
 async function verified(){
  const target={provider:'synthetic-ads',accountId:'a',resourceType:'campaign',resourceId:randomUUID()};
  const ports=createSyntheticActionPorts({clock:()=>new Date(),store:new PgActionStore(db),enabled:[{workspaceId:ws,capabilityId:'ads.campaign.budget.update'}],
   policy:{constraints:{maxBudgetDeltaPercent:20,protectedAccountIds:[],approvalTtlMs:600000},proposers:'*',approvers:['bob'],executors:['alice']}});
  ports.ledger.seed({workspaceId:ws,target},{dailyBudget:{amountMinor:'100',currency:'VND'}});
  const service=new GovernedActionService(ports);
  const p=await service.propose(actor,{requestKey:randomUUID(),capabilityId:'ads.campaign.budget.update',target,arguments:{dailyBudget:{amountMinor:'110',currency:'VND'}},rationale:'test'});
  const pv=await service.preview(actor,p.id);
  await service.authorize({...actor,id:'bob'},p.id,{reviewedArgumentDigest:p.argumentDigest,reviewedPreviewDigest:pv.preview!.previewDigest,reason:'ok'});
  return {service,p};
 }
 beforeAll(async()=>{const admin=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});try{await admin.query(`CREATE SCHEMA ${schema}`);}finally{await admin.onModuleDestroy();} db=new PostgresService(config);await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1)',[ws]);await db.query('INSERT INTO platform_user(id) VALUES ($1)',[adminId]);});
 afterAll(async()=>{if(db){await db.query(`DROP SCHEMA ${schema} CASCADE`);await db.onModuleDestroy();}});
 it('atomically persists outcome and envelope, survives restart and deduplicates inbox',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const inbox=new PgAssertionInbox(db);const worker=new PgAssertionDelivery(db,inbox,opts);
  expect((await worker.inspect(ws))[0]).toMatchObject({status:'PENDING',attempts:0});
  // Optional actual restart of an explicitly owned private cluster; never an existing service.
  if (process.env.REL_PRIVATE_PG_DATA) {
   const data=resolve(process.env.REL_PRIVATE_PG_DATA);
   if (!/north-r46-rel-[a-f0-9]{32}[\\/]data$/i.test(data) || !process.env.TEST_DATABASE_URL?.includes('127.0.0.1:55467/north_rel_test')) throw Error('PRIVATE_CLUSTER_REQUIRED');
   await db.onModuleDestroy();
   const ctl='C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe';
   const restart=spawnSync(ctl,['-D',data,'-l',resolve(data,'../server.log'),'-m','fast','-w','restart'],{stdio:'ignore',timeout:30000});
   expect(restart.status).toBe(0);
  }
  const other=new PostgresService(config);
  try{await new PgAssertionDelivery(other,new PgAssertionInbox(other),opts).runOnce();}finally{await other.onModuleDestroy();}
  expect((await worker.inspect(ws))[0].status).toBe('DELIVERED');
  const row=(await db.query<{envelope:AssertionEnvelope}>('SELECT envelope FROM assertion_inbox WHERE workspace_id=$1',[ws])).rows[0];
  await inbox.emit(row.envelope);await inbox.emit(row.envelope);
  expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1',[ws])).rowCount).toBe(1);
 });
 it('rolls back action CAS and event when outbox insert fails',async()=>{
  const {service,p}=await verified();
  await db.query(`CREATE FUNCTION fail_outbox_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test outbox unavailable'; END $$`);
  await db.query('CREATE TRIGGER fail_outbox_test BEFORE INSERT ON assertion_outbox FOR EACH ROW EXECUTE FUNCTION fail_outbox_test()');
  try{await expect(service.execute(actor,p.id)).rejects.toThrow('outbox unavailable');}finally{await db.query('DROP TRIGGER fail_outbox_test ON assertion_outbox');await db.query('DROP FUNCTION fail_outbox_test()');}
  expect((await new PgActionStore(db).get(ws,p.id))?.state).toBe('EXECUTING');
  expect((await new PgActionStore(db).events(ws,p.id)).at(-1)?.toState).toBe('EXECUTING');
 });
 it('bounds retries, shows categorical failure, scopes replay and delivers after recovery',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const fail=new PgAssertionDelivery(db,{emit:async()=>{throw new Error('sensitive secret');}},opts);
  await fail.runOnce();await db.query("UPDATE assertion_outbox SET next_attempt_at=now()-interval '1 second' WHERE workspace_id=$1 AND status='PENDING'",[ws]);await fail.runOnce();
  const failed=(await fail.inspect(ws)).find(r=>r.status==='FAILED')!;
  expect(failed).toMatchObject({attempts:2,lastError:'SINK_FAILED'});
  const ops=new AssertionDeliveryOps(db);
  const original={...process.env};
  Object.assign(process.env,{AUTH_MODE:'oidc',ASSERTION_DELIVERY_ENABLED:'true',DEPLOYMENT_MODE:'test',PILOT_STORE_MODE:'postgres',DATABASE_URL:process.env.TEST_DATABASE_URL});
  try {
   await expect(ops.change({...opsActor,workspaceId:'foreign'},failed.assertionId,'replay')).rejects.toThrow('DELIVERY_CONFLICT');
   await ops.change(opsActor,failed.assertionId,'replay');
   expect((await db.query('SELECT 1 FROM assertion_delivery_audit WHERE workspace_id=$1 AND assertion_id=$2',[ws,failed.assertionId])).rowCount).toBe(1);
  } finally {process.env=original;}
  await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  expect((await fail.inspect(ws)).find(r=>r.assertionId===failed.assertionId)?.status).toBe('DELIVERED');
 });
 it('quarantines persisted poison and detects conflicting duplicate evidence',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const row=(await db.query<{envelope:AssertionEnvelope}>('SELECT envelope FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2',[ws,p.id])).rows[0];
  const poisonId=randomUUID();
  await db.query(`INSERT INTO assertion_outbox(workspace_id,assertion_id,proposal_id,event_sequence,envelope)
   SELECT workspace_id,$3,proposal_id,event_sequence,'{}'::jsonb FROM assertion_outbox WHERE workspace_id=$1 AND proposal_id=$2`,[ws,p.id,poisonId]);
  const worker=new PgAssertionDelivery(db,new PgAssertionInbox(db),opts);await worker.runOnce();
  expect((await worker.inspect(ws)).find(x=>x.assertionId===poisonId)).toMatchObject({status:'FAILED',attempts:1,lastError:'INVALID_ENVELOPE'});
  expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2',[ws,poisonId])).rowCount).toBe(0);
  await expect(new PgAssertionInbox(db).emit({...row.envelope,value:'changed'})).rejects.toThrow('ENVELOPE_CONFLICT');
 });
 it('atomically audits admin stop/replay and rolls back mutation when audit fails',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const id=(await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).find(x=>x.status==='PENDING')!.assertionId;
  const original={...process.env};
  Object.assign(process.env,{AUTH_MODE:'oidc',ASSERTION_DELIVERY_ENABLED:'true',DEPLOYMENT_MODE:'test',PILOT_STORE_MODE:'postgres',DATABASE_URL:process.env.TEST_DATABASE_URL});
  try{
   const ops=new AssertionDeliveryOps(db);
   await expect(ops.change({...opsActor,userId:randomUUID()},id,'stop')).rejects.toThrow();
   expect((await ops.inspect(opsActor)).find(x=>x.assertionId===id)?.status).toBe('PENDING');
   await ops.change(opsActor,id,'stop');
   expect((await ops.inspect(opsActor)).find(x=>x.assertionId===id)?.lastError).toBe('OPERATOR_STOP');
   await expect(db.query('DELETE FROM assertion_delivery_audit WHERE workspace_id=$1',[ws])).rejects.toThrow();
   await ops.change(opsActor,id,'replay');
   await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  }finally{process.env=original;}
 });
 it('simulates crash after inbox commit before acknowledgement and recovers duplicate by expired lease',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const row=(await db.query<{envelope:AssertionEnvelope;assertion_id:string}>('SELECT envelope,assertion_id FROM assertion_outbox WHERE workspace_id=$1 AND status=\'PENDING\'',[ws])).rows[0];
  await new PgAssertionInbox(db).emit(row.envelope);
  await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=1,lease_token=$3,lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND assertion_id=$2",[ws,row.assertion_id,randomUUID()]);
  await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  expect((await db.query('SELECT 1 FROM assertion_inbox WHERE workspace_id=$1 AND assertion_id=$2',[ws,row.assertion_id])).rowCount).toBe(1);
  expect((await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).find(x=>x.assertionId===row.assertion_id)?.status).toBe('DELIVERED');
 });
 it('concurrent workers invoke one sink per fresh lease',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);let calls=0;
  const sink={emit:async(e:AssertionEnvelope)=>{calls++;await new PgAssertionInbox(db).emit(e);}};
  await Promise.all([new PgAssertionDelivery(db,sink,opts).runOnce(),new PgAssertionDelivery(db,sink,opts).runOnce()]);
  expect(calls).toBe(1);
 });
 it('reclaims expired leases and never overwrites immutable evidence',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=1,lease_token=$2,lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND status='PENDING'",[ws,randomUUID()]);
  await Promise.all([new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce(),new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce()]);
  expect((await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).some(r=>r.status==='LEASED')).toBe(false);
  await expect(db.query("UPDATE assertion_outbox SET envelope='{}' WHERE workspace_id=$1",[ws])).rejects.toThrow('immutable');
  const migrations=loadMigrations().filter(m=>m.version >= '014_assertion_delivery');
  await db.withTransaction(async tx=>{
   const schema=`delivery_rollback_${randomUUID().replaceAll('-','')}`;
   await tx.query(`CREATE SCHEMA ${schema}`);await tx.query(`SET LOCAL search_path TO ${schema}`);
   for(const m of loadMigrations())await tx.query(m.up);
   for(const m of [...migrations].reverse())await tx.query(m.down);for(const m of migrations)await tx.query(m.up);
   await tx.query('SET LOCAL search_path TO public');await tx.query(`DROP SCHEMA ${schema} CASCADE`);
  });
 });
});
