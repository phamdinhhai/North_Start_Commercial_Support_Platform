import { Body, Controller, Get, Header, Headers, HttpException, Inject, Param, Post } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { SyncHealthError } from '../ports/operator-sync-health';
import { OperatorSyncHealthQuery } from '../application/operator-sync-health';
@Controller('source-integrations/sync-health')
export class OperatorSyncHealthController {
 constructor(@Inject(AUTH_CONTEXT_RESOLVER)private readonly auth:AuthContextResolver,@Inject(OperatorSyncHealthQuery)private readonly query:OperatorSyncHealthQuery){}
 private async run<T>(h:Record<string,string|undefined>,fn:(ctx:ReturnType<AuthContextResolver['resolve']>)=>Promise<T>){
  try{return await fn(this.auth.resolve({headers:h}));}catch(e){if(e instanceof SyncHealthError)throw new HttpException({code:e.code},e.status);throw new HttpException({code:'HEALTH_UNAVAILABLE'},503);}
 }
 @Get() @Header('Cache-Control','no-store') report(@Headers()h:Record<string,string|undefined>){return this.run(h,c=>this.query.report(c));}
 @Post(':id/control') @Header('Cache-Control','no-store') command(@Headers()h:Record<string,string|undefined>,@Param('id')id:string,@Body()body:unknown){
  return this.run(h,c=>{
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).join()!=='action')throw new SyncHealthError('INPUT_INVALID',400);
   return this.query.command(c,id,(body as {action:'pause'|'resume'|'revoke'}).action);
  });
 }
}
