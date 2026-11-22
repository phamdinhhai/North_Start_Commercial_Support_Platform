import test from 'node:test';
import assert from 'node:assert/strict';
import {backendOrigin,validateEnrollment,matchesEnrollment} from '../../src/adapters/hybrid-browser-runtime/permission-policy.mjs';
import {resolveSiteContext,minimizeDOM} from '../../src/adapters/hybrid-browser-runtime/platform-registry.mjs';
import {initialState,configure,appendContext,reserve,acknowledge,recover,health} from '../../src/adapters/hybrid-browser-runtime/outbox.mjs';
import {inspectGraphQL,inspectNetwork,inspectRealtime,createDiagnosticSession} from '../../src/adapters/hybrid-browser-runtime/diagnostics.mjs';

const expiresAt='2099-01-01T00:00:00.000Z';
const token='fabricated-capability-'.repeat(3);
const claim={enrollmentId:'qa-enrollment',token,expiresAt,scope:{workspaceId:'qa-workspace',connectionId:'qa-connection',provider:'pancake',accountId:'qa-account',target:{pageId:'qa-page',conversationId:'qa-conversation'}}};
const grant=()=>validateEnrollment({origin:'https://north.example',enrollment:structuredClone(claim)});
const context=()=>resolveSiteContext('https://pancake.vn/qa-page?c_id=qa-conversation',{pageId:'qa-page',accountId:'qa-account'});
const queued=()=>appendContext(configure(initialState(),grant()),context(),'2026-11-21T00:00:00.000Z','qa-capture');
const ack=(patch={})=>({enrollmentId:'qa-enrollment',captureId:'qa-capture',sequence:1,receiptId:'qa-receipt',disposition:'stored',checkpoint:1,completeness:'UNKNOWN',...patch});

