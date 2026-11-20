import {randomUUID} from 'node:crypto';
import type {AuthContext} from '../../ports/auth';
import type {ContentDigest,ContentDigester} from '../../ports/content-digester';
import type {SourceEpisodeLink,SourceEpisodeLinkInput,SourceEpisodeLinkStore,SourceLinkAuthorization} from '../../ports/source-episode-link';
import {SourceIntegrationError} from '../../ports/source-observation';
import {PostgresService} from '../postgres/postgres.service';
type Row={id:string;lead_id:string;origin_lead_id:string;effective_lead_id:string|null;connection_id:string;receipt_id:string;envelope_id:string;version:number;action:SourceEpisodeLinkInput['action'];reason:string;actor_id:string;recorded_at:Date|string;command_digest:ContentDigest};
const project=(r:Row):SourceEpisodeLink=>({id:r.id,leadId:r.lead_id,originLeadId:r.origin_lead_id,effectiveLeadId:r.effective_lead_id,connectionId:r.connection_id,receiptId:r.receipt_id,evidenceEnvelopeId:r.envelope_id,version:r.version,action:r.action,reason:r.reason,actorId:r.actor_id,recordedAt:new Date(r.recorded_at).toISOString(),linkage:r.action==='link'?'human_confirmed':r.action==='reject'?'rejected':'unknown',verification:'UNVERIFIED'});
const fail=(code:string,status=409):never=>{throw new SourceIntegrationError(code,status);};
/** ADR-005/006/009: technical context association, immutable source, human-only authority. */
export class PgSourceEpisodeLinkStore implements SourceEpisodeLinkStore {
 constructor(private readonly db:PostgresService){}
 async command(ctx:AuthContext,leadId:string,v:SourceEpisodeLinkInput,content:string,digester:ContentDigester,authorize:SourceLinkAuthorization){
  return this.db.withTransaction(async tx=>{
   // Lock receipt even for version zero; commands on different connections stay independent.
   const receipt=(await tx.query<{lead_id:string|null;envelope_id:string|null}>(`SELECT lead_id,envelope_id FROM source_receipt WHERE workspace_id=$1 AND connection_id=$2 AND receipt_id=$3 FOR UPDATE`,[ctx.workspaceId,v.connectionId,v.receiptId])).rows[0];
   if(!receipt)return fail('SOURCE_RECEIPT_NOT_FOUND',404);
   if(!receipt.lead_id||!receipt.envelope_id||receipt.envelope_id!==v.evidenceEnvelopeId)return fail('SOURCE_EVIDENCE_MISMATCH',422);
   const latest=(await tx.query<Row>(`SELECT * FROM source_episode_link WHERE workspace_id=$1 AND connection_id=$2 AND receipt_id=$3 ORDER BY version DESC LIMIT 1`,[ctx.workspaceId,v.connectionId,v.receiptId])).rows[0];
   const affected=[...new Set([leadId,receipt.lead_id,latest?.effective_lead_id].filter((id):id is string=>!!id))].sort();
   // Freeze ownership rows while the existing authorization callback resolves them.
   const locked=await tx.query<{id:string;workspace_id:string;owner_user_id:string|null}>('SELECT id,workspace_id,owner_user_id FROM lead WHERE workspace_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',[ctx.workspaceId,affected]);
   for(const id of affected){
    const row=locked.rows.find(r=>r.id===id);if(!row)return fail('LEAD_NOT_FOUND',404);
    await authorize(ctx,id,{workspaceId:row.workspace_id,ownerUserId:row.owner_user_id});
   }
   const prior=(await tx.query<Row>(`SELECT * FROM source_episode_link WHERE workspace_id=$1 AND connection_id=$2 AND receipt_id=$3 AND idempotency_key=$4`,[ctx.workspaceId,v.connectionId,v.receiptId,v.idempotencyKey])).rows[0];
   if(prior){if(prior.actor_id!==ctx.userId||digester.matches(ctx.workspaceId,'command',content,prior.command_digest)!==true)return fail('IDEMPOTENCY_CONFLICT');return project(prior);}
   if((latest?.version??0)!==v.expectedVersion)return fail('SOURCE_LINK_STALE_VERSION');
   // An unlink/reject cannot silently revoke an association for a different target Lead.
   if(v.action!=='link'&&latest?.effective_lead_id&&latest.effective_lead_id!==leadId)return fail('SOURCE_LINK_TARGET_MISMATCH');
   const version=v.expectedVersion+1,id=randomUUID(),effective=v.action==='link'?leadId:null;
   const row=(await tx.query<Row>(`INSERT INTO source_episode_link(id,workspace_id,connection_id,receipt_id,lead_id,origin_lead_id,effective_lead_id,envelope_id,version,action,reason,actor_id,idempotency_key,command_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) RETURNING *`,[id,ctx.workspaceId,v.connectionId,v.receiptId,leadId,receipt.lead_id,effective,receipt.envelope_id,version,v.action,v.reason,ctx.userId,v.idempotencyKey,JSON.stringify(digester.digest(ctx.workspaceId,'command',content))])).rows[0];
   // Rationale may contain PII: persist in protected history, never duplicate in telemetry/audit.
   await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value) VALUES('source-episode-link',$1,$2,$3,'source.episode-link.appended',$4::jsonb)`,[id,ctx.workspaceId,ctx.userId,JSON.stringify({leadId,originLeadId:receipt.lead_id,effectiveLeadId:effective,version,action:v.action,envelopeId:receipt.envelope_id,verification:'UNVERIFIED'})]);
   return project(row);
  });
 }
 async list(workspaceId:string,leadId:string,actorId?:string){
  return this.db.withTransaction(async tx=>{
   const rows=await tx.query<Row>(`SELECT * FROM source_episode_link WHERE workspace_id=$1 AND lead_id=$2::uuid ORDER BY recorded_at,id LIMIT 100`,[workspaceId,leadId]);
   if(actorId)await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value)
    VALUES('lead',$1,$2,$3,'source.link-history.accessed','{"completeness":"UNKNOWN"}'::jsonb)`,[leadId,workspaceId,actorId]);
   return rows.rows.map(project);
  });
 }
 async linkedReceipts(workspaceId:string,leadId:string){
  const rows=await this.db.query<{connection_id:string;receipt_id:string;envelope_id:string;origin_lead_id:string}>(`SELECT l.connection_id,l.receipt_id,l.envelope_id,l.origin_lead_id FROM source_episode_link l WHERE l.workspace_id=$1 AND l.effective_lead_id=$2::uuid AND NOT EXISTS(SELECT 1 FROM source_episode_link newer WHERE newer.workspace_id=l.workspace_id AND newer.connection_id=l.connection_id AND newer.receipt_id=l.receipt_id AND newer.version>l.version) ORDER BY l.recorded_at,l.id LIMIT 100`,[workspaceId,leadId]);
  return rows.rows.map(r=>({connectionId:r.connection_id,receiptId:r.receipt_id,envelopeId:r.envelope_id,originLeadId:r.origin_lead_id}));
 }
}
