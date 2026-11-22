import type {IntegrationScope} from '../../ports/integration';
import type {HybridFixtureReader} from '../../ports/hybrid-fixture-reader';
import {HubSpotReadConnector, MetaAdsReadConnector} from './sdk-connectors';
import {withBoundedFixtureRelay} from './bounded-fixture-relay';

interface Config {
 workspaceId:string; connectionId:string; accountId:string; baseUrl:string;
 accessToken:string; expiresAt:string; currency?:string; timezone?:string; revoked?:boolean;
}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,256}$/u.test(v);
const object=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
function fixtureFacts(label:unknown) {
 if(label===undefined)return {};
 if(typeof label!=='string'||!/^fixture-[A-Za-z0-9_-]{1,64}$/u.test(label))throw new Error('FABRICATED_FACT_REQUIRED');
 return {facts:{label,lifecycle:'present'}};
}
function loopback(base:string) {
 const url=new URL(base);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.pathname!=='/'||url.username||url.password||url.search||url.hash)throw new Error('LOCAL_PROVIDER_BASE_REQUIRED');
}

/** Server-owned fixture config; never accepts provider endpoints or credentials from a client. */
export class ConfiguredHybridFixtureReader implements HybridFixtureReader {
 private readonly configs:Config[];
 private readonly budgets=new Map<string,{start:number;last:number;count:number}>();
 constructor(raw:string|undefined=process.env.HYBRID_API_FIXTURES_JSON) {
  let parsed:unknown;
  try{parsed=raw?JSON.parse(raw):[];}catch{throw new Error('HYBRID_FIXTURE_CONFIG_INVALID');}
  if((raw?.length??0)>32768||!Array.isArray(parsed)||parsed.length>25)throw new Error('HYBRID_FIXTURE_CONFIG_INVALID');
  const seen=new Set<string>();
  this.configs=parsed.map(value=>{
   const v=object(value);
   if(!v||!id(v.workspaceId)||!id(v.connectionId)||!id(v.accountId)||typeof v.baseUrl!=='string'||typeof v.accessToken!=='string'||!/^(pancake|meta|hs)-fixture(?:-[A-Za-z0-9_-]+)?$/u.test(v.accessToken)||typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt)))throw new Error('HYBRID_FIXTURE_CONFIG_INVALID');
   loopback(v.baseUrl);
   const key=JSON.stringify([v.workspaceId,v.connectionId]);
   if(seen.has(key))throw new Error('DUPLICATE_CREDENTIAL_SCOPE');
   seen.add(key);return {...v} as unknown as Config;
  });
 }
 revoke(workspaceId:string,connectionId:string) {
  const c=this.configs.find(v=>v.workspaceId===workspaceId&&v.connectionId===connectionId);
  if(c)c.revoked=true;
 }
 private admit(scope:IntegrationScope) {
  const c=this.configs.find(v=>v.workspaceId===scope.workspaceId&&v.connectionId===scope.connectionId);
  if(!c||c.revoked||c.accountId!==scope.accountId||Date.parse(c.expiresAt)<=Date.now())throw new Error('CREDENTIAL_UNAVAILABLE');
  if(!scope.target||!Object.keys(scope.target).length||Object.values(scope.target).some(v=>!v.startsWith('fixture-')||!id(v)))throw new Error('FIXTURE_TARGET_REQUIRED');
  const key=JSON.stringify([scope.workspaceId,scope.connectionId]),now=Date.now();
  let budget=this.budgets.get(key);
  if(!budget||now-budget.start>=60000)budget={start:now,last:0,count:0};
  if(budget.count>=25||budget.last&&now-budget.last<1000)throw new Error('LOCAL_RATE_LIMIT');
  budget.count++;budget.last=now;this.budgets.set(key,budget);return c;
 }
 async read(scope:IntegrationScope):ReturnType<HybridFixtureReader['read']> {
  const c=this.admit(scope),target=scope.target!;
  if(scope.providerSurface==='pancake-conversations') {
   if(!c.accessToken.startsWith('pancake-fixture')||!target.pageId||!target.conversationId)throw new Error('CREDENTIAL_CLASS_MISMATCH');
   return withBoundedFixtureRelay(c.baseUrl,async base=>{
    const endpoint=new URL(`/api/public_api/v1/pages/${target.pageId}/conversations/${target.conversationId}/messages`,base);
    endpoint.searchParams.set('page_access_token',c.accessToken);
    const response=await fetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(2500)});
    if(!response.ok)throw new Error('PANCAKE_READ_REJECTED');
    const value=object(await response.json());
    if(value?.success!==true||value.page_id!==target.pageId||value.conversation_id!==target.conversationId)throw new Error('PANCAKE_SCOPE_MISMATCH');
    // fixture_label is emulator-only metadata, never represented as an official Pancake field.
    return {native:{accountId:scope.accountId,pageId:String(value.page_id),conversationId:String(value.conversation_id)},...fixtureFacts(value.fixture_label)};
   });
  }
  if(scope.providerSurface==='meta-ads') {
   const page=await new MetaAdsReadConnector(c.baseUrl,c.accessToken,scope.accountId,c.currency??'',c.timezone??'').readPage('2026-11-01','2026-11-20');
   const row=page.records.find(v=>v.campaignId===target.campaignId);
   if(!row)throw new Error('META_SCOPE_MISMATCH');
   return {native:{accountId:row.accountId,campaignId:row.campaignId!},...fixtureFacts(row.campaignName)};
  }
  if(scope.providerSurface!=='hubspot-crm')throw new Error('PROVIDER_SURFACE_INVALID');
  const records=await new HubSpotReadConnector(c.baseUrl,c.accessToken).contacts(100);
  const row=records.find(v=>v.id===target.contactId);
  if(!row)throw new Error('HUBSPOT_SCOPE_MISMATCH');
  return {native:{accountId:scope.accountId,contactId:row.id},...fixtureFacts(row.properties.firstname)};
 }
}
