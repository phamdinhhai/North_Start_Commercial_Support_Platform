import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PostgresService, type SqlExecutor } from '../postgres/postgres.service';
import { Migrator, loadMigrations } from '../postgres/migrator';
import { PgSourceIntegrationStore } from './pg-source-integration.store';
import { installContentDigester } from '../../ports/content-digester-runtime';
import { configuredContentDigester } from '../crypto/configured-content-digester';
import type { AuthContext } from '../../ports/auth';
import type { SourceObservation } from '../../ports/source-observation';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
suite('source bounded reads and locking',()=>{
  let db:PostgresService,store:PgSourceIntegrationStore;
  const ctx:AuthContext={workspaceId:`perf-test-${randomUUID()}`,userId:'fabricated-admin',role:'admin',isDemo:false};
  const observation=(messageId=randomUUID()):SourceObservation=>({schemaVersion:1,accountId:'p',provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',completeness:'UNKNOWN',verification:'UNVERIFIED',receiptId:randomUUID(),native:{system:'meta',pageId:'p',conversationId:null,messageId,eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated',rawPayload:{utterance:'Fabricated',speaker:'customer',original:{fabricated:true}}});
  const conversationObservation=(conversationId:string,pageId:string,system:'meta'|'pancake'='meta'):SourceObservation=>({...observation(),accountId:pageId,native:{system,pageId,conversationId,messageId:randomUUID(),eventId:null,revision:null},rawPayload:{utterance:`Fabricated ${conversationId}`,speaker:'customer',original:{fabricated:true}}});
  const connectWithPage=(pageId='p')=>store.createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId});
  const connect=()=>connectWithPage();
  beforeAll(async()=>{
    db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL,max:8,statement_timeout:5000});
    await new Migrator(db,loadMigrations()).up();
    await db.query('INSERT INTO workspace(id,name) VALUES($1,$1)',[ctx.workspaceId]);
    installContentDigester(configuredContentDigester({NODE_ENV:'test'}));store=new PgSourceIntegrationStore(db);
  });
  afterAll(async()=>{await db?.onModuleDestroy();});
  it('gets a scoped connection beyond the legacy first hundred',async()=>{
    let last=await connect();for(let i=0;i<101;i++)last=await connect();
    expect(await store.getConnection(ctx.workspaceId,last.id)).toMatchObject({id:last.id});
    expect(await store.getConnection('foreign',last.id)).toBeNull();
    expect(await store.getConnection(ctx.workspaceId,'bad')).toBeNull();
    expect(await store.listConnections(ctx.workspaceId)).toHaveLength(100);
  });
  it('pages all receipts at identical timestamps without gaps and rejects cross scope cursors',async()=>{
    const c=await connect(),base=observation();
    const first=await db.withTransaction(async tx=>{
      const sameTransaction=new PgSourceIntegrationStore({withTransaction:<T>(fn:(executor:SqlExecutor)=>Promise<T>)=>fn(tx)} as PostgresService);
      const result=await sameTransaction.intake(ctx,c.id,base);
      for(let i=0;i<6;i++)await sameTransaction.intake(ctx,c.id,{...base,receiptId:randomUUID()});
      return result;
    });
    const seen:string[]=[];let cursor:string|undefined;
    do {
      const page=await store.evidencePage(ctx.workspaceId,first.leadId!,ctx.userId,{limit:2,cursor});
      seen.push(...page.items.map(x=>x.receipt.receiptId));
      if(page.nextCursor) {
        await expect(store.evidencePage('foreign',first.leadId!,ctx.userId,{cursor:page.nextCursor})).rejects.toMatchObject({code:'INPUT_INVALID'});
        await expect(store.evidencePage(ctx.workspaceId,randomUUID(),ctx.userId,{cursor:page.nextCursor})).rejects.toMatchObject({code:'INPUT_INVALID'});
      }
      cursor=page.nextCursor??undefined;
    } while(cursor);
    expect(seen).toHaveLength(7);expect(new Set(seen).size).toBe(7);
  });
  it('pages canonical conversations without skipping boundaries or merging connection/provider identities',async()=>{
    const connections=[] as Awaited<ReturnType<typeof connectWithPage>>[];
    for(const pageId of ['p1','p2','p3','p4','p5']) connections.push(await connectWithPage(pageId));
    const receipts=[] as {receiptId:string;connectionId:string}[];
    // One transaction gives PostgreSQL's transaction timestamp to every receipt;
    // this exercises the UUID tie-breaker without mutating append-only evidence.
    await db.withTransaction(async tx=>{
      const sameTransaction=new PgSourceIntegrationStore({withTransaction:<T>(fn:(executor:SqlExecutor)=>Promise<T>)=>fn(tx)} as PostgresService);
      for(let i=0;i<5;i++){
        const result=await sameTransaction.intake(ctx,connections[i].id,conversationObservation(`conversation-${i+1}`,connections[i].pageId));
        receipts.push({receiptId:result.receiptId,connectionId:connections[i].id});
      }
    });
    const owned=(await db.query<{lead_id:string}>('SELECT lead_id FROM source_receipt WHERE receipt_id=$1',[receipts[0].receiptId])).rows[0].lead_id;
    await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',['sales-owner',owned]);
    const scoped=await store.conversationPage(ctx.workspaceId,'sales-owner',{actorRole:'sales',limit:20});
    expect(scoped.items).toHaveLength(1);
    expect(scoped.items[0].conversationId).toBe('conversation-1');
    const denied=await store.conversationPage(ctx.workspaceId,'unassigned-sales',{actorRole:'sales',limit:20});
    expect(denied.items).toHaveLength(0);
    const seen:string[]=[];let cursor:string|undefined;
    do {
      const page=await store.conversationPage(ctx.workspaceId,ctx.userId,{actorRole:'admin',limit:2,cursor});
      seen.push(...page.items.map(item=>item.canonicalId??item.conversationId));
      cursor=page.nextCursor??undefined;
    } while(cursor);
    expect(seen).toHaveLength(5);expect(new Set(seen).size).toBe(5);

    await store.intake(ctx,connections[0].id,conversationObservation('mixed-conversation','p1','meta'));
    await store.intake(ctx,connections[0].id,conversationObservation('mixed-conversation','p1','meta'));
    const mixedLeads=(await db.query<{id:string}>('SELECT DISTINCT lead_id AS id FROM source_receipt WHERE workspace_id=$1 AND conversation_id=$2',[ctx.workspaceId,'mixed-conversation'])).rows;
    expect(mixedLeads).toHaveLength(2);
    await db.query('UPDATE lead SET owner_user_id=$1 WHERE id=$2',['sales-owner',mixedLeads[0].id]);
    const mixedScoped=await store.conversationPage(ctx.workspaceId,'sales-owner',{actorRole:'sales',conversationId:'mixed-conversation',limit:20});
    expect(mixedScoped.items).toHaveLength(1);
    expect(mixedScoped.items[0].messages).toHaveLength(1);
    expect(mixedScoped.items[0].messageHistoryTruncated).toBe(false);

    // Same native conversation ID is isolated by connection/provider namespace.
    const duplicateA=await store.intake(ctx,connections[0].id,conversationObservation('same-native-id','p1','meta'));
    const duplicateB=await store.intake(ctx,connections[1].id,conversationObservation('same-native-id','p2','pancake'));
    const duplicatePage=await store.conversationPage(ctx.workspaceId,ctx.userId,{actorRole:'admin',conversationId:'same-native-id',limit:10});
    expect(duplicatePage.items.map(item=>item.canonicalId)).toEqual(expect.arrayContaining([
      JSON.stringify([ctx.workspaceId,connections[0].id,'meta','p1','same-native-id']),
      JSON.stringify([ctx.workspaceId,connections[1].id,'pancake','p2','same-native-id'])
    ]));
    expect(duplicateA.receiptId).not.toBe(duplicateB.receiptId);

    await store.revokeConnection(ctx,connections[4].id);
    const afterRevoke=await store.conversationPage(ctx.workspaceId,ctx.userId,{actorRole:'admin',limit:20});
    expect(afterRevoke.items.some(item=>item.canonicalId===JSON.stringify([ctx.workspaceId,connections[4].id,'meta','p5','conversation-5']))).toBe(false);
    const filtered=await store.conversationPage(ctx.workspaceId,ctx.userId,{actorRole:'admin',pageId:'p1',limit:20});
    expect(filtered.items.every(item=>item.pageId==='p1')).toBe(true);

    await db.withTransaction(async tx=>{
      const sameTransaction=new PgSourceIntegrationStore({withTransaction:<T>(fn:(executor:SqlExecutor)=>Promise<T>)=>fn(tx)} as PostgresService);
      for(let i=0;i<101;i++) await sameTransaction.intake(ctx,connections[0].id,conversationObservation('long-history','p1','meta'));
    });
    const bounded=await store.conversationPage(ctx.workspaceId,ctx.userId,{actorRole:'admin',conversationId:'long-history',limit:2});
    expect(bounded.items).toHaveLength(1);
    expect(bounded.items[0].messages).toHaveLength(100);
    expect(bounded.items[0].messageHistoryLimit).toBe(100);
    expect(bounded.items[0].messageHistoryTruncated).toBe(true);
  }, 120000);
  it('holds revoke behind an accepted intake lock, then denies every subsequent append',async()=>{
    const c=await connect(),base=observation();
    let entered!:()=>void,release!:()=>void;
    const locked=new Promise<void>(r=>{entered=r;}),proceed=new Promise<void>(r=>{release=r;});
    const original=db.withTransaction.bind(db);
    const held={withTransaction:<T>(fn:(tx:SqlExecutor)=>Promise<T>)=>original(tx=>fn({query:async(sql:string,args?:unknown[])=>{
      const result=await tx.query(sql,args);if(sql.includes('source_connection')&&sql.includes('FOR UPDATE')){entered();await proceed;}return result;
    }} as SqlExecutor))} as PostgresService;
    const intake=new PgSourceIntegrationStore(held).intake(ctx,c.id,base);await locked;
    let revoked=false;const revoke=store.revokeConnection(ctx,c.id).then(r=>{revoked=true;return r;});
    // Observe the actual database lock wait, not an assumed scheduling delay.
    let blocked=false;
    try {
      for(let i=0;i<100;i++){
        const rows=await db.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'UPDATE source_connection%' LIMIT 1");
        if(rows.rows.length){blocked=true;break;}
        await new Promise(r=>setTimeout(r,5));
      }
      expect(blocked).toBe(true);expect(revoked).toBe(false);
    } finally {release();}
    expect(await intake).toMatchObject({disposition:'stored'});await revoke;
    await expect(store.intake(ctx,c.id,base)).rejects.toMatchObject({code:'CONNECTION_REVOKED'});
    expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE connection_id=$1',[c.id])).rows[0].n).toBe(1);
  });
  it('safely removes and concurrently reapplies only index migration over existing history',async()=>{
    const migration=loadMigrations().find(m=>m.version==='019_source_receipt_lookup_indexes')!;
    const before=(await db.query('SELECT count(*)::int n FROM source_receipt')).rows[0].n;
    // Exercise this index-only downgrade even when later independent migrations exist.
    await db.withTransaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[migration.version]);
      await tx.query(migration.down);
      await tx.query('DELETE FROM schema_migrations WHERE version=$1',[migration.version]);
    });
    expect((await db.query('SELECT count(*)::int n FROM source_receipt')).rows[0].n).toBe(before);
    await Promise.all([new Migrator(db,[migration]).up(),new Migrator(db,[migration]).up()]);
    expect((await db.query("SELECT indexname FROM pg_indexes WHERE indexname IN ('source_receipt_message_history','source_receipt_explicit_event')")).rows).toHaveLength(2);
    expect((await db.query('SELECT count(*)::int n FROM source_receipt')).rows[0].n).toBe(before);
  });
});
