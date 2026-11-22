import {describe,expect,it,vi} from 'vitest';
import {runOfflineSend} from './run-offline-send';
import {SendLedger} from '../../domain/send-ledger/send-ledger';

// Use the domain model through a port; infrastructure/transport integration is tested separately.
function journal(){
 const ledger=new SendLedger();let begun=false;
 return {begin(){if(begun)throw Error('duplicate');begun=true;ledger.plan('fixture');ledger.reserve('fixture');},
 append(state:Parameters<SendLedger['append']>[0]['event'],evidence?:string){return ledger.append({requestId:'fixture',event:state,at:new Date().toISOString(),evidence});},
 inspect(){return begun?ledger.get('fixture'):undefined;},release(){},ledger};
}
describe('offline send coordinator never retries',()=>{
 it.each(['confirmed','rejected','ambiguous'] as const)('records %s after reservation and dispatch',async kind=>{
  const j=journal(),dispatch=vi.fn(async()=>{expect(j.inspect()?.state).toBe('DISPATCH_STARTED');return {kind};});
  const r=await runOfflineSend({fixture:true,journal:j,dispatch});
  expect(r.state).toBe(kind==='confirmed'?'RESPONSE_CONFIRMED':kind==='rejected'?'PROVIDER_REJECTED':'MANUAL_REVIEW_REQUIRED');
  expect(r.httpAttempts).toBe(1);expect(r.automaticRetryAllowed).toBe(false);expect(dispatch).toHaveBeenCalledTimes(1);
  const again=await runOfflineSend({fixture:true,journal:j,dispatch});expect(again.state).toBe('REFUSED');expect(dispatch).toHaveBeenCalledTimes(1);
 });
 it.each(['afterReservation','afterDispatchRecord'] as const)('interruption at %s cannot dispatch or resend',async hook=>{
  const j=journal(),dispatch=vi.fn(async()=>({kind:'confirmed' as const}));
  const r=await runOfflineSend({fixture:true,journal:j,dispatch,[hook](){throw Error('fabricated crash');}});
  expect(r.state).toBe('MANUAL_REVIEW_REQUIRED');expect(dispatch).not.toHaveBeenCalled();
 });
 it('transport exception remains ambiguous and nonretryable',async()=>{
  const j=journal();const r=await runOfflineSend({fixture:true,journal:j,dispatch:async()=>{throw Error('secret-url-must-not-escape')}});
  expect(r).toMatchObject({state:'MANUAL_REVIEW_REQUIRED',httpAttempts:1,automaticRetryAllowed:false,providerDelivery:'UNKNOWN'});
 });
});
