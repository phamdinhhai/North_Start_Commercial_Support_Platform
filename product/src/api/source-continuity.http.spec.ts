import {afterEach,describe,it,expect,vi} from 'vitest';
import {Test} from '@nestjs/testing';
import {FastifyAdapter,type NestFastifyApplication} from '@nestjs/platform-fastify';
import {SourceContinuityController} from './source-continuity.controller';
import {SourceContinuityService} from '../application/source-continuity/source-continuity.service';
import {LinkedSourceEvidenceQuery} from '../application/source-continuity/linked-source-evidence';
import {AUTH_CONTEXT_RESOLVER,type AuthContext} from '../ports/auth';
import {SOURCE_SYNTHETIC_MODE} from '../ports/source-fixture-decoder';
import {SourceIntegrationError} from '../ports/source-observation';

describe('R4.11 continuity HTTP boundary',()=>{
 let app:NestFastifyApplication;
 const id='00000000-0000-4000-8000-000000000001';
 const admin:AuthContext={workspaceId:'qa',userId:'admin',role:'admin',isDemo:false};
 async function setup(ctx:AuthContext|null=admin,enabled=true){
  const store={command:vi.fn(),list:vi.fn().mockResolvedValue([]),linkedReceipts:vi.fn().mockResolvedValue([])};
  const read=vi.fn().mockResolvedValue(undefined),mutate=vi.fn().mockResolvedValue(undefined);
  const continuity=new SourceContinuityService(store,mutate,read,{} as never,enabled);
  const reader={read:vi.fn()};
  const module=await Test.createTestingModule({controllers:[SourceContinuityController],providers:[
   {provide:AUTH_CONTEXT_RESOLVER,useValue:{resolve:()=>ctx}}, {provide:SOURCE_SYNTHETIC_MODE,useValue:enabled},
   {provide:SourceContinuityService,useValue:continuity},{provide:LinkedSourceEvidenceQuery,useValue:new LinkedSourceEvidenceQuery(continuity,reader)},
  ]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});
  await app.init();await app.getHttpAdapter().getInstance().ready();return {store,read,mutate,reader};
 }
 afterEach(async()=>{await app?.close();});
 it.each([{ctx:null,enabled:true,status:401},{ctx:admin,enabled:false,status:404},{ctx:{...admin,isDemo:true},enabled:true,status:403}])('fails closed before storage %j',async({ctx,enabled,status})=>{
  const {store}=await setup(ctx,enabled);
  for(const tail of ['source-links','linked-evidence']){
   const r=await app.inject({url:`/source-integrations/leads/${id}/${tail}`});expect(r.statusCode).toBe(status);
   expect(r.json()).toHaveProperty('code');
  }
  expect(store.list).not.toHaveBeenCalled();expect(store.linkedReceipts).not.toHaveBeenCalled();
 });
 it('returns no-store honest projections and rejects malformed identifiers',async()=>{
  await setup();
  for(const tail of ['source-links','linked-evidence']){
   const r=await app.inject({url:`/source-integrations/leads/${id}/${tail}`});
   expect(r.statusCode).toBe(200);expect(r.headers['cache-control']).toBe('no-store');
   expect(r.json()).toMatchObject({items:[],verification:'UNVERIFIED',completeness:'UNKNOWN'});
   const invalid=await app.inject({url:`/source-integrations/leads/not-a-uuid/${tail}`});expect(invalid.statusCode).toBe(400);
  }
 });
 it('sanitizes store faults and does not return successful evidence on audit failure',async()=>{
  const {store}=await setup();store.list.mockRejectedValue(new Error('private body bearer secret'));
  const r=await app.inject({url:`/source-integrations/leads/${id}/source-links`});
  expect(r.statusCode).toBe(503);expect(r.json()).toEqual({code:'SOURCE_UNAVAILABLE'});expect(r.headers['cache-control']).toBe('no-store');expect(r.body).not.toContain('private');
 });
 it('preserves scoped access failure before reading pointers',async()=>{
  const {read,store}=await setup();read.mockRejectedValue(new SourceIntegrationError('LEAD_NOT_FOUND',404));
  const r=await app.inject({url:`/source-integrations/leads/${id}/linked-evidence`});
  expect(r.statusCode).toBe(404);expect(store.linkedReceipts).not.toHaveBeenCalled();
 });
 it.each(['sales','viewer','manager'] as const)('denies %s mutation before storage',async role=>{
  const {store}=await setup({...admin,role});
  const r=await app.inject({method:'POST',url:`/source-integrations/leads/${id}/source-links`,payload:{}});
  expect(r.statusCode).toBe(403);expect(store.command).not.toHaveBeenCalled();
 });
});
