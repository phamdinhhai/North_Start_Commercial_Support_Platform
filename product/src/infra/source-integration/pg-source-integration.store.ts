import { randomUUID } from 'node:crypto';
import { createEnvelope, canonicalizePayload } from '../../domain/envelope/envelope';
import { createLead } from '../../domain/lead/lead';
import { contentDigester } from '../../ports/content-digester-runtime';
import type { ContentDigest } from '../../ports/content-digester';
import type { AuthContext } from '../../ports/auth';
import { SourceIntegrationError, type SourceConnection, type SourceEvidence, type SourceIntegrationStore, type SourceObservation, type SourceReceipt } from '../../ports/source-observation';
import { PostgresService, type SqlExecutor } from '../postgres/postgres.service';
import { toEnvelope, type EnvelopeDbRow } from '../postgres/repositories/pilot-persistence.types';

type ConnectionRow = {id:string;workspace_id:string;provider:SourceConnection['provider'];route:SourceConnection['route'];page_id:string;status:SourceConnection['status']};
type ReceiptRow = {id:string;connection_id:string;receipt_id:string;lead_id:string|null;envelope_id:string|null;disposition:Exclude<SourceReceipt['disposition'],'receipt_duplicate'>;quarantine_reason:SourceReceipt['quarantineReason'];observation:Omit<SourceObservation,'rawPayload'>;receipt_digest:ContentDigest;event_id:string|null;revision:string|null};
const connection = (r:ConnectionRow):SourceConnection => ({id:r.id,workspaceId:r.workspace_id,provider:r.provider,route:r.route,pageId:r.page_id,status:r.status,health:'SYNTHETIC_ONLY'});
const receipt = (r:ReceiptRow, duplicate=false):SourceReceipt => ({receiptId:r.receipt_id,connectionId:r.connection_id,leadId:r.lead_id,envelopeId:r.envelope_id,disposition:duplicate?'receipt_duplicate':r.disposition,quarantineReason:r.quarantine_reason,verification:'UNVERIFIED',completeness:'UNKNOWN'});
const fail = (code:string,status=409):never=>{throw new SourceIntegrationError(code,status);};
async function audit(tx:SqlExecutor,ctx:AuthContext,id:string,event:string,value:unknown) {
  await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value) VALUES('source-integration',$1,$2,$3,$4,$5::jsonb)`,[id,ctx.workspaceId,ctx.userId,event,JSON.stringify(value)]);
}
/** One existing PostgreSQL transaction boundary for accepted raw evidence, lead seed and receipts. */
export class PgSourceIntegrationStore implements SourceIntegrationStore {
  constructor(private readonly db:PostgresService) {}
  async createConnection(ctx:AuthContext,input:Pick<SourceConnection,'provider'|'route'|'pageId'>) {
    return this.db.withTransaction(async tx=>{
      const id=randomUUID();
      const rows=await tx.query<ConnectionRow>(`INSERT INTO source_connection(id,workspace_id,provider,route,page_id,status) VALUES($1,$2,$3,$4,$5,'active') RETURNING *`,[id,ctx.workspaceId,input.provider,input.route,input.pageId]);
      await audit(tx,ctx,id,'source.connection.created',{provider:input.provider,route:input.route,health:'SYNTHETIC_ONLY'});
      return connection(rows.rows[0]);
    });
  }
  async revokeConnection(ctx:AuthContext,id:string) {
    return this.db.withTransaction(async tx=>{
      const rows=await tx.query<ConnectionRow>(`UPDATE source_connection SET status='revoked',revoked_at=COALESCE(revoked_at,now()) WHERE workspace_id=$1 AND id::text=$2 RETURNING *`,[ctx.workspaceId,id]);
      if(!rows.rows[0])return fail('CONNECTION_NOT_FOUND',404);
      await audit(tx,ctx,id,'source.connection.revoked',{status:'revoked'});
      return connection(rows.rows[0]);
    });
  }
  async listConnections(workspaceId:string) {
    return (await this.db.query<ConnectionRow>('SELECT * FROM source_connection WHERE workspace_id=$1 ORDER BY created_at,id LIMIT 100',[workspaceId])).rows.map(connection);
  }
  async intake(ctx:AuthContext,connectionId:string,o:SourceObservation,options={claimResponsibility:false}):Promise<SourceReceipt> {
    return this.db.withTransaction(async tx=>{
      const c=(await tx.query<ConnectionRow>('SELECT * FROM source_connection WHERE workspace_id=$1 AND id::text=$2 FOR UPDATE',[ctx.workspaceId,connectionId])).rows[0];
      if(!c)return fail('CONNECTION_NOT_FOUND',404);
      if(c.status!=='active')return fail('CONNECTION_REVOKED',403);
      if(c.provider!==o.provider || c.route!==o.route || c.page_id!==o.accountId)return fail('SOURCE_SCOPE_MISMATCH',403);
      const serialized=canonicalizePayload(o);
      const prior=(await tx.query<ReceiptRow>('SELECT * FROM source_receipt WHERE workspace_id=$1 AND connection_id=$2 AND receipt_id=$3',[ctx.workspaceId,c.id,o.receiptId])).rows[0];
      if(prior) {
        if(contentDigester().matches(ctx.workspaceId,'receipt',serialized,prior.receipt_digest)!==true)return fail('RECEIPT_COLLISION');
        return receipt(prior,true);
      }
      const n=o.native;
      const known=!!(n.system && n.pageId && n.messageId);
      let leadId:string|null=null,envelopeId:string|null=null;
      let disposition:ReceiptRow['disposition']='unknown';
      if(known) {
        const args=[ctx.workspaceId,n.system,n.pageId,n.messageId];
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['source-message',...args])]);
        const priorObjects=(await tx.query<ReceiptRow>(`SELECT * FROM source_receipt WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND message_id=$4 ORDER BY created_at,id`,args)).rows;
        if(n.conversationId!==null && priorObjects.some(r=>r.observation.native.conversationId!==null && r.observation.native.conversationId!==n.conversationId))return fail('NATIVE_OBJECT_COLLISION');
        // Same explicit event/revision means immutable observation identity, never a text identity merge.
        const sameEvent=n.eventId===null?undefined:priorObjects.find(r=>r.event_id===n.eventId && r.revision===n.revision);
        if(sameEvent) {
          const existing=(await tx.query<EnvelopeDbRow>('SELECT * FROM commercial_envelope WHERE id=$1',[sameEvent.envelope_id])).rows[0];
          const a=toEnvelope(existing).rawPayload as Record<string,unknown>;
          // Original route-specific fabricated payloads may differ. Compare normalized source content + label/time.
          const stable=(value:SourceObservation)=>canonicalizePayload([value.rawPayload.utterance,value.rawPayload.speaker,value.lifecycle,value.occurredAt]);
          const previous={...sameEvent.observation,rawPayload:a} as unknown as SourceObservation;
          if(stable(previous)!==stable(o))return fail('NATIVE_EVENT_COLLISION');
        }
        const mapped=(await tx.query<{lead_id:string}>(`SELECT lead_id FROM source_native_message WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND message_id=$4`,args)).rows[0];
        const env=createEnvelope({workspaceId:ctx.workspaceId,connection:c.id,externalRecordId:o.receiptId,externalEventType:o.lifecycle,sourceCapturedAt:o.observedAt,rawPayload:o.rawPayload,isSynthetic:true,acquisitionMode:'imported_record',acquisitionSource:'manual'});
        envelopeId=env.envelopeId;
        await tx.query(`INSERT INTO commercial_envelope(id,schema_version,workspace_id,connection,external_record_id,external_event_type,source_captured_at,ingested_at,raw_payload,raw_payload_hash,raw_payload_digest,mapping_status,is_synthetic,acquisition_mode,acquisition_source)
          VALUES($1,1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,'mapped',true,'imported_record','manual')`,[env.envelopeId,ctx.workspaceId,c.id,o.receiptId,o.lifecycle,env.sourceCapturedAt,env.ingestedAt,JSON.stringify(env.rawPayload),env.rawPayloadHash,JSON.stringify(env.rawPayloadDigest)]);
        if(mapped) {leadId=mapped.lead_id;disposition=n.eventId!==null && !sameEvent?'distinct_event':'object_aligned';}
        else {
          // Synthetic message intake creates an unassigned commercial episode seed, not a conversation/customer merge.
          const lead=createLead({workspaceId:ctx.workspaceId,displayName:o.displayName,conversationSource:`${n.system}:page`});leadId=lead.id;disposition='stored';
          await tx.query(`INSERT INTO lead(id,workspace_id,display_name,conversation_source,attribution,status,created_at,owner_user_id,source_envelope_id) VALUES($1,$2,$3,$4,'unknown','New',$5,$6,$7)`,[lead.id,ctx.workspaceId,lead.displayName,lead.conversationSource,lead.createdAt,options.claimResponsibility?ctx.userId:null,envelopeId]);
          await tx.query(`INSERT INTO source_native_message(workspace_id,native_system,page_id,message_id,lead_id) VALUES($1,$2,$3,$4,$5)`,[...args,leadId]);
          await audit(tx,ctx,lead.id,'source.lead.seeded',{leadId,envelopeId,owner:options.claimResponsibility?ctx.userId:null,explicitAdminClaim:options.claimResponsibility,attribution:'unknown',synthetic:true});
        }
      }
      const {rawPayload:_raw,...metadata}=o;
      const id=randomUUID();
      const result=await tx.query<ReceiptRow>(`INSERT INTO source_receipt(id,workspace_id,connection_id,receipt_id,native_system,page_id,conversation_id,message_id,event_id,revision,lead_id,envelope_id,observation,receipt_digest,disposition,quarantine_reason)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16) RETURNING *`,[id,ctx.workspaceId,c.id,o.receiptId,n.system,n.pageId,n.conversationId,n.messageId,n.eventId,n.revision,leadId,envelopeId,JSON.stringify(metadata),JSON.stringify(contentDigester().digest(ctx.workspaceId,'receipt',serialized)),disposition,known?null:'UNKNOWN_NATIVE_ID']);
      await audit(tx,ctx,id,'source.receipt.appended',{leadId,envelopeId,disposition,verification:'UNVERIFIED'});
      return receipt(result.rows[0]);
    });
  }
  async evidence(workspaceId:string,leadId:string,actorId:string):Promise<readonly SourceEvidence[]> {
    return this.db.withTransaction(async tx=>{
      const rows=await tx.query<ReceiptRow & {envelope:EnvelopeDbRow}>(`SELECT r.*,to_jsonb(e) AS envelope FROM source_receipt r JOIN commercial_envelope e ON e.id=r.envelope_id AND e.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.lead_id::text=$2 ORDER BY r.created_at,r.id LIMIT 100`,[workspaceId,leadId]);
      await audit(tx,{workspaceId,userId:actorId,role:'viewer',isDemo:false},leadId,'source.evidence.accessed',{count:rows.rows.length});
      return rows.rows.map(r=>({receipt:receipt(r),observation:r.observation,envelope:toEnvelope(r.envelope)}));
    });
  }
}
