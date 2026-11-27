import type { LinkedSourceEvidenceReader } from '../../ports/linked-source-evidence';
import type { SourceEvidence,SourceReceipt,SourceObservation } from '../../ports/source-observation';
import { PostgresService } from '../postgres/postgres.service';
import { toEnvelope,type EnvelopeDbRow } from '../postgres/repositories/pilot-persistence.types';
export class PgLinkedSourceEvidenceReader implements LinkedSourceEvidenceReader {
  constructor(private readonly db:PostgresService){}
  async read(workspaceId:string,connectionId:string,receiptId:string,envelopeId:string,actorId:string):Promise<SourceEvidence|null>{
    return this.db.withTransaction(async tx=>{
      const row=(await tx.query<{connection_id:string;receipt_id:string;lead_id:string;envelope_id:string;disposition:SourceReceipt['disposition'];observation:Omit<SourceObservation,'rawPayload'>;envelope:EnvelopeDbRow}>(`
        SELECT r.*,to_jsonb(e) AS envelope FROM source_receipt r JOIN commercial_envelope e ON e.id=r.envelope_id AND e.workspace_id=r.workspace_id
        WHERE r.workspace_id=$1 AND r.connection_id=$2::uuid AND r.receipt_id=$3 AND r.envelope_id=$4::uuid`,[workspaceId,connectionId,receiptId,envelopeId])).rows[0];
      if(!row)return null;
      await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,event_type,new_value)
        VALUES('lead',$1,$2,$3,'source.linked-evidence.accessed',$4::jsonb)`,[row.lead_id,workspaceId,actorId,JSON.stringify({envelopeId:row.envelope_id})]);
      return {observation:row.observation,envelope:toEnvelope(row.envelope),receipt:{connectionId:row.connection_id,receiptId:row.receipt_id,leadId:row.lead_id,envelopeId:row.envelope_id,disposition:row.disposition,quarantineReason:null,verification:'UNVERIFIED',completeness:'UNKNOWN'}};
    });
  }
}
