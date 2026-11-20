import {randomUUID} from 'node:crypto';
import {canonicalizePayload} from '../../domain/envelope/envelope';
import type {ProviderCredentialStore,ProviderServicePrincipal} from '../../ports/provider-credentials';
import type {FabricatedDelivery, FabricatedDeliveryStore} from '../../ports/fabricated-delivery';
import {SourceIntegrationError,type SourceConnection,type SourceObservation} from '../../ports/source-observation';
import type {ContentDigest} from '../../ports/content-digester';
import {contentDigester} from '../../ports/content-digester-runtime';
import {PostgresService,type SqlExecutor} from '../postgres/postgres.service';
import {PgSourceIntegrationStore} from '../source-integration/pg-source-integration.store';
/** Raw admission is validated again at persistence; only fabricated observations can be stored. */
export class PgFabricatedDeliveryStore implements FabricatedDeliveryStore {
 constructor(private readonly db:PostgresService,private readonly credentials:ProviderCredentialStore,
  private readonly admit:(value:unknown,workspaceId:string,connection:SourceConnection)=>SourceObservation){}
 async accept(principal:ProviderServicePrincipal,delivery:FabricatedDelivery){
  await this.credentials.resolve(principal);
  if(!delivery||typeof delivery.deliveryId!=='string'||! /^[\x21-\x7e]{1,256}$/.test(delivery.deliveryId)||!Array.isArray(delivery.observations)||delivery.observations.length>100)throw new SourceIntegrationError('DELIVERY_SCHEMA_INVALID',400);
  const canonical=canonicalizePayload(delivery);
  if(Buffer.byteLength(canonical)>1048576)throw new SourceIntegrationError('DELIVERY_SCHEMA_INVALID',400);
  return this.db.withTransaction(async tx=>{
   const w=principal.workspaceId,cid=principal.connectionId;
   const row=(await tx.query<{id:string;workspace_id:string;provider:SourceConnection['provider'];route:SourceConnection['route'];page_id:string;status:SourceConnection['status']}>('SELECT * FROM source_connection WHERE workspace_id=$1 AND id=$2::uuid FOR UPDATE',[w,cid])).rows[0];
   if(!row)throw new SourceIntegrationError('CONNECTION_NOT_FOUND',404);
   const credential=await this.credentials.resolve(principal);
   if(row.status!=='active')throw new SourceIntegrationError('CONNECTION_REVOKED',403);
   if(credential.provider!==row.provider||credential.accountId!==row.page_id)throw new SourceIntegrationError('SOURCE_SCOPE_MISMATCH',403);
   const old=(await tx.query<{delivery_digest:ContentDigest;accepted_count:number}>('SELECT delivery_digest,accepted_count FROM fabricated_delivery WHERE workspace_id=$1 AND connection_id=$2::uuid AND delivery_id=$3',[w,cid,delivery.deliveryId])).rows[0];
   if(old&&contentDigester().matches(w,'receipt',canonical,old.delivery_digest)!==true)throw new SourceIntegrationError('DELIVERY_COLLISION',409);
   let accepted=old?.accepted_count??0;
   if(!old){
    const sameTx=new PgSourceIntegrationStore({withTransaction:<T>(fn:(executor:SqlExecutor)=>Promise<T>)=>fn(tx)} as PostgresService);
    for(const value of delivery.observations){
     const o=this.admit(value,w,{id:cid,workspaceId:w,provider:row.provider,route:row.route,pageId:row.page_id,status:row.status,health:'SYNTHETIC_ONLY'});
     const receipt=await sameTx.intake({workspaceId:w,userId:'fabricated-service:'+cid,role:'viewer',isDemo:false},cid,o,{claimResponsibility:false});
     if(receipt.disposition!=='receipt_duplicate')accepted++;
    }
    await tx.query('INSERT INTO fabricated_delivery(workspace_id,connection_id,delivery_id,delivery_digest,accepted_count) VALUES($1,$2,$3,$4::jsonb,$5)',[w,cid,delivery.deliveryId,JSON.stringify(contentDigester().digest(w,'receipt',canonical)),accepted]);
   }
   await tx.query('INSERT INTO fabricated_delivery_attempt(id,workspace_id,connection_id,delivery_id,duplicate,credential_version) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),w,cid,delivery.deliveryId,!!old,credential.version]);
   return {classification:'TEST_ONLY' as const,deliveryId:delivery.deliveryId,duplicate:!!old,accepted};
  });
 }
}
