import { describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AssertionDeliveryController } from './assertion-delivery.controller';
import { AssertionDeliveryOps, AssertionOpsError } from '../infra/governed-action/assertion-delivery.ops';
describe('assertion delivery controller',()=>{
 it('uses request-bound auth and categorical error responses',async()=>{
  const resolve=vi.fn(()=>null);const ops={inspect:vi.fn().mockRejectedValue(new AssertionOpsError('FORBIDDEN',403)),change:vi.fn().mockRejectedValue(Error('private body'))};
  const c=new AssertionDeliveryController(ops as unknown as AssertionDeliveryOps,{resolve});const headers={authorization:'opaque'};
  try{await c.inspect(headers);}catch(e){expect((e as HttpException).getResponse()).toEqual({code:'FORBIDDEN'});}
  expect(resolve).toHaveBeenCalledWith({headers});
  await expect(c.replay(headers,'id')).rejects.toMatchObject({status:503});
  await expect(c.stop(headers,'id')).rejects.toMatchObject({status:503});
 });
});
