import { Body, Controller, Headers, HttpException, Inject, Post } from '@nestjs/common';
import { IntegrationIntake } from '../application/integration/intake';
import { IntegrationError } from '../ports/integration';
@Controller('integration')
export class IntegrationController {
 constructor(@Inject(IntegrationIntake) private readonly intake: IntegrationIntake) {}
 @Post('enroll') enroll(@Headers('x-integration-issuer') issuer: unknown,@Body() body: unknown) {return this.call(()=>this.intake.enroll(issuer,body));}
 @Post('revoke') revoke(@Headers('x-integration-issuer') issuer: unknown,@Body() body: unknown) {return this.call(()=>this.intake.revoke(issuer,body));}
 @Post('observations') append(@Headers('authorization') auth: unknown,@Body() body: unknown) {return this.call(()=>this.intake.append(auth,body));}
 private async call<T>(fn:()=>Promise<T>):Promise<T> {
  try{return await fn();}catch(e){if(e instanceof IntegrationError)throw new HttpException({code:e.code},e.status);throw new HttpException({code:'INTAKE_UNAVAILABLE'},503);}
 }
}
