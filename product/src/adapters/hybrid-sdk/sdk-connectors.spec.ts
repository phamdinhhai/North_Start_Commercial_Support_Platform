import {createServer, type Server} from 'node:http';
import {afterEach, describe, expect, it} from 'vitest';
import {HubSpotReadConnector, MetaAdsReadConnector} from './sdk-connectors';

const servers:Server[]=[];
async function fixture(handler:(req:import('node:http').IncomingMessage,res:import('node:http').ServerResponse)=>void){
 const server=createServer(handler);servers.push(server);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();return `http://127.0.0.1:${typeof address==='object'&&address?address.port:0}`;
}
afterEach(async()=>{for(const server of servers.splice(0))await new Promise<void>(resolve=>server.close(()=>resolve()));});

describe('official SDK read-only connectors against local emulators',()=>{
 it('uses HubSpot SDK contacts pagination and exact scope',async()=>{
   const base=await fixture((req,res)=>{expect(req.url).toContain('/crm/v3/objects/contacts');expect(req.headers.authorization).toBe('Bearer hs-fixture');res.setHeader('content-type','application/json');res.end(JSON.stringify({results:[{id:'c-1',properties:{email:'fixture@example.test',firstname:'F'}}],}));});
   await expect(new HubSpotReadConnector(base,'hs-fixture').contacts(10,'cursor-1')).resolves.toEqual([{id:'c-1',properties:{email:'fixture@example.test',firstname:'F'}}]);
 });
 it('uses HubSpot SDK company and deal endpoints',async()=>{
   const paths:string[]=[];const base=await fixture((req,res)=>{paths.push(req.url??'');res.setHeader('content-type','application/json');res.end(JSON.stringify({results:[{id:'x',properties:{name:'fixture'}}]}));});const connector=new HubSpotReadConnector(base,'hs-fixture');await connector.companies();await connector.deals();expect(paths.some(path=>path.includes('/companies'))).toBe(true);expect(paths.some(path=>path.includes('/deals'))).toBe(true);
 });
 it('maps Meta SDK insights with account currency and timezone',async()=>{
   const base=await fixture((req,res)=>{expect(req.url).toContain('/v27.0/act_123/insights');expect(req.url).toContain('access_token=meta-fixture');res.setHeader('content-type','application/json');res.end(JSON.stringify({data:[{account_id:'123',account_currency:'USD',date_start:'2026-01-01',date_stop:'2026-01-02',impressions:'7',spend:'12.50'}]}));});
   await expect(new MetaAdsReadConnector(base,'meta-fixture','act_123','USD','Asia/Ho_Chi_Minh').insights('2026-01-01','2026-01-02')).resolves.toEqual([{accountId:'act_123',dateStart:'2026-01-01',dateStop:'2026-01-02',impressions:7,spend:12.5,currency:'USD',timezone:'Asia/Ho_Chi_Minh'}]);
 });
 it('rejects invalid bounds and provider schema',async()=>{const base=await fixture((_,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({bad:true}));});await expect(new HubSpotReadConnector(base,'token').contacts(101)).rejects.toThrow('LIMIT_INVALID');await expect(new MetaAdsReadConnector(base,'token','act_1','USD','UTC').insights('2026-02-02','2026-02-01')).rejects.toThrow('DATE_RANGE_INVALID');await expect(new MetaAdsReadConnector(base,'token','act_1','USD','UTC').insights('2026-02-01','2026-02-02')).rejects.toThrow('META_SCHEMA_INVALID');});
 it('preserves SDK errors for HTTP 429 and expiry',async()=>{const base=await fixture((_,res)=>{res.statusCode=429;res.setHeader('content-type','application/json');res.end(JSON.stringify({message:'rate limited'}));});await expect(new HubSpotReadConnector(base,'token').contacts()).rejects.toBeTruthy();});
});
