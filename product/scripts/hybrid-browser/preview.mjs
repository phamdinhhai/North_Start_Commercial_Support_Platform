/** Owned persistent fixture resources. No provider traffic; no PID-based stop. */
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync,openSync,closeSync} from 'node:fs';
import {tmpdir,userInfo} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {cleanEnvironment,validateManifest} from '../pilot/safety.mjs';
import {packageHybrid} from './package.mjs';
import {fixturePaths,fixtureHtml,localOrigin,validatePreview,previewProof,verifyPreviewProof,assertPrivatePath,assertExtensionTree} from './preview-policy.mjs';

const product=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const root=resolve(process.env.R415_PRIVATE_ROOT??tmpdir());
process.env.TEMP=root;process.env.TMP=root;
const home=join(root,'hybrid-preview'),file=join(home,'manifest.json');
const env=()=>({...cleanEnvironment(),R415_PRIVATE_ROOT:root});
const delay=ms=>new Promise(done=>setTimeout(done,ms));
async function freePort(){const s=createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r);});const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function save(m){await writeFile(file,JSON.stringify(m,null,2)+'\n',{mode:0o600});}
export async function probe(url,timeout=1000){try{return await fetch(url,{signal:AbortSignal.timeout(timeout),redirect:'error'});}catch(error){if(error.cause?.code==='ECONNREFUSED')return null;throw Error('PREVIEW_LISTENER_UNCERTAIN');}}
async function statusOf(m){const challenge=randomBytes(32).toString('hex');const r=await probe(m.fixtureOrigin+'/__status?challenge='+challenge);if(!r)return null;if(!r.ok)throw Error('PREVIEW_PORT_UNIDENTIFIED');const value=await r.json();if(value.instance!==m.id||value.syntheticOnly!==true||!verifyPreviewProof(value.proof,previewProof(m.control,'fixture',m.id,challenge)))throw Error('PREVIEW_INSTANCE_MISMATCH');return value;}
async function waitStopped(m){for(let i=0;i<50;i++){try{if(!await statusOf(m))return;}catch(error){if(error.message!=='PREVIEW_LISTENER_UNCERTAIN')throw error;}await delay(100);}throw Error('PREVIEW_STOP_TIMEOUT');}
async function appReady(m){const p=validateManifest(m.pilotManifest),challenge=randomBytes(32).toString('hex');const identity=await probe(m.appOrigin+'/v1/hybrid-preview/status?challenge='+challenge);if(!identity)return false;if(!identity.ok)throw Error('PREVIEW_APP_UNIDENTIFIED');const own=await identity.json();if(own.id!==m.id||own.syntheticOnly!==true||!verifyPreviewProof(own.proof,previewProof(p.hybridPreview.signingSecret,'app',m.id,challenge)))throw Error('PREVIEW_APP_MISMATCH');const r=await probe(m.appOrigin+'/v1/health/readiness');return r?.status===200;}
function pilot(command,manifest){const args=['scripts/pilot/local.mjs',command,...(manifest?[manifest]:[])];const run=spawnSync(process.execPath,args,{cwd:product,env:env(),windowsHide:true,encoding:'utf8',timeout:60000});if(run.status!==0)throw Error('OWNED_PILOT_'+command.toUpperCase()+'_FAILED');return run.stdout;}
function ensurePrivateDirectory(){assertPrivatePath(root);assertPrivatePath(home);}
async function initialize(){
 ensurePrivateDirectory();await mkdir(root,{recursive:true});await mkdir(home,{mode:0o700});
 if(process.platform==='win32'){const acl=spawnSync('icacls.exe',[home,'/inheritance:r','/grant:r',userInfo().username+':(OI)(CI)F'],{stdio:'ignore',windowsHide:true});if(acl.status!==0)throw Error('PREVIEW_ACL_FAILED');}
 const log=pilot('init',undefined);const match=log.match(/Manifest:\s*(.+manifest\.json)/);if(!match)throw Error('OWNED_PILOT_MANIFEST_MISSING');
 const p=validateManifest(match[1].trim());pilot('stop',p.file);
 const fixturePort=await freePort();p.hybridPreview={fixturePort,signingSecret:randomBytes(32).toString('hex')};
 await writeFile(p.file,JSON.stringify(p,null,2)+'\n',{mode:0o600});
 const m={kind:'NORTH_START_HYBRID_PREVIEW_V2',id:p.id,pilotManifest:p.file,fixturePort,fixtureOrigin:localOrigin(fixturePort),appOrigin:localOrigin(p.appPort),control:randomBytes(32).toString('hex'),extensionDirectory:join(home,'extension'),state:'stopped'};
 await save(m);return validatePreview(file,root);
}
export async function serve(m){
 let stopping=false;
 const server=createServer((req,res)=>{
  res.setHeader('cache-control','no-store');const url=new URL(req.url,'http://127.0.0.1');
  if(req.method==='GET'&&url.pathname==='/__status'){const challenge=url.searchParams.get('challenge');if(!/^[a-f0-9]{64}$/.test(challenge??'')){res.writeHead(400);return res.end();}res.setHeader('content-type','application/json');return res.end(JSON.stringify({instance:m.id,syntheticOnly:true,proof:previewProof(m.control,'fixture',m.id,challenge)}));}
  if(req.method==='POST'&&url.pathname==='/__stop'){
   const supplied=req.headers['x-preview-control'];if(typeof supplied!=='string'||Buffer.byteLength(supplied)!==Buffer.byteLength(m.control)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(m.control))){res.writeHead(403);return res.end();}
   res.end('stopping');if(!stopping){stopping=true;setTimeout(()=>{server.closeAllConnections();server.close();},100);}return;
  }
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  const kind=Object.entries(fixturePaths).find(([,path])=>new URL(path,m.fixtureOrigin).pathname===url.pathname)?.[0];
  if(url.pathname==='/'){res.setHeader('content-type','text/html; charset=utf-8');return res.end('<!doctype html><title>North Start fixture preview</title><h1>Fabricated integration fixtures</h1><p>Only invented data. No provider connection.</p><a href="'+m.appOrigin+'/v1/hybrid-preview">Open enrollment and receipt console</a><ul>'+Object.entries(fixturePaths).map(([k,p])=>'<li><a href="'+p+'">'+k+'</a></li>').join('')+'</ul>');}
  if(!kind){res.writeHead(404);return res.end('Unknown fixture');}
  res.setHeader('content-type','text/html; charset=utf-8');res.end(fixtureHtml(kind,m.appOrigin));
 });
 await new Promise((r,j)=>{server.once('error',j);server.listen(m.fixturePort,'127.0.0.1',r);});
 process.on('SIGTERM',()=>{server.closeAllConnections();server.close();});
}
export async function start(){
 ensurePrivateDirectory();const m=existsSync(file)?validatePreview(file,root):await initialize();
 if(!await appReady(m))pilot('start',m.pilotManifest);
 assertExtensionTree(m.extensionDirectory,home);await packageHybrid(m.extensionDirectory,true);
 if(!await statusOf(m)){
  const fd=openSync(join(home,'server.log'),'a');
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--serve'],{cwd:product,env:env(),stdio:['ignore',fd,fd],detached:true,windowsHide:true});closeSync(fd);child.unref();
  let ready=false;for(let i=0;i<50;i++){if(await statusOf(m)){ready=true;break;}await delay(100);}if(!ready)throw Error('PREVIEW_FIXTURE_NOT_READY');
 }
 if(!await appReady(m))throw Error('PREVIEW_APP_NOT_READY');m.state='running';await save(m);return status();
}
export async function status(){const m=validatePreview(file,root);const fixture=await statusOf(m);const ready=await appReady(m);return {kind:'HYBRID_PREVIEW',running:Boolean(fixture&&ready),fixture:m.fixtureOrigin,console:m.appOrigin+'/v1/hybrid-preview',operator:m.appOrigin+'/v1/operator',extensionDirectory:m.extensionDirectory,syntheticOnly:true,state:m.state};}
export async function stop(){
 const m=validatePreview(file,root);if(await statusOf(m)){const r=await fetch(m.fixtureOrigin+'/__stop',{method:'POST',headers:{'x-preview-control':m.control},signal:AbortSignal.timeout(1000),redirect:'error'});if(!r.ok)throw Error('PREVIEW_STOP_REFUSED');await waitStopped(m);}
 pilot('stop',m.pilotManifest);m.state='stopped';await save(m);return {stopped:true,historyRetained:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const command=process.argv[2];if(command==='--serve')await serve(validatePreview(file,root));else if(command==='start')console.log(JSON.stringify(await start()));else if(command==='status')console.log(JSON.stringify(await status()));else if(command==='stop')console.log(JSON.stringify(await stop()));else throw Error('Usage: preview.mjs start|status|stop');}catch(error){console.error(error.message);process.exitCode=1;}}
