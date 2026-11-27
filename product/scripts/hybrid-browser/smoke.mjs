import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {packageHybrid} from './package.mjs';

const root=await mkdtemp(join(tmpdir(),'north-r414-hybrid-'));
const extension=join(root,'extension');
await packageHybrid(extension,true);
let received=[];
const backend=createServer(async(req,res)=>{
  if(req.method==='POST'&&req.url==='/v1/hybrid/observations'){
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192){res.writeHead(413);return res.end();}}
    try{const body=JSON.parse(raw);received.push(body);res.writeHead(201,{'content-type':'application/json'});return res.end(JSON.stringify({enrollmentId:body.enrollmentId,captureId:body.captureId,sequence:body.sequence,receiptId:'fixture-receipt-1',disposition:'stored',checkpoint:body.sequence,completeness:'UNKNOWN'}));}catch{res.writeHead(400);return res.end();}
  }res.writeHead(404);res.end();
});
await new Promise(done=>backend.listen(0,'127.0.0.1',done));
const backendPort=backend.address().port;
const site=createServer((req,res)=>{if(req.url.startsWith('/pancake/')){res.writeHead(200,{'content-type':'text/html'});return res.end('<!doctype html><div data-ns-context data-account-id="fixture-account" data-page-id="fixture-page"></div>');}res.writeHead(404);res.end();});
await new Promise(done=>site.listen(0,'127.0.0.1',done));const sitePort=site.address().port;
const profile=join(root,'profile');
const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
context.setDefaultTimeout(10000);
try{
  console.log('checkpoint: browser-started');
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');worker.on('console',m=>console.log('worker-console',m.text()));worker.on('pageerror',e=>console.log('worker-error',e.message));const extensionId=new URL(worker.url()).host;console.log('worker-url',worker.url());
  const browserErrors=[];const popupErrors=[];context.on('console',msg=>browserErrors.push(msg.text()));
  console.log('checkpoint: worker-started');
  const provider=await context.newPage();await provider.goto(`http://127.0.0.1:${sitePort}/pancake/fixture-page?c_id=fixture-conversation`);
  const popup=await context.newPage();const popupUrl=`chrome-extension://${extensionId}/hybrid-browser-runtime/popup.html`;await popup.goto(popupUrl);console.log('popup-url',popup.url(),await popup.title());
  popup.on('pageerror',e=>popupErrors.push(e.message));
  await popup.locator('#origin').fill(`http://127.0.0.1:${backendPort}`);
  await popup.locator('#enrollment').fill(JSON.stringify({enrollmentId:'00000000-0000-4000-8000-000000000001',token:'t'.repeat(64),expiresAt:'2099-01-01T00:00:00Z',scope:{workspaceId:'fixture-workspace',connectionId:'fixture-connection',provider:'pancake',accountId:'fixture-account',target:{pageId:'fixture-page',conversationId:'fixture-conversation'}},fixture:true}));
  console.log('popup-script',await popup.locator('body').textContent());await popup.locator('#configure').click();await popup.waitForTimeout(500);console.log('configure-health',await popup.locator('#health').textContent(),JSON.stringify({popupErrors,browserErrors}));
  console.log('checkpoint: configured');
  console.log('configuration-view',await popup.locator('#health').textContent(),await worker.evaluate(()=>({diagnostic:globalThis.__hybridDiagnostic,debugger:typeof chrome.debugger,storage:typeof chrome.storage.local.get})));
  await provider.bringToFront();const startResult=await popup.evaluate(()=>Promise.race([chrome.runtime.sendMessage({kind:'start'}),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),8000))]));console.log('start-result',JSON.stringify(startResult));if(startResult?.timeout){console.log('state-view',await worker.evaluate(async()=>{const s=(await chrome.storage.local.get('northStartHybridV1')).northStartHybridV1;return s?{enrolled:!!s.enrollment,delivery:s.delivery,session:s.session?{tabId:s.session.tabId}:null,pending:s.outbox.length}:null;}));throw new Error('HYBRID_BROWSER_START_TIMEOUT');}
  console.log('checkpoint: capture-started');
  await provider.waitForTimeout(400);await popup.bringToFront();await popup.locator('#upload').click();
  for(let i=0;i<30&&received.length===0;i++)await new Promise(done=>setTimeout(done,100));
  if(received.length!==1)throw new Error('HYBRID_BROWSER_RECEIPT_MISSING');
  const body=received[0];if(body.observation?.native?.conversationId!=='fixture-conversation'||body.observation?.native?.pageId!=='fixture-page'||body.observation?.authenticity!=='CLIENT_OBSERVED')throw new Error('HYBRID_BROWSER_SCOPE_MISMATCH');
  if(JSON.stringify(body).includes('data-ns-context'))throw new Error('HYBRID_BROWSER_RAW_DOM_LEAK');
  console.log(JSON.stringify({result:'PASS',provider:'pancake',observationReceived:1,receipt:'stored',browserRestart:'not-run-in-this-smoke',providerMutations:0,customerData:false}));
}finally{await context.close();backend.closeAllConnections();backend.close();site.closeAllConnections();site.close();await rm(root,{recursive:true,force:true});}
