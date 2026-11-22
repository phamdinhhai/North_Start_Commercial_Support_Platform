import type { ContactAttempt,ContactAttemptInput,ContactAttemptReceipt,ContactAttemptStore } from '../../ports/contact-attempt';
import type { ContentDigest } from '../../ports/content-digester';
import { PilotDomainError,PilotStaleVersionError } from '../../ports/pilot-loop.types';
import type { TransactionRunner } from './migrator';
import type { SqlExecutor } from './postgres.service';
export class PgContactAttemptStore implements ContactAttemptStore {
 constructor(private readonly db:TransactionRunner&SqlExecutor){}
 async list(workspaceId:string,leadId:string,limit:number,after?:string){
  const r=await this.db.query<{record:ContactAttempt}>(`SELECT jsonb_build_object('id',id,'leadId',lead_id,'workspaceId',workspace_id,'actor',actor,'recordedAt',recorded_at,'occurredAt',occurred_at,'channel',channel,'claimedResult',claimed_result,'evidenceRef',evidence_ref,'followUpImplication',follow_up_implication,'reason',reason,'acquisitionMode',acquisition_mode,'assertionStatus',assertion_status) AS record
  FROM pilot_contact_attempt WHERE workspace_id=$1 AND lead_id=$2 AND ($3::uuid IS NULL OR (recorded_at,id)>
    (SELECT recorded_at,id FROM pilot_contact_attempt WHERE workspace_id=$1 AND lead_id=$2 AND id=$3::uuid))
  ORDER BY recorded_at,id LIMIT $4`,[workspaceId,leadId,after??null,limit]);return r.rows.map(x=>x.record);
 }
 async receipt(workspaceId:string,leadId:string,key:string){
  const r=await this.db.query<{actor:string;digest:ContentDigest;result:{attemptId:string;version:number}}>(`SELECT actor,digest,result FROM pilot_closure_command WHERE workspace_id=$1 AND lead_id=$2 AND idempotency_key=$3 AND operation='contact-attempt'`,[workspaceId,leadId,key]);const row=r.rows[0];return row?{actor:row.actor,digest:row.digest,...row.result}:undefined;
 }
 async append(a:ContactAttempt,input:ContactAttemptInput,digest:ContentDigest):Promise<ContactAttemptReceipt>{return this.db.withTransaction(async tx=>{
  const lock=await tx.query<{version:number;owner_user_id:string}>(`SELECT version,owner_user_id FROM lead WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,[a.leadId,a.workspaceId]);
  const lead=lock.rows[0];if(!lead)throw new PilotDomainError('LEAD_NOT_FOUND',404,'lead not found');
  if(lead.owner_user_id!==a.actor)throw new PilotDomainError('NOT_OWNER',403,'only current lead owner may record contact');
  if(lead.version!==input.expectedVersion)throw new PilotStaleVersionError(a.leadId,input.expectedVersion,lead.version);
  const prior=await tx.query('SELECT 1 FROM pilot_closure_command WHERE workspace_id=$1 AND lead_id=$2 AND idempotency_key=$3',[a.workspaceId,a.leadId,input.idempotencyKey]);
  if(prior.rows.length)throw new PilotDomainError('IDEMPOTENCY_CONFLICT',409,'idempotency key already used');
  const receipt={actor:a.actor,digest,attemptId:a.id,version:input.expectedVersion+1};
  await tx.query(`INSERT INTO pilot_contact_attempt(id,lead_id,workspace_id,actor,recorded_at,occurred_at,channel,claimed_result,evidence_ref,follow_up_implication,reason,acquisition_mode,assertion_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'claimed','claimed')`,[a.id,a.leadId,a.workspaceId,a.actor,a.recordedAt,a.occurredAt,a.channel,a.claimedResult,a.evidenceRef??null,a.followUpImplication,a.reason]);
  await tx.query(`UPDATE lead SET version=version+1 WHERE id=$1 AND workspace_id=$2`,[a.leadId,a.workspaceId]);
  await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value,reason) VALUES('lead',$1,$2,$3,'contact_attempt_recorded',$4::jsonb,'manual contact claim appended')`,[a.leadId,a.workspaceId,a.actor,JSON.stringify({attemptId:a.id,assertionStatus:'claimed',version:receipt.version})]);
  await tx.query(`INSERT INTO pilot_closure_command(workspace_id,lead_id,idempotency_key,actor,operation,digest,result) VALUES($1,$2,$3,$4,'contact-attempt',$5::jsonb,$6::jsonb)`,[a.workspaceId,a.leadId,input.idempotencyKey,a.actor,JSON.stringify(digest),JSON.stringify({attemptId:a.id,version:receipt.version})]);
  return receipt;
 });}
}
