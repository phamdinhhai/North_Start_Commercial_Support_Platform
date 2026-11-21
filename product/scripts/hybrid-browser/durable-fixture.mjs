/** Disposable subprocess: real Nest/OIDC/PostgreSQL, fabricated identities only. */
import 'reflect-metadata';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter} from '@nestjs/platform-fastify';
import {startIdp} from '../../e2e/oidc/fixture-idp.mjs';

if(process.env.R414_FIXTURE_CHILD!=='true')throw Error('FIXTURE_CHILD_REQUIRED');
const database=new URL(process.env.QA_DATABASE_URL??'invalid:');
if(database.hostname!=='127.0.0.1'||!database.port||!/^\/qa_browser_r414_[a-f0-9]+$/.test(database.pathname))throw Error('ISOLATED_DATABASE_REQUIRED');
const appPort=Number(process.env.R414_APP_PORT),idpPort=Number(process.env.R414_IDP_PORT),controlPort=Number(process.env.R414_CONTROL_PORT);
if(![appPort,idpPort,controlPort].every(p=>Number.isSafeInteger(p)&&p>1024&&p<65536))throw Error('FIXTURE_PORTS_REQUIRED');
const origin=`http://127.0.0.1:${appPort}`,issuer=`http://127.0.0.1:${idpPort}`;
Object.assign(process.env,{DATABASE_URL:database.href,DEPLOYMENT_MODE:'test',NODE_ENV:'test',PILOT_STORE_MODE:'postgres',AUTH_MODE:'oidc',AUTH_DEV_UNSIGNED_TOKENS:'false',DEMO_WORKSPACES:'false',OIDC_BROWSER_ENABLED:'true',OIDC_BROWSER_ORIGIN:origin,OIDC_AUTHORIZATION_ENDPOINT:issuer+'/authorize',OIDC_TOKEN_ENDPOINT:issuer+'/token',OIDC_CLIENT_ID:'qa-browser',OIDC_ISSUER:issuer,OIDC_JWKS_URI:issuer+'/jwks',OIDC_AUDIENCE:'qa-api',AIL_RESEARCH_ENABLED:'true',HYBRID_FIXTURE_ENABLED:'true'});
const require=createRequire(import.meta.url);
const {installContentDigester}=require('../../dist/ports/content-digester-runtime.js');
const {configuredContentDigester}=require('../../dist/infra/crypto/configured-content-digester.js');
installContentDigester(configuredContentDigester(process.env));
const {PostgresService}=require('../../dist/infra/postgres/postgres.service.js');
const {Migrator,loadMigrations}=require('../../dist/infra/postgres/migrator.js');
const {AppModule}=require('../../dist/app.module.js');
const {MEMBERSHIP_STORE}=require('../../dist/ports/auth.js');
const {BROWSER_SESSION}=require('../../dist/ports/browser-session.js');
const db=new PostgresService();await new Migrator(db,loadMigrations()).up();
for(const workspace of ['qa-browser-a','qa-browser-b'])await db.query('INSERT INTO workspace(id,name)VALUES($1,$2) ON CONFLICT(id)DO NOTHING',[workspace,'Fabricated hybrid browser rehearsal']);
const idp=await startIdp(idpPort,origin);
const app=await NestFactory.create(AppModule,new FastifyAdapter({forceCloseConnections:true}),{logger:false});app.setGlobalPrefix('v1');await app.listen(appPort,'127.0.0.1');
const members=app.get(MEMBERSHIP_STORE);
for(const account of ['admin','viewer','foreign'])await members.grant({workspaceId:account==='foreign'?'qa-browser-b':'qa-browser-a',issuer,subject:account,baseRole:account==='viewer'?'viewer':'admin'});
const control=createServer(async(req,res)=>{
 if(req.method!=='POST'||req.headers['x-qa-control']!==process.env.QA_CONTROL_SECRET){res.writeHead(403);return res.end();}
 if(req.url==='/expire-sessions'){for(const [key,value]of app.get(BROWSER_SESSION).sessions)app.get(BROWSER_SESSION).sessions.set(key,{...value,expires:0});return res.end('expired');}
 if(req.url==='/revoke-admin'){await members.revoke({workspaceId:'qa-browser-a',issuer,subject:'admin'});return res.end('revoked');}
 res.writeHead(404);res.end();
});await new Promise(done=>control.listen(controlPort,'127.0.0.1',done));
async function close(){control.closeAllConnections();control.close();await app.close();await db.onModuleDestroy();idp.closeAllConnections();idp.close();process.exit(0);}
process.on('SIGTERM',close);process.on('SIGINT',close);
console.log(JSON.stringify({ready:true,fixtureOnly:true}));
