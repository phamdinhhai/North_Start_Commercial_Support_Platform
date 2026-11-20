import { describe,it,expect,vi } from 'vitest';
import { SourceIntegrationService } from './source-integration.service';
import { validateSourceObservation } from './validation';
import type { SourceIntegrationStore,SourceObservation } from '../../ports/source-observation';
import type { AuthContext } from '../../ports/auth';
export const observation=():SourceObservation=>({schemaVersion:1,accountId:'p',provider:'pancake',route:'pancake-synthetic',synthetic:true,sourceAuthority:'synthetic_fixture',completeness:'UNKNOWN',verification:'UNVERIFIED',receiptId:'r',native:{system:'meta',pageId:'p',conversationId:null,messageId:'m',eventId:null,revision:null},observedAt:'2026-11-20T00:00:00Z',occurredAt:null,lifecycle:'upsert-observed',displayName:'Invented episode',rawPayload:{utterance:'Invented message',speaker:'customer',original:{id:'m'}}});
const ctx:AuthContext={workspaceId:'synthetic',userId:'admin',role:'admin',isDemo:false};
describe('synthetic source application boundary',()=>{
  const store=()=>({intake:vi.fn(),evidence:vi.fn().mockResolvedValue([]),createConnection:vi.fn(),listConnections:vi.fn(),revokeConnection:vi.fn()}) satisfies SourceIntegrationStore;
  it('defaults off and denies every nonadmin mutation including demo admin',async()=>{
    const s=store();await expect(new SourceIntegrationService(s,vi.fn()).intake(ctx,'c',observation())).rejects.toMatchObject({status:404});
    const service=new SourceIntegrationService(s,vi.fn(),true);
    for(const role of ['sales','viewer','manager'] as const)await expect(service.intake({...ctx,role},'c',observation())).rejects.toMatchObject({status:403});
    await expect(service.intake({...ctx,isDemo:true},'c',observation())).rejects.toMatchObject({status:403});expect(s.intake).not.toHaveBeenCalled();
  });
  it('requires lead authorization before any evidence reader and propagates refusal',async()=>{
    const s=store(),auth=vi.fn().mockRejectedValue(new Error('denied'));
    await expect(new SourceIntegrationService(s,auth,true).evidence(ctx,'lead')).rejects.toThrow('denied');expect(s.evidence).not.toHaveBeenCalled();
    auth.mockResolvedValue(undefined);await new SourceIntegrationService(s,auth,true).evidence(ctx,'lead');expect(s.evidence).toHaveBeenCalledWith('synthetic','lead','admin');
  });
  it('requires explicit human responsibility option and never puts it in adapter observation',async()=>{
    const s=store(),service=new SourceIntegrationService(s,vi.fn(),true),o=observation();
    await service.intake(ctx,'c',o);expect(s.intake).toHaveBeenLastCalledWith(ctx,'c',o,{claimResponsibility:false});
    await service.intake(ctx,'c',o,{claimResponsibility:true});expect(s.intake).toHaveBeenLastCalledWith(ctx,'c',o,{claimResponsibility:true});
    await expect(service.intake(ctx,'c',o,{claimResponsibility:'true'} as never)).rejects.toMatchObject({status:400});
  });
  it('validates a strict bounded synthetic schema; unknown native IDs remain explicit',()=>{
    expect(validateSourceObservation(observation()).native.conversationId).toBeNull();
    for(const change of [{synthetic:false},{sourceAuthority:'provider'},{verification:'VERIFIED'},{workspaceId:'other'},{confidence:1},{rawPayload:{...observation().rawPayload,utterance:'a'.repeat(16385)}}])expect(()=>validateSourceObservation({...observation(),...change})).toThrow('INPUT_INVALID');
    expect(()=>validateSourceObservation({...observation(),occurredAt:'2026-02-30T00:00:00Z'})).toThrow('INPUT_INVALID');
  });
});
