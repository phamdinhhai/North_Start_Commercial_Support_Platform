import { Controller, Get, Post, Body, Headers, Param, Query, Inject, HttpException } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { PilotClosureService, type ClosureInput } from '../application/pilot/pilot-closure.service';
import { PilotDomainError } from '../ports/pilot-loop.types';
import { validateCompleteBody, validateHandoffBody, validateAcceptBody, validateOutcomeBody, validateAdvanceBody } from './pilot-validation';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message:string):never{throw new PilotDomainError('INPUT_INVALID',400,message);}
function id(value:string){if(!UUID.test(value ?? ''))invalid('id must be UUID');return value;}
function command(body:unknown,operation:string):ClosureInput{
 if(!body||typeof body!=='object'||Array.isArray(body))invalid('body must be object');const b=body as Record<string,unknown>;
 if(!Number.isInteger(b.expectedVersion)||Number(b.expectedVersion)<1)invalid('expectedVersion must be positive integer');
 const text=(key:string,max:number,required=true)=>{if(b[key]===undefined&&!required)return;if(typeof b[key]!=='string'||!b[key].trim()||b[key].length>max)invalid(`${key} is invalid`);};
 if(operation==='advance'&&validateAdvanceBody(b).length)invalid('advance fields invalid');
 if(operation==='handoff' && validateHandoffBody(b).length)invalid('handoff fields invalid');if(operation==='accept'&&validateAcceptBody(b).length)invalid('accept fields invalid');if(operation==='outcome'&&validateOutcomeBody(b).length)invalid('outcome fields invalid');
 text('idempotencyKey',128);text('reason',2000,operation!=='complete');if(operation==='context')text('text',16000);if(operation==='create')text('action',2000);
 for(const key of operation==='reschedule'?['newDueAt']:operation==='create'||operation==='reopen'?['dueAt']:[]){if(b[key]===undefined&&key==='dueAt')continue;if(typeof b[key]!=='string'||!/^\d{4}-\d\d-\d\dT/.test(b[key])||!Number.isFinite(Date.parse(b[key])))invalid(`${key} must be ISO datetime`);}
 if(operation==='correct'&&!['Won','Lost','Unknown'].includes(b.value as string))invalid('value is invalid');
 if(operation==='complete'&&validateCompleteBody({...b,workId:'00000000-0000-0000-0000-000000000001'}).length)invalid('completion evidence fields are invalid');
 const allowed=['expectedVersion','idempotencyKey','reason',...(operation==='advance'?['to']:operation==='handoff'?['context','proposedAction','responsibleParty','origin','dueAt','recipientUserId','evidenceRef']:operation==='accept'?['workId']:operation==='outcome'?['value']:operation==='context'?['text']:operation==='create'?['action','dueAt']:operation==='reopen'?['dueAt']:operation==='reschedule'?['newDueAt']:operation==='correct'?['value']:['evidence','evidenceRef','occurredAt','declaration','confirmed'])];
 if(Object.keys(b).some(k=>!allowed.includes(k)))invalid('unexpected field');return b as ClosureInput;
}
@Controller('pilot')
export class PilotClosureController{
 constructor(@Inject(AUTH_CONTEXT_RESOLVER)private readonly auth:AuthContextResolver,@Inject(PilotClosureService)private readonly closure:PilotClosureService){}
 private async run<T>(headers:Record<string,string|undefined>,operation:(ctx:NonNullable<ReturnType<AuthContextResolver['resolve']>>)=>Promise<T>){try{const ctx=this.auth.resolve({headers});if(!ctx)throw new HttpException({code:'UNAUTHENTICATED',message:'unauthenticated'},401);return await operation(ctx);}catch(e){if(e instanceof PilotDomainError)throw new HttpException({code:e.code,message:e.message,...(e.details?{details:e.details}:{})},e.status);if(e instanceof HttpException)throw e;throw new HttpException({code:'INTERNAL',message:'internal server error'},500);}}
 @Get('leads')leads(@Headers()h:Record<string,string|undefined>,@Query()q:Record<string,string|undefined>){return this.run(h,c=>{if(q.classification!==undefined&&!['real','synthetic','all'].includes(q.classification))invalid('classification invalid');const limit=q.limit===undefined?50:Number(q.limit);if(!Number.isInteger(limit)||limit<1||limit>100)invalid('limit must be 1..100');return this.closure.leads(c,{limit,classification:q.classification as 'real'|'synthetic'|'all'|undefined,...(q.after?{after:id(q.after)}:{})});});}
 @Get('assignees')assignees(@Headers()h:Record<string,string|undefined>){return this.run(h,c=>this.closure.assignees(c));}
 @Get('leads/:leadId/context')context(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string){return this.run(h,c=>this.closure.context(c,id(lead)));}
 @Get('leads/:leadId/evidence')evidence(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Query()q:Record<string,string|undefined>){return this.run(h,c=>{if(q.limit!==undefined&&(!Number.isInteger(Number(q.limit))||Number(q.limit)<1||Number(q.limit)>20))invalid('limit must be 1..20');return this.closure.evidence(c,id(lead));});}
 @Get('leads/:leadId/timeline')timeline(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string){return this.run(h,c=>this.closure.timeline(c,id(lead)));}
 @Post('leads/:leadId/context')editContext(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'context',command(b,'context')));}
 @Post('leads/:leadId/next-actions')create(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'create',command(b,'create')));}
 @Post('leads/:leadId/next-actions/:workId/reopen')reopen(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Param('workId')work:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'reopen',command(b,'reopen'),id(work)));}
 @Post('leads/:leadId/next-actions/:workId/complete')complete(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Param('workId')work:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'complete',command(b,'complete'),id(work)));}
 @Post('leads/:leadId/next-actions/:workId/reschedule')reschedule(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Param('workId')work:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'reschedule',command(b,'reschedule'),id(work)));}
 @Post('leads/:leadId/outcomes/:outcomeId/correct')correct(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Param('outcomeId')outcome:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'correct',command(b,'correct'),id(outcome)));}
 @Post('leads/:leadId/commands/handoff')handoff(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'handoff',command(b,'handoff')));}
 @Post('leads/:leadId/commands/accept')accept(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'accept',command(b,'accept')));}
 @Post('leads/:leadId/commands/outcome')outcome(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'outcome',command(b,'outcome')));}

 @Post('leads/:leadId/commands/advance')advance(@Headers()h:Record<string,string|undefined>,@Param('leadId')lead:string,@Body()b:unknown){return this.run(h,c=>this.closure.execute(c,id(lead),'advance',command(b,'advance')));}

}
