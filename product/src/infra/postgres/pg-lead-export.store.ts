import type { LeadExport, LeadExportStore } from '../../ports/lead-export';
import { LeadExportError } from '../../ports/lead-export';
import type { TransactionRunner } from './migrator';
/** Bounded, consistent snapshot. Audit failure aborts export. No export artifact is retained. */
export class PgLeadExportStore implements LeadExportStore {
  constructor(private readonly db:TransactionRunner){}
  async exportLead(workspaceId:string,leadId:string,actorId:string):Promise<LeadExport|undefined>{
    return this.db.withTransaction(async tx=>{
      await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      const lead=await tx.query<Record<string,unknown>>('SELECT * FROM lead WHERE workspace_id=$1 AND id=$2',[workspaceId,leadId]);
      if(!lead.rows[0])return undefined;
      const records:Record<string,Record<string,unknown>[]>={lead:lead.rows};
      // Fixed SQL identifiers only. Every child query includes both lead and workspace scopes.
      for(const table of ['handoff','pilot_work_item','outcome','commercial_event','feedback']){
        const r=await tx.query<Record<string,unknown>>(`SELECT * FROM ${table} WHERE workspace_id=$1 AND lead_id=$2::uuid LIMIT 1001`,[workspaceId,leadId]);
        records[table]=r.rows;
      }
      const audits=await tx.query<Record<string,unknown>>(`SELECT * FROM audit_record WHERE workspace_id=$1 AND
        ((entity_type='lead' AND entity_id=$2) OR (entity_type='handoff' AND entity_id IN (SELECT id::text FROM handoff WHERE workspace_id=$1 AND lead_id=$2::uuid))
        OR (entity_type='outcome' AND entity_id IN (SELECT id::text FROM outcome WHERE workspace_id=$1 AND lead_id=$2::uuid))
        OR (entity_type='commercial-event' AND entity_id IN (SELECT id::text FROM commercial_event WHERE workspace_id=$1 AND lead_id=$2::uuid))) LIMIT 1001`,[workspaceId,leadId]);
      records.audit_record=audits.rows;
      const evidence=await tx.query<Record<string,unknown>>(`SELECT e.* FROM commercial_envelope e JOIN pilot_ingest_command c ON c.envelope_id=e.id
        WHERE e.workspace_id=$1 AND c.lead_id=$2::uuid LIMIT 1001`,[workspaceId,leadId]);
      records.commercial_envelope=evidence.rows;
      records.assertion_envelope=(await tx.query<Record<string,unknown>>(`SELECT * FROM assertion_envelope
        WHERE workspace_id=$1 AND subject_type='lead' AND subject_id=$2 LIMIT 1001`,[workspaceId,leadId])).rows;
      for(const table of ['pilot_context_revision','pilot_closure_command']){
        const exists=await tx.query<{name:string|null}>('SELECT to_regclass($1)::text AS name',[table]);
        if(exists.rows[0].name)records[table]=(await tx.query<Record<string,unknown>>(`SELECT * FROM ${table} WHERE workspace_id=$1 AND lead_id=$2::uuid LIMIT 1001`,[workspaceId,leadId])).rows;
      }
      if(Object.values(records).some(rows=>rows.length>1000)||Buffer.byteLength(JSON.stringify(records),'utf8')>5_000_000)throw new LeadExportError('EXPORT_TOO_LARGE',413);
      const synthetic=typeof evidence.rows[0]?.is_synthetic==='boolean'?evidence.rows[0].is_synthetic:'unknown';
      await tx.query(`INSERT INTO audit_record(entity_type,entity_id,workspace_id,actor,new_value,event_type,reason)
        VALUES ('lead',$1,$2,$3,$4::jsonb,'LEAD_DATA_EXPORTED','admin single-lead export')`,
      [leadId,workspaceId,actorId,JSON.stringify({schemaVersion:1,scope:'single-lead-pilot-records',tables:Object.keys(records),synthetic})]);
      return {schemaVersion:1,scope:'single-lead-pilot-records',exportedAt:new Date().toISOString(),workspaceId,leadId,synthetic,records,
        exclusions:['customer records (separate identity entity)','workspace membership and credentials','unlinked raw research frames','workspace-level telemetry','governed-action foundation records']};
    });
  }
}

