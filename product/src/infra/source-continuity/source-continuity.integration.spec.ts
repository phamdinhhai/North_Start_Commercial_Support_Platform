import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PostgresService} from '../postgres/postgres.service';
import {Migrator,loadMigrations} from '../postgres/migrator';
import {PgSourceIntegrationStore} from '../source-integration/pg-source-integration.store';
import {PgSourceEpisodeLinkStore} from './pg-source-episode-link.store';
import {SourceContinuityService} from '../../application/source-continuity/source-continuity.service';
import {PilotLoopModule} from '../../scripts/pilot-loop.module';
import {RbacService} from '../rbac/rbac.service';
import type {PilotLoopService} from '../../application/pilot/pilot-loop.service';
import type {SourceLinkAuthorization} from '../../ports/source-episode-link';
import {installContentDigester} from '../../ports/content-digester-runtime';
import {configuredContentDigester} from '../crypto/configured-content-digester';
import type {AuthContext} from '../../ports/auth';
import type {SourceObservation,SourceReceipt} from '../../ports/source-observation';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('append-only human episode context',()=>{
 let db:PostgresService,source:PgSourceIntegrationStore,store:PgSourceEpisodeLinkStore,service:SourceContinuityService,cid:string;
 const ctx:AuthContext={workspaceId:`continuity-${randomUUID()}`,userId:'operator-one',role:'admin',isDemo:false};
 const digester=configuredContentDigester({NODE_ENV:'test'});
 const auth:SourceLinkAuthorization=async(c,id,locked)=>{const r=locked?{workspace_id:locked.workspaceId,owner_user_id:locked.ownerUserId}:(await db.query('SELECT workspace_id,owner_user_id FROM lead WHERE workspace_id=$1 AND id=$2',[c.workspaceId,id])).rows[0];if(!r||r.workspace_id!==c.workspaceId||r.owner_user_id!==c.userId)throw new Error('NOT_OWNER');};
 const observation=(conversationId:string|null='conversation',system:'meta'|'pancake'='meta'):SourceObservation=>({schemaVersion:1,accountId:'page',provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',completeness:'UNKNOWN',verification:'UNVERIFIED',receiptId:randomUUID(),native:{system,pageId:'page',conversationId,messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Same name 0900000000',rawPayload:{utterance:'same text 0900000000',speaker:'customer',original:{synthetic:true}}});
 const seed=async(o=observation())=>source.intake(ctx,cid,o,{claimResponsibility:true});
 const input=(r:SourceReceipt,changes={})=>({connectionId:cid,receiptId:r.receiptId,evidenceEnvelopeId:r.envelopeId!,expectedVersion:0,idempotencyKey:randomUUID(),action:'link' as const,reason:'Human chose episode context',...changes});
 beforeAll(async()=>{db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL,max:1,connectionTimeoutMillis:1000});await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[ctx.workspaceId]);installContentDigester(digester);source=new PgSourceIntegrationStore(db);store=new PgSourceEpisodeLinkStore(db);service=new SourceContinuityService(store,auth,auth,digester,true);cid=(await source.createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId:'page'})).id;});
 afterAll(async()=>db?.onModuleDestroy());
 it('same conversation never merges: explicit link adds context and unlink/reject preserve immutable origins',async()=>{
  const a=await seed(),b=await seed();expect(a.leadId).not.toBe(b.leadId);
  const before=(await db.query('SELECT to_jsonb(r) data FROM source_receipt r WHERE workspace_id=$1 ORDER BY id',[ctx.workspaceId])).rows;
  const command=input(b),linked=await service.command(ctx,a.leadId!,command);expect(linked).toMatchObject({effectiveLeadId:a.leadId,originLeadId:b.leadId,linkage:'human_confirmed',verification:'UNVERIFIED',version:1});
  expect(await service.command(ctx,a.leadId!,command)).toEqual(linked);
  await expect(service.command(ctx,a.leadId!,{...command,reason:'changed'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});
  expect(await service.linkedReceipts(ctx,a.leadId!)).toHaveLength(1);
  await service.command(ctx,a.leadId!,input(b,{action:'unlink',expectedVersion:1}));expect(await service.linkedReceipts(ctx,a.leadId!)).toHaveLength(0);
  await service.command(ctx,a.leadId!,input(b,{action:'reject',expectedVersion:2}));expect((await service.list(ctx,a.leadId!)).items.map(r=>r.linkage)).toEqual(['human_confirmed','unknown','rejected']);
  expect((await db.query('SELECT to_jsonb(r) data FROM source_receipt r WHERE workspace_id=$1 ORDER BY id',[ctx.workspaceId])).rows).toEqual(before);
  expect((await db.query('SELECT lead_id FROM source_native_message WHERE workspace_id=$1 AND lead_id=$2',[ctx.workspaceId,b.leadId])).rows).toHaveLength(1);
 });
 it('handles distinct conversations, missing conversation and different native namespaces without inference',async()=>{
  const a=await seed(observation('first')),b=await seed(observation('second')),c=await seed(observation(null)),o=observation('first'),d=await seed(o),e=await seed({...o,receiptId:randomUUID(),native:{...o.native,system:'pancake'}});
  expect(new Set([a.leadId,b.leadId,c.leadId,d.leadId,e.leadId]).size).toBe(5);
  for(const r of [b,c,e])await service.command(ctx,a.leadId!,input(r));expect(await service.linkedReceipts(ctx,a.leadId!)).toHaveLength(3);
  expect((await db.query('SELECT customer_id,attribution FROM lead WHERE id=$1',[a.leadId])).rows[0]).toEqual({customer_id:null,attribution:'unknown'});
 });
 it('serializes optimistic races and reauthorizes current source/target owners',async()=>{
  const a=await seed(),b=await seed();const results=await Promise.allSettled([service.command(ctx,a.leadId!,input(b)),service.command(ctx,a.leadId!,input(b))]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.find(r=>r.status==='rejected')).toMatchObject({reason:{code:'SOURCE_LINK_STALE_VERSION'}});
  await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',['operator-two',b.leadId]);
  await expect(service.command(ctx,a.leadId!,input(b,{expectedVersion:1}))).rejects.toThrow('NOT_OWNER');
  expect(await service.linkedReceipts(ctx,a.leadId!)).toHaveLength(0);
  expect((await service.list(ctx,a.leadId!)).items).toHaveLength(0);
 });
 it('correction requires ownership of source, target and previous effective episode',async()=>{
  const a=await seed(),b=await seed(),c=await seed();await service.command(ctx,a.leadId!,input(b));
  await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',['operator-two',a.leadId]);
  await expect(service.command(ctx,c.leadId!,input(b,{expectedVersion:1}))).rejects.toThrow('NOT_OWNER');
  await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',[ctx.userId,a.leadId]);
  await service.command(ctx,c.leadId!,input(b,{expectedVersion:1}));
  expect(await service.linkedReceipts(ctx,a.leadId!)).toEqual([]);expect(await service.linkedReceipts(ctx,c.leadId!)).toHaveLength(1);
  const other={...ctx,userId:'operator-two'};
  await expect(service.command(other,c.leadId!,input(b,{expectedVersion:2}))).rejects.toThrow('NOT_OWNER');
 });
 it('rejects tenant/evidence mismatches and source history update/delete/truncate',async()=>{
  const a=await seed(),b=await seed();await expect(service.command(ctx,a.leadId!,input(b,{evidenceEnvelopeId:a.envelopeId}))).rejects.toMatchObject({code:'SOURCE_EVIDENCE_MISMATCH'});
  await expect(store.command({...ctx,workspaceId:'foreign'},a.leadId!,input(b),'content',digester,async()=>{})).rejects.toMatchObject({code:'SOURCE_RECEIPT_NOT_FOUND'});
  await service.command(ctx,a.leadId!,input(b));
  for(const sql of ['UPDATE source_episode_link SET reason=reason','DELETE FROM source_episode_link','TRUNCATE source_episode_link'])await expect(db.query(sql)).rejects.toThrow('append-only');
  const historyMigration=loadMigrations().find(m=>m.version==='020_source_episode_link')!;
  await expect(db.withTransaction(tx=>tx.query(historyMigration.down))).rejects.toThrow('empty history');
 });
 it('uses actual runtime locked authority with one pool client and ten concurrent commands',async()=>{
  // Exercise the production factory instead of reproducing its permission checks in the test.
  const providers=Reflect.getMetadata('providers',PilotLoopModule) as {provide:unknown;useFactory?:(db:PostgresService,loop:PilotLoopService,policy:RbacService,enabled:boolean)=>SourceContinuityService}[];
  const factory=providers.find(p=>p.provide===SourceContinuityService)?.useFactory;
  expect(factory).toBeTypeOf('function');
  const {PgPilotStore}=await import('../postgres/pg-pilot.store');
  const pilotStore=new PgPilotStore(db);
  const loop={get:(id:string)=>pilotStore.load(id)} as unknown as PilotLoopService;
  const runtime=factory!(db,loop,new RbacService(),true);
  const pairs=[];
  for(let n=0;n<10;n++)pairs.push({target:await seed(),origin:await seed()});
  const commands=pairs.map(({origin})=>input(origin));
  const results=await Promise.all(pairs.map(({target},index)=>runtime.command(ctx,target.leadId!,commands[index]!)));
  expect(results).toHaveLength(10);expect(results.every(r=>r.version===1&&r.verification==='UNVERIFIED')).toBe(true);
  expect(db.getPool().totalCount).toBe(1);expect(db.getPool().waitingCount).toBe(0);
  // A permission change must be reflected on the next request, including idempotent replay.
  const pair=pairs[0]!,command=input(pair.origin,{expectedVersion:1});
  await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',['operator-two',pair.origin.leadId]);
  await expect(runtime.command(ctx,pair.target.leadId!,command)).rejects.toMatchObject({code:'NOT_OWNER',status:403});
  await expect(runtime.command(ctx,pair.target.leadId!,commands[0]!)).rejects.toMatchObject({code:'NOT_OWNER',status:403});
  expect((await store.list(ctx.workspaceId,pair.target.leadId!))).toHaveLength(1);
  // Caller authority cannot replace the current source origin's owner, even on a target they own.
  expect((await db.query('SELECT owner_user_id FROM lead WHERE id=$1',[pair.origin.leadId])).rows[0].owner_user_id).toBe('operator-two');
 },10000);
 it('rolls back link when final audit fails and permits retry',async()=>{
  const a=await seed(),b=await seed(),v=input(b),original=db.withTransaction.bind(db);
  const failing={withTransaction:<T>(fn:Parameters<PostgresService['withTransaction']>[0])=>original(async tx=>fn({query:async(sql:string,args?:unknown[])=>{if(sql.includes('INSERT INTO audit_record'))throw new Error('injected audit failure');return tx.query(sql,args);}})) as Promise<T>} as PostgresService;
  const s=new SourceContinuityService(new PgSourceEpisodeLinkStore(failing),auth,auth,digester,true);await expect(s.command(ctx,a.leadId!,v)).rejects.toThrow('injected audit failure');
  expect((await store.list(ctx.workspaceId,a.leadId!))).toHaveLength(0);expect(await service.command(ctx,a.leadId!,v)).toMatchObject({version:1});
 });
});
