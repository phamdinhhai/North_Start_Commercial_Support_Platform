import { Controller, Get, Headers, Header, HttpException, Inject, Param, Post, HttpCode } from '@nestjs/common';
import { AUTH_CONTEXT_RESOLVER, type AuthContextResolver } from '../ports/auth';
import { AssertionDeliveryOps, AssertionOpsError } from '../infra/governed-action/assertion-delivery.ops';
@Controller('internal/assertion-delivery')
export class AssertionDeliveryController {
  constructor(@Inject(AssertionDeliveryOps) private readonly ops: AssertionDeliveryOps,
    @Inject(AUTH_CONTEXT_RESOLVER) private readonly auth: AuthContextResolver) {}
  @Get()
  @Header('cache-control','no-store')
  inspect(@Headers() headers: Record<string,string|undefined>) {
    return this.call(()=>this.ops.inspect(this.auth.resolve({headers})));
  }
  @Post(':id/replay')
  @HttpCode(200)
  replay(@Headers() headers: Record<string,string|undefined>, @Param('id') id:string) {
    return this.call(()=>this.ops.change(this.auth.resolve({headers}),id,'replay'));
  }
  @Post(':id/stop')
  @HttpCode(200)
  stop(@Headers() headers: Record<string,string|undefined>, @Param('id') id:string) {
    return this.call(()=>this.ops.change(this.auth.resolve({headers}),id,'stop'));
  }
  private async call<T>(fn:()=>Promise<T>):Promise<T> {
    try{return await fn();}catch(e){
      if(e instanceof AssertionOpsError)throw new HttpException({code:e.code},e.status);
      throw new HttpException({code:'ASSERTION_DELIVERY_UNAVAILABLE'},503);
    }
  }
}
