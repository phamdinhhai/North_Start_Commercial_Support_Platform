import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { AssertionDeliveryOps } from './assertion-delivery.ops';
import type { PostgresService } from '../postgres/postgres.service';
const actor={workspaceId:'ws',userId:randomUUID(),role:'admin' as const,isDemo:false};
function setup(row={status:'FAILED',attempts:2,last_error:'SINK_FAILED'}) {
 const query=vi.fn().mockResolvedValueOnce({rows:[row],rowCount:1}).mockResolvedValue({rows:[],rowCount:1});
 const db={query,withTransaction:vi.fn(async(fn:(tx:{query:typeof query})=>unknown)=>fn({query}))};
 return {ops:new AssertionDeliveryOps(db as unknown as PostgresService),query,db};
}
function enable(){vi.stubEnv('AUTH_MODE','oidc');vi.stubEnv('ASSERTION_DELIVERY_ENABLED','true');vi.stubEnv('DEPLOYMENT_MODE','test');vi.stubEnv('PILOT_STORE_MODE','postgres');vi.stubEnv('DATABASE_URL','postgresql://127.0.0.1/private');}
afterEach(()=>vi.unstubAllEnvs());
describe('assertion operations authorization and atomic audit',()=>{
 it('denies flag-off, unauthenticated, demo and every non-admin role before database access',async()=>{
  const {ops,db}=setup();vi.stubEnv('ASSERTION_DELIVERY_ENABLED','false');
  await expect(ops.inspect(actor)).rejects.toThrow('DISABLED');enable();
  for(const ctx of [null,{...actor,isDemo:true},{...actor,userId:'legacy'},...(['manager','sales','viewer'] as const).map(role=>({...actor,role}))]) await expect(ops.inspect(ctx)).rejects.toThrow();
  expect(db.query).not.toHaveBeenCalled();
 });
 it('replays with row lock and audit in the same transaction, using server workspace',async()=>{
  enable();const {ops,query,db}=setup();const id=randomUUID();await ops.change(actor,id,'replay');
  expect(db.withTransaction).toHaveBeenCalledTimes(1);expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
  expect(query.mock.calls[0][1]).toEqual(['ws',id]);expect(query.mock.calls[2][1]).toEqual(['ws',id,actor.userId,'replay','FAILED',2]);
 });
 it('refuses poison replay, conflict replay, delivered replay, live-lease stop and malformed ids',async()=>{
  enable();
  for(const row of [
   {status:'FAILED',attempts:1,last_error:'INVALID_ENVELOPE'},
   {status:'FAILED',attempts:1,last_error:'ENVELOPE_CONFLICT'},
   {status:'DELIVERED',attempts:1,last_error:''},
  ])await expect(setup(row).ops.change(actor,randomUUID(),'replay')).rejects.toThrow('CONFLICT');
  await expect(setup({status:'LEASED',attempts:1,last_error:''}).ops.change(actor,randomUUID(),'stop')).rejects.toThrow('CONFLICT');
  await expect(setup().ops.change(actor,'bad','stop')).rejects.toThrow('INPUT_INVALID');
 });
 it('stops pending delivery without changing evidence',async()=>{
  enable();const {ops,query}=setup({status:'PENDING',attempts:0,last_error:''});await ops.change(actor,randomUUID(),'stop');
  expect(query.mock.calls[1][1]).toContain('OPERATOR_STOP');expect(query.mock.calls[1][0]).not.toContain('envelope=');
 });
});
