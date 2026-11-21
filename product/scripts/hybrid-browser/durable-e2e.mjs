/** Combined installable MV3 -> real OIDC/Nest -> PostgreSQL receipt rehearsal; no provider calls. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {Client} from 'pg';
import {chromium} from '@playwright/test';
import {packageHybrid} from './package.mjs';
import {validateRootDatabase,fixtureDatabaseName} from './durable-e2e-policy.mjs';

const product=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const rootUrl=validateRootDatabase(process.env.TEST_DATABASE_URL,process.env.DATABASE_URL);
const database=fixtureDatabaseName('qa_browser_r414_'+randomBytes(5).toString('hex'));
const privateRoot=process.env.R414_TEMP_ROOT??tmpdir();await mkdir(privateRoot,{recursive:true});
const root=await mkdtemp(join(privateRoot,'north-r414-durable-'));
const adminUrl=new URL(rootUrl);adminUrl.pathname='/postgres';const databaseUrl=new URL(rootUrl);databaseUrl.pathname='/'+database;
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function port(){const server=createServer();await new Promise(done=>server.listen(0,'127.0.0.1',done));const p=server.address().port;await new Promise(done=>server.close(done));return p;}
const [appPort,idpPort,controlPort]=await Promise.all([port(),port(),port()]);
const appOrigin=`http://127.0.0.1:${appPort}`,controlOrigin=`http://127.0.0.1:${controlPort}`;
const workspace='qa-browser-a',controlSecret=randomBytes(32).toString('hex');
const scopes=[
 {workspaceId:workspace,connectionId:'fixture-connection-pancake',accountId:'fixture-account-pancake',providerSurface:'pancake-conversations',pageId:'fixture-page-pancake',target:{pageId:'fixture-page-pancake',conversationId:'fixture-conversation-pancake'}},
 {workspaceId:workspace,connectionId:'fixture-connection-ads',accountId:'fixture-account-ads',providerSurface:'meta-ads',pageId:'fixture-page-ads',target:{campaignId:'fixture-campaign-ads'}},
 {workspaceId:workspace,connectionId:'fixture-connection-crm',accountId:'fixture-account-crm',providerSurface:'hubspot-crm',pageId:'fixture-page-crm',target:{contactId:'fixture-contact-crm'}},
];
const childEnv={...process.env,R414_FIXTURE_CHILD:'true',QA_DATABASE_URL:databaseUrl.href,QA_CONTROL_SECRET:controlSecret,R414_APP_PORT:String(appPort),R414_IDP_PORT:String(idpPort),R414_CONTROL_PORT:String(controlPort),AIL_SIGNING_SECRET:randomBytes(32).toString('hex'),AIL_SCOPE_ALLOWLIST:JSON.stringify(scopes),CONTENT_DIGEST_KEYS_JSON:JSON.stringify(['qa-browser-a','qa-browser-b'].map(workspaceId=>({workspaceId,activeKid:'fixture',keys:[{kid:'fixture',secretBase64:randomBytes(32).toString('base64')}]})))};
let child,context,db,site,proxy;const privateLog=join(root,'fixture-app.log');
const proof={result:'RUNNING',providerContacted:false,providerMutations:0,customerData:false,steps:[]};
const step=name=>proof.steps.push(name);
async function wait(check,label){for(let n=0;n<100;n++){try{const value=await check();if(value)return value;}catch{}await delay(100);}throw Error('TIMEOUT_'+label);}
async function startBackend(){const log=openSync(privateLog,'a');child=spawn(process.execPath,['scripts/hybrid-browser/durable-fixture.mjs'],{cwd:product,env:childEnv,stdio:['ignore',log,log],windowsHide:true});closeSync(log);await wait(async()=>{if(child.exitCode!==null)throw Error('FIXTURE_CHILD_EXIT');try{return (await fetch(appOrigin+'/v1/auth/session')).status===200;}catch{return false;}},'BACKEND_READY');}
async function stopBackend(signal='SIGTERM'){if(!child||child.exitCode!==null)return;const exited=new Promise(done=>child.once('exit',done));child.kill(signal);await Promise.race([exited,delay(5000)]);}
async function closeServer(server){if(!server)return;server.closeAllConnections();await new Promise(done=>server.close(done));}
const admin=new Client({connectionString:adminUrl.href});await admin.connect();await admin.query('CREATE DATABASE '+database);await admin.end();
let dropAck=false,partialAck=false;const proxyRequests=[];
try{
 await startBackend();db=new Client({connectionString:databaseUrl.href});await db.connect();step('REAL_NEST_POSTGRES_READY');
 proxy=createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/v1/hybrid/observations'){res.writeHead(404);return res.end();}
  let raw='';for await(const bytes of req){raw+=bytes;if(Buffer.byteLength(raw)>8192){res.writeHead(413);return res.end();}}
  const parsed=JSON.parse(raw);proxyRequests.push({captureId:parsed.captureId,sequence:parsed.sequence,raw});
  try{const upstream=await fetch(appOrigin+req.url,{method:'POST',headers:{authorization:req.headers.authorization,'content-type':'application/json'},body:raw});const body=await upstream.text();
   if(dropAck){dropAck=false;res.destroy();return;}res.writeHead(upstream.status,{'content-type':'application/json'});if(partialAck){partialAck=false;res.end('{"receiptId":');return;}res.end(body);
  }catch{res.writeHead(503);res.end('{"code":"FIXTURE_BACKEND_UNAVAILABLE"}');}
 });await new Promise(done=>proxy.listen(0,'127.0.0.1',done));const uploadOrigin=`http://127.0.0.1:${proxy.address().port}`;
 site=createServer((req,res)=>{const path=new URL(req.url,'http://127.0.0.1').pathname;const kind=path.split('/')[1];const account=({pancake:'pancake',ads:'ads',crm:'crm'})[kind];if(!account){res.writeHead(404);return res.end();}const pageAttr=kind==='pancake'?' data-page-id="fixture-page-pancake"':'';res.writeHead(200,{'content-type':'text/html'});res.end(`<!doctype html><title>Fabricated ${account}</title><div data-ns-context data-account-id="fixture-account-${account}"${pageAttr}></div><p>Fabricated private text must not enter receipt</p>`);});await new Promise(done=>site.listen(0,'127.0.0.1',done));const siteOrigin=`http://127.0.0.1:${site.address().port}`;
 const extension=join(root,'extension');const packaged=await packageHybrid(extension,true);proof.packageSha256=packaged.zipSha256;
 const profile=join(root,'profile');const browserOptions={channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]};
 async function launch(){context=await chromium.launchPersistentContext(profile,browserOptions);context.setDefaultTimeout(15000);await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||u.protocol==='chrome-extension:'?route.continue():route.abort();});const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');return new URL(worker.url()).host;}
 let extensionId=await launch(),popup=await context.newPage();const popupURL=()=>`chrome-extension://${extensionId}/hybrid-browser-runtime/popup.html`;await popup.goto(popupURL());
 let auth=await context.newPage();
 async function login(account='admin'){await auth.goto(appOrigin+'/v1/auth/login');await auth.waitForURL(new RegExp(idpPort+'/authorize'));await auth.getByLabel('Account').selectOption(account);await auth.getByRole('button',{name:'Continue'}).click();await auth.waitForURL(new RegExp(appPort+'/v1/operator$'));}
 async function api(path,body){return auth.evaluate(async({path,body})=>{const session=await (await fetch('/v1/auth/session')).json();const response=await fetch(path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'content-type':'application/json','x-csrf-token':session.csrfToken},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:response.status,body:await response.json()};},{path,body});}
 await login();step('REAL_OIDC_ADMIN_LOGIN');
 const grants=[];for(const s of scopes){const response=await api('/v1/integration/enrollments',{connectionId:s.connectionId});assert.equal(response.status,201,'server-side admin enrollment must succeed');grants.push({...response.body,scope:{...response.body.scope,provider:({'pancake-conversations':'pancake','meta-ads':'meta-ads','hubspot-crm':'hubspot'})[s.providerSurface]}});}
 step('THREE_SERVER_BOUND_ENROLLMENTS');
 const send=message=>popup.evaluate(value=>chrome.runtime.sendMessage(value),message);
 const state=()=>popup.evaluate(async()=>(await chrome.storage.local.get('northStartHybridV1')).northStartHybridV1);
 async function configureGrant(grant){await popup.bringToFront();await popup.locator('#origin').fill(uploadOrigin);await popup.locator('#enrollment').fill(JSON.stringify(grant));await popup.locator('#configure').click();await wait(async()=>(await state()).enrollment?.enrollmentId===grant.enrollmentId,'ENROLLMENT_CONFIGURED');}
 async function capture(provider){await provider.bringToFront();const result=await send({kind:'start'});assert.equal(result.ok,true,'MV3 start failed');await wait(async()=>(await state()).outbox.length>0,'BROWSER_OBSERVATION');}
 async function upload(expected='ready'){await popup.bringToFront();const result=await send({kind:'upload'});assert.equal(result.ok,true,'MV3 upload command failed');try{await wait(async()=>(await state()).delivery===expected,'UPLOAD_'+expected);}catch(error){const s=await state();throw new Error(`${error.message} delivery=${s.delivery} pending=${s.outbox.length} stop=${s.lastStop} requests=${proxyRequests.length}`);}}
 const paths=['/pancake/fixture-page-pancake?c_id=fixture-conversation-pancake','/ads/manage?act=fixture-account-ads&selected_campaign_ids=fixture-campaign-ads','/crm/contacts/fixture-account-crm/record/0-1/fixture-contact-crm'];
 const receiptCount=async()=>Number((await db.query('SELECT count(*)::int n FROM integration_receipt')).rows[0].n);
 for(let i=0;i<3;i++){await configureGrant(grants[i]);const page=await context.newPage();await page.goto(siteOrigin+paths[i]);await capture(page);await upload();assert.equal((await state()).outbox.length,0);assert.equal(await receiptCount(),i+1);await page.close();}
 step('THREE_REAL_MV3_TO_POSTGRES_RECEIPTS');
 let health=await api('/v1/integration/health');assert.equal(health.status,200);assert.equal(health.body.completeness,'UNKNOWN');assert.equal(health.body.enrollments.length,3);assert.equal(health.body.enrollments.reduce((n,e)=>n+e.delivery.receiptCount,0),3);step('AUTHORIZED_DATA_HEALTH_READBACK');
 assert.equal(Number((await db.query('SELECT count(*)::int n FROM lead')).rows[0].n),0);const metadata=JSON.stringify((await db.query('SELECT metadata FROM integration_receipt')).rows);assert.ok(!metadata.includes('Fabricated private text'));step('NO_BODY_OR_COMMERCIAL_PROJECTION');
 async function freshGrant(){const response=await api('/v1/integration/enrollments',{connectionId:scopes[0].connectionId});assert.equal(response.status,201);return {...response.body,scope:{...response.body.scope,provider:'pancake'}};}
 async function pancakePage(){const page=await context.newPage();await page.goto(siteOrigin+paths[0]);return page;}
 // A loopback proxy loses the ACK only after the actual PostgreSQL transaction committed.
 let grant=await freshGrant();await configureGrant(grant);let provider=await pancakePage();await capture(provider);const beforeLost=await receiptCount();partialAck=true;await upload('retry-required');assert.equal(await receiptCount(),beforeLost+1);const pending=structuredClone((await state()).pending),lostRequest=proxyRequests.at(-1).raw;
 const cdp=await context.newCDPSession(provider);const target=(await cdp.send('Target.getTargets')).targetInfos.find(t=>t.type==='service_worker'&&t.url.startsWith('chrome-extension://'+extensionId));assert.ok(target);await cdp.send('Target.closeTarget',{targetId:target.targetId});await delay(200);await send({kind:'status'});await wait(async()=>(await state()).lastStop==='worker-restarted','WORKER_RESTARTED');assert.deepEqual((await state()).pending,pending);await upload();assert.deepEqual(JSON.parse(proxyRequests.at(-1).raw),JSON.parse(lostRequest));assert.equal(await receiptCount(),beforeLost+1);step('LOST_ACK_WORKER_RESTART_IDENTICAL_REPLAY');await provider.close();
 // A truncated ACK is untrusted even when its real intake transaction committed.
 grant=await freshGrant();await configureGrant(grant);provider=await pancakePage();await capture(provider);partialAck=true;const beforePartial=await receiptCount();await upload('retry-required');const partialPending=structuredClone((await state()).pending);assert.equal(await receiptCount(),beforePartial+1);await context.close();extensionId=await launch();popup=await context.newPage();await popup.goto(popupURL());await send({kind:'status'});assert.deepEqual((await state()).pending,partialPending);assert.equal((await state()).session,null);await upload();assert.equal(await receiptCount(),beforePartial+1);step('PARTIAL_ACK_BROWSER_RESTART_PERSISTENCE');
 auth=await context.newPage();await login();
 // Kill the actual application process. The queued upload fails locally and remains identical.
 grant=await freshGrant();await configureGrant(grant);provider=await pancakePage();await capture(provider);const beforeCrash=await receiptCount();await stopBackend('SIGKILL');await upload('retry-required');const crashPending=structuredClone((await state()).pending);await startBackend();await upload();assert.equal(await receiptCount(),beforeCrash+1);assert.equal(proxyRequests.at(-1).captureId,crashPending.captureId);step('ACTUAL_BACKEND_PROCESS_CRASH_RESTART_RECEIPT');
 auth=await context.newPage();await login();
 // Existing enrollment capability authorizes only its exact scope and immutable request.
 const valid=JSON.parse(proxyRequests.at(-1).raw);const sendRaw=body=>fetch(appOrigin+'/v1/hybrid/observations',{method:'POST',headers:{authorization:'Bearer '+grant.token,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await sendRaw(valid)).status,201);assert.equal(await receiptCount(),beforeCrash+1);
 const conflict=structuredClone(valid);conflict.observation.observedAt='2026-11-22T00:00:00.000Z';assert.equal((await sendRaw(conflict)).status,409);
 const foreign=structuredClone(valid);foreign.observation.scope.workspaceId='qa-browser-b';assert.equal((await sendRaw(foreign)).status,403);
 const changed=structuredClone(valid);changed.observation.native.conversationId='fixture-foreign-conversation';assert.equal((await sendRaw(changed)).status,403);step('DUPLICATE_CONFLICT_FOREIGN_WORKSPACE_NATIVE_OBJECT_DENIAL');
 // Account changes and DOM shape drift stop the active observation without opening new authority.
 await provider.evaluate(()=>document.querySelector('[data-ns-context]').dataset.accountId='fixture-foreign-account');await wait(async()=>(await state()).lastStop==='target-changed','ACCOUNT_SWITCH_STOP');assert.equal((await state()).outbox.length,0);step('ACCOUNT_SWITCH_FAIL_CLOSED');
 await provider.evaluate(()=>document.querySelector('[data-ns-context]').dataset.accountId='fixture-account-pancake');await capture(provider);await upload();await provider.evaluate(()=>document.querySelector('[data-ns-context]').removeAttribute('data-account-id'));await wait(async()=>(await state()).lastStop==='target-changed','SCHEMA_DRIFT_STOP');step('MISSING_IDENTITY_DOM_SCHEMA_FAIL_CLOSED');
 // Expired browser login cannot issue a new enrollment. Existing capabilities are independent.
 await fetch(controlOrigin+'/expire-sessions',{method:'POST',headers:{'x-qa-control':controlSecret}});assert.equal((await api('/v1/integration/enrollments',{connectionId:scopes[0].connectionId})).status,401);step('EXPIRED_OIDC_SESSION_ENROLLMENT_DENIED');
 await login('foreign');const foreignHealth=await api('/v1/integration/health');assert.equal(foreignHealth.status,200);assert.equal(foreignHealth.body.workspaceId,'qa-browser-b');assert.equal(foreignHealth.body.enrollments.length,0);assert.equal((await api('/v1/integration/enrollments',{connectionId:scopes[0].connectionId})).status,403);step('FOREIGN_OIDC_PRINCIPAL_SCOPE_DENIAL');
 await login();grant=await freshGrant();await configureGrant(grant);await provider.evaluate(()=>document.querySelector('[data-ns-context]').dataset.accountId='fixture-account-pancake');await capture(provider);await fetch(controlOrigin+'/revoke-admin',{method:'POST',headers:{'x-qa-control':controlSecret}});await upload('unauthorized');assert.equal((await state()).enrollment.token,null);assert.equal((await state()).outbox.length,1);step('MEMBERSHIP_REVOCATION_DURING_BROWSER_DELIVERY');
 proof.result='PASS';proof.providers=['pancake','meta-ads','hubspot'];proof.receipts=await receiptCount();proof.uniqueCommercialLeads=0;proof.completeness='UNKNOWN';proof.sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:product,encoding:'utf8'}).trim();proof.historyIncident='SEND_UNRESOLVED';
 await writeFile(join(root,'verification.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{
 await context?.close().catch(()=>{});await closeServer(proxy).catch(()=>{});await closeServer(site).catch(()=>{});await stopBackend();await db?.end().catch(()=>{});
 const cleanup=new Client({connectionString:adminUrl.href});try{await cleanup.connect();await cleanup.query('DROP DATABASE IF EXISTS '+fixtureDatabaseName(database)+' WITH (FORCE)');}finally{await cleanup.end();}
}
