import { randomUUID } from 'node:crypto';
import type { AuthContext } from '../../ports/auth';
import type { LeadAccessPolicy } from '../../ports/rbac';
import type { PilotLoopStore } from '../../ports/pilot-loop.store';
import type { ContentDigester } from '../../ports/content-digester';
import type { PilotAssigneeDirectory } from '../../ports/pilot-closure';
import { isSynthetic } from '../../ports/pilot-closure';
import { PilotDomainError, PilotStaleVersionError, type PilotLoopState, type AuditDraft } from '../../ports/pilot-loop.types';
import type { LeadId } from '../../domain/lead/lead';
import { requirePilotLeadAccess } from './lead-access';
import { requireOwner, requireWork } from './work-mutation-policy';
import { PilotLoopService } from './pilot-loop.service';

export interface ClosureInput { expectedVersion: number; idempotencyKey: string; [key: string]: unknown }
/** ADR-006 owner rules, I-05 append history; no new commercial state transitions. */
export class PilotClosureService {
  constructor(private readonly store: PilotLoopStore, private readonly policy: LeadAccessPolicy,
    private readonly digester: ContentDigester, private readonly directory?: PilotAssigneeDirectory) {}

  async view(ctx: AuthContext, leadId: string): Promise<PilotLoopState> {
    const state = await this.store.load(leadId);
    requirePilotLeadAccess(ctx, state, this.policy);
    return state!;
  }
  async leads(ctx: AuthContext, query: { classification?: 'real'|'synthetic'|'all'; limit?: number; after?: string; search?: string }) {
    return this.store.leads({...query,workspaceId:ctx.workspaceId,actorId:ctx.userId,actorRole:ctx.role});
  }
  async assignees(ctx: AuthContext) {
    if (ctx.isDemo || ctx.role === 'viewer') throw new PilotDomainError('LEAD_ACCESS_DENIED',403,'forbidden');
    return {items:(await this.directory?.list(ctx.workspaceId) ?? []).filter(m => ['admin','manager','sales'].includes(m.role)).slice(0,100)};
  }
  async context(ctx: AuthContext, leadId: string) {
    const s = await this.view(ctx,leadId);
    return {version:s.version,isSynthetic:isSynthetic(s),current:s.contextRevisions?.at(-1) ?? null,revisions:s.contextRevisions ?? []};
  }
  async timeline(ctx: AuthContext, leadId: string) {
    const s = await this.view(ctx,leadId);
    return {version:s.version,isSynthetic:isSynthetic(s),history:await this.store.history(leadId),contextRevisions:s.contextRevisions ?? [],workItems:s.workItems,outcomes:s.outcomes};
  }
  async evidence(ctx: AuthContext, leadId: string) {
    const s = await this.view(ctx,leadId);
    const e = s.envelope;
    const raw = e?.rawPayload && typeof e.rawPayload === 'object' ? e.rawPayload as Record<string,unknown> : {};
    const utterance = typeof raw.utterance === 'string' ? raw.utterance : '';
    const bounded = new TextDecoder().decode(Buffer.from(utterance,'utf8').subarray(0,16384),{stream:true});
    await this.store.appendAccess(leadId,ctx.userId);
    return {isSynthetic:isSynthetic(s),accessRecorded:true,items:e ? [{envelopeId:e.envelopeId,sourceCapturedAt:e.sourceCapturedAt,ingestedAt:e.ingestedAt,
      connection:e.connection,externalRecordId:e.externalRecordId,acquisitionMode:e.acquisitionMode,acquisitionSource:e.acquisitionSource,
      mappingStatus:e.mappingStatus,isSynthetic:e.isSynthetic,rawPayloadDigest:e.rawPayloadDigest,rawPayload:{utterance:bounded,speaker:raw.speaker === 'customer' || raw.speaker === 'staff' ? raw.speaker : null},truncated:bounded !== utterance}] : []};
  }

  private commandResult(state:PilotLoopState,result:Record<string,unknown>):Record<string,unknown>{
    if(typeof result.revisionId==='string')return {version:result.version,revision:state.contextRevisions?.find(r=>r.id===result.revisionId)};
    return result;
  }

