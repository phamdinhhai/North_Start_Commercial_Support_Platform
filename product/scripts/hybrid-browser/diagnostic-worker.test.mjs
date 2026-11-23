import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticTabMatches} from '../../src/adapters/hybrid-browser-runtime/diagnostics.mjs';

const enrollment={fixture:false,scope:{provider:'meta-ads',accountId:'act_123',target:{campaignId:'campaign-1'}}};
const session={tabId:7,origin:'https://adsmanager.facebook.com',lastContext:{provider:'meta-ads',origin:'https://adsmanager.facebook.com',native:{accountId:'act_123',campaignId:'campaign-1'}}};
test('diagnostic URL revalidates native account and object independently of stale DOM',()=>{
 assert.equal(diagnosticTabMatches('https://adsmanager.facebook.com/manage?act=act_123&selected_campaign_ids=campaign-1',session,enrollment),true);
 assert.equal(diagnosticTabMatches('https://adsmanager.facebook.com/manage?act=act_456&selected_campaign_ids=campaign-1',session,enrollment),false);
 assert.equal(diagnosticTabMatches('https://adsmanager.facebook.com/manage?act=act_123&selected_campaign_ids=campaign-2',session,enrollment),false);
 assert.equal(diagnosticTabMatches('https://adsmanager.facebook.com/manage?act=act_123',session,enrollment),false);
});
test('HubSpot URL account candidate cannot be replaced by a previous DOM account',()=>{
 const e={fixture:false,scope:{provider:'hubspot',accountId:'123',target:{contactId:'contact-1'}}};
 const s={origin:'https://app.hubspot.com',lastContext:{provider:'hubspot',origin:'https://app.hubspot.com',native:{accountId:'123',contactId:'contact-1'}}};
 assert.equal(diagnosticTabMatches('https://app.hubspot.com/contacts/456/record/0-1/contact-1',s,e),false);
});
test('actual worker initialization detaches a saved privileged session before clearing state',async()=>{
 let state={version:1,session:{...session,startedAt:'2026-01-01T00:00:00Z'},diagnostic:{tabId:7,events:[]},outbox:[],gaps:[]};
 const order=[];const event=()=>({addListener(){}});
 globalThis.chrome={
  storage:{local:{setAccessLevel:async()=>{},get:async()=>({northStartHybridV1:state}),set:async value=>{order.push('save');state=value.northStartHybridV1;}}},
  runtime:{id:'fixture-extension',getURL:path=>'chrome-extension://fixture-extension/'+path,onMessage:event(),onStartup:event()},
  debugger:{detach:async target=>{order.push('detach:'+target.tabId);},onEvent:event(),onDetach:event()},
  tabs:{onRemoved:event()},permissions:{onRemoved:event()},
 };
 try{
  await import('../../src/adapters/hybrid-browser-runtime/worker.mjs?restart-test');
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.deepEqual(order,['detach:7','save']);assert.equal(state.diagnostic,null);assert.equal(state.session,null);assert.equal(state.lastStop,'worker-restarted');
 }finally{delete globalThis.chrome;}
});
test('actual worker stops diagnostic events on account switch and permission revocation',async()=>{
 let state={version:1,session:null,diagnostic:null,outbox:[],gaps:[]};
 let onDiagnostic,onPermission;const detached=[];const event=()=>({addListener(){}});
 globalThis.chrome={
  storage:{local:{setAccessLevel:async()=>{},get:async()=>({northStartHybridV1:state}),set:async value=>{state=value.northStartHybridV1;}}},
  runtime:{id:'fixture-extension',getURL:path=>'chrome-extension://fixture-extension/'+path,onMessage:event(),onStartup:event()},
  debugger:{detach:async target=>{detached.push(target.tabId);},onEvent:{addListener:fn=>{onDiagnostic=fn;}},onDetach:event()},
  tabs:{get:async()=>({url:'https://adsmanager.facebook.com/manage?act=act_456&selected_campaign_ids=campaign-1'}),sendMessage:async()=>{},onRemoved:event()},
  permissions:{onRemoved:{addListener:fn=>{onPermission=fn;}}},
 };
 try{
  await import('../../src/adapters/hybrid-browser-runtime/worker.mjs?account-switch-test');
  await new Promise(resolve=>setTimeout(resolve,25));
  const active=()=>({version:1,session:{...session,startedAt:'2026-01-01T00:00:00Z'},enrollment,diagnostic:{tabId:7,events:[]},outbox:[],gaps:[]});
  state=active();onDiagnostic({tabId:7},'Network.responseReceived',{response:{url:'https://graph.example/fixture',status:200}});
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(state.lastStop,'diagnostic-target-changed');assert.equal(state.diagnostic,null);assert.equal(state.session,null);assert.deepEqual(detached,[7]);
  state=active();onPermission({permissions:['debugger']});await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(state.lastStop,'permission-revoked');assert.equal(state.diagnostic,null);assert.deepEqual(detached,[7,7]);
 }finally{delete globalThis.chrome;}
});
