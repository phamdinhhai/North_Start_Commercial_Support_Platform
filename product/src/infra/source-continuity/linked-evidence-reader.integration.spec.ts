import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PostgresService} from '../postgres/postgres.service';
import {Migrator,loadMigrations} from '../postgres/migrator';
import {PgSourceIntegrationStore} from '../source-integration/pg-source-integration.store';
import {PgLinkedSourceEvidenceReader} from './pg-linked-source-evidence.reader';
import {installContentDigester} from '../../ports/content-digester-runtime';
import {configuredContentDigester} from '../crypto/configured-content-digester';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('R4.11 linked source evidence durable read boundary',()=>{
 let db:PostgresService,reader:PgLinkedSourceEvidenceReader,cid:string,receipt:string,envelope:string;
 const workspaceId='qa-reader-'+randomUUID(),ctx={workspaceId,userId:'qa-actor',role:'admin' as const,isDemo:false};
 beforeAll(async()=>{
  db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});await new Migrator(db,loadMigrations()).up();
  installContentDigester(configuredContentDigester({NODE_ENV:'test'}));await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[workspaceId]);
  const store=new PgSourceIntegrationStore(db);cid=(await store.createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId:'page'})).id;
  receipt=randomUUID();const r=await store.intake(ctx,cid,{schemaVersion:1,accountId:'page',provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',verification:'UNVERIFIED',completeness:'UNKNOWN',receiptId:receipt,
   native:{system:'pancake',pageId:'page',conversationId:null,messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated reader QA',rawPayload:{utterance:'Fabricated',speaker:'customer',original:{invented:true}}},{claimResponsibility:true});
  envelope=r.envelopeId!;reader=new PgLinkedSourceEvidenceReader(db);
 });
 afterAll(async()=>db?.onModuleDestroy());
 const auditCount=async()=>Number((await db.query("SELECT count(*) n FROM audit_record WHERE workspace_id=$1 AND event_type='source.linked-evidence.accessed'",[workspaceId])).rows[0].n);
 it('rejects each wrong tuple component before returning evidence or appending access audit',async()=>{
  const before=await auditCount();
  for(const [w,c,r,e] of [['foreign',cid,receipt,envelope],[workspaceId,randomUUID(),receipt,envelope],[workspaceId,cid,'foreign',envelope],[workspaceId,cid,receipt,randomUUID()]])
   expect(await reader.read(w,c,r,e,ctx.userId)).toBeNull();
  expect(await auditCount()).toBe(before);
  const evidence=await reader.read(workspaceId,cid,receipt,envelope,ctx.userId);expect(evidence?.envelope.envelopeId).toBe(envelope);expect(evidence?.receipt.verification).toBe('UNVERIFIED');expect(await auditCount()).toBe(before+1);
 });
 it('mandatory access audit failure aborts the transaction with no returned evidence',async()=>{
  const before=await auditCount(),original=db.withTransaction.bind(db);
  const failing={withTransaction:<T>(fn:Parameters<PostgresService['withTransaction']>[0])=>original(async tx=>fn({query:async(sql:string,args?:unknown[])=>{
   if(sql.includes('INSERT INTO audit_record'))throw new Error('qa audit fault');return tx.query(sql,args);
  }})) as Promise<T>} as PostgresService;
  await expect(new PgLinkedSourceEvidenceReader(failing).read(workspaceId,cid,receipt,envelope,ctx.userId)).rejects.toThrow('qa audit fault');
  expect(await auditCount()).toBe(before);expect(await reader.read(workspaceId,cid,receipt,envelope,ctx.userId)).not.toBeNull();expect(await auditCount()).toBe(before+1);
 });
});
