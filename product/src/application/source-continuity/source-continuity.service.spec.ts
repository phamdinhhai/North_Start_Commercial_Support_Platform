import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {SourceContinuityService} from './source-continuity.service';
import type {SourceEpisodeLinkStore} from '../../ports/source-episode-link';
import type {AuthContext} from '../../ports/auth';
import {configuredContentDigester} from '../../infra/crypto/configured-content-digester';
const ctx:AuthContext={workspaceId:'w',userId:'owner',role:'admin',isDemo:false};
const input=()=>({connectionId:randomUUID(),receiptId:'receipt',evidenceEnvelopeId:randomUUID(),expectedVersion:0,idempotencyKey:'key',action:'link',reason:'Human selected evidence'});
function setup(enabled=true){const store={command:vi.fn(),list:vi.fn().mockResolvedValue([]),linkedReceipts:vi.fn().mockResolvedValue([])} satisfies SourceEpisodeLinkStore;const owner=vi.fn().mockResolvedValue(undefined),read=vi.fn().mockResolvedValue(undefined);return {store,owner,read,service:new SourceContinuityService(store,owner,read,configuredContentDigester({NODE_ENV:'test'}),enabled)};}
describe('explicit source continuity boundary',()=>{
 it('defaults gated off and rejects demo/viewer/manager/sales without store access',async()=>{
  const a=setup(false);await expect(a.service.command(ctx,randomUUID(),input())).rejects.toMatchObject({code:'SOURCE_INTEGRATION_DISABLED'});
  for(const role of ['viewer','manager','sales'] as const){const s=setup();await expect(s.service.command({...ctx,role},randomUUID(),input())).rejects.toMatchObject({code:'FORBIDDEN'});expect(s.store.command).not.toHaveBeenCalled();}
  const s=setup();await expect(s.service.command({...ctx,isDemo:true},randomUUID(),input())).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('rejects malformed versions/evidence/extra authority and oversized rationale',async()=>{
  const s=setup();for(const change of [{expectedVersion:-1},{expectedVersion:0.2},{expectedVersion:Number.MAX_VALUE},{reason:'x'.repeat(2001)},{reason:'\n'},{evidenceEnvelopeId:'wrong'},{verification:'provider_verified'},{action:'merge'}])await expect(s.service.command(ctx,randomUUID(),{...input(),...change})).rejects.toMatchObject({code:'INPUT_INVALID'});expect(s.store.command).not.toHaveBeenCalled();
 });
 it('requires existing owner authorization before command and supplies reauthorization callback',async()=>{
  const s=setup(),lead=randomUUID(),v=input();await s.service.command(ctx,lead,v);expect(s.owner).toHaveBeenCalledWith(ctx,lead);expect(s.store.command.mock.calls[0]?.[5]).toBe(s.owner);
  s.owner.mockRejectedValue(new Error('NOT_OWNER'));await expect(s.service.command(ctx,lead,v)).rejects.toThrow('NOT_OWNER');expect(s.store.command).toHaveBeenCalledTimes(1);
 });
 it('allows assigned sales reads but hides inaccessible origin pointers and history',async()=>{
  const s=setup(),lead=randomUUID(),origin=randomUUID();
  s.read.mockImplementation(async(_ctx:AuthContext,id:string)=>{if(id===origin)throw new Error('DENIED');});
  s.store.linkedReceipts.mockResolvedValue([{connectionId:randomUUID(),receiptId:'hidden',envelopeId:randomUUID(),originLeadId:origin}] as never);
  s.store.list.mockResolvedValue([{originLeadId:origin,effectiveLeadId:lead}] as never);
  expect(await s.service.linkedReceipts({...ctx,role:'sales'},lead)).toEqual([]);
  expect(await s.service.list({...ctx,role:'sales'},lead)).toMatchObject({items:[],completeness:'UNKNOWN'});
 });
 it('authorizes bounded reads separately' ,async()=>{const s=setup(),lead=randomUUID();expect(await s.service.list(ctx,lead)).toMatchObject({items:[],limit:100,verification:'UNVERIFIED'});await s.service.linkedReceipts(ctx,lead);expect(s.read).toHaveBeenCalledTimes(2);});
});