  async execute(ctx: AuthContext, leadId: string, operation: string, input: ClosureInput, resourceId?: string): Promise<Record<string,unknown>> {
    const s = await this.view(ctx,leadId);
    if (ctx.isDemo || ctx.role === 'viewer') throw new PilotDomainError('LEAD_ACCESS_DENIED',403,'forbidden');
    if(operation !== 'accept') requireOwner(s,ctx.userId,operation);
    const content = JSON.stringify([operation,resourceId ?? null,Object.keys(input).sort().map(k => [k,input[k]])]);
    const prior = s.closureCommands?.find(c => c.idempotencyKey === input.idempotencyKey);
    if (prior) {
      if (prior.actor !== ctx.userId || prior.operation !== operation || this.digester.matches(ctx.workspaceId,'command',content,prior.digest) !== true)
        throw new PilotDomainError('IDEMPOTENCY_CONFLICT',409,'idempotency key already used');
      return this.commandResult(s,prior.result);
    }
    if (s.version !== input.expectedVersion) throw new PilotStaleVersionError(leadId,input.expectedVersion,s.version ?? 0);
    const digest = this.digester.digest(ctx.workspaceId,'command',content);
    let result: Record<string,unknown> = {};
    const save = async (next: PilotLoopState, audits: readonly AuditDraft[]) => {
      if (next.version !== input.expectedVersion) throw new PilotStaleVersionError(leadId,input.expectedVersion,next.version ?? 0);
      result = {version:input.expectedVersion + 1,...(operation === 'context' ? {revision:next.contextRevisions!.at(-1)}
        : operation === 'handoff' ? {workItemId:next.workItems.at(-1)?.id,leadStatus:next.lead.status,recipient:next.handoffRecipient}
        : operation === 'accept' ? {workItemId:input.workId,leadStatus:next.lead.status,owner:next.ownerUserId}
        : operation === 'advance' ? {leadStatus:next.lead.status}
        : operation === 'outcome' ? {outcomeId:next.outcomes.at(-1)?.id,leadStatus:next.lead.status,assertionStatus:next.outcomes.at(-1)?.assertionStatus}
        : operation === 'correct' ? {outcomeId:next.outcomes.at(-1)!.id,supersedesOutcomeId:resourceId}
        : {workItemId:operation === 'complete' ? resourceId : next.workItems.at(-1)!.id,...(resourceId && operation !== 'complete' ? {supersedesWorkId:resourceId} : {})})};
      try { return await this.store.save({...next,closureCommands:[...(s.closureCommands ?? []),{idempotencyKey:input.idempotencyKey,actor:ctx.userId,operation,digest,result:operation==='context'?{version:result.version,revisionId:next.contextRevisions!.at(-1)!.id}:result}]},audits); } catch(error) {
        if(error instanceof PilotStaleVersionError) {
          const current=await this.store.load(leadId);
          const winning=current?.closureCommands?.find(c=>c.idempotencyKey===input.idempotencyKey);
          if(winning && winning.actor===ctx.userId && winning.operation===operation && this.digester.matches(ctx.workspaceId,'command',content,winning.digest)===true) {result=this.commandResult(current!,winning.result);return current!;}
        }
        throw error;
      }
    };
    const delegated: PilotLoopStore = {load:async () => s,loadIngest:k => this.store.loadIngest(k),save,history:id => this.store.history(id),loadEvidence:id => this.store.loadEvidence(id),queue:q => this.store.queue(q),leads:q=>this.store.leads(q),appendAccess:(id,a)=>this.store.appendAccess(id,a)};
    const loop = new PilotLoopService(delegated,{ingest:()=>{throw new Error('intake is unavailable in closure commands');}});
    const reason = input.reason as string;
    if (operation === 'handoff') {
      const eligible = await this.directory?.list(ctx.workspaceId) ?? [];
      if (!eligible.some(m=>m.userId===input.recipientUserId && ['sales','manager','admin'].includes(m.role))) throw new PilotDomainError('INPUT_INVALID',400,'recipient must be an active eligible workspace member');
      await loop.handoffToSales(leadId as LeadId,{...input,actor:ctx.userId} as unknown as Parameters<PilotLoopService['handoffToSales']>[1]);
    } else if (operation === 'accept') {
      await loop.salesAccept(leadId as LeadId,{workId:input.workId as string,actor:ctx.userId,reason});
    } else if (operation === 'advance') {
      await loop.advance(leadId as LeadId,{to:input.to as 'Contacting'|'Follow-up',reason,actor:ctx.userId});
    } else if (operation === 'outcome') {
      await loop.recordOutcome(leadId as LeadId,{value:input.value as 'Won'|'Lost'|'Unknown',actor:ctx.userId,reason});
    } else if (operation === 'context') {
      const revision = {id:randomUUID(),text:input.text as string,actor:ctx.userId,recordedAt:new Date().toISOString(),reason};
      await save({...s,contextRevisions:[...(s.contextRevisions ?? []),revision]},[{entityType:'lead',entityId:leadId,workspaceId:ctx.workspaceId,actor:ctx.userId,eventType:'context_revised',newValue:JSON.stringify(revision),reason}]);
    } else if (operation === 'create' || operation === 'reopen') {
      const old = operation === 'reopen' ? requireWork(s,resourceId!) : undefined;
      if (old && (old.status !== 'completed' || old.actor !== ctx.userId || s.workItems.some(w => w.supersedesWorkId === old.id))) throw new PilotDomainError('WORK_ALREADY_CLOSED',409,'only an assigned completed item without successor can be reopened');
      const work = {id:randomUUID(),leadId:s.lead.id,workspaceId:ctx.workspaceId,action:old?.action ?? input.action as string,responsibleParty:old?.responsibleParty ?? 'internal' as const,origin:old?.origin ?? 'explicit-request' as const,status:'open' as const,completionEvidence:'absent' as const,occurredAt:'unknown',recordedAt:new Date().toISOString(),actor:ctx.userId,reason,...(input.dueAt ? {dueAt:input.dueAt as string} : {}),...(old ? {supersedesWorkId:old.id} : {})};
      await save({...s,workItems:[...s.workItems,work]},[{entityType:'commercial-event',entityId:work.id,workspaceId:ctx.workspaceId,actor:ctx.userId,eventType:old ? 'work_reopened' : 'work_created',newValue:JSON.stringify(work),reason}]);
    } else if (operation === 'complete') {
      await loop.completeWork(leadId as LeadId,{...input,workId:resourceId!,actor:ctx.userId} as unknown as Parameters<PilotLoopService['completeWork']>[1]);
    } else if (operation === 'reschedule') {
      await loop.rescheduleWork(leadId as LeadId,{workId:resourceId!,newDueAt:input.newDueAt as string,reason,actor:ctx.userId});
    } else if (operation === 'correct') {
      await loop.correctOutcomeRecord(leadId as LeadId,{outcomeId:resourceId!,newValue:input.value as 'Won'|'Lost'|'Unknown',reason,actor:ctx.userId});
    } else throw new PilotDomainError('INPUT_INVALID',400,'unknown operation');
    return result;
  }
}
