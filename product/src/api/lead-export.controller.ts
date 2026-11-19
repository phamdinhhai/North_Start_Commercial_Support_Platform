import { LeadExportService } from '../application/pilot/lead-export.service';
import { Controller,Get,Headers,Param,Inject,HttpException,UnauthorizedException,Header } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER,type AuthContextResolver } from '../ports/auth';
import { LEAD_EXPORT_STORE,type LeadExportStore,LeadExportError } from '../ports/lead-export';
@Controller('v1/pilot/lifecycle')
export class LeadExportController {
 private readonly service:LeadExportService;
 constructor(@Inject(AUTH_CONTEXT_RESOLVER) private readonly auth:AuthContextResolver,@Inject(LEAD_EXPORT_STORE) store:LeadExportStore){this.service=new LeadExportService(store);}
 @Get('leads/:leadId/export')
 @Header('Cache-Control','no-store')
 @Header('Content-Disposition','attachment; filename="lead-export.json"')
 async export(@Headers() headers:Record<string,string|undefined>,@Param('leadId') leadId:string){
  const ctx=this.auth.resolve({headers});if(!ctx)throw new UnauthorizedException();
  try{return await this.service.export(ctx,leadId);}catch(error){
   if(error instanceof LeadExportError)throw new HttpException({code:error.code},error.status);
   throw new HttpException({code:'INTERNAL'},500);
  }
 }
}
