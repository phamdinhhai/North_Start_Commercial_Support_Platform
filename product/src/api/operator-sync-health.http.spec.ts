import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { OperatorSyncHealthController } from './operator-sync-health.controller';
import { OperatorSyncHealthQuery } from '../application/operator-sync-health';
import { AUTH_CONTEXT_RESOLVER, type AuthContext } from '../ports/auth';
describe('operator synchronization HTTP boundary',()=>{
 let app:NestFastifyApplication;
 const admin:AuthContext={workspaceId:'w',userId:'a',role:'admin',isDemo:false};
 const id='00000000-0000-4000-8000-000000000001';
 async function setup(ctx:AuthContext|null=admin,enabled=true){
  const reader={list:vi.fn().mockResolvedValue({items:[],observedAt:'2026-01-01T00:00:00Z',truncated:false})},control={control:vi.fn()};
  const m=await Test.createTestingModule({controllers:[OperatorSyncHealthController],providers:[{provide:AUTH_CONTEXT_RESOLVER,useValue:{resolve:()=>ctx}},{provide:OperatorSyncHealthQuery,useValue:new OperatorSyncHealthQuery(reader,control,enabled)}]}).compile();
  app=m.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('v1');await app.init();await app.getHttpAdapter().getInstance().ready();return {reader,control};
 }
 afterEach(async()=>app?.close());
 it('returns no-store operational empty state to managers without provider or credential details',async()=>{
  const {reader}=await setup({...admin,role:'manager'});const r=await app.inject({url:'/v1/source-integrations/sync-health'});
  expect(r.statusCode).toBe(200);expect(r.headers['cache-control']).toBe('no-store');expect(r.json()).toMatchObject({classification:'OPERATIONAL_SYNC_TELEMETRY_NOT_COMMERCIAL_EVIDENCE',items:[],completeness:'UNKNOWN'});expect(reader.list).toHaveBeenCalledWith('w',100);
 });
 it.each([{ctx:null,status:401},{ctx:{...admin,role:'sales' as const},status:403},{ctx:{...admin,isDemo:true},status:403}])('rejects unauthorized health requests %j',async({ctx,status})=>{const {reader}=await setup(ctx);const r=await app.inject({url:'/v1/source-integrations/sync-health'});expect(r.statusCode).toBe(status);expect(reader.list).not.toHaveBeenCalled();});
 it('denies manager mutation and rejects forged workspace/action fields',async()=>{
  let s=await setup({...admin,role:'manager'});const denied=await app.inject({method:'POST',url:`/v1/source-integrations/sync-health/${id}/control`,payload:{action:'pause'}});expect(denied.statusCode).toBe(403);expect(s.control.control).not.toHaveBeenCalled();await app.close();
  s=await setup();for(const payload of [{action:'reset'},{action:'pause',workspaceId:'foreign'},{action:'pause',cursor:'skip'}]){const r=await app.inject({method:'POST',url:`/v1/source-integrations/sync-health/${id}/control`,payload});expect(r.statusCode).toBe(400);}expect(s.control.control).not.toHaveBeenCalled();
 });
 it('binds admin control to resolved workspace and fails closed without detailed exception',async()=>{
  const {control,reader}=await setup();const r=await app.inject({method:'POST',url:`/v1/source-integrations/sync-health/${id}/control`,payload:{action:'pause'}});expect(r.statusCode).toBe(201);expect(control.control).toHaveBeenCalledWith('w',id,'pause','a');
  reader.list.mockRejectedValue(new Error('token=do-not-print'));const fault=await app.inject({url:'/v1/source-integrations/sync-health'});expect(fault.statusCode).toBe(503);expect(fault.headers['cache-control']).toBe('no-store');expect(fault.json()).toEqual({code:'HEALTH_UNAVAILABLE'});expect(fault.body).not.toContain('do-not-print');
 });
 it('refuses report and control when not composed enabled',async()=>{const {reader,control}=await setup(admin,false);expect((await app.inject({url:'/v1/source-integrations/sync-health'})).statusCode).toBe(404);expect((await app.inject({method:'POST',url:`/v1/source-integrations/sync-health/${id}/control`,payload:{action:'pause'}})).statusCode).toBe(404);expect(reader.list).not.toHaveBeenCalled();expect(control.control).not.toHaveBeenCalled();});
});
