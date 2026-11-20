import type {AuthContext} from '../../ports/auth';
import type {ContentDigester} from '../../ports/content-digester';
import {SourceIntegrationError} from '../../ports/source-observation';
import type {SourceEpisodeLinkInput,SourceEpisodeLinkStore,SourceLinkAuthorization} from '../../ports/source-episode-link';
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
/** I-06/07: explicit evidence-context associations only; OPEN: ID-1, no identity merge. */
export class SourceContinuityService {
 constructor(private readonly store:SourceEpisodeLinkStore,private readonly authorizeMutation:SourceLinkAuthorization,
 private readonly authorizeRead:SourceLinkAuthorization,private readonly digester:ContentDigester,private readonly enabled=false){}
 private gate(ctx:AuthContext){
  if(!this.enabled)throw new SourceIntegrationError('SOURCE_INTEGRATION_DISABLED',404);
  if(!ctx?.userId||!ctx.workspaceId)throw new SourceIntegrationError('UNAUTHORIZED',401);
  if(ctx.isDemo)throw new SourceIntegrationError('FORBIDDEN',403);
 }
 async command(ctx:AuthContext,leadId:string,value:unknown){
  this.gate(ctx);
  if(ctx.role!=='admin')throw new SourceIntegrationError('FORBIDDEN',403);
  if(!uuid(leadId)||!value||typeof value!=='object'||Array.isArray(value))throw new SourceIntegrationError('INPUT_INVALID',400);
  const v=value as SourceEpisodeLinkInput;
  if(Object.keys(v).sort().join()!=='action,connectionId,evidenceEnvelopeId,expectedVersion,idempotencyKey,reason,receiptId'||
   !uuid(v.connectionId)||!uuid(v.evidenceEnvelopeId)||!Number.isSafeInteger(v.expectedVersion)||v.expectedVersion<0||
   !['link','unlink','reject'].includes(v.action)||!text(v.receiptId,256)||!text(v.idempotencyKey,128)||!text(v.reason,2000))throw new SourceIntegrationError('INPUT_INVALID',400);
  await this.authorizeMutation(ctx,leadId);
  const content=JSON.stringify(['source-episode-link',leadId,v.connectionId,v.receiptId,v.evidenceEnvelopeId,v.expectedVersion,v.idempotencyKey,v.action,v.reason]);
  return this.store.command(ctx,leadId,v,content,this.digester,this.authorizeMutation);
 }
 async list(ctx:AuthContext,leadId:string){
  this.gate(ctx);await this.authorizeRead(ctx,leadId);
  const rows=await this.store.list(ctx.workspaceId,leadId),items=[];
  for(const row of rows){
   if(await this.canRead(ctx,[row.originLeadId,row.effectiveLeadId]))items.push(row);
  }
  return {items,limit:100,possiblyTruncated:items.length===100,completeness:'UNKNOWN' as const,verification:'UNVERIFIED' as const};
 }
 async linkedReceipts(ctx:AuthContext,leadId:string){
  this.gate(ctx);await this.authorizeRead(ctx,leadId);
  const rows=await this.store.linkedReceipts(ctx.workspaceId,leadId),items=[];
  for(const row of rows)if(await this.canRead(ctx,[row.originLeadId])){
   const {originLeadId:_origin,...pointer}=row;items.push(pointer);
  }
  return items;
 }
 private async canRead(ctx:AuthContext,ids:readonly (string|null)[]){
  try{for(const id of new Set(ids))if(id)await this.authorizeRead(ctx,id);return true;}
  catch{return false;}// No inaccessible source ids or counts are exposed; completeness remains UNKNOWN.
 }
}
function text(v:unknown,max:number):v is string{return typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);}
