import type { AuthContext } from '../../ports/auth';
import type { ManagerExceptionsReader, ManagerExceptionsQuery, ManagerExceptionRow, ManagerExceptionItem, ManagerObservation } from '../../ports/manager-exceptions';
import { PilotDomainError } from '../../ports/pilot-loop.types';

export function projectManagerException(row: ManagerExceptionRow, now: number): ManagerExceptionItem {
 const observations: ManagerObservation[] = [];
 if(row.ownerMissing) observations.push('owner_unassigned');
 if(row.awaitingSince) observations.push('awaiting_acceptance');
 if(row.recipientState==='inactive') observations.push('recipient_inactive');
 if(row.recipientState==='unknown') observations.push('recipient_unknown');
 if(row.overdue) observations.push('overdue_open_work');
 if(row.claimedWithOpen) observations.push('claimed_outcome_with_open_work');
 if(row.evidenceMissing) observations.push('source_evidence_missing');
 if(row.contextUnknown) observations.push('context_unknown');
 if(row.sourceUnknown) observations.push('source_unknown');
 return {leadId:row.leadId,displayName:row.displayName,version:row.version,classification:row.classification,observations,
 ...(row.awaitingSince ? {awaitingSince:row.awaitingSince,awaitingAgeSeconds:Math.max(0,Math.floor((now-Date.parse(row.awaitingSince))/1000))}: {})};
}
/** ADR-006 supervisory workspace read; ADR-007 bounded LVP observations, no mutation or SLA inference. */
export class ManagerExceptionsService {
 constructor(private readonly reader: ManagerExceptionsReader, private readonly clock: ()=>number = Date.now) {}
 async list(ctx: AuthContext, query: Omit<ManagerExceptionsQuery,'workspaceId'>) {
  if(ctx.isDemo || !['manager','admin'].includes(ctx.role)) throw new PilotDomainError('LEAD_ACCESS_DENIED',403,'forbidden');
  if(!Number.isInteger(query.limit)||query.limit<1||query.limit>100||!['real','synthetic','unknown','all'].includes(query.classification))
   throw new PilotDomainError('INPUT_INVALID',400,'invalid query');
  const now=this.clock(), rows=await this.reader.scan({...query,workspaceId:ctx.workspaceId});
  const scanned=rows.slice(0,query.limit), hasMore=rows.length>query.limit;
  return {asOf:new Date(now).toISOString(),classification:query.classification,scannedLeads:scanned.length,hasMore,
   ...(hasMore?{nextAfter:scanned.at(-1)!.leadId}:{}),items:scanned.map(r=>projectManagerException(r,now)).filter(r=>r.observations.length),
   scope:'bounded_page' as const};
 }
}
