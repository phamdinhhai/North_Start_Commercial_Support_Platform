import { resolveSiteContext, minimizeDOM } from './platform-registry.mjs';
import { validateEnrollment, matchesEnrollment } from './permission-policy.mjs';
import { initialState, configure, appendContext, reserve, acknowledge, stop, recover, health } from './outbox.mjs';
import { inspectGraphQL, inspectNetwork, inspectRealtime } from './diagnostics.mjs';
const KEY='northStartHybridV1';
const load=async()=> (await chrome.storage.local.get(KEY))[KEY] ?? initialState();
const save=state=>chrome.storage.local.set({[KEY]:state});
let tasks=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
function enqueue(task){const result=tasks.then(task);tasks=result.catch(()=>{});return result;}
async function stopCapture(reason){const s=await load();if(s.session?.tabId)await chrome.tabs.sendMessage(s.session.tabId,{kind:'stop-observer'}).catch(()=>{});if(s.diagnostic)await chrome.debugger.detach({tabId:s.diagnostic.tabId}).catch(()=>{});await save({...stop(s,reason),diagnostic:null});}
async function startCapture(){
 const s=await load();if(!s.enrollment?.token)throw Error('ENROLLMENT_REQUIRED');
 if(Date.parse(s.enrollment.expiresAt)<=Date.now())throw Error('ENROLLMENT_EXPIRED');
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error('UNSUPPORTED_SITE');
 const c=resolveSiteContext(tab.url,{},s.enrollment.fixture);if(!c||c.provider!==s.enrollment.scope.provider)throw Error('UNSUPPORTED_SITE');
 await stopCapture('new-capture');
 await save({...await load(),session:{tabId:tab.id,origin:c.origin,startedAt:new Date().toISOString()},lastStop:null});
 try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['hybrid-browser-runtime/dom-observer.js']});}catch{await stopCapture('injection-denied');throw Error('SITE_PERMISSION_REQUIRED');}
}
async function readAck(response){
 const reader=response.body?.getReader();if(!reader)return null;let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return null;}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return null;}finally{reader.releaseLock();}
}
async function upload(){
 let s=reserve(await load());await save(s);if(!s.pending)return;
 if(!await chrome.permissions.contains({origins:[s.enrollment.origin+'/*']}))throw Error('BACKEND_PERMISSION_REQUIRED');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetch(s.enrollment.origin+'/v1/hybrid/observations',{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{authorization:'Bearer '+s.enrollment.token,'content-type':'application/json'},body:JSON.stringify(s.pending)});s=acknowledge(s,response.status,await readAck(response));}
 catch{s={...s,delivery:'retry-required'};}finally{clearTimeout(timer);}await save(s);
 if(['blocked','unauthorized','expired'].includes(s.delivery))await stopCapture(s.delivery);
}
async function startDiagnostic(){
 const s=await load();if(!s.session)throw Error('CAPTURE_REQUIRED');
 if(!await chrome.permissions.contains({permissions:['debugger']}))throw Error('DIAGNOSTIC_PERMISSION_REQUIRED');
 const tab=await chrome.tabs.get(s.session.tabId);if(new URL(tab.url).origin!==s.session.origin)throw Error('TARGET_SCOPE_MISMATCH');
 await chrome.debugger.attach({tabId:s.session.tabId},'1.3');
 try{await chrome.debugger.sendCommand({tabId:s.session.tabId},'Network.enable');await save({...s,diagnostic:{tabId:s.session.tabId,events:[],startedAt:new Date().toISOString()}});}catch{await chrome.debugger.detach({tabId:s.session.tabId});throw Error('DIAGNOSTIC_UNAVAILABLE');}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 const popup=sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL('hybrid-browser-runtime/popup.html');
 if(message?.kind==='context-observed'){
  if(sender.id!==chrome.runtime.id||!sender.tab)return false;
  enqueue(async()=>{const s=await load();if(s.session?.tabId!==sender.tab.id)return;
   const senderContext=resolveSiteContext(sender.url,{},s.enrollment?.fixture),context=resolveSiteContext(message.url,minimizeDOM(message.dom),s.enrollment?.fixture);
   if(!senderContext||!context||context.origin!==s.session.origin||senderContext.origin!==context.origin||!matchesEnrollment(context,s.enrollment))return stopCapture('target-changed');
   await save(appendContext(s,context));
  }).then(()=>respond({ok:true}),()=>respond({ok:false,code:'OBSERVATION_REFUSED'}));return true;
 }
 if(!popup)return false;
 enqueue(async()=>{
  if(message?.kind==='configure'){const fixture=Boolean(message.fixture)&&chrome.runtime.getManifest().optional_host_permissions?.includes('http://127.0.0.1/*');const e=validateEnrollment(message,fixture);if(!await chrome.permissions.contains({origins:[e.origin+'/*']}))throw Error('BACKEND_PERMISSION_REQUIRED');await save(configure(await load(),e));}
  else if(message?.kind==='start')await startCapture();
  else if(message?.kind==='stop')await stopCapture('user-stopped');
  else if(message?.kind==='upload')await upload();
  else if(message?.kind==='diagnostic')await startDiagnostic();
  else if(message?.kind==='disconnect'){await stopCapture('disconnected');const s=await load();await save({...s,enrollment:s.enrollment?{...s.enrollment,token:null}:null,delivery:'disconnected'});}
  else if(message?.kind!=='status')throw Error('UNSUPPORTED_COMMAND');
  return health(await load());
 }).then(result=>respond({ok:true,result}),()=>respond({ok:false,code:'ACTION_REFUSED'}));return true;
});
chrome.debugger.onEvent.addListener((source,method,params)=>{enqueue(async()=>{
 const s=await load();if(s.diagnostic?.tabId!==source.tabId)return;
 const tab=await chrome.tabs.get(source.tabId);if(new URL(tab.url).origin!==s.session?.origin)return stopCapture('diagnostic-origin-changed');
 const observation=method==='Network.responseReceived'?inspectNetwork(params.response?.url,params.response?.status):method==='Network.requestWillBeSent'?inspectGraphQL(params.request?.postData):method==='Network.webSocketFrameReceived'?inspectRealtime(params.response?.payloadData):null;
 if(observation)await save({...s,diagnostic:{...s.diagnostic,events:[...s.diagnostic.events,observation].slice(-50)}});
}).catch(()=>stopCapture('diagnostic-failed'));});
chrome.debugger.onDetach.addListener(source=>{enqueue(async()=>{const s=await load();if(s.diagnostic?.tabId===source.tabId)await save({...s,diagnostic:null});}).catch(()=>{});});
chrome.tabs.onRemoved.addListener(tabId=>{enqueue(async()=>{if((await load()).session?.tabId===tabId)await stopCapture('tab-closed');}).catch(()=>{});});
chrome.permissions.onRemoved.addListener(()=>{enqueue(()=>stopCapture('permission-revoked')).catch(()=>{});});
chrome.runtime.onStartup.addListener(()=>{enqueue(()=>stopCapture('browser-restarted')).catch(()=>{});});
enqueue(async()=>{const s=await load();await save({...recover(s),diagnostic:null});}).catch(()=>{});
