import {Signature} from '@hubspot/api-client';
import {timingSafeEqual} from 'node:crypto';
/** Official SDK signature primitive, with explicit freshness/future and constant-time checks. */
export function verifyHubSpotWebhookFixture(input:{body:Buffer;signature:string;timestamp:number;secret:string;url:string},now=Date.now()):{provider:'hubspot';fixture:true;objectId:string;completeness:'UNKNOWN'} {
 if(!Buffer.isBuffer(input.body)||input.body.length>8192||!/^fixture-[A-Za-z0-9_-]{16,}$/.test(input.secret)||!Number.isSafeInteger(input.timestamp)||Math.abs(now-input.timestamp)>300000)throw new Error('WEBHOOK_REJECTED');
 const url=new URL(input.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.search||url.hash)throw new Error('WEBHOOK_REJECTED');
 let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(input.body);}catch{throw new Error('WEBHOOK_REJECTED');}
 const expected=Signature.getSignature('POST','v3',{clientSecret:input.secret,requestBody:text,url:input.url,timestamp:input.timestamp,signature:input.signature});
 const a=Buffer.from(expected),b=Buffer.from(input.signature);if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('WEBHOOK_REJECTED');
 let parsed:unknown;try{parsed=JSON.parse(text);}catch{throw new Error('WEBHOOK_REJECTED');}
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).sort().join()!=='fixture,objectId'||(parsed as {fixture?:unknown}).fixture!==true||!/^fixture-[A-Za-z0-9_-]+$/.test((parsed as {objectId:string}).objectId))throw new Error('WEBHOOK_SCHEMA_REJECTED');
 return {provider:'hubspot',fixture:true,objectId:(parsed as {objectId:string}).objectId,completeness:'UNKNOWN'};
}
