import{beforeAll,afterAll,describe,it,expect,vi}from'vitest';
import{randomUUID,randomBytes,createHmac}from'node:crypto';
import{PostgresService,type SqlExecutor}from'../postgres/postgres.service';
import{Migrator,loadMigrations}from'../postgres/migrator';
import{PgSourceIntegrationStore}from'../source-integration/pg-source-integration.store';
import{PgFabricatedDeliveryStore}from'./pg-fabricated-delivery.store';
import{FabricatedWebhookAdmission}from'../../application/provider-transport/fabricated-webhook';
import{TestOnlyProviderCredentialStore}from'../../application/provider-credentials/test-only-credential-store';
import{validateSourceObservation}from'../../application/source-integration/validation';
import{assertSyntheticSourceAdmission}from'../../application/source-trust/source-trust';
import{verifyMetaSignature}from'../../adapters/provider-contracts/meta-signature';
import{installContentDigester}from'../../ports/content-digester-runtime';
import{configuredContentDigester}from'../crypto/configured-content-digester';
import type{AuthContext}from'../../ports/auth';
import type{SourceConnection}from'../../ports/source-observation';
const suite=process.env.TEST_DATABASE_URL?describe:describe.skip;
const admit=(v:unknown,w:string,c:SourceConnection)=>{const o=validateSourceObservation(v);assertSyntheticSourceAdmission(o,{workspaceId:w,connection:c});return o;};
suite('signed fabricated delivery durable admission (not a live provider receiver)',()=>{
 let db:PostgresService,source:PgSourceIntegrationStore,credentials:TestOnlyProviderCredentialStore;
 const ctx:AuthContext={workspaceId:'delivery-'+randomUUID(),userId:'operator',role:'admin',isDemo:false};
 const secret=randomBytes(48).toString('base64');
 const observation=(pageId:string)=>({schemaVersion:1,provider:'pancake',route:'pancake-synthetic',accountId:pageId,synthetic:true,sourceAuthority:'synthetic_fixture',verification:'UNVERIFIED',completeness:'UNKNOWN',receiptId:randomUUID(),native:{system:'meta',pageId,conversationId:'fabricated-conversation',messageId:randomUUID(),eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated signed delivery',rawPayload:{utterance:'Fabricated only',speaker:'customer',original:{fabricated:true}}});
 const signed=(body:unknown,key=secret)=>{const raw=Buffer.from(typeof body==='string'?body:JSON.stringify(body));return {raw,signature:'sha256='+createHmac('sha256',key).update(raw).digest('hex')};};
 beforeAll(async()=>{vi.stubEnv('DEPLOYMENT_MODE','test');db=new PostgresService({connectionString:process.env.TEST_DATABASE_URL});await new Migrator(db,loadMigrations()).up();await db.query('INSERT INTO workspace(id,name)VALUES($1,$1)',[ctx.workspaceId]);installContentDigester(configuredContentDigester({NODE_ENV:'test'}));source=new PgSourceIntegrationStore(db);credentials=new TestOnlyProviderCredentialStore('test',true);});
 afterAll(async()=>{await db?.onModuleDestroy();vi.unstubAllEnvs();});
 async function setup(customDb=db){const c=await source.createConnection(ctx,{provider:'pancake',route:'pancake-synthetic',pageId:'page'}),m=await credentials.configure(ctx,{workspaceId:ctx.workspaceId,connectionId:c.id,provider:'pancake',accountId:'page',scopes:['messages.read']},secret),principal=await credentials.issuePrincipal(ctx,m.credentialId);return{c,m,principal,service:new FabricatedWebhookAdmission(credentials,new PgFabricatedDeliveryStore(customDb,credentials,admit),verifyMetaSignature,true)};}
 const body=(events=[observation('page')])=>({protocol:'north-start-fabricated-delivery/v1',deliveryId:randomUUID(),events});
 it('acknowledges only after commit; duplicate signed attempts preserve one intended effect and audit each attempt',async()=>{
  const{c,principal,service}=await setup(),b=body(),s=signed(b);
  const results=await Promise.all([1,2,3].map(()=>service.accept(principal,s.raw,'application/json',s.signature)));
  expect(results.filter(r=>!r.duplicate)).toHaveLength(1);expect(results.every(r=>r.classification==='TEST_ONLY')).toBe(true);
  expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE connection_id=$1',[c.id])).rows[0].n).toBe(1);
  expect((await db.query('SELECT count(*)::int n FROM fabricated_delivery_attempt WHERE connection_id=$1',[c.id])).rows[0].n).toBe(3);
  const states=(await db.query('SELECT owner_user_id,customer_id,status,attribution FROM lead WHERE workspace_id=$1 AND source_envelope_id IN(SELECT envelope_id FROM source_receipt WHERE connection_id=$2)',[ctx.workspaceId,c.id])).rows;
  expect(states).toEqual([{owner_user_id:null,customer_id:null,status:'New',attribution:'unknown'}]);
  const changed=signed({...b,events:[{...b.events[0],rawPayload:{...b.events[0].rawPayload,utterance:'different fabricated'}}]});await expect(service.accept(principal,changed.raw,'application/json',changed.signature)).rejects.toMatchObject({code:'DELIVERY_COLLISION'});
 });
 it('rejects invalid MAC before accepted evidence, including malformed JSON and non-json/oversized body',async()=>{
  const{c,principal,service}=await setup(),s=signed(body());
  await expect(service.accept(principal,s.raw,'application/json','sha256='+'0'.repeat(64))).rejects.toMatchObject({code:'DELIVERY_AUTH_INVALID'});
  const malformed=signed('{not json');await expect(service.accept(principal,malformed.raw,'application/json',malformed.signature)).rejects.toMatchObject({code:'DELIVERY_SCHEMA_INVALID'});
  for(const[type,raw]of[['text/plain',s.raw],['application/json',Buffer.alloc(1048577)] ]as const)await expect(service.accept(principal,raw,type,s.signature)).rejects.toMatchObject({code:'DELIVERY_SCHEMA_INVALID'});
  expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE connection_id=$1',[c.id])).rows[0].n).toBe(0);
 });
 it('rejects forged routing, account, timestamp/media schema, and structural principals without secret disclosure',async()=>{
  const{c,principal,service}=await setup();
  for(const b of[{...body(),workspaceId:'foreign'},{...body(),events:[observation('wrong-page')]},{...body(),events:[{...observation('page'),observedAt:'2026-02-30T00:00:00Z'}]},{...body(),events:[{...observation('page'),attachments:['unexpected']}]}]){const s=signed(b);try{await service.accept(principal,s.raw,'application/json',s.signature);throw Error('expected refusal');}catch(e){expect(e).toHaveProperty('code');expect(JSON.stringify(e)).not.toContain(secret);}}
  const s=signed(body());await expect(service.accept({...principal,workspaceId:'foreign'},s.raw,'application/json',s.signature)).rejects.toMatchObject({code:'CREDENTIAL_UNAVAILABLE'});
  expect((await db.query('SELECT count(*)::int n FROM fabricated_delivery WHERE connection_id=$1',[c.id])).rows[0].n).toBe(0);
 });
 it('rolls back source evidence and delivery ledger when durable acceptance audit fails',async()=>{
  const original=db.withTransaction.bind(db);const failing={withTransaction:<T>(fn:(tx:SqlExecutor)=>Promise<T>)=>original(tx=>fn({query:async(sql:string,args?:unknown[])=>{if(sql.includes('INSERT INTO fabricated_delivery_attempt'))throw Error('injected attempt audit failure');return tx.query(sql,args);}} as SqlExecutor))}as PostgresService;
  const{c,principal,service}=await setup(failing),s=signed(body());await expect(service.accept(principal,s.raw,'application/json',s.signature)).rejects.toThrow('injected attempt audit failure');
  expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE connection_id=$1',[c.id])).rows[0].n).toBe(0);expect((await db.query('SELECT count(*)::int n FROM fabricated_delivery WHERE connection_id=$1',[c.id])).rows[0].n).toBe(0);
  const retry=new FabricatedWebhookAdmission(credentials,new PgFabricatedDeliveryStore(db,credentials,admit),verifyMetaSignature,true);expect(await retry.accept(principal,s.raw,'application/json',s.signature)).toMatchObject({duplicate:false,accepted:1});
 });
 it('revocation and rotation reject stale principals, and connection revoke refuses historical replay',async()=>{
  const{c,m,principal,service}=await setup(),s=signed(body());await service.accept(principal,s.raw,'application/json',s.signature);
  await credentials.rotate(ctx,m.credentialId,secret+'new',1);await expect(service.accept(principal,s.raw,'application/json',s.signature)).rejects.toMatchObject({code:'CREDENTIAL_VERSION_CONFLICT'});
  const fresh=await credentials.issuePrincipal(ctx,m.credentialId),rotated=signed(body(),secret+'new');await source.revokeConnection(ctx,c.id);await expect(service.accept(fresh,rotated.raw,'application/json',rotated.signature)).rejects.toMatchObject({code:'CONNECTION_REVOKED'});
  await credentials.revoke(ctx,m.credentialId);await expect(service.accept(fresh,rotated.raw,'application/json',rotated.signature)).rejects.toMatchObject({code:'CREDENTIAL_REVOKED'});
 });
 it('keeps production disabled and forbids nonempty downgrade without deleting immutable delivery history',async()=>{
  const{principal}=await setup();const disabled=new FabricatedWebhookAdmission(credentials,new PgFabricatedDeliveryStore(db,credentials,admit),verifyMetaSignature);const s=signed(body());await expect(disabled.accept(principal,s.raw,'application/json',s.signature)).rejects.toMatchObject({code:'FABRICATED_WEBHOOK_DISABLED'});
  const down=loadMigrations().find(m=>m.version==='023_fabricated_delivery')!.down;await expect(db.withTransaction(tx=>tx.query(down))).rejects.toThrow('empty history');
  for(const sql of['UPDATE fabricated_delivery SET accepted_count=0','DELETE FROM fabricated_delivery_attempt','TRUNCATE fabricated_delivery_attempt'])await expect(db.query(sql)).rejects.toThrow('append-only');
 });
 it('fails closed without explicit mode and redacts verifier exceptions',async()=>{
  const{principal,service}=await setup(),s=signed(body());
  vi.stubEnv('DEPLOYMENT_MODE',undefined);vi.stubEnv('APP_MODE',undefined);
  await expect(service.accept(principal,s.raw,'application/json',s.signature)).rejects.toMatchObject({code:'TEST_ONLY'});
  vi.stubEnv('DEPLOYMENT_MODE','test');
  const broken=new FabricatedWebhookAdmission(credentials,new PgFabricatedDeliveryStore(db,credentials,admit),()=>{throw Error('private-provider-token');},true);
  await expect(broken.accept(principal,s.raw,'application/json',s.signature)).rejects.toMatchObject({code:'DELIVERY_AUTH_INVALID'});
 });
 it('refuses a signed profile-only principal at admission and persistence, without creating accepted evidence',async()=>{
  const{c,principal}=await setup(),profile=await credentials.configure(ctx,{workspaceId:ctx.workspaceId,connectionId:c.id,provider:'pancake',accountId:'page',scopes:['profile.read']},secret);
  const restricted=await credentials.issuePrincipal(ctx,profile.credentialId),b=body(),s=signed(b),sink=new PgFabricatedDeliveryStore(db,credentials,admit);
  const service=new FabricatedWebhookAdmission(credentials,sink,verifyMetaSignature,true);
  await expect(service.accept(restricted,s.raw,'application/json',s.signature)).rejects.toMatchObject({code:'CREDENTIAL_SCOPE_MISMATCH'});
  await expect(sink.accept(restricted,{deliveryId:b.deliveryId,observations:b.events as never})).rejects.toMatchObject({code:'CREDENTIAL_SCOPE_MISMATCH'});
  await expect(credentials.resolve(principal)).rejects.toMatchObject({code:'CREDENTIAL_VERSION_CONFLICT'});
  expect((await db.query('SELECT count(*)::int n FROM source_receipt WHERE connection_id=$1',[c.id])).rows[0].n).toBe(0);
 });
});
