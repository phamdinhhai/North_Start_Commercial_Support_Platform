// Fabricated-only signed operator fixture. No provider calls, tokens or Owner resources.
import 'reflect-metadata';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter} from '@nestjs/platform-fastify';
import {startIdp} from '../oidc/fixture-idp.mjs';
const target=new URL(process.env.QA_DATABASE_URL||'invalid:');
if(!['postgres:','postgresql:'].includes(target.protocol)||target.hostname!=='127.0.0.1'||!target.port||!/^\/qa_browser_[a-z0-9_]+$/.test(target.pathname)||target.search||target.hash)throw new Error('Fresh explicit loopback qa_browser_* database required');
if(!/^[a-f0-9]{64}$/.test(process.env.QA_CONTROL_SECRET||''))throw new Error('Runner control secret required');
const require=createRequire(import.meta.url),origin='http://127.0.0.1:3440',issuer='http://127.0.0.1:3441';
Object.assign(process.env,{DATABASE_URL:process.env.QA_DATABASE_URL,DEPLOYMENT_MODE:'test',NODE_ENV:'test',PILOT_STORE_MODE:'postgres',AUTH_MODE:'oidc',AUTH_DEV_UNSIGNED_TOKENS:'false',DEMO_WORKSPACES:'false',OIDC_BROWSER_ENABLED:'true',SOURCE_INTEGRATION_SYNTHETIC_ENABLED:'true',OIDC_BROWSER_ORIGIN:origin,OIDC_AUTHORIZATION_ENDPOINT:issuer+'/authorize',OIDC_TOKEN_ENDPOINT:issuer+'/token',OIDC_CLIENT_ID:'qa-browser',OIDC_ISSUER:issuer,OIDC_JWKS_URI:issuer+'/jwks',OIDC_AUDIENCE:'qa-api',CONTENT_DIGEST_KEYS_JSON:JSON.stringify(['qa-browser-a','qa-browser-b'].map(workspaceId=>({workspaceId,activeKid:'fixture-v1',keys:[{kid:'fixture-v1',secretBase64:randomBytes(32).toString('base64')}]})))});
const {installContentDigester}=require('../../dist/ports/content-digester-runtime.js');
const {configuredContentDigester}=require('../../dist/infra/crypto/configured-content-digester.js');
installContentDigester(configuredContentDigester(process.env));
const {PostgresService}=require('../../dist/infra/postgres/postgres.service.js');
const {Migrator,loadMigrations}=require('../../dist/infra/postgres/migrator.js');
const {AppModule}=require('../../dist/app.module.js');
const {MEMBERSHIP_STORE}=require('../../dist/ports/auth.js');
const {PgSourceIntegrationStore}=require('../../dist/infra/source-integration/pg-source-integration.store.js');
const {PgSyncCheckpointStore}=require('../../dist/infra/sync/pg-sync-checkpoint.store.js');
const {admitSyncObservation}=require('../../dist/application/durable-sync/admission.js');
const {TestOnlyProviderCredentialStore}=require('../../dist/application/provider-credentials/test-only-credential-store.js');
const {bindSyncCredential}=require('../../dist/application/durable-sync/credential-binding.js');
const db=new PostgresService();await new Migrator(db,loadMigrations()).up();
if((await db.query('SELECT count(*)::int n FROM lead')).rows[0].n!==0)throw new Error('Fresh acceptance database required');
for(const w of ['qa-browser-a','qa-browser-b'])await db.query('INSERT INTO workspace(id,name) VALUES($1,$2)',[w,'Fabricated R4.12 QA']);
const idp=await startIdp(3441,origin);let app;
async function start(){app=await NestFactory.create(AppModule,new FastifyAdapter({forceCloseConnections:true}),{logger:false});app.setGlobalPrefix('v1');await app.listen(3440,'127.0.0.1');}
await start();const members=app.get(MEMBERSHIP_STORE);
for(const account of ['owner','recipient','viewer','bystander','foreign','admin'])await members.grant({workspaceId:account==='foreign'?'qa-browser-b':'qa-browser-a',issuer,subject:account,baseRole:account==='viewer'?'viewer':['admin','foreign'].includes(account)?'admin':account==='bystander'?'manager':'sales'});
const source=new PgSourceIntegrationStore(db),credentials=new TestOnlyProviderCredentialStore('test',true);let fixture=null;
async function seed(){
 if(fixture)return fixture;const streams=[];
 for(const [workspaceId,provider]of [['qa-browser-a','pancake'],['qa-browser-a','meta-page'],['qa-browser-b','pancake']]){
  const ctx={workspaceId,userId:'fabricated-setup-admin',role:'admin',isDemo:false},accountId='fabricated-page-'+randomUUID();
  const c=await source.createConnection(ctx,{provider,route:provider+'-synthetic',pageId:accountId});
  const metadata=await credentials.configure(ctx,{workspaceId,connectionId:c.id,provider,accountId,scopes:['messages.read']},randomBytes(32).toString('hex'));
  const principal=await credentials.issuePrincipal(ctx,metadata.credentialId),store=new PgSyncCheckpointStore(db,admitSyncObservation,bindSyncCredential(credentials,principal));
  const s=await store.createStream(workspaceId,c.id),lease=await store.claimLease(workspaceId,s.id,'browser-setup',30000);
  const observation={schemaVersion:1,provider,route:provider+'-synthetic',accountId,synthetic:true,sourceAuthority:'synthetic_fixture',completeness:'UNKNOWN',verification:'UNVERIFIED',receiptId:randomUUID(),native:{system:provider==='meta-page'?'meta':'pancake',pageId:accountId,conversationId:null,messageId:randomUUID(),eventId:null,revision:null},observedAt:new Date().toISOString(),occurredAt:null,lifecycle:'upsert-observed',displayName:'Fabricated sync health only',rawPayload:{utterance:'Invented health fixture',speaker:'customer',original:{synthetic:true}}};
  await store.commitPage(workspaceId,s.id,lease.token,{pageKey:'fabricated-page-one',expectedVersion:0,expectedCursor:null,nextCursor:'secret-cursor-DO-NOT-EXPOSE',completed:false,observations:[observation]});
  streams.push({workspaceId,provider,streamId:s.id,connectionId:c.id});
 }
 fixture={streams};return fixture;
}
const control=createServer(async(req,res)=>{
 if(req.method!=='POST'||!['/seed-health','/restart'].includes(req.url)||req.headers['x-qa-control']!==process.env.QA_CONTROL_SECRET){res.writeHead(403);return res.end();}
 try{if(req.url==='/seed-health'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(await seed()));}await app.close();await start();res.end('restarted');}catch{res.writeHead(503);res.end('fixture-control-unavailable');}
});
await new Promise(r=>control.listen(3442,'127.0.0.1',r));
async function close(){await app.close();await db.onModuleDestroy();idp.close();control.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