test('backend authority refuses embedded credentials, non-origin paths, query and remote HTTP',()=>{
 for(const url of ['https://user:password@north.example','https://north.example/path','https://north.example/?token=fabricated','https://north.example/#fragment','http://north.example'])assert.throws(()=>backendOrigin(url));
 assert.equal(backendOrigin('http://127.0.0.1:1234/',true),'http://127.0.0.1:1234');
 assert.throws(()=>backendOrigin('http://127.0.0.1:1234/',false));
});
test('expiry and token whitespace cannot become an enrollment',()=>{
 assert.throws(()=>validateEnrollment({origin:'https://north.example',enrollment:{...claim,expiresAt:'2000-01-01T00:00:00Z'}}));
 assert.throws(()=>validateEnrollment({origin:'https://north.example',enrollment:{...claim,token:token+'\n'}}));
});
test('unknown target keys are rejected, and account/conversation mismatch does not match grant',()=>{
 assert.throws(()=>validateEnrollment({origin:'https://north.example',enrollment:{...claim,scope:{...claim.scope,target:{cookie:'fabricated'}}}}));
 const e=grant(),c=context();
 assert.equal(matchesEnrollment({...c,native:{...c.native,accountId:'foreign-account'}},e),false);
 assert.equal(matchesEnrollment({...c,native:{...c.native,conversationId:'foreign-conversation'}},e),false);
 assert.throws(()=>appendContext(configure(initialState(),e),{...c,native:{...c.native,pageId:'foreign-page'}}));
});
test('foreign workspace reconfiguration cannot transfer a pending outbox',()=>{
 const s=queued(),foreign={...grant(),scope:{...grant().scope,workspaceId:'foreign'}};
 assert.throws(()=>configure(s,foreign),/PENDING_OUTBOX_BINDING/);
 assert.equal(s.outbox.length,1);
});
test('lost ACK preserves identical capture/sequence through explicit retry and worker recovery',()=>{
 let s=reserve(queued());const first=structuredClone(s.pending);
 s=acknowledge(s,502,null);s=recover({...s,session:{tabId:1,startedAt:'2026-11-21T00:00:00.000Z'}});s=reserve(s);
 assert.deepEqual(s.pending,first);assert.equal(s.outbox.length,1);assert.equal(s.gaps.at(-1).possible,true);
});
test('foreign enrollment/capture/sequence ACK never removes pending observation',()=>{
 for(const patch of [{enrollmentId:'foreign'},{captureId:'foreign'},{sequence:2},{checkpoint:0},{completeness:'COMPLETE'},{disposition:'unrecognized'}]){
  const s=acknowledge(reserve(queued()),200,ack(patch));assert.equal(s.delivery,'retry-required');assert.equal(s.outbox.length,1);assert.ok(s.pending);
 }
});
test('exact duplicate ACK removes only the acknowledged observation without promoting completeness',()=>{
 const s=acknowledge(reserve(queued()),200,ack({disposition:'duplicate'}));assert.equal(s.outbox.length,0);assert.equal(s.nextSequence,2);assert.equal(health(s).completeness,'UNKNOWN');
});
test('401 and 403 discard capability and keep unsent evidence for explicit reconciliation',()=>{
 for(const status of [401,403]){const s=acknowledge(reserve(queued()),status,null);assert.equal(s.delivery,'unauthorized');assert.equal(s.enrollment.token,null);assert.equal(s.outbox.length,1);assert.throws(()=>reserve(s));}
});
test('receipt conflict is terminal and cannot be cleared by reusing same enrollment',()=>{
 const s=acknowledge(reserve(queued()),409,null);assert.equal(s.delivery,'blocked');assert.throws(()=>configure(s,grant()),/FRESH_ENROLLMENT_REQUIRED/);assert.throws(()=>reserve(s));
});
test('expired enrollment stops capture without losing pending evidence or allocating a new sequence',()=>{
 const before=reserve(queued()),after=reserve(before,Date.parse('2100-01-01T00:00:00Z'));
 assert.equal(after.delivery,'expired');assert.equal(after.enrollment.token,null);assert.equal(after.nextSequence,1);assert.equal(after.outbox.length,1);assert.equal(after.pending.captureId,'qa-capture');
});
test('DOM projection strips text, HTML, cookies, headers and token values',()=>{
 const result=minimizeDOM({accountId:'qa-account',pageId:'qa-page',message:'fabricated-body',html:'<p>fabricated</p>',cookie:'fabricated',authorization:'fabricated',access_token:'fabricated'});
 assert.deepEqual(result,{accountId:'qa-account',pageId:'qa-page'});
 assert.equal(resolveSiteContext('https://pancake.vn.attacker.example/qa-page',{accountId:'qa-account'}),null);
});
test('diagnostics retain only approved operation/event categories, never variables or URLs',()=>{
 assert.deepEqual(inspectGraphQL(JSON.stringify({operationName:'ConversationQuery',variables:{token:'fabricated'}})),{kind:'graphql',operationName:'ConversationQuery',authority:'PRIVATE_OBSERVED',completeness:'UNKNOWN'});
 assert.equal(inspectGraphQL(JSON.stringify({operationName:'SendMessage',variables:{message:'fabricated'}})),null);
 const network=inspectNetwork('https://provider.example/path?access_token=fabricated',403);assert.deepEqual(network,{kind:'http',status:403,authorization:'DENIED',completeness:'UNKNOWN'});
 assert.equal(JSON.stringify(network).includes('access_token'),false);
 assert.equal(inspectRealtime(JSON.stringify({event:'send-message',body:'fabricated'})),null);
});
test('privileged diagnostics require explicit activation and exact tab/origin scope',()=>{
 assert.throws(()=>createDiagnosticSession({tabId:1,origin:'https://pancake.vn',allowedOrigins:['https://pancake.vn']}),/ACTIVATION/);
 assert.throws(()=>createDiagnosticSession({activated:true,tabId:1,origin:'https://evil.example',allowedOrigins:['https://pancake.vn']}),/ORIGIN/);
 const session=createDiagnosticSession({activated:true,tabId:7,origin:'https://pancake.vn',allowedOrigins:['https://pancake.vn']});
 assert.equal(session.accept(7,'https://pancake.vn'),true);
 assert.equal(session.accept(8,'https://pancake.vn'),false);
 session.stop();assert.equal(session.isActive(),false);assert.equal(session.accept(7,'https://pancake.vn'),false);
});
