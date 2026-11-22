import { describe, it, expect, vi } from 'vitest';
import { createAssertion } from '../../domain/commercial-event/commercial-event';
import type { SqlExecutor } from '../postgres/postgres.service';
import { PgAssertionDelivery, PgAssertionInbox } from './pg-assertion-delivery';
import { validDeliveryEnvelope } from './assertion-envelope.validation';
const envelope=()=>createAssertion({workspaceId:'ws',subjectType:'lead',subjectId:'l',eventType:'WON',value:'observed',acquisitionMode:'observed',sourceActor:'human',createdBy:'human'});
const opts={batchSize:2,maxAttempts:2,leaseMs:1000,timeoutMs:5,backoffMs:1};
function fixture(value:unknown=envelope(),attempts=1){
 const e=value as ReturnType<typeof envelope>;
 const row={workspace_id:'ws',assertion_id:e?.assertionId,envelope:value,attempts,lease_token:'token'};
 const query=vi.fn().mockResolvedValueOnce({rows:[],rowCount:0}).mockResolvedValueOnce({rows:[row],rowCount:1}).mockResolvedValue({rows:[],rowCount:1});
 return {db:{query} as unknown as SqlExecutor,query,row};
}
describe('assertion delivery failure boundaries',()=>{
 it('rejects malformed/foreign/inferred payloads without invoking sink',async()=>{
  for(const value of [{},null,{...envelope(),workspaceId:'other'},{...envelope(),acquisitionMode:'inferred'},{...envelope(),confidence:{}},{...envelope(),createdAt:'garbage'},{...envelope(),evidenceSummary:{bad:[]}}]){
   const {db,query}=fixture(value);const sink={emit:vi.fn()};
   await new PgAssertionDelivery(db,sink,opts).runOnce();
   expect(sink.emit).not.toHaveBeenCalled();expect(query.mock.calls[2][1]).toEqual(expect.arrayContaining(['FAILED','INVALID_ENVELOPE']));
  }
 });
 it('times out a hung sink and bounds retry exhaustion',async()=>{
  for(const attempts of [1,2]){
   const {db,query}=fixture(envelope(),attempts);
   await new PgAssertionDelivery(db,{emit:()=>new Promise(()=>{})},opts).runOnce();
   expect(query.mock.calls[2][1]).toEqual(expect.arrayContaining([attempts===2?'FAILED':'PENDING','SINK_TIMEOUT']));
  }
 });
 it('never persists sensitive sink errors',async()=>{
  const {db,query}=fixture();
  await new PgAssertionDelivery(db,{emit:async()=>{throw Error('secret body');}},opts).runOnce();
  expect(JSON.stringify(query.mock.calls)).not.toContain('secret body');
  expect(query.mock.calls[2][1]).toContain('SINK_FAILED');
 });
 it('fences acknowledgement and retry by lease token after ownership loss',async()=>{
  const {db,query}=fixture();
  await new PgAssertionDelivery(db,{emit:async()=>{}},opts).runOnce();
  expect(query.mock.calls[2][0]).toContain("lease_token=$3 AND status='LEASED'");
  expect(query.mock.calls[2][1]).toEqual(['ws',expect.any(String),'token']);
 });
 it('detects conflicting immutable inbox evidence',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[],rowCount:0});
  await expect(new PgAssertionInbox({query}).emit(envelope())).rejects.toThrow('ENVELOPE_CONFLICT');
  expect(query).toHaveBeenCalledTimes(2);
 });
 it('accepts valid non-inferred envelopes and rejects malformed optional metadata',()=>{
  const e=envelope();expect(validDeliveryEnvelope(e,'ws',e.assertionId)).toBe(true);
  expect(validDeliveryEnvelope({...e,rawEvidencePointer:42},'ws',e.assertionId)).toBe(false);
  expect(validDeliveryEnvelope({...e,subjectType:'fake'},'ws',e.assertionId)).toBe(false);
 });
});
