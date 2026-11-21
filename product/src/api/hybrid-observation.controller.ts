import {Body,Controller,Headers,HttpException,Inject,Post} from '@nestjs/common';
import {RouteConfig} from '@nestjs/platform-fastify';
import {IntegrationIntake} from '../application/integration/intake';
import {IntegrationError} from '../ports/integration';

/** Minimized fixture observations reuse signed enrollment and the existing durable receipt path. */
@Controller('hybrid')
export class HybridObservationController {
  constructor(@Inject(IntegrationIntake) private readonly intake:IntegrationIntake) {}
  @RouteConfig({bodyLimit:8192}) @Post('observations')
  async append(@Headers('authorization') auth:unknown,@Body() body:unknown) {
    try {const ack=await this.intake.appendHybrid(auth,body);return {...ack,completeness:'UNKNOWN'};}
    catch(error){if(error instanceof IntegrationError)throw new HttpException({code:error.code},error.status);throw new HttpException({code:'INTAKE_UNAVAILABLE'},503);}
  }
}
