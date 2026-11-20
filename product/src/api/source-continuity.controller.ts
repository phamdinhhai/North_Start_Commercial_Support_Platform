import {Body,Controller,Get,Header,Headers,HttpException,Inject,Param,Post} from '@nestjs/common';
import {AUTH_CONTEXT_RESOLVER,type AuthContextResolver} from '../ports/auth';
import {SOURCE_SYNTHETIC_MODE} from '../ports/source-fixture-decoder';
import {SourceIntegrationError} from '../ports/source-observation';
import {PilotDomainError} from '../ports/pilot-loop.types';
import {SourceContinuityService} from '../application/source-continuity/source-continuity.service';
import {LinkedSourceEvidenceQuery} from '../application/source-continuity/linked-source-evidence';
@Controller('source-integrations/leads')
export class SourceContinuityController{
  constructor(@Inject(AUTH_CONTEXT_RESOLVER)private readonly auth:AuthContextResolver,
    @Inject(SOURCE_SYNTHETIC_MODE)private readonly enabled:boolean,
    @Inject(SourceContinuityService)private readonly continuity:SourceContinuityService,
    @Inject(LinkedSourceEvidenceQuery)private readonly linked:LinkedSourceEvidenceQuery){}
  private async run<T>(h:Record<string,string|undefined>,id:string,op:(ctx:NonNullable<ReturnType<AuthContextResolver['resolve']>>)=>Promise<T>){
    try{
      if(!this.enabled)throw new SourceIntegrationError('SOURCE_INTEGRATION_DISABLED',404);
      const ctx=this.auth.resolve({headers:h});if(!ctx)throw new SourceIntegrationError('UNAUTHORIZED',401);
      if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))throw new SourceIntegrationError('INPUT_INVALID',400);
      return await op(ctx);
    }catch(e){if(e instanceof SourceIntegrationError||e instanceof PilotDomainError)throw new HttpException({code:e.code},e.status);
      throw new HttpException({code:'SOURCE_UNAVAILABLE'},503);}
  }
  @Get(':id/source-links') @Header('Cache-Control','no-store') list(@Headers()h:Record<string,string|undefined>,@Param('id')id:string){return this.run(h,id,ctx=>this.continuity.list(ctx,id));}
  @Post(':id/source-links') @Header('Cache-Control','no-store') command(@Headers()h:Record<string,string|undefined>,@Param('id')id:string,@Body()body:unknown){return this.run(h,id,ctx=>this.continuity.command(ctx,id,body));}
  @Get(':id/linked-evidence') @Header('Cache-Control','no-store') evidence(@Headers()h:Record<string,string|undefined>,@Param('id')id:string){return this.run(h,id,ctx=>this.linked.evidence(ctx,id));}
}
