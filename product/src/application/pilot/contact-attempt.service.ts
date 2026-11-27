import { randomUUID } from 'node:crypto';
import type { AuthContext } from '../../ports/auth';
import type { LeadAccessPolicy } from '../../ports/rbac';
import type { PilotLoopStore } from '../../ports/pilot-loop.store';
import type { ContentDigester } from '../../ports/content-digester';
import type { ContactAttemptInput,ContactAttemptStore,ContactAttemptReceipt } from '../../ports/contact-attempt';
import { PilotDomainError,PilotStaleVersionError } from '../../ports/pilot-loop.types';
import { requirePilotLeadAccess } from './lead-access';
import { requireOwner } from './work-mutation-policy';
/** ADR-005: human claims only. OPEN: CE-1 ? no state transition or implicit next action. */
export class ContactAttemptService {
 constructor(private readonly store:PilotLoopStore,private readonly policy:LeadAccessPolicy,
 private readonly digester:ContentDigester,private readonly attempts:ContactAttemptStore){}
 private async view(ctx:AuthContext,id:string){const s=await this.store.load(id);requirePilotLeadAccess(ctx,s,this.policy);return s!;}
 async list(ctx:AuthContext,id:string,limit=50,after?:string){
  const s=await this.view(ctx,id);const rows=await this.attempts.list(ctx.workspaceId,id,limit+1,after);
  const items=rows.slice(0,limit);
  return {version:s.version,isSynthetic:s.envelope?.isSynthetic??null,items,...(rows.length>limit?{nextCursor:items.at(-1)!.id}:{}),truth:{
   conversationSource:s.envelope?{status:'recorded',value:s.envelope.connection,reason:'Accepted source envelope connection; does not establish acquisition origin.'}:{status:'unknown',value:null,reason:'No accepted conversation source envelope.'},
   acquisitionLineage:s.lead.acquisitionLineage&&!['unknown','not_applicable','not_observed','not_requested','redacted'].includes(s.lead.acquisitionLineage.toLowerCase())?{status:'recorded',value:s.lead.acquisitionLineage,reason:'Separately recorded acquisition lineage.'}:{status:'unknown',value:null,reason:'No independently established acquisition linkage.'},
   revenueAttribution:{status:'unknown',value:null,reason:'ADR-008: revenue attribution remains UNKNOWN in LVP; contact and Won claims do not establish revenue credit.'}}};
 }
 async record(ctx:AuthContext,id:string,input:ContactAttemptInput){
  const s=await this.view(ctx,id);
  if(ctx.isDemo||ctx.role==='viewer')throw new PilotDomainError('LEAD_ACCESS_DENIED',403,'forbidden');
  requireOwner(s,ctx.userId,'record contact attempt');
  const content=JSON.stringify(Object.keys(input).sort().map(k=>[k,input[k as keyof ContactAttemptInput]]));
  const replay=(r:ContactAttemptReceipt)=>{if(r.actor!==ctx.userId||this.digester.matches(ctx.workspaceId,'command',content,r.digest)!==true)throw new PilotDomainError('IDEMPOTENCY_CONFLICT',409,'idempotency key already used');return {attemptId:r.attemptId,version:r.version};};
  const prior=await this.attempts.receipt(ctx.workspaceId,id,input.idempotencyKey);if(prior)return replay(prior);
  if(s.closureCommands?.some(c=>c.idempotencyKey===input.idempotencyKey))throw new PilotDomainError('IDEMPOTENCY_CONFLICT',409,'idempotency key already used');
  if(s.version!==input.expectedVersion)throw new PilotStaleVersionError(id,input.expectedVersion,s.version??0);
  if(input.evidenceRef){const e=await this.store.loadEvidence(input.evidenceRef);
   if(!e)throw new PilotDomainError('EVIDENCE_NOT_FOUND',422,'evidence not found');
   if(e.workspaceId!==ctx.workspaceId||typeof e.isSynthetic!=='boolean'||e.isSynthetic!==s.envelope?.isSynthetic)throw new PilotDomainError('EVIDENCE_OUT_OF_SCOPE',403,'evidence scope/classification mismatch');
   if(input.evidenceRef!==s.sourceEnvelopeId&&!s.handoff?.evidenceRefs.some(r=>r.envelopeId===input.evidenceRef)&&!s.workItems.some(w=>w.evidenceRef===input.evidenceRef))throw new PilotDomainError('EVIDENCE_NOT_RELATED',422,'evidence is not related to this lead');
  }
  const {expectedVersion:_version,idempotencyKey:_key,...claim}=input;
  try {const r=await this.attempts.append({...claim,id:randomUUID(),leadId:id,workspaceId:ctx.workspaceId,actor:ctx.userId,recordedAt:new Date().toISOString(),acquisitionMode:'claimed',assertionStatus:'claimed'},input,this.digester.digest(ctx.workspaceId,'command',content));return replay(r);}
  catch(e){if(e instanceof PilotStaleVersionError){const winner=await this.attempts.receipt(ctx.workspaceId,id,input.idempotencyKey);if(winner)return replay(winner);}throw e;}
 }
}
