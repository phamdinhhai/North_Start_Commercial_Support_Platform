import {readFileSync,writeFileSync,mkdirSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import ts from 'typescript';
import {describe,expect,it} from 'vitest';
import {OfflineSendJournal} from './offline-send-journal';
import {SendLedger} from '../../domain/send-ledger/send-ledger';

const binding={fixture:true as const,workspaceId:'crash-workspace',connectionId:'crash-connection',operationId:'crash-operation',pageId:'crash-page',conversationId:'crash-conversation'};
const key=Buffer.alloc(32,7),payload=Buffer.from('{"action":"reply_inbox","message":"fixture"}');
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'north-r4133-process-'));writeFileSync(join(dir,'.offline-send-fixture'),'fixture');
 for(const relative of ['domain/send-ledger/send-ledger.ts','infra/send-forensics/offline-send-journal.ts','adapters/pancake-forensics/offline-http.ts']){
  const source=readFileSync(resolve('src',relative),'utf8'),destination=join(dir,'modules',relative.replace(/\.ts$/u,'.js'));
  mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText);
 }
 const worker=join(dir,'worker.cjs');
 writeFileSync(worker,`
 const {OfflineSendJournal}=require('./modules/infra/send-forensics/offline-send-journal.js');
 const {sendOfflineFixture}=require('./modules/adapters/pancake-forensics/offline-http.js');
 const binding=${JSON.stringify(binding)},payload=Buffer.from(${JSON.stringify(payload.toString())});
 const j=new OfflineSendJournal(__dirname,binding,Buffer.alloc(32,7),payload);
 (async()=>{try{
  j.begin();if(process.argv[2]==='reserved')process.exit(73);
  j.append('DISPATCH_STARTED');if(process.argv[2]==='dispatch')process.exit(74);
  if(process.argv[2]==='received'){
   const req=require('node:http').request(process.argv[3],{method:'POST',headers:{'content-type':'application/json','content-length':payload.length}},res=>{res.resume();process.exit(75)});
   req.on('error',()=>process.exit(76));req.end(payload);return;
  }
  const observed=await sendOfflineFixture(process.argv[3],'fixture',{timeoutMs:1000,maxBytes:4096});
  j.append(observed.kind==='confirmed'?'RESPONSE_CONFIRMED':observed.kind==='rejected'?'PROVIDER_REJECTED':'AMBIGUOUS','FIXTURE_RESPONSE');
  console.log(JSON.stringify({state:observed.kind}));
 }catch{console.log(JSON.stringify({state:'REFUSED'}));}finally{j.release();}})();
 `);
 return {dir,worker};
}
function run(worker:string,mode:string,url?:string){return new Promise<{code:number|null;output:string}>(resolve=>{
 const p=spawn(process.execPath,[worker,mode,...(url?[url]:[])],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
 p.stdout.on('data',b=>output+=b);p.stderr.on('data',()=>{});p.on('close',code=>resolve({code,output}));
});}

describe('actual process crash and duplicate-send fixtures',()=>{
 it.each([['reserved',73,'RESERVED'],['dispatch',74,'DISPATCH_STARTED']] as const)('preserves %s crash with no automatic redispatch',async(mode,code,state)=>{
  const f=fixture();expect((await run(f.worker,mode)).code).toBe(code);
  const journal=new OfflineSendJournal(f.dir,binding,key,payload);const observed=journal.inspect();expect(observed?.state).toBe(state);
  expect(()=>journal.begin()).toThrow('OFFLINE_SEND_LOCKED');
  const recovered=new SendLedger(observed!.events).recover(binding.operationId);expect(recovered.state).toBe('MANUAL_REVIEW_REQUIRED');
  expect(journal.inspect()?.state).toBe(state); // read-only recovery view preserves original forensic bytes
 });
 it('retains ambiguity after server receives body but child dies before complete response',async()=>{
  let received=0;const server=createServer(async(req,res)=>{let body='';for await(const b of req)body+=b;expect(body).toBe(payload.toString());received++;res.writeHead(200,{'content-type':'application/json'});res.flushHeaders();});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();const url=`http://127.0.0.1:${typeof address==='object'&&address?address.port:0}`;
  try{const f=fixture();expect((await run(f.worker,'received',url)).code).toBe(75);expect(received).toBe(1);const journal=new OfflineSendJournal(f.dir,binding,key,payload);expect(journal.inspect()?.state).toBe('DISPATCH_STARTED');expect(()=>journal.begin()).toThrow('OFFLINE_SEND_OPERATION_EXISTS');}
  finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 });
 it('two concurrent processes produce one request and one auditable outcome',async()=>{
  let received=0;const server=createServer(async(req,res)=>{for await(const unused of req){void unused;}received++;res.writeHead(200,{'content-type':'application/json'});res.end('{"success":true}');});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();const url=`http://127.0.0.1:${typeof address==='object'&&address?address.port:0}`;
  try{const f=fixture();const results=await Promise.all([run(f.worker,'normal',url),run(f.worker,'normal',url)]);expect(received).toBe(1);expect(results.filter(x=>x.output.includes('REFUSED'))).toHaveLength(1);expect(new OfflineSendJournal(f.dir,binding,key,payload).inspect()?.state).toBe('RESPONSE_CONFIRMED');}
  finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 });
});
