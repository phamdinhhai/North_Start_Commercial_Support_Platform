import type { ContactAttempt,ContactAttemptStore,ContactAttemptInput,ContactAttemptReceipt } from '../../ports/contact-attempt';
import type { PilotLoopStore } from '../../ports/pilot-loop.store';
import type { ContentDigest } from '../../ports/content-digester';
import { PilotDomainError,PilotStaleVersionError } from '../../ports/pilot-loop.types';
/** Explicit local/test adapter; production uses PostgreSQL. */
export class InMemoryContactAttemptStore implements ContactAttemptStore {
 private readonly attempts:ContactAttempt[]=[];
 private readonly receipts=new Map<string,ContactAttemptReceipt>();
 constructor(private readonly store:PilotLoopStore){}
 private key(w:string,l:string,k:string){return JSON.stringify([w,l,k]);}
 async receipt(w:string,l:string,k:string){return this.receipts.get(this.key(w,l,k));}
 async list(w:string,l:string,limit:number,after?:string){return this.attempts.filter(a=>a.workspaceId===w&&a.leadId===l&&(!after||a.id>after)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit);}
 async append(a:ContactAttempt,i:ContactAttemptInput,d:ContentDigest){
 const s=await this.store.load(a.leadId);if(!s||s.lead.workspaceId!==a.workspaceId)throw new PilotDomainError('LEAD_NOT_FOUND',404,'lead not found');
 if(s.ownerUserId!==a.actor)throw new PilotDomainError('NOT_OWNER',403,'only owner may record contact');
 if(s.version!==i.expectedVersion)throw new PilotStaleVersionError(a.leadId,i.expectedVersion,s.version??0);
 if(s.closureCommands?.some(c=>c.idempotencyKey===i.idempotencyKey))throw new PilotDomainError('IDEMPOTENCY_CONFLICT',409,'idempotency key already used');
 const r={actor:a.actor,digest:d,attemptId:a.id,version:i.expectedVersion+1};
 await this.store.save({...s,closureCommands:[...(s.closureCommands??[]),{idempotencyKey:i.idempotencyKey,actor:a.actor,operation:'contact-attempt',digest:d,result:{attemptId:a.id,version:r.version}}]},[{entityType:'lead',entityId:a.leadId,workspaceId:a.workspaceId,actor:a.actor,eventType:'contact_attempt_recorded',newValue:JSON.stringify({attemptId:a.id,assertionStatus:'claimed',version:r.version}),reason:'manual contact claim appended'}]);
 this.attempts.push(a);this.receipts.set(this.key(a.workspaceId,a.leadId,i.idempotencyKey),r);return r;
 }
}
