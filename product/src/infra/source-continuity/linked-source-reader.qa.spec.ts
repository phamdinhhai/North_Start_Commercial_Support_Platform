import {describe,it,expect,vi} from 'vitest';
import {PgLinkedSourceEvidenceReader} from './pg-linked-source-evidence.reader';
import {LinkedSourceEvidenceQuery} from '../../application/source-continuity/linked-source-evidence';
import type {PostgresService} from '../postgres/postgres.service';
import type {SourceContinuityService} from '../../application/source-continuity/source-continuity.service';
import type {SourceEvidence} from '../../ports/source-observation';
const ctx={workspaceId:'qa',userId:'actor',role:'admin' as const,isDemo:false};
describe('R4.11 independent linked evidence reader/query',()=>{
 it('binds the complete pointer tuple and audits nothing on a scoped miss',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[]});
  const db={withTransaction:async(fn:(tx:{query:typeof query})=>unknown)=>fn({query})} as unknown as PostgresService;
  expect(await new PgLinkedSourceEvidenceReader(db).read('qa','connection','receipt','envelope','actor')).toBeNull();
  expect(query).toHaveBeenCalledTimes(1);expect(query.mock.calls[0][1]).toEqual(['qa','connection','receipt','envelope']);
  expect(query.mock.calls[0][0]).toContain('e.workspace_id=r.workspace_id');
 });
 it('does not expose read evidence when mandatory audit insertion fails',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[{lead_id:'origin',envelope_id:'envelope'}]}).mockRejectedValueOnce(new Error('audit unavailable'));
  const db={withTransaction:async(fn:(tx:{query:typeof query})=>unknown)=>fn({query})} as unknown as PostgresService;
  await expect(new PgLinkedSourceEvidenceReader(db).read('qa','connection','receipt','envelope','actor')).rejects.toThrow('audit unavailable');
  expect(query.mock.calls[1][1]).toEqual(['origin','qa','actor',JSON.stringify({envelopeId:'envelope'})]);
 });
 it('projects safe evidence only after filtered pointers, without raw wrapper or digest',async()=>{
  const linkedReceipts=vi.fn().mockResolvedValue([{connectionId:'c',receiptId:'r',envelopeId:'e'}]);
  const reader={read:vi.fn().mockResolvedValue({receipt:{verification:'UNVERIFIED'},observation:{native:{system:'meta',pageId:'p',messageId:'m'}},
   envelope:{envelopeId:'e',rawPayload:{utterance:'fabricated',speaker:'customer',original:{private:'wrapper'}},rawPayloadHash:'private-digest',rawPayloadDigest:{private:'key'}}} as unknown as SourceEvidence)};
  const result=await new LinkedSourceEvidenceQuery({linkedReceipts} as unknown as SourceContinuityService,reader).evidence(ctx,'target');
  expect(reader.read).toHaveBeenCalledWith('qa','c','r','e','actor');
  expect(result.items[0]).toMatchObject({association:{linkage:'human_confirmed',verification:'UNVERIFIED',identityMerge:false},trust:{providerAttestation:'NOT_AVAILABLE',nativeMapping:'USER_ASSERTED_CANDIDATE'}});
  expect(JSON.stringify(result)).not.toMatch(/private|wrapper|digest/);
 });
 it('reads no evidence if origin authorization filtered every pointer',async()=>{
  const reader={read:vi.fn()};const linkedReceipts=vi.fn().mockResolvedValue([]);
  const result=await new LinkedSourceEvidenceQuery({linkedReceipts} as unknown as SourceContinuityService,reader).evidence(ctx,'target');
  expect(result.items).toEqual([]);expect(reader.read).not.toHaveBeenCalled();expect(result.completeness).toBe('UNKNOWN');
 });
});
