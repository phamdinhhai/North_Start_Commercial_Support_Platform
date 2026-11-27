import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {InMemoryPilotStore} from '../../infra/pilot/in-memory-pilot.store';
import {InMemoryContactAttemptStore} from '../../infra/pilot/in-memory-contact-attempt.store';
import {AuditStore} from '../../infra/audit/audit-store';
import {ManualAdapter} from '../../adapters/manual/manual-adapter';
import {RbacService} from '../../infra/rbac/rbac.service';
import {configuredContentDigester} from '../../infra/crypto/configured-content-digester';
import {PilotLoopService} from './pilot-loop.service';
import {ContactAttemptService} from './contact-attempt.service';
import {validateContactAttempt} from '../../api/contact-attempt.controller';
const ctx={workspaceId:'contact-test',userId:'owner',role:'sales' as const,isDemo:false};
const input={expectedVersion:1,idempotencyKey:'one',occurredAt:'unknown',channel:'phone' as const,claimedResult:'no-answer' as const,followUpImplication:'Call tomorrow',reason:'manual record'};
async function fixture(){const store=new InMemoryPilotStore(new AuditStore());const loop=new PilotLoopService(store,new ManualAdapter());const service=new ContactAttemptService(store,new RbacService(),configuredContentDigester({NODE_ENV:'test'}),new InMemoryContactAttemptStore(store));const s=await loop.ingestScenario({workspaceId:ctx.workspaceId,ownerUserId:ctx.userId,displayName:'Synthetic',utterance:'original',speaker:'customer',connection:'manual',externalRecordId:randomUUID(),isSynthetic:true});return {store,service,s};}
describe('manual contact claims',()=>{
 it('records unknown time without mutating commercial state, replays and audits metadata only',async()=>{const f=await fixture();const r=await f.service.record(ctx,f.s.lead.id,input);expect(r.version).toBe(2);expect(await f.service.record(ctx,f.s.lead.id,input)).toEqual(r);const page=await f.service.list(ctx,f.s.lead.id);expect(page.items).toHaveLength(1);expect(page.items[0]).toMatchObject({actor:'owner',occurredAt:'unknown',acquisitionMode:'claimed',assertionStatus:'claimed'});expect(page.truth.acquisitionLineage.status).toBe('unknown');expect(page.truth.revenueAttribution.reason).toContain('ADR-008');const s=await f.store.load(f.s.lead.id);expect(s?.lead).toEqual(f.s.lead);expect(s?.workItems).toEqual([]);expect(s?.outcomes).toEqual([]);expect(JSON.stringify(await f.store.history(f.s.lead.id))).not.toContain('Call tomorrow');});
 it('rejects changed replay and stale write',async()=>{const f=await fixture();await f.service.record(ctx,f.s.lead.id,input);await expect(f.service.record(ctx,f.s.lead.id,{...input,claimedResult:'reached'})).rejects.toMatchObject({code:'IDEMPOTENCY_CONFLICT'});await expect(f.service.record(ctx,f.s.lead.id,{...input,idempotencyKey:'new'})).rejects.toMatchObject({code:'STALE_VERSION'});});
 it('retains owner-only boundary for admin/manager/viewer/demo and other workspace',async()=>{const f=await fixture();for(const c of [{...ctx,role:'viewer' as const},{...ctx,isDemo:true},{...ctx,userId:'manager',role:'manager' as const},{...ctx,userId:'admin',role:'admin' as const},{...ctx,userId:'foreign'}])await expect(f.service.record(c,f.s.lead.id,input)).rejects.toMatchObject({status:403});await expect(f.service.list({...ctx,workspaceId:'foreign'},f.s.lead.id)).rejects.toMatchObject({status:404});});
 it('only accepts related evidence',async()=>{const f=await fixture();await expect(f.service.record(ctx,f.s.lead.id,{...input,evidenceRef:randomUUID()})).rejects.toMatchObject({code:'EVIDENCE_NOT_FOUND'});await f.service.record(ctx,f.s.lead.id,{...input,evidenceRef:f.s.sourceEnvelopeId});expect((await f.service.list(ctx,f.s.lead.id)).items[0].evidenceRef).toBe(f.s.sourceEnvelopeId);});
 it('rejects future/ambiguous time and forged fields',()=>{for(const changes of [{occurredAt:'2099-01-01T00:00:00Z'},{occurredAt:'2020-01-01'},{actor:'fake'},{recordedAt:'2020-01-01T00:00:00Z'},{workspaceId:'fake'},{expectedVersion:0},{channel:'fax'},{claimedResult:'Won'},{followUpImplication:''}])expect(()=>validateContactAttempt({...input,...changes})).toThrow();expect(validateContactAttempt(input)).toEqual(input);});
});
