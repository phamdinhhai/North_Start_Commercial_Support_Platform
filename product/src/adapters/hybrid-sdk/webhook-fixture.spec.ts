import {describe,it,expect} from 'vitest';
import {Signature} from '@hubspot/api-client';
import {verifyHubSpotWebhookFixture} from './webhook-fixture';
const now=1800000000000,secret='fixture-'+'x'.repeat(32),url='http://127.0.0.1/webhook';
function input(body=Buffer.from('{"fixture":true,"objectId":"fixture-contact"}'),timestamp=now){return {body,timestamp,secret,url,signature:Signature.getSignature('POST','v3',{clientSecret:secret,requestBody:body.toString('utf8'),url,timestamp,signature:''})};}
describe('official HubSpot signed webhook fabricated contract',()=>{
 it('uses the SDK signature primitive and keeps fixture completeness UNKNOWN',()=>expect(verifyHubSpotWebhookFixture(input(),now)).toEqual({provider:'hubspot',fixture:true,objectId:'fixture-contact',completeness:'UNKNOWN'}));
 it('rejects tampered bytes and signatures without parsed payload leakage',()=>{const x=input();expect(()=>verifyHubSpotWebhookFixture({...x,body:Buffer.from(x.body.toString().replace('contact','company'))},now)).toThrow('WEBHOOK_REJECTED');expect(()=>verifyHubSpotWebhookFixture({...x,signature:'bad'},now)).toThrow('WEBHOOK_REJECTED');});
 it.each([-300001,300001])('rejects stale/future timestamp %i',delta=>expect(()=>verifyHubSpotWebhookFixture(input(undefined,now+delta),now)).toThrow('WEBHOOK_REJECTED'));
 it('does not accept invalid JSON or invalid UTF-8 as a trusted event',()=>{expect(()=>verifyHubSpotWebhookFixture(input(Buffer.from('{broken')),now)).toThrow('WEBHOOK_REJECTED');expect(()=>verifyHubSpotWebhookFixture(input(Buffer.from([0xff])),now)).toThrow('WEBHOOK_REJECTED');});
 it('rejects real-data declarations and extra secret fields after verification',()=>{expect(()=>verifyHubSpotWebhookFixture(input(Buffer.from('{"fixture":false,"objectId":"fixture-contact"}')),now)).toThrow('WEBHOOK_SCHEMA_REJECTED');expect(()=>verifyHubSpotWebhookFixture(input(Buffer.from('{"fixture":true,"objectId":"fixture-contact","cookie":"secret"}')),now)).toThrow('WEBHOOK_SCHEMA_REJECTED');});
});
