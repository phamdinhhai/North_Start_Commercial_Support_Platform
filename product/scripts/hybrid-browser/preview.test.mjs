import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Script} from 'node:vm';
import {fixturePaths,fixtureNative,fixtureHtml,localOrigin,validatePreview,previewProof,verifyPreviewProof,assertPrivatePath,assertExtensionTree} from './preview-policy.mjs';
import {previewPage} from './preview-page.mjs';
import {previewConfiguration} from './preview-runtime.mjs';
import {probe} from './preview.mjs';
import {createServer} from 'node:http';
import {resolveSiteContext} from '../../src/adapters/hybrid-browser-runtime/platform-registry.mjs';
import {matchesEnrollment} from '../../src/adapters/hybrid-browser-runtime/permission-policy.mjs';

const scopeFor=(kind)=>({workspaceId:'fixture-workspace',connectionId:'fixture-connection-'+kind,accountId:fixtureNative[kind].accountId,provider:kind==='ads'?'meta-ads':kind==='crm'?'hubspot':'pancake',target:kind==='pancake'?{pageId:'fixture-page-pancake',conversationId:'fixture-conversation-pancake'}:kind==='ads'?{campaignId:'fixture-campaign-ads'}:{contactId:'fixture-contact-crm'}});
test('timeout is unidentified, only refused connection means absent listener',async()=>{
 const server=createServer(()=>{});await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 try{await assert.rejects(probe(url,50),/LISTENER_UNCERTAIN/);}finally{server.closeAllConnections();await new Promise(done=>server.close(done));}
 assert.equal(await probe(url),null);
});
for(const kind of Object.keys(fixturePaths))test(kind+' fixture page recognizes and binds the actual DOM and URL',()=>{
 const html=fixtureHtml(kind,'http://127.0.0.1:4301');
 const dom=Object.fromEntries([...html.matchAll(/data-([a-z-]+)="([^"]+)"/g)].map(([,k,v])=>[k.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v]));
 const context=resolveSiteContext('http://127.0.0.1:4302'+fixturePaths[kind],dom,true);
 assert.ok(context);assert.equal(matchesEnrollment(context,{scope:scopeFor(kind)}),true);
 assert.equal(context.facts.label,'fixture-label-v1');assert.equal(context.completeness,'UNKNOWN');
});
test('preview configuration remains disabled in the normal Sales pilot',()=>{
 assert.equal(previewConfiguration({}),null);
 const base={workspace:'fixture-workspace',control:'a'.repeat(64),appPort:4301,pgPort:4302,idpPort:4303,controlPort:4304};
 assert.throws(()=>previewConfiguration({...base,hybridPreview:{fixturePort:4305,signingSecret:base.control}}));
 assert.throws(()=>previewConfiguration({...base,hybridPreview:{fixturePort:4301,signingSecret:'b'.repeat(64)}}));
 const c=previewConfiguration({...base,hybridPreview:{fixturePort:4305,signingSecret:'b'.repeat(64)}});
 assert.notEqual(c.env.AIL_SIGNING_SECRET,base.control);assert.equal(JSON.parse(c.env.AIL_SCOPE_ALLOWLIST).length,3);
 assert.ok(JSON.parse(c.env.AIL_SCOPE_ALLOWLIST).every(s=>s.workspaceId===base.workspace));
});
test('Owner console has valid script and no privileged credential embedded',()=>{
 const html=previewPage('http://127.0.0.1:4305');new Script(html.match(/<script>([\s\S]*)<\/script>/)[1]);
 assert.match(html,/Create scoped enrollment/);assert.match(html,/receipt replay probe/);assert.doesNotMatch(html,/[?&](?:access_token|page_access_token)=/);
 for(const origin of ['https://remote.test','http://127.0.0.1:4305/path','http://u:p@127.0.0.1:4305'])assert.throws(()=>previewPage(origin));
 for(const p of [0,80,65536,4301.5])assert.throws(()=>localOrigin(p));
});
test('public instance IDs and stale proofs cannot authenticate replaced listeners',()=>{
 const key='a'.repeat(64),id='b'.repeat(32),nonce='c'.repeat(64),proof=previewProof(key,'fixture',id,nonce);
 assert.equal(verifyPreviewProof(proof,previewProof(key,'fixture',id,nonce)),true);
 for(const expected of [previewProof(key,'app',id,nonce),previewProof(key,'fixture',id,'d'.repeat(64)),previewProof('e'.repeat(64),'fixture',id,nonce)])assert.equal(verifyPreviewProof(proof,expected),false);
 assert.equal(verifyPreviewProof('0'.repeat(64),proof),false);assert.equal(verifyPreviewProof(undefined,proof),false);
});
test('root and package directory junctions are refused before writes',()=>{
 const root=mkdtempSync(join(tmpdir(),'preview-link-')),home=join(root,'hybrid-preview'),outside=join(root,'other');mkdirSync(home);mkdirSync(outside);
 const extension=join(home,'extension');symlinkSync(outside,extension,process.platform==='win32'?'junction':'dir');
 try{assert.throws(()=>assertExtensionTree(extension,home),/LINK_REFUSED/);assert.throws(()=>assertPrivatePath(join(extension,'not-created-yet')),/LINK_REFUSED/);}finally{unlinkSync(extension);}
 mkdirSync(extension);const runtime=join(extension,'runtime');symlinkSync(outside,runtime,process.platform==='win32'?'junction':'dir');
 try{assert.throws(()=>assertExtensionTree(extension,home),/LINK_REFUSED/);}finally{unlinkSync(runtime);}
});
test('private preview rejects manifest retargeting and resource substitutions before network IO',()=>{
 const before={TEMP:process.env.TEMP,TMP:process.env.TMP};const root=mkdtempSync(join(tmpdir(),'preview-policy-'));
 process.env.TEMP=root;process.env.TMP=root;
 try{
  const id='a'.repeat(32),home=join(root,'north-synthetic-pilot-'+id),data=join(home,'data'),previewHome=join(root,'hybrid-preview');mkdirSync(data,{recursive:true});mkdirSync(previewHome);
  writeFileSync(join(data,'postgresql.auto.conf'),"listen_addresses='127.0.0.1'\nport=4302\n");
  const p={kind:'LOCAL_SYNTHETIC_ONLY_V1',id,data,database:'pilot_'+id,role:'pilot_'+id,password:'c'.repeat(64),adminPassword:'d'.repeat(64),control:'e'.repeat(64),workspace:'synthetic-'+id,pgPort:4302,appPort:4301,idpPort:4303,controlPort:4304,digestKeys:['synthetic-'+id,'synthetic-'+id+'-foreign'].map(workspaceId=>({workspaceId,activeKid:'local-v1',keys:[{kid:'local-v1',secretBase64:Buffer.alloc(32,1).toString('base64')}]})),hybridPreview:{fixturePort:4305,signingSecret:'f'.repeat(64)}};
  const pf=join(home,'manifest.json');writeFileSync(pf,JSON.stringify(p));
  const m={kind:'NORTH_START_HYBRID_PREVIEW_V2',id,pilotManifest:pf,fixturePort:4305,fixtureOrigin:localOrigin(4305),appOrigin:localOrigin(4301),control:'b'.repeat(64),extensionDirectory:join(previewHome,'extension'),state:'stopped'};
  const file=join(previewHome,'manifest.json');writeFileSync(file,JSON.stringify(m));assert.equal(validatePreview(file,root).id,id);
  assert.throws(()=>validatePreview(pf,root));
  for(const patch of [{appOrigin:'https://remote.test'},{id:'b'.repeat(32)},{fixtureOrigin:'http://127.0.0.1:4306'},{extensionDirectory:root},{fixturePort:4301}]){writeFileSync(file,JSON.stringify({...m,...patch}));assert.throws(()=>validatePreview(file,root));}
  assert.ok(readFileSync(pf,'utf8').includes('LOCAL_SYNTHETIC_ONLY_V1'));
 }finally{for(const [k,v]of Object.entries(before))if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
