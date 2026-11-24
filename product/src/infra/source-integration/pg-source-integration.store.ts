import { randomUUID } from 'node:crypto';
import { createEnvelope, canonicalizePayload } from '../../domain/envelope/envelope';
import { createLead } from '../../domain/lead/lead';
import { contentDigester } from '../../ports/content-digester-runtime';
import type { ContentDigest } from '../../ports/content-digester';
import type { AuthContext } from '../../ports/auth';
import { SourceIntegrationError, type SourceConnection, type SourceEvidence, type SourceEvidencePageOptions, type SourceIntegrationStore, type SourceObservation, type SourceReceipt, type SourceConversationPage } from '../../ports/source-observation';
import { encodeEvidenceCursor, evidencePageRequest } from './evidence-cursor';
import { PostgresService, type SqlExecutor } from '../postgres/postgres.service';
import { toEnvelope, type EnvelopeDbRow } from '../postgres/repositories/pilot-persistence.types';

type ConnectionRow = {id:string;workspace_id:string;provider:SourceConnection['provider'];route:SourceConnection['route'];page_id:string;status:SourceConnection['status']};
type ReceiptRow = {id:string;connection_id:string;receipt_id:string;lead_id:string|null;envelope_id:string|null;disposition:Exclude<SourceReceipt['disposition'],'receipt_duplicate'>;quarantine_reason:SourceReceipt['quarantineReason'];observation:Omit<SourceObservation,'rawPayload'>;receipt_digest:ContentDigest;event_id:string|null;revision:string|null};
const connection = (r:ConnectionRow):SourceConnection => ({id:r.id,workspaceId:r.workspace_id,provider:r.provider,route:r.route,pageId:r.page_id,status:r.status,health:'SYNTHETIC_ONLY'});
const receipt = (r:ReceiptRow, duplicate=false):SourceReceipt => ({receiptId:r.receipt_id,connectionId:r.connection_id,leadId:r.lead_id,envelopeId:r.envelope_id,disposition:duplicate?'receipt_duplicate':r.disposition,quarantineReason:r.quarantine_reason,verification:'UNVERIFIED',completeness:'UNKNOWN'});
const fail = (code:string,status=409):never=>{throw new SourceIntegrationError(code,status);};
const uuid = (value:string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function audit(tx:SqlExecutor,ctx:AuthContext,id:string,event:string,value:unknown) {
  await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value) VALUES('source-integration',$1,$2,$3,$4,$5::jsonb)`,[id,ctx.workspaceId,ctx.userId,event,JSON.stringify(value)]);
}
/** One existing PostgreSQL transaction boundary for accepted raw evidence, lead seed and receipts. */
export class PgSourceIntegrationStore implements SourceIntegrationStore {
  constructor(private readonly db:PostgresService) {}
  async getConnection(workspaceId:string,id:string):Promise<SourceConnection|null> {
    if(!uuid(id))return null;
    const row=(await this.db.query<ConnectionRow>('SELECT * FROM source_connection WHERE workspace_id=$1 AND id=$2::uuid',[workspaceId,id])).rows[0];
    return row?connection(row):null;
  }
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
    const rows=await this.db.query<ConnectionRow & {receipt_count:number;quarantine_count:number;last_receipt_at:Date|string|null}>(`
      WITH page AS MATERIALIZED (SELECT * FROM source_connection WHERE workspace_id=$1 ORDER BY created_at,id LIMIT 100)
      SELECT c.*,r.* FROM page c CROSS JOIN LATERAL (
        SELECT count(*)::int AS receipt_count,count(*) FILTER(WHERE quarantine_reason IS NOT NULL)::int AS quarantine_count,
          max(created_at) AS last_receipt_at FROM source_receipt WHERE workspace_id=c.workspace_id AND connection_id=c.id
      ) r ORDER BY c.created_at,c.id`,[workspaceId]);
    return rows.rows.map(r=>({...connection(r),delivery:{receiptCount:r.receipt_count,quarantineCount:r.quarantine_count,
      lastReceiptAt:r.last_receipt_at===null?null:new Date(r.last_receipt_at).toISOString()}}));
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
        if(n.eventId!==null) {
          await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['source-event',ctx.workspaceId,n.system,n.pageId,n.eventId,n.revision])]);
          const events=await tx.query(`SELECT 1 FROM source_receipt WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND event_id=$4
            AND revision IS NOT DISTINCT FROM $5 AND message_id IS DISTINCT FROM $6 LIMIT 1`,[ctx.workspaceId,n.system,n.pageId,n.eventId,n.revision,n.messageId]);
          if(events.rows.length)return fail('NATIVE_EVENT_COLLISION');
        }
        await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(['source-message',...args])]);
        if(n.conversationId!==null) {
          const conflict=await tx.query(`SELECT 1 FROM source_receipt WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND message_id=$4
            AND conversation_id IS NOT NULL AND conversation_id<>$5 LIMIT 1`,[...args,n.conversationId]);
          if(conflict.rows.length)return fail('NATIVE_OBJECT_COLLISION');
        }
        // Same explicit event/revision means immutable observation identity, never a text identity merge.
        const sameEvent=n.eventId===null?undefined:(await tx.query<ReceiptRow>(`SELECT * FROM source_receipt WHERE workspace_id=$1 AND native_system=$2 AND page_id=$3 AND message_id=$4
          AND event_id=$5 AND revision IS NOT DISTINCT FROM $6 ORDER BY created_at,id LIMIT 1`,[...args,n.eventId,n.revision])).rows[0];
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
  async evidencePage(workspaceId:string,leadId:string,actorId:string,options:SourceEvidencePageOptions={}) {
    const {limit,position}=evidencePageRequest(workspaceId,leadId,options);
    if(!uuid(leadId))return fail('INPUT_INVALID',400);
    return this.db.withTransaction(async tx=>{
      const rows=await tx.query<ReceiptRow & {envelope:EnvelopeDbRow;cursor_time:string}>(`SELECT r.*,to_jsonb(e) AS envelope,
        to_char(r.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_time
        FROM source_receipt r JOIN commercial_envelope e ON e.id=r.envelope_id AND e.workspace_id=r.workspace_id
        WHERE r.workspace_id=$1 AND r.lead_id=$2::uuid
        ${position?'AND (r.created_at,r.id)>($3::timestamptz,$4::uuid)':''}
        ORDER BY r.created_at,r.id LIMIT $${position?5:3}`,
        position?[workspaceId,leadId,position.time,position.id,limit+1]:[workspaceId,leadId,limit+1]);
      const selected=rows.rows.slice(0,limit),last=selected.at(-1);
      await audit(tx,{workspaceId,userId:actorId,role:'viewer',isDemo:false},leadId,'source.evidence.accessed',{count:selected.length});
      return {items:selected.map(r=>({receipt:receipt(r),observation:r.observation,envelope:toEnvelope(r.envelope)})),
        nextCursor:rows.rows.length>limit && last?encodeEvidenceCursor(workspaceId,leadId,{time:last.cursor_time,id:last.id}):null};
    });
  }
  async conversationPage(workspaceId:string,actorId:string,options:SourceEvidencePageOptions & {conversationId?:string;pageId?:string;actorRole?:AuthContext['role']}={}):Promise<SourceConversationPage> {
    const limit=Math.min(Math.max(options.limit??20,1),100);
    const actorRole=options.actorRole;
    if(!actorRole || !['admin','manager','sales','viewer'].includes(actorRole)) return fail('FORBIDDEN',403);
    const cursorScope=JSON.stringify([workspaceId,actorId,actorRole,options.conversationId??null,options.pageId??null]);
    let position:null|{time:string;id:string}=null;
    if(options.cursor){try{const parsed=JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8'));if(parsed.scope!==cursorScope||typeof parsed.time!=='string'||typeof parsed.id!=='string')return fail('INPUT_INVALID',400);position=parsed;}catch{return fail('INPUT_INVALID',400);}}
    const args:any[]=[workspaceId,actorRole,actorId],where=['r.workspace_id=$1','r.conversation_id IS NOT NULL',`($2 IN ('admin','manager') OR l.owner_user_id=$3 OR EXISTS (SELECT 1 FROM pilot_work_item aw WHERE aw.workspace_id=r.workspace_id AND aw.lead_id=l.id AND aw.actor=$3 AND aw.status IN ('proposed','accepted','open','awaiting-external')))`];
    if(options.conversationId){args.push(options.conversationId);where.push(`r.conversation_id=$${args.length}`);}
    if(options.pageId){args.push(options.pageId);where.push(`r.page_id=$${args.length}`);}
    const baseWhere=where.join(' AND ');const cursorWhere=position?`AND (k.sort_time,k.sort_id)>($${args.length+1}::timestamptz,$${args.length+2}::uuid)`:'';
    if(position)args.push(position.time,position.id);
    const conversationLimitParam=args.length+1;args.push(limit+1);
    const messageHistoryLimit=100;
    const messageLimitParam=args.length+1;args.push(messageHistoryLimit+1);
    const rows=await this.db.query<any>(`WITH keys AS (SELECT r.workspace_id,r.connection_id,r.native_system,r.page_id,r.conversation_id,min(r.created_at) sort_time,min(r.id::text)::uuid sort_id FROM source_receipt r JOIN source_connection c ON c.workspace_id=r.workspace_id AND c.id=r.connection_id AND c.status='active' LEFT JOIN LATERAL (SELECT effective_lead_id,action FROM source_episode_link sl0 WHERE sl0.workspace_id=r.workspace_id AND sl0.connection_id=r.connection_id AND sl0.receipt_id=r.receipt_id ORDER BY sl0.version DESC LIMIT 1) sl ON TRUE LEFT JOIN lead l ON l.workspace_id=r.workspace_id AND l.id=CASE WHEN sl.action='link' THEN sl.effective_lead_id ELSE r.lead_id END WHERE ${baseWhere} GROUP BY r.workspace_id,r.connection_id,r.native_system,r.page_id,r.conversation_id), selected AS (SELECT * FROM keys k WHERE TRUE ${cursorWhere} ORDER BY k.sort_time,k.sort_id LIMIT $${conversationLimitParam}), ranked AS (SELECT k.sort_time,k.sort_id,to_char(k.sort_time AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS sort_time_cursor,r.id,r.receipt_id,r.connection_id,r.native_system,r.page_id,r.conversation_id,r.message_id,r.created_at,ROW_NUMBER() OVER (PARTITION BY r.workspace_id,r.connection_id,r.native_system,r.page_id,r.conversation_id ORDER BY r.created_at,r.id) AS message_rank,COALESCE(e.raw_payload->>'utterance',NULL) utterance,COALESCE(e.raw_payload->>'speaker','unknown') speaker FROM selected k JOIN source_receipt r ON r.workspace_id=k.workspace_id AND r.connection_id=k.connection_id AND r.native_system IS NOT DISTINCT FROM k.native_system AND r.page_id IS NOT DISTINCT FROM k.page_id AND r.conversation_id=k.conversation_id LEFT JOIN LATERAL (SELECT effective_lead_id,action FROM source_episode_link sl1 WHERE sl1.workspace_id=r.workspace_id AND sl1.connection_id=r.connection_id AND sl1.receipt_id=r.receipt_id ORDER BY sl1.version DESC LIMIT 1) sl1 ON TRUE LEFT JOIN lead l ON l.workspace_id=r.workspace_id AND l.id=CASE WHEN sl1.action='link' THEN sl1.effective_lead_id ELSE r.lead_id END LEFT JOIN commercial_envelope e ON e.id=r.envelope_id AND e.workspace_id=r.workspace_id WHERE ($2 IN ('admin','manager') OR l.owner_user_id=$3 OR EXISTS (SELECT 1 FROM pilot_work_item aw WHERE aw.workspace_id=r.workspace_id AND aw.lead_id=l.id AND aw.actor=$3 AND aw.status IN ('proposed','accepted','open','awaiting-external'))) ) SELECT * FROM ranked WHERE message_rank <= $${messageLimitParam} ORDER BY sort_time,sort_id,created_at,id`,args);
    const grouped=new Map<string,any>();for(const row of rows.rows){const id=String(row.conversation_id),connectionId=String(row.connection_id),canonicalId=JSON.stringify([workspaceId,connectionId,row.native_system??null,row.page_id??null,id]);let group=grouped.get(canonicalId);if(!group){group={_sortTime:String(row.sort_time_cursor),_sortId:String(row.sort_id),canonicalId,conversationId:id,connectionId,pageId:row.page_id??null,provider:row.native_system==='pancake'?'pancake':row.native_system==='meta'?'meta-page':null,messages:[],_messageHistoryTruncated:false};grouped.set(canonicalId,group);}if(Number(row.message_rank)>messageHistoryLimit){group._messageHistoryTruncated=true;}else{group.messages.push({messageId:row.message_id??null,conversationId:id,pageId:row.page_id??null,observedAt:new Date(row.created_at).toISOString(),utterance:row.utterance??null,speaker:row.speaker,receiptId:row.receipt_id,verification:'UNVERIFIED',completeness:'UNKNOWN'});}}
    const groups=[...grouped.values()],visible=groups.slice(0,limit),cursorGroup=visible.at(-1);
    // Resolve only currently authorized Lead associations for the visible conversations.
    // The query applies the same workspace, active-connection and Lead policy before
    // returning identifiers, so inaccessible origin/effective Leads never reach the UI.
    for (const group of visible) {
      const assoc=await this.db.query<{lead_id:string;display_name:string;status:string}>(`WITH latest AS (
        SELECT DISTINCT ON (workspace_id,connection_id,receipt_id) workspace_id,connection_id,receipt_id,effective_lead_id,action
        FROM source_episode_link WHERE workspace_id=$1 ORDER BY workspace_id,connection_id,receipt_id,version DESC
      ) SELECT DISTINCT ON (l.id) l.id::text AS lead_id,l.display_name,l.status
        FROM source_receipt r JOIN source_connection c ON c.workspace_id=r.workspace_id AND c.id=r.connection_id AND c.status='active'
        LEFT JOIN latest sl ON sl.workspace_id=r.workspace_id AND sl.connection_id=r.connection_id AND sl.receipt_id=r.receipt_id
        JOIN lead l ON l.workspace_id=r.workspace_id AND l.id=COALESCE(sl.effective_lead_id,r.lead_id)
        WHERE r.workspace_id=$1 AND r.connection_id=$2::uuid AND r.conversation_id=$3
          AND r.native_system IS NOT DISTINCT FROM $4 AND r.page_id IS NOT DISTINCT FROM $5
          AND COALESCE(sl.action,'link')<>'reject'
          AND ($6 IN ('admin','manager') OR l.owner_user_id=$7 OR EXISTS (
            SELECT 1 FROM pilot_work_item aw WHERE aw.workspace_id=r.workspace_id AND aw.lead_id=l.id AND aw.actor=$7
              AND aw.status IN ('proposed','accepted','open','awaiting-external')))
      ORDER BY l.id,l.display_name`,[workspaceId,group.connectionId,group.conversationId,group.provider==='pancake'?'pancake':group.provider==='meta-page'?'meta':null,group.pageId,actorRole,actorId]);
      const associatedLeads=assoc.rows.map(row=>({leadId:row.lead_id,displayName:row.display_name,status:row.status}));
      group.associatedLeads=associatedLeads;
      group.associationState=associatedLeads.length?'known':'none';
    }
    return {items:visible.map(group=>{const {_sortTime,_sortId,_messageHistoryTruncated,...publicGroup}=group;return {...publicGroup,messageHistoryLimit,messageHistoryTruncated:Boolean(_messageHistoryTruncated),completeness:'UNKNOWN',verification:'UNVERIFIED'}}),nextCursor:groups.length>limit&&cursorGroup?Buffer.from(JSON.stringify({scope:cursorScope,time:cursorGroup._sortTime,id:cursorGroup._sortId})).toString('base64url'):null};
  }
}
