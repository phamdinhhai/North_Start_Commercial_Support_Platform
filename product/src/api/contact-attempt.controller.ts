import { Controller,Get,Post,Header,Headers,Param,Query,Body,Inject,HttpException } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER,type AuthContextResolver,type AuthContext } from '../ports/auth';
import { ContactAttemptService } from '../application/pilot/contact-attempt.service';
import type { ContactAttemptInput } from '../ports/contact-attempt';
import { PilotDomainError } from '../ports/pilot-loop.types';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message:string):never{throw new PilotDomainError('INPUT_INVALID',400,message);}
function uuid(id:string){if(!UUID.test(id??''))invalid('id must be UUID');return id;}
export function validateContactAttempt(body:unknown):ContactAttemptInput {
 if(!body||typeof body!=='object'||Array.isArray(body))invalid('body must be object');const b=body as Record<string,unknown>;
 if(Object.keys(b).some(k=>!['expectedVersion','idempotencyKey','occurredAt','channel','claimedResult','evidenceRef','followUpImplication','reason'].includes(k)))invalid('unexpected field');
 if(!Number.isSafeInteger(b.expectedVersion)||Number(b.expectedVersion)<1)invalid('expectedVersion must be positive integer');
 for(const [k,max] of [['idempotencyKey',128],['followUpImplication',2000],['reason',2000]] as const)if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>max)invalid(k+' invalid');
 if(!['phone','message','email','other'].includes(b.channel as string))invalid('channel invalid');
 if(!['reached','no-answer','left-message','unknown'].includes(b.claimedResult as string))invalid('claimedResult invalid');
 if(b.occurredAt!=='unknown'&&(typeof b.occurredAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(b.occurredAt)||!Number.isFinite(Date.parse(b.occurredAt))||Date.parse(b.occurredAt)>Date.now()))invalid('occurredAt must be past ISO datetime or unknown');
 if(b.occurredAt!=='unknown'){const [year,month,day]=(b.occurredAt as string).slice(0,10).split('-').map(Number);if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())invalid('occurredAt invalid calendar date');}
 if(b.evidenceRef!==undefined)uuid(b.evidenceRef as string);return b as unknown as ContactAttemptInput;
}
@Controller('pilot')
export class ContactAttemptController {
 constructor(@Inject(AUTH_CONTEXT_RESOLVER)private readonly auth:AuthContextResolver,@Inject(ContactAttemptService)private readonly service:ContactAttemptService){}
 private async run(h:Record<string,string|undefined>,fn:(ctx:AuthContext)=>Promise<unknown>){try{const ctx=this.auth.resolve({headers:h});if(!ctx)throw new HttpException({code:'UNAUTHENTICATED'},401);return await fn(ctx);}catch(e){if(e instanceof PilotDomainError)throw new HttpException({code:e.code,message:e.message,...(e.details?{details:e.details}:{})},e.status);if(e instanceof HttpException)throw e;throw new HttpException({code:'INTERNAL',message:'internal server error'},500);}}
 @Header('Cache-Control','no-store')
 @Get('leads/:leadId/contact-attempts')list(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Query()q:Record<string,string|undefined>){return this.run(h,c=>{const limit=q.limit===undefined?50:Number(q.limit);if(!Number.isInteger(limit)||limit<1||limit>100||Object.keys(q).some(k=>!['limit','after'].includes(k)))invalid('query invalid');return this.service.list(c,uuid(lead),limit,q.after===undefined?undefined:uuid(q.after));});}
 @Post('leads/:leadId/contact-attempts')record(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()body:unknown){return this.run(h,c=>this.service.record(c,uuid(lead),validateContactAttempt(body)));}
}
