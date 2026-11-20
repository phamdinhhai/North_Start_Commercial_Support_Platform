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
  const o=(changes:Partial<SourceObservation>={}):SourceObservation=>({schemaVersion:1,accountId:'p',provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',completeness:'UNKNOWN',verification:'UNVERIFIED',receiptId:randomUUID(),native:{system:'meta',pageId:'p',conversationId:null,messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Invented episode',rawPayload:{utterance:'Invented message',speaker:'customer',original:{invented:true}},...changes});
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
  it('serializes duplicate receipt retries and fails known conversation/native event collisions',async()=>{
    const c=await connect(),a=o(),results=await Promise.all([s.intake(ctx,c.id,a),s.intake(ctx,c.id,a)]);
    expect(results.map(r=>r.disposition).sort()).toEqual(['receipt_duplicate','stored']);
    const known={...a,receiptId:randomUUID(),native:{...a.native,conversationId:'known',eventId:'immutable-event'}};
    await s.intake(ctx,c.id,known);
    await expect(s.intake(ctx,c.id,{...known,receiptId:randomUUID(),native:{...known.native,conversationId:'different'}})).rejects.toMatchObject({code:'NATIVE_OBJECT_COLLISION'});
    await expect(s.intake(ctx,c.id,{...known,receiptId:randomUUID(),native:{...known.native,messageId:'different'}})).rejects.toMatchObject({code:'NATIVE_EVENT_COLLISION'});
    await expect(s.intake(ctx,c.id,{...o(),accountId:'foreign'})).rejects.toMatchObject({code:'SOURCE_SCOPE_MISMATCH'});
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
  it('refuses schema rollback when accepted source history exists and preserves migration bookkeeping', async () => {
    const before = (await db.query('SELECT count(*)::int n FROM source_receipt WHERE workspace_id=$1', [ctx.workspaceId])).rows[0].n;
    expect(before).toBeGreaterThan(0);
    await expect(new Migrator(db, loadMigrations()).down(1)).rejects.toThrow('source integration rollback requires empty history');
    expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE workspace_id=$1', [ctx.workspaceId])).rows[0].n).toBe(before);
    expect((await new Migrator(db, loadMigrations()).applied()).at(-1)).toBe('018_source_integration');
  });
  it('reconciles an explicit event across routes while preserving originals and refusing changed meaning atomically', async () => {
    const pancake=await connect(),meta=await connect('meta-page'),base=o();
    const first={...base,native:{...base.native,eventId:randomUUID(),revision:'fixture-revision-1'}};
    const second=o({...first,provider:'meta-page',route:'meta-page-synthetic',receiptId:randomUUID(),
      observedAt:'2026-11-20T00:00:02Z',rawPayload:{...first.rawPayload,original:{differentFabricatedRoute:'meta'}}});
    const a=await s.intake(ctx,pancake.id,first),b=await s.intake(ctx,meta.id,second);
    expect(b).toMatchObject({leadId:a.leadId,disposition:'object_aligned'});
    expect(b.envelopeId).not.toBe(a.envelopeId);
    const snapshot=async()=>({
      receipts:(await db.query('SELECT count(*)::int n FROM source_receipt WHERE workspace_id=$1 AND lead_id=$2',[ctx.workspaceId,a.leadId])).rows[0].n,
      envelopes:(await db.query('SELECT count(*)::int n FROM commercial_envelope WHERE workspace_id=$1 AND connection IN ($2,$3)',[ctx.workspaceId,pancake.id,meta.id])).rows[0].n,
      native:(await db.query('SELECT count(*)::int n FROM source_native_message WHERE workspace_id=$1 AND lead_id=$2',[ctx.workspaceId,a.leadId])).rows[0].n,
    });
    expect(await snapshot()).toEqual({receipts:2,envelopes:2,native:1});
    const evidence=await s.evidence(ctx.workspaceId,a.leadId!,ctx.userId);
    expect(evidence.map(item=>item.envelope.rawPayload)).toEqual(expect.arrayContaining([first.rawPayload,second.rawPayload]));
    for(const changed of [
      {...second,receiptId:randomUUID(),rawPayload:{...second.rawPayload,speaker:'staff' as const}},
      {...second,receiptId:randomUUID(),lifecycle:'deletion-labelled' as const},
    ]) {
      await expect(s.intake(ctx,meta.id,changed)).rejects.toMatchObject({code:'NATIVE_EVENT_COLLISION',status:409});
      expect(await snapshot()).toEqual({receipts:2,envelopes:2,native:1});
    }
    const other={...ctx,workspaceId:`explicit-event-other-${randomUUID()}`};
    await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[other.workspaceId]);
    const foreign=await connect('meta-page',other);
    const foreignResult=await s.intake(other,foreign.id,{...second,rawPayload:{...second.rawPayload,speaker:'staff'}});
    expect(foreignResult.leadId).not.toBe(a.leadId);
    expect(foreignResult.disposition).toBe('stored');
    expect(await snapshot()).toEqual({receipts:2,envelopes:2,native:1});
  });
  it('reports only scoped local receipt health, including quarantine, without claiming a live sync', async () => {
    const c=await connect(),a=o();
    await s.intake(ctx,c.id,a);
    await s.intake(ctx,c.id,{...o(),native:{...a.native,messageId:null}});
    const view=(await s.listConnections(ctx.workspaceId)).find(r=>r.id===c.id)!;
    expect(view.health).toBe('SYNTHETIC_ONLY');
    expect(view.delivery).toMatchObject({receiptCount:2,quarantineCount:1});
    expect(view.delivery?.lastReceiptAt).toMatch(/^\d{4}-/);
    expect(await s.listConnections('unrelated-workspace')).toEqual([]);
  });
});
