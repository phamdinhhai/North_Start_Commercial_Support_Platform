import type {Enrollment,Upload} from '../../ports/integration';
import {fail,isId,isObject} from './config';
import {receiptEnvelope} from './hybrid-envelope';
const keys=(value:Record<string,unknown>,expected:string)=>Object.keys(value).sort().join()===expected;
const surfaces:Record<string,string>={'pancake-conversations':'pancake','meta-ads':'meta-ads','hubspot-crm':'hubspot'};
const identifiers=['pageId','conversationId','campaignId','adsetId','adId','contactId','companyId','dealId'];
/** No raw payload, cookie, token, client digest or authority field is accepted. */
export function validateHybridUpload(input:unknown,claim:Enrollment):Upload {
 if(!isObject(input)||!keys(input,'captureId,enrollmentId,observation,sequence')||input.enrollmentId!==claim.id||!isId(input.captureId)||!Number.isSafeInteger(input.sequence)||(input.sequence as number)<1||!isObject(input.observation))return fail('INPUT_INVALID');
 const o=input.observation,s=claim.scope,target=s.target;
 if(!target||Object.keys(target).some(k=>!['pageId','conversationId','campaignId','adsetId','adId','contactId','companyId','dealId'].includes(k))||!Object.keys(target).some(k=>k!=='pageId')||Object.values(target).some(v=>!isId(v)||!v.startsWith('fixture-')))return fail('FIXTURE_TARGET_REQUIRED',403);
 if(!keys(o,o.facts===undefined?'authenticity,captureId,completeness,method,native,observedAt,provider,providerSurface,schemaVersion,scope,sourceRevision':'authenticity,captureId,completeness,facts,method,native,observedAt,provider,providerSurface,schemaVersion,scope,sourceRevision')||o.schemaVersion!==1||o.captureId!==input.captureId||o.provider!==surfaces[s.providerSurface]||o.providerSurface!==s.providerSurface||o.method!=='browser-dom'||o.authenticity!=='CLIENT_OBSERVED'||o.completeness!=='UNKNOWN'||!isId(o.sourceRevision)||typeof o.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(o.observedAt)||!Number.isFinite(Date.parse(o.observedAt))||!isObject(o.scope)||!isObject(o.native))return fail('INPUT_INVALID');
 if(o.facts!==undefined&&(!isObject(o.facts)||!keys(o.facts,'label,lifecycle')||typeof o.facts.label!=='string'||!/^fixture-[A-Za-z0-9_-]{1,64}$/.test(o.facts.label)||!['present','deleted'].includes(String(o.facts.lifecycle))))return fail('INPUT_INVALID');
 const clientScope=o.scope as Record<string,unknown>;
 if(!keys(clientScope,'accountId,connectionId,workspaceId')||['workspaceId','connectionId','accountId'].some(k=>clientScope[k]!==s[k as 'workspaceId'|'connectionId'|'accountId']))return fail('SCOPE_MISMATCH',403);
 const n=o.native as Record<string,unknown>;
 if(Object.keys(n).some(k=>!['accountId','pageAlias','currency','timezone',...identifiers].includes(k))||Object.values(n).some(v=>!isId(v)))return fail('INPUT_INVALID');
 if(n.accountId!==s.accountId||Object.entries(target).some(([k,v])=>n[k]!==v)||identifiers.some(k=>n[k]!==undefined&&target[k]!==n[k]))return fail('TARGET_SCOPE_MISMATCH',403);
 const objectKey=identifiers.find(k=>k!=='pageId'&&target[k]!==undefined)!;
 // Legacy pageId names the server-bound account/page; native object identity remains separate.
 const upload:Upload={captureId:input.captureId,sequence:input.sequence as number,pageId:s.pageId,observation:{scope:{workspaceId:s.workspaceId,connectionId:s.connectionId,accountId:s.accountId,providerSurface:s.providerSurface},captureId:input.captureId,sourceRevision:o.sourceRevision,externalEventId:null,externalObjectId:target[objectKey],eventType:'hybrid:'+objectKey,method:'browser-dom',evidenceType:'synthetic',authenticity:'UNKNOWN',completeness:'UNKNOWN',occurredAt:null,observedAt:o.observedAt,native:Object.fromEntries(['accountId',...Object.keys(target)].map(k=>[k,n[k]])),fixture:true,sourceAuthority:'synthetic_fixture'}};
 if(o.facts!==undefined)upload.observation.facts={label:(o.facts as Record<string,string>).label,lifecycle:(o.facts as Record<string,string>).lifecycle};
 upload.observation.hybridEnvelope=receiptEnvelope(claim,upload,'browser_dom');
 return upload;
}
