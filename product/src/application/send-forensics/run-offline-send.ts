import type {SendRecord, SendState} from '../../domain/send-ledger/send-ledger';

export interface OfflineJournalPort {
  begin():void;
  append(state:SendState,evidence?:string):SendRecord;
  inspect():SendRecord|undefined;
  release():void;
}
export interface OfflineDispatchResult {kind:'confirmed'|'rejected'|'ambiguous';category?:string;}
export interface OfflineSendPorts {
  fixture:true;
  journal:OfflineJournalPort;
  dispatch():Promise<OfflineDispatchResult>;
  /** Fault injection seams are for fabricated crash fixtures only. */
  afterReservation?():void;
  afterDispatchRecord?():void;
}
export interface OfflineSendResult {
  state:SendState|'REFUSED';httpAttempts:number;automaticRetryAllowed:false;providerDelivery:'UNKNOWN';
}
/** No credentials, provider client, scheduler or HTTP route is registered for this offline coordinator. */
export async function runOfflineSend(ports:OfflineSendPorts):Promise<OfflineSendResult> {
  const result=(state:OfflineSendResult['state'],httpAttempts:number):OfflineSendResult=>
    ({state,httpAttempts,automaticRetryAllowed:false,providerDelivery:'UNKNOWN'});
  if(ports.fixture!==true)throw new Error('OFFLINE_SEND_FIXTURE_REQUIRED');
  let held=false,attempts=0;
  try {
    ports.journal.begin();held=true;
    ports.afterReservation?.();
    ports.journal.append('DISPATCH_STARTED');
    ports.afterDispatchRecord?.();
    attempts=1;
    const observed=await ports.dispatch();
    if(observed.kind==='confirmed')return result(ports.journal.append('RESPONSE_CONFIRMED','HTTP_AND_BUSINESS_ACK_ONLY').state,attempts);
    if(observed.kind==='rejected')return result(ports.journal.append('PROVIDER_REJECTED','VALIDATED_REJECTION_RESPONSE').state,attempts);
    ports.journal.append('AMBIGUOUS','TRANSPORT_OR_RESPONSE_UNRESOLVED');
    return result(ports.journal.append('MANUAL_REVIEW_REQUIRED','NO_AUTOMATIC_RESEND').state,attempts);
  } catch {
    if(!held)return result('REFUSED',0);
    const state=ports.journal.inspect()?.state;
    if(state==='RESERVED')return result(ports.journal.append('MANUAL_REVIEW_REQUIRED','INTERRUPTED_BEFORE_DISPATCH').state,attempts);
    if(state==='DISPATCH_STARTED')ports.journal.append('AMBIGUOUS','EXECUTION_INTERRUPTED');
    if(state==='DISPATCH_STARTED'||state==='AMBIGUOUS')
      return result(ports.journal.append('MANUAL_REVIEW_REQUIRED','NO_AUTOMATIC_RESEND').state,attempts);
    throw new Error('OFFLINE_SEND_JOURNAL_FAILURE');
  } finally {if(held)ports.journal.release();}
}
