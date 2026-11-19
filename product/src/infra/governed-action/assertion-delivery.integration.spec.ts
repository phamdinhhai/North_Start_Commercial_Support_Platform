import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
 const opts={batchSize:10,maxAttempts:2,leaseMs:1000,timeoutMs:100,backoffMs:1};
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
 beforeAll(async()=>{db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name) VALUES ($1,$1)',[ws]);});
 afterAll(async()=>{await db?.onModuleDestroy();});
 it('atomically persists outcome and envelope, survives restart and deduplicates inbox',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  const inbox=new PgAssertionInbox(db);const worker=new PgAssertionDelivery(db,inbox,opts);
  expect((await worker.inspect(ws))[0]).toMatchObject({status:'PENDING',attempts:0});
  const other=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});
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
  expect(await fail.replay('foreign',failed.assertionId)).toBe(false);
  expect(await fail.replay(ws,failed.assertionId)).toBe(true);
  await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce();
  expect((await fail.inspect(ws)).find(r=>r.assertionId===failed.assertionId)?.status).toBe('DELIVERED');
 });
 it('reclaims expired leases and never overwrites immutable evidence',async()=>{
  const {service,p}=await verified();await service.execute(actor,p.id);
  await db.query("UPDATE assertion_outbox SET status='LEASED',attempts=1,lease_token=$2,lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND status='PENDING'",[ws,randomUUID()]);
  await Promise.all([new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce(),new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).runOnce()]);
  expect((await new PgAssertionDelivery(db,new PgAssertionInbox(db),opts).inspect(ws)).some(r=>r.status==='LEASED')).toBe(false);
  await expect(db.query("UPDATE assertion_outbox SET envelope='{}' WHERE workspace_id=$1",[ws])).rejects.toThrow('immutable');
  const migration=loadMigrations().find(m=>m.version==='014_assertion_delivery')!;
  await db.withTransaction(async tx=>{await tx.query(migration.down);await tx.query(migration.up);});
 });
});

