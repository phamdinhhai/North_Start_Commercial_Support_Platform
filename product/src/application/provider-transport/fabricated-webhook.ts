import type {ProviderCredentialStore,ProviderServicePrincipal} from '../../ports/provider-credentials';
import type {FabricatedDeliveryStore} from '../../ports/fabricated-delivery';
import {SourceIntegrationError} from '../../ports/source-observation';
import {validateSourceObservation} from '../source-integration/validation';
import {assertSyntheticNativeIdentity} from '../source-trust/source-trust';
/** Never register as a live route. The signature is a TEST_ONLY fabricated protocol,
 * not evidence of Pancake authenticity or an approved Meta app/account. */
export class FabricatedWebhookAdmission {
 constructor(private readonly credentials:ProviderCredentialStore,private readonly store:FabricatedDeliveryStore,
  private readonly verify:(raw:Uint8Array,signature:unknown,secret:Uint8Array)=>boolean,private readonly enabled=false){}
 async accept(principal:ProviderServicePrincipal,raw:Uint8Array,contentType:unknown,signature:unknown){
  if(!this.enabled)throw new SourceIntegrationError('FABRICATED_WEBHOOK_DISABLED',404);
  const mode=(process.env.DEPLOYMENT_MODE??process.env.APP_MODE??'').trim().toLowerCase();
  if(!['test','local'].includes(mode)||['production','pilot'].includes((process.env.NODE_ENV??'').trim().toLowerCase()))throw new SourceIntegrationError('TEST_ONLY',403);
  const credential=await this.credentials.resolve(principal);
  if(!(raw instanceof Uint8Array)||raw.byteLength>1048576||typeof contentType!=='string'||!/^application\/json(?:;\s*charset=utf-8)?$/i.test(contentType))throw new SourceIntegrationError('DELIVERY_SCHEMA_INVALID',400);
  let valid=false;try{valid=this.verify(raw,signature,Buffer.from(credential.secret,'utf8'));}catch{valid=false;}
  if(!valid)throw new SourceIntegrationError('DELIVERY_AUTH_INVALID',401);
  let body:unknown;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{throw new SourceIntegrationError('DELIVERY_SCHEMA_INVALID',400);}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new SourceIntegrationError('DELIVERY_SCHEMA_INVALID',400);
  const v=body as Record<string,unknown>;
  if(Object.keys(v).sort().join()!=='deliveryId,events,protocol'||v.protocol!=='north-start-fabricated-delivery/v1'||typeof v.deliveryId!=='string'||! /^[\x21-\x7e]{1,256}$/.test(v.deliveryId)||!Array.isArray(v.events)||v.events.length>100)throw new SourceIntegrationError('DELIVERY_SCHEMA_INVALID',400);
  const observations=v.events.map(value=>{const o=validateSourceObservation(value);assertSyntheticNativeIdentity(o);if(o.provider!==credential.provider||o.accountId!==credential.accountId)throw new SourceIntegrationError('SOURCE_SCOPE_MISMATCH',403);return o;});
  // Sink resolves the current principal again under the connection transaction lock.
  return this.store.accept(principal,{deliveryId:v.deliveryId,observations});
 }
}
