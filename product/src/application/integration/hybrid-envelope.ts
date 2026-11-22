import {createHash} from 'node:crypto';
import type {Enrollment, Upload} from '../../ports/integration';
import type {HybridObservationEnvelope, HybridNativeIdentity} from '../../ports/hybrid-observation';

/** Only minimized fixture identity/facts are hashed here, never raw content. */
export function receiptEnvelope(e:Enrollment,u:Upload,authority:'browser_dom'|'official_api'):HybridObservationEnvelope {
 const target=e.scope.target!;
 const kind=Object.keys(target).find(k=>k!=='pageId')!;
 const objectType=kind.replace(/Id$/u,'') as HybridNativeIdentity['objectType'];
 const native:HybridNativeIdentity={system:({'pancake-conversations':'pancake','meta-ads':'meta_ads','hubspot-crm':'hubspot'} as const)[e.scope.providerSurface],accountId:e.scope.accountId,objectType,objectId:target[kind],parentId:target.pageId??null};
 const payload={native,...(u.observation.facts?{facts:u.observation.facts}: {})};
 return {schemaVersion:1,fixture:true,workspaceId:e.scope.workspaceId,connectionId:e.scope.connectionId,observationId:u.captureId,authority,trust:authority==='browser_dom'?'UNVERIFIED':'AUTHENTICATED_TRANSPORT',native,capturedAt:String(u.observation.observedAt),payloadDigest:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),payload};
}
