import {Controller,Get,Header,Headers,Query,Inject,HttpException} from '@nestjs/common';
import {AUTH_CONTEXT_RESOLVER,type AuthContextResolver} from '../ports/auth';
import {ManagerExceptionsService} from '../application/pilot/manager-exceptions.service';
import type {ManagerClassification} from '../ports/manager-exceptions';
import {ManagerExceptionsUnavailable} from '../ports/manager-exceptions';
import {PilotDomainError} from '../ports/pilot-loop.types';
@Controller('pilot')
export class ManagerExceptionsController {
 constructor(@Inject(AUTH_CONTEXT_RESOLVER)private readonly auth:AuthContextResolver,@Inject(ManagerExceptionsService)private readonly service:ManagerExceptionsService) {}
 @Header('Cache-Control','no-store')
 @Get('manager-exceptions') async list(@Headers()headers:Record<string,string|undefined>,@Query()q:Record<string,string|undefined>) {
  try {
   const ctx=this.auth.resolve({headers});
   if(!ctx)throw new HttpException({code:'UNAUTHENTICATED'},401);
   const limit=q.limit===undefined?50:Number(q.limit),classification=q.classification??'real';
   if(Object.keys(q).some(k=>!['limit','after','classification'].includes(k)) || !Number.isInteger(limit)||limit<1||limit>100||!['real','synthetic','unknown','all'].includes(classification)||
    (q.after!==undefined&&!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(q.after))) throw new PilotDomainError('INPUT_INVALID',400,'invalid query');
   return await this.service.list(ctx,{limit,classification:classification as ManagerClassification,after:q.after});
  }catch(e){if(e instanceof ManagerExceptionsUnavailable)throw new HttpException({code:e.code,message:e.message},503);if(e instanceof PilotDomainError)throw new HttpException({code:e.code,message:e.message},e.status);if(e instanceof HttpException)throw e;throw new HttpException({code:'INTERNAL'},500);}
 }
}
