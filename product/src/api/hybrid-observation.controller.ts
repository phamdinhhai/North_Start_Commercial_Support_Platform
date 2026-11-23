import {Body,Controller,Get,Headers,HttpCode,HttpException,Inject,Optional,Post} from '@nestjs/common';
import {RouteConfig} from '@nestjs/platform-fastify';
import {IntegrationIntake} from '../application/integration/intake';
import {IntegrationError} from '../ports/integration';
import {HYBRID_FIXTURE_READER, type HybridFixtureReader} from '../ports/hybrid-fixture-reader';

/** Minimized fixture observations reuse signed enrollment and the existing durable receipt path. */
@Controller('hybrid')
export class HybridObservationController {
  constructor(@Inject(IntegrationIntake) private readonly intake:IntegrationIntake,@Optional() @Inject(HYBRID_FIXTURE_READER) private readonly reader?:HybridFixtureReader) {}
  @RouteConfig({bodyLimit:8192}) @Post('observations')
  async append(@Headers('authorization') auth:unknown,@Body() body:unknown) {
    try {const ack=await this.intake.appendHybrid(auth,body);return {...ack,completeness:'UNKNOWN'};}
    catch(error){if(error instanceof IntegrationError)throw new HttpException({code:error.code},error.status);throw new HttpException({code:'INTAKE_UNAVAILABLE'},503);}
  }
  @RouteConfig({bodyLimit:4096}) @HttpCode(201) @Post('provider-read')
  async providerRead(@Headers('authorization') auth:unknown,@Body() body:unknown) {
    try {if(!this.reader)throw new IntegrationError('HYBRID_READ_UNAVAILABLE',503);return {...await this.intake.appendHybridProvider(auth,body,this.reader),completeness:'UNKNOWN'};}
    catch(error){if(error instanceof IntegrationError)throw new HttpException({code:error.code},error.status);throw new HttpException({code:'PROVIDER_READ_FAILED'},502);}
  }
  @Get('reconciliation')
  async reconciliation(@Headers('authorization') auth:unknown) {
    try{return await this.intake.reconcileHybrid(auth);}
    catch(error){if(error instanceof IntegrationError)throw new HttpException({code:error.code},error.status);throw new HttpException({code:'RECONCILIATION_UNAVAILABLE'},503);}
  }
}
