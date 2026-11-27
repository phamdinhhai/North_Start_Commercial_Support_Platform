import { createLead } from '../../domain/lead/lead';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Migrator, loadMigrations } from './migrator';
import { PostgresService } from './postgres.service';
import { PgPilotStore } from './pg-pilot.store';
import { PilotLoopService } from '../../application/pilot/pilot-loop.service';
import { PilotClosureService } from '../../application/pilot/pilot-closure.service';
import { ManualAdapter } from '../../adapters/manual/manual-adapter';
import { RbacService } from '../rbac/rbac.service';
import { configuredContentDigester } from '../crypto/configured-content-digester';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('R4 workflow PostgreSQL CAS and append history',()=>{
 const workspaceId=`r4-${randomUUID()}`;const actor={workspaceId,userId:'owner',role:'sales' as const,isDemo:false};let db:PostgresService;
 beforeAll(async()=>{db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});await new Migrator(db,loadMigrations()).up();});
 afterAll(async()=>{await db?.onModuleDestroy();});
 async function setup(){const store=new PgPilotStore(db);const loop=new PilotLoopService(store,new ManualAdapter());const service=new PilotClosureService(store,new RbacService(),configuredContentDigester({NODE_ENV:'test'}));const s=await loop.ingestScenario({workspaceId,ownerUserId:'owner',displayName:'Workflow',utterance:'accepted original',speaker:'customer',connection:'manual',externalRecordId:randomUUID(),isSynthetic:false});return {store,loop,service,s};}
 it('persists context/receipt atomically, survives fresh store, enforces immutable history',async()=>{const f=await setup();const input={expectedVersion:1,idempotencyKey:'edit',text:'current context',reason:'operator edit'};const r=await f.service.execute(actor,f.s.lead.id,'context',input);const fresh=await new PgPilotStore(db).load(f.s.lead.id);expect(fresh?.contextRevisions?.[0].text).toBe('current context');expect(fresh?.closureCommands?.[0].result).toEqual({version:2,revisionId:(r.revision as {id:string}).id});expect(JSON.stringify(fresh?.closureCommands)).not.toContain('current context');expect(await f.service.execute(actor,f.s.lead.id,'context',input)).toEqual(r);await expect(db.query('UPDATE pilot_context_revision SET text=$2 WHERE lead_id=$1',[f.s.lead.id,'rewrite'])).rejects.toThrow('append-only');await expect(db.query('DELETE FROM pilot_closure_command WHERE lead_id=$1',[f.s.lead.id])).rejects.toThrow('append-only');expect(fresh?.envelope?.rawPayloadDigest?.algorithm_version).toBe('hmac-sha256-v1');});
 it('CAS prevents lost update, identical concurrent submissions return one result',async()=>{const f=await setup();const b={expectedVersion:1,idempotencyKey:'duplicate',action:'Call',reason:'follow-up'};const r=await Promise.all([f.service.execute(actor,f.s.lead.id,'create',b),f.service.execute(actor,f.s.lead.id,'create',b)]);expect(r[0]).toEqual(r[1]);expect((await f.store.load(f.s.lead.id))?.workItems).toHaveLength(1);await expect(f.service.execute(actor,f.s.lead.id,'context',{expectedVersion:1,idempotencyKey:'other',text:'new',reason:'stale'})).rejects.toMatchObject({code:'STALE_VERSION'});});
 it('evidence read audit is version neutral and discovery includes zero-work leads',async()=>{const f=await setup();expect((await f.service.leads(actor,{classification:'real'})).items.some(x=>x.leadId===f.s.lead.id)).toBe(true);await f.service.evidence(actor,f.s.lead.id);expect((await f.store.load(f.s.lead.id))?.version).toBe(1);expect((await f.store.history(f.s.lead.id)).some(x=>x.eventType==='evidence_accessed')).toBe(true);});
 it('rolls back context and receipt when mutation audit fails',async()=>{const f=await setup();const before=await f.store.load(f.s.lead.id);await expect(f.store.save({...before!,contextRevisions:[{id:randomUUID(),text:'never commit',actor:'owner',recordedAt:new Date().toISOString(),reason:'test'}]},[{entityType:'lead',entityId:randomUUID(),workspaceId,actor:'owner',eventType:'invalid',newValue:'bad'}])).rejects.toThrow();expect((await f.store.load(f.s.lead.id))?.contextRevisions).toEqual([]);expect((await f.store.load(f.s.lead.id))?.version).toBe(1);});
 it('composite FK refuses crossworkspace context references',async()=>{const f=await setup();await expect(db.query('INSERT INTO pilot_context_revision(id,lead_id,workspace_id,text,actor,recorded_at,reason) VALUES($1,$2,$3,$4,$5,now(),$6)',[randomUUID(),f.s.lead.id,'wrong-workspace','context','owner','test'])).rejects.toThrow();});
 it('refuses immutable classification rewrites on existing lead saves',async()=>{const f=await setup();await expect(f.store.save({...f.s,envelope:{...f.s.envelope!,isSynthetic:true}},[])).rejects.toMatchObject({conflicts:['isSynthetic']});expect((await f.store.load(f.s.lead.id))?.envelope?.isSynthetic).toBe(false);});

 it('preserves unknown source classification for bare legacy leads in PG lists and queue',async()=>{const f=await setup();const lead=createLead({workspaceId,displayName:'unknown provenance'});await f.store.save({lead,ownerUserId:'owner',outcomes:[],workItems:[{id:randomUUID(),leadId:lead.id,workspaceId,action:'Legacy work',responsibleParty:'internal',origin:'explicit-request',status:'open',completionEvidence:'absent',occurredAt:'unknown',recordedAt:new Date().toISOString(),actor:'owner'}]},[]);for(const classification of ['real','synthetic'] as const){expect((await f.service.leads(actor,{classification})).items.some(x=>x.leadId===lead.id)).toBe(false);expect((await f.store.queue({workspaceId,actorId:'owner',actorRole:'sales',classification})).items.some(x=>x.leadId===lead.id)).toBe(false);}expect((await f.service.leads(actor,{classification:'all'})).items.find(x=>x.leadId===lead.id)?.isSynthetic).toBeNull();expect((await f.store.queue({workspaceId,actorId:'owner',actorRole:'sales',classification:'all'})).items.find(x=>x.leadId===lead.id)?.isSynthetic).toBeNull();});
 it('applies bounded Vietnamese search before PostgreSQL pagination and binds cursor scope',async()=>{
   const searchWorkspace=`${workspaceId}-search`;
   await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[searchWorkspace]);
   const searchLeadId=randomUUID();
   await db.query(`INSERT INTO lead(id,workspace_id,display_name,status,owner_user_id) SELECT gen_random_uuid(),$1,'Lead số '||i,'New',$2 FROM generate_series(1,100) i`,[searchWorkspace,'owner']);
   await db.query(`INSERT INTO lead(id,workspace_id,display_name,status,owner_user_id) VALUES($1,$2,$3,'New',$4)`,[searchLeadId,searchWorkspace,'Khách hàng Đà Nẵng','owner']);
   const first=await new PgPilotStore(db).leads({workspaceId:searchWorkspace,actorId:'owner',actorRole:'sales',classification:'all',search:'đà nẵng',limit:25});
   expect(first.items.map(x=>x.displayName)).toEqual(['Khách hàng Đà Nẵng']);
   const page=await new PgPilotStore(db).leads({workspaceId:searchWorkspace,actorId:'owner',actorRole:'sales',classification:'all',limit:25});
   expect(page.nextCursor).toBeDefined();
   await expect(new PgPilotStore(db).leads({workspaceId:searchWorkspace,actorId:'other',actorRole:'sales',classification:'all',limit:25,after:page.nextCursor})).rejects.toMatchObject({code:'INPUT_INVALID'});
   await expect(new PgPilotStore(db).leads({workspaceId:searchWorkspace,actorId:'owner',actorRole:'sales',classification:'synthetic',limit:25,after:page.nextCursor})).rejects.toMatchObject({code:'INPUT_INVALID'});
 });

});
