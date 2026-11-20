import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {PostgresService} from '../postgres/postgres.service';
import {Migrator,loadMigrations} from '../postgres/migrator';
import {PgSourceIntegrationStore} from './pg-source-integration.store';
import {installContentDigester} from '../../ports/content-digester-runtime';
import {configuredContentDigester} from '../crypto/configured-content-digester';
import type {AuthContext} from '../../ports/auth';
import type {SourceObservation} from '../../ports/source-observation';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('durable synthetic source evidence',()=>{
  let db:PostgresService,s:PgSourceIntegrationStore;
  const ctx:AuthContext={workspaceId:`source-${randomUUID()}`,userId:'synthetic-admin',role:'admin',isDemo:false};
  const o=(changes:Partial<SourceObservation>={}):SourceObservation=>({schemaVersion:1,provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',completeness:'UNKNOWN',verification:'UNVERIFIED',receiptId:randomUUID(),native:{system:'meta',pageId:'p',conversationId:null,messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Invented episode',rawPayload:{utterance:'Invented message',speaker:'customer',original:{invented:true}},...changes});
  const connect=(p:'pancake'|'meta-page'='pancake',c=ctx)=>s.createConnection(c,{provider:p,route:p==='pancake'?'pancake-synthetic':'meta-page-synthetic',pageId:'p'});
  beforeAll(async()=>{db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[ctx.workspaceId]);installContentDigester(configuredContentDigester({NODE_ENV:'test'}));s=new PgSourceIntegrationStore(db);});
  afterAll(async()=>{await db?.onModuleDestroy();});
  it('serializes dualpath same message, retains raw and provenance, survives restart without owner/actions/outcomes',async()=>{
    const p=await connect(),m=await connect('meta-page'),a=o(),b=o({...a,receiptId:randomUUID(),provider:'meta-page',route:'meta-page-synthetic',observedAt:'2026-11-20T00:00:01Z',rawPayload:{...a.rawPayload,original:{otherRoute:true}}});
    const r=await Promise.all([s.intake(ctx,p.id,a),s.intake(ctx,m.id,b)]);expect(r[0].leadId).toBe(r[1].leadId);
    expect(r.map(x=>x.disposition).sort()).toEqual(['object_aligned','stored']);
    const e=await s.evidence(ctx.workspaceId,r[0].leadId!,ctx.userId);expect(e).toHaveLength(2);expect(e.map(x=>x.envelope.rawPayload)).toEqual(expect.arrayContaining([a.rawPayload,b.rawPayload]));
    expect((await db.query('SELECT owner_user_id,attribution FROM lead WHERE id=$1',[r[0].leadId])).rows[0]).toEqual({owner_user_id:null,attribution:'unknown'});
    for(const table of ['outcome','handoff','pilot_work_item'])expect((await db.query(`SELECT id FROM ${table} WHERE lead_id=$1`,[r[0].leadId])).rows).toHaveLength(0);
    await db.onModuleDestroy();s=new PgSourceIntegrationStore(db);expect(await s.intake(ctx,p.id,a)).toMatchObject({disposition:'receipt_duplicate',leadId:r[0].leadId});
    await expect(s.intake(ctx,p.id,{...a,rawPayload:{...a.rawPayload,utterance:'changed'}})).rejects.toMatchObject({code:'RECEIPT_COLLISION'});
  });
  it('separates messages and workspaces despite identical text and accepts missing conversation provenance',async()=>{
    const c=await connect(),a=o(),first=await s.intake(ctx,c.id,a),second=await s.intake(ctx,c.id,o());expect(first.leadId).not.toBe(second.leadId);
    const other={...ctx,workspaceId:`other-${randomUUID()}`};await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[other.workspaceId]);
    const foreign=await connect('pancake',other);expect((await s.intake(other,foreign.id,a)).leadId).not.toBe(first.leadId);
    await expect(s.intake(other,c.id,a)).rejects.toMatchObject({status:404});expect(await s.evidence(other.workspaceId,first.leadId!,other.userId)).toEqual([]);
  });
  it('appends unordered edits/delete and explicit distinct events while refusing same native event changed content',async()=>{
    const c=await connect(),base=o(),event={...base,native:{...base.native,eventId:'event1',revision:'1'}},r=await s.intake(ctx,c.id,event);
    await expect(s.intake(ctx,c.id,{...event,receiptId:randomUUID(),rawPayload:{...base.rawPayload,utterance:'collision'}})).rejects.toMatchObject({code:'NATIVE_EVENT_COLLISION'});
    for(const [eventId,label,utterance,observedAt] of [['event3','deletion-labelled','','2026-11-20T00:00:03Z'],['event2','upsert-observed','edited','2026-11-20T00:00:02Z']] as const){
      expect(await s.intake(ctx,c.id,{...base,receiptId:randomUUID(),native:{...base.native,eventId},lifecycle:label,observedAt,rawPayload:{...base.rawPayload,utterance}})).toMatchObject({leadId:r.leadId,disposition:'distinct_event'});
    }
    const e=await s.evidence(ctx.workspaceId,r.leadId!,ctx.userId);expect(e).toHaveLength(3);expect(e[0].envelope.rawPayload).toEqual(base.rawPayload);
    await expect(db.query('UPDATE source_receipt SET disposition=disposition WHERE lead_id=$1',[r.leadId])).rejects.toThrow('append-only');
  });
  it('quarantines missing native identity without retaining raw and blocks revoked sources',async()=>{
    const c=await connect(),a=o();const r=await s.intake(ctx,c.id,{...a,native:{...a.native,messageId:null}});expect(r).toMatchObject({leadId:null,envelopeId:null,quarantineReason:'UNKNOWN_NATIVE_ID'});
    const row=(await db.query('SELECT observation FROM source_receipt WHERE connection_id=$1',[c.id])).rows[0];expect(JSON.stringify(row)).not.toContain('Invented message');
    await s.revokeConnection(ctx,c.id);await expect(s.intake(ctx,c.id,o())).rejects.toMatchObject({code:'CONNECTION_REVOKED'});
  });
  it('claims responsibility only on explicitly commanded creation and never reassigns existing message on replay',async()=>{
    const c=await connect(),a=o(),r=await s.intake(ctx,c.id,a,{claimResponsibility:true});
    expect((await db.query('SELECT owner_user_id FROM lead WHERE id=$1',[r.leadId])).rows[0].owner_user_id).toBe(ctx.userId);
    await s.intake({...ctx,userId:'other-admin'},c.id,{...a,receiptId:randomUUID()},{claimResponsibility:true});
    await s.intake({...ctx,userId:'other-admin'},c.id,a,{claimResponsibility:true});
    expect((await db.query('SELECT owner_user_id FROM lead WHERE id=$1',[r.leadId])).rows[0].owner_user_id).toBe(ctx.userId);
  });
  it('rolls back envelope lead native mapping and receipt when final audit fails; retry recovers atomically',async()=>{
    const c=await connect(),a=o(),original=db.withTransaction.bind(db);
    const failing={withTransaction:<T>(fn:Parameters<PostgresService['withTransaction']>[0])=>original(async tx=>fn({query:async(sql:string,args?:unknown[])=>{if(args?.includes('source.receipt.appended'))throw new Error('injected audit failure');return tx.query(sql,args);}})) as Promise<T>} as PostgresService;
    await expect(new PgSourceIntegrationStore(failing).intake(ctx,c.id,a)).rejects.toThrow('injected audit failure');
    expect((await db.query('SELECT id FROM commercial_envelope WHERE connection=$1',[c.id])).rows).toHaveLength(0);
    expect((await db.query('SELECT id FROM source_receipt WHERE connection_id=$1',[c.id])).rows).toHaveLength(0);
    expect(await s.intake(ctx,c.id,a)).toMatchObject({disposition:'stored'});
  });
});
