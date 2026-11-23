/** Disposable acceptance for the persistent launcher, never the Owner database. */
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chromium,expect} from '@playwright/test';
import {Client} from 'pg';
import {createServer} from 'node:http';
import {fixturePaths} from './preview-policy.mjs';
import {connection} from '../pilot/safety.mjs';
const product=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const root=await mkdtemp(join(tmpdir(),'preview-acceptance-'));
const env={...process.env,TEMP:root,TMP:root,R415_PRIVATE_ROOT:root};
const cli=command=>JSON.parse(execFileSync(process.execPath,['scripts/hybrid-browser/preview.mjs',command],{cwd:product,env,encoding:'utf8',windowsHide:true,timeout:90000}).trim());
const cliAsync=command=>promisify(execFile)(process.execPath,['scripts/hybrid-browser/preview.mjs',command],{cwd:product,env,encoding:'utf8',windowsHide:true,timeout:90000});
let launched=false,context,db;
const proof={result:'RUNNING',source:execFileSync('git',['rev-parse','HEAD'],{cwd:product,encoding:'utf8'}).trim(),externalProviderCalls:0,mutations:0,steps:[]};
try{
 const started=cli('start');launched=true;assert.equal(started.running,true);assert.equal(cli('status').running,true);
 proof.steps.push('START_AND_IDENTITY_BOUND_STATUS');
 const m=JSON.parse(await readFile(join(root,'hybrid-preview','manifest.json'),'utf8'));
 const pilot=JSON.parse(await readFile(m.pilotManifest,'utf8'));
 db=new Client({connectionString:connection(pilot)});await db.connect();
 assert.equal((await db.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n,23);
 const denied=await fetch(started.fixture+'/__stop',{method:'POST',headers:{'x-preview-control':'not-authorized'}});assert.equal(denied.status,403);assert.equal(cli('status').running,true);
 proof.steps.push('UNAUTHORIZED_STOP_REFUSED');
 context=await chromium.launchPersistentContext(join(root,'browser-profile'),{channel:'chromium',headless:true,args:['--disable-extensions-except='+started.extensionDirectory,'--load-extension='+started.extensionDirectory]});
 context.setDefaultTimeout(15000);await context.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||u.protocol==='chrome-extension:'?route.continue():route.abort();});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const extensionId=new URL(worker.url()).host;
 const popup=await context.newPage();await popup.goto('chrome-extension://'+extensionId+'/hybrid-browser-runtime/popup.html');
 const portal=await context.newPage();await portal.goto(started.console);await expect(portal.locator('#enroll')).toBeDisabled();
 const auth=await context.newPage();await auth.goto(m.appOrigin+'/v1/auth/login');await auth.getByLabel('Account').selectOption('admin');await auth.getByRole('button',{name:'Continue'}).click();await expect(auth.locator('#session-status')).toHaveText('Signed in.');
 await portal.locator('#session').click();await expect(portal.locator('#enroll')).toBeEnabled();proof.steps.push('REAL_OIDC_ADMIN_CONSOLE');
 const state=()=>popup.evaluate(async()=>(await chrome.storage.local.get('northStartHybridV1')).northStartHybridV1);
 const send=message=>popup.evaluate(value=>chrome.runtime.sendMessage(value),message);
 for(const kind of Object.keys(fixturePaths)){
  await portal.locator('#provider').selectOption(kind);await portal.locator('#enroll').click();await expect(portal.locator('#enrollment-status')).toContainText('Scoped enrollment issued');
  const grant=JSON.parse(await portal.locator('#grant').inputValue());
  await popup.locator('#origin').fill(m.appOrigin);await popup.locator('#enrollment').fill(JSON.stringify(grant));await popup.locator('#configure').click();await expect.poll(async()=>(await state()).enrollment?.enrollmentId).toBe(grant.enrollmentId);
  const fixture=await context.newPage();await fixture.goto(started.fixture+fixturePaths[kind]);await fixture.bringToFront();assert.equal((await send({kind:'start'})).ok,true);await expect.poll(async()=>(await state()).outbox.length).toBe(1);
  assert.equal((await send({kind:'upload'})).ok,true);await expect.poll(async()=>(await state()).outbox.length).toBe(0);assert.equal((await state()).delivery,'ready');
  await portal.locator('#health').click();await expect(portal.locator('#receipts')).toContainText('UNVERIFIED');
  await portal.locator('#probe').click();await expect(portal.locator('#probe-result')).toContainText('PASS: stored');
  assert.equal((await send({kind:'stop'})).ok,true);await fixture.close();proof.steps.push(kind.toUpperCase()+'_INSTALLED_MV3_RECEIPT_AND_REPLAY');
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM integration_receipt')).rows[0].n,6);
 assert.equal((await db.query('SELECT count(*)::int n FROM lead')).rows[0].n,0);
 const stored=JSON.stringify((await db.query('SELECT metadata FROM integration_receipt')).rows);
 assert.ok(!stored.includes('access_token'));proof.steps.push('SIX_DURABLE_RECEIPTS_ZERO_COMMERCIAL_LEADS');
 await context.close();context=null;await db.end();db=null;
 // A replaced fixture listener knows the public instance id but cannot prove custody.
 await fetch(started.fixture+'/__stop',{method:'POST',headers:{'x-preview-control':m.control}});
 await expect.poll(async()=>{try{await fetch(started.fixture+'/');return false;}catch{return true;}}).toBe(true);
 const requests=[];const fake=createServer((req,res)=>{requests.push({method:req.method,controlPresent:Boolean(req.headers['x-preview-control'])});res.setHeader('content-type','application/json');res.end(JSON.stringify({instance:m.id,syntheticOnly:true,proof:'0'.repeat(64)}));});
 await new Promise(done=>fake.listen(m.fixturePort,'127.0.0.1',done));
 try{await assert.rejects(cliAsync('stop'));assert.ok(requests.length>0&&requests.every(r=>r.method==='GET'&&!r.controlPresent));}finally{fake.closeAllConnections();await new Promise(done=>fake.close(done));}
 assert.equal(cli('start').running,true);proof.steps.push('REPLACED_LISTENER_REFUSED_WITHOUT_STOP_SECRET');
 const stopped=cli('stop');assert.equal(stopped.historyRetained,true);assert.equal(cli('status').running,false);
 const restarted=cli('start');assert.equal(restarted.running,true);assert.equal(restarted.operator,started.operator);
 db=new Client({connectionString:connection(pilot)});await db.connect();assert.equal((await db.query('SELECT count(*)::int n FROM integration_receipt')).rows[0].n,6);await db.end();db=null;
 proof.steps.push('AUTHENTICATED_STOP_AND_RESTART_RETAIN_HISTORY');
 proof.result='PASS';proof.receipts=6;proof.leads=0;proof.completeness='UNKNOWN';proof.artifactRoot=root;
 await writeFile(join(root,'acceptance.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await context?.close().catch(()=>{});await db?.end().catch(()=>{});if(launched)cli('stop');}
