import {withBoundedFixtureRelay} from './bounded-fixture-relay';
import {Client as HubSpotClient} from '@hubspot/api-client';
import {FacebookAdsApi} from 'facebook-nodejs-business-sdk';
import {metaReportingFacts} from './provider-fact-quality';

export interface HubSpotRecord {readonly id:string;readonly properties:Record<string,string|undefined>}
export interface HubSpotReadPage {readonly records:HubSpotRecord[];readonly nextCursor:string|null;readonly completeness:'UNKNOWN'}
export interface MetaInsight {readonly accountId:string;readonly campaignId?:string;readonly dateStart:string;readonly dateStop:string;readonly impressions:number;readonly spend:number;readonly currency:string;readonly timezone:string;readonly reportingFacts:ReturnType<typeof metaReportingFacts>}
export interface MetaReadPage {readonly records:MetaInsight[];readonly nextCursor:string|null;readonly completeness:'UNKNOWN';readonly timezoneSource:'caller-supplied'}

const validBase = (value:string) => {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash || url.pathname!=='/') throw new Error('LOCAL_PROVIDER_BASE_REQUIRED');
  return url.toString().replace(/\/$/u,'');
};
const fixtureToken = (value:string,prefix:'hs'|'meta') => new RegExp(`^${prefix}-fixture(?:-[A-Za-z0-9_-]+)?$`,'u').test(value);
/** Validate an SDK endpoint before constructing an official client. Real egress
 * remains disabled in this acceptance slice; HTTPS hosts must be explicitly
 * allowlisted by the caller and loopback is reserved for fabricated fixtures. */
export function validateSdkEndpoint(value:string, allowedHttpsHosts:readonly string[]=[]):string {
  const url=new URL(value);
  if(url.protocol==='http:') return validBase(value);
  if(url.protocol!=='https:'||url.port&&url.port!=='443'||url.hostname==='localhost'||!/[a-z]/iu.test(url.hostname)||url.hostname.includes(':')||url.username||url.password||url.search||url.hash||url.pathname!=='/'||!allowedHttpsHosts.includes(url.hostname)) throw new Error('PROVIDER_BASE_NOT_ALLOWLISTED');
  return url.toString().replace(/\/$/u,'');
}
export function redactCredential(value:string):string { return value.replace(/([?&](?:access_token|page_access_token|api_key|token)=)[^&]*/giu,'$1[REDACTED]').replace(/Bearer\s+[^\s]+/giu,'Bearer [REDACTED]'); }
export class SdkReadError extends Error {
 constructor(readonly code:'AUTH_EXPIRED'|'FORBIDDEN'|'RATE_LIMITED'|'PROVIDER_UNAVAILABLE',readonly status:number|null){super(code);}
}
function safeError(error:unknown):never {
 const v=error&&typeof error==='object'?error as Record<string,unknown>:{};
 const status=Number(v.code??v.statusCode??v.status??0);
 throw new SdkReadError(status===401?'AUTH_EXPIRED':status===403?'FORBIDDEN':status===429?'RATE_LIMITED':'PROVIDER_UNAVAILABLE',Number.isInteger(status)&&status>=100&&status<=599?status:null);
}

/** Official HubSpot SDK, constrained to a local emulator in this acceptance slice. */
export class HubSpotReadConnector {
  private readonly basePath:string;
  private readonly accessToken:string;
  constructor(basePath:string, accessToken:string) {
    if (!fixtureToken(accessToken,'hs')) throw new Error('FABRICATED_FIXTURE_TOKEN_REQUIRED');
    // The official SDK's Node transport does not expose redirect:'error'. The base
    // is loopback-pinned and tokens are fabricated-only, so this is emulator-only.
    this.basePath=validBase(basePath);this.accessToken=accessToken;
  }
  async contacts(limit=100, after?:string):Promise<HubSpotRecord[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('LIMIT_INVALID');
    return (await this.readPage('contacts',limit,after)).records;
  }
  async companies(limit=100, after?:string):Promise<HubSpotRecord[]> {
    return (await this.readPage('companies',limit,after)).records;
  }
  async deals(limit=100, after?:string):Promise<HubSpotRecord[]> {
    return (await this.readPage('deals',limit,after)).records;
  }
  async readPage(kind:'contacts'|'companies'|'deals',limit=100,after?:string):Promise<HubSpotReadPage> {
    if(!['contacts','companies','deals'].includes(kind)||!Number.isInteger(limit)||limit<1||limit>100||after!==undefined&&(typeof after!=='string'||after.length>512||/[\x00-\x1f]/u.test(after)))throw new Error('LIMIT_INVALID');
    const props={contacts:['email','firstname','lastname'],companies:['name','domain'],deals:['dealname','dealstage','amount']}[kind];
    let values;
    try{values=await withBoundedFixtureRelay(this.basePath,basePath=>new HubSpotClient({basePath,accessToken:this.accessToken,numberOfApiCallRetries:0}).crm[kind].basicApi.getPage(limit,after,props));}catch(error){return safeError(error);}
    if(!values||!Array.isArray(values.results)||values.results.length>limit)throw new Error('HUBSPOT_SCHEMA_INVALID');
    const cursor=values.paging?.next?.after??null;
    if(cursor!==null&&(typeof cursor!=='string'||cursor.length>512))throw new Error('HUBSPOT_SCHEMA_INVALID');
    const records=values.results.map(value=>{
      if(!value||typeof value!=='object'||typeof value.id!=='string'||!value.id||value.id==='undefined'||value.id.length>256||!value.properties||typeof value.properties!=='object'||Array.isArray(value.properties))throw new Error('HUBSPOT_SCHEMA_INVALID');
      return {id:value.id,properties:Object.fromEntries(Object.entries(value.properties).filter(([key])=>props.includes(key)).map(([key,item])=>[key,item===null?undefined:String(item)]))};
    });
    return {records,nextCursor:cursor,completeness:'UNKNOWN'};
  }
}

/** Official Meta Business SDK read path. Writes are deliberately absent. */
export class MetaAdsReadConnector {
  private readonly api:FacebookAdsApi;
  private readonly baseUrl:string;
  constructor(baseUrl:string, accessToken:string, private readonly accountId:string, private readonly currency:string, private readonly timezone:string) {
    if (!/^act_[A-Za-z0-9]+$/u.test(accountId) || !currency || !timezone) throw new Error('META_SCOPE_INVALID');
    if (!fixtureToken(accessToken,'meta')) throw new Error('FABRICATED_FIXTURE_TOKEN_REQUIRED');
    this.baseUrl=validBase(baseUrl); this.api=new FacebookAdsApi(accessToken,'en_US',false);
  }
  async insights(dateStart:string,dateStop:string):Promise<MetaInsight[]> {
    return (await this.readPage(dateStart,dateStop)).records;
  }
  /** Single bounded SDK page only; no claim about permanent history completeness. */
  async readPage(dateStart:string,dateStop:string):Promise<MetaReadPage> {
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(dateStart) || !/^\d{4}-\d{2}-\d{2}$/u.test(dateStop) || dateStart > dateStop) throw new Error('DATE_RANGE_INVALID');
    let value:{data?:Array<Record<string,unknown>>;paging?:{cursors?:{after?:unknown}}};
    try{value=await withBoundedFixtureRelay(this.baseUrl,baseUrl=>this.api.call('GET',[this.accountId,'insights'],{level:'campaign',fields:'campaign_id,account_id,account_currency,date_start,date_stop,impressions,spend',time_range:JSON.stringify({since:dateStart,until:dateStop})},{},false,baseUrl)) as typeof value;}catch(error){return safeError(error);}
    if (!Array.isArray(value?.data)||value.data.length>100) throw new Error('META_SCHEMA_INVALID');
    const cursor=value.paging?.cursors?.after??null;
    if(cursor!==null&&(typeof cursor!=='string'||cursor.length>512))throw new Error('META_SCHEMA_INVALID');
    const records=value.data.map(row=>{
      if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('META_SCHEMA_INVALID');
      if(String(row.account_id)!==this.accountId.slice(4)||row.account_currency!==this.currency)throw new Error('META_SCOPE_MISMATCH');
      if(!/^\d{4}-\d{2}-\d{2}$/u.test(String(row.date_start))||!/^\d{4}-\d{2}-\d{2}$/u.test(String(row.date_stop))||!Number.isSafeInteger(Number(row.impressions))||Number(row.impressions)<0||!Number.isFinite(Number(row.spend))||Number(row.spend)<0)throw new Error('META_SCHEMA_INVALID');
      if(row.campaign_id!==undefined&&(typeof row.campaign_id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(row.campaign_id)))throw new Error('META_SCHEMA_INVALID');
      if(String(row.date_start)<dateStart||String(row.date_stop)>dateStop||String(row.date_start)>String(row.date_stop))throw new Error('META_WINDOW_MISMATCH');
      const reportingFacts=metaReportingFacts({providerCurrency:String(row.account_currency),configuredCurrency:this.currency,configuredTimezone:this.timezone,since:String(row.date_start),until:String(row.date_stop)});
      return {accountId:this.accountId,...(row.campaign_id?{campaignId:String(row.campaign_id)}:{}),dateStart:String(row.date_start),dateStop:String(row.date_stop),impressions:Number(row.impressions),spend:Number(row.spend),currency:String(row.account_currency),timezone:this.timezone,reportingFacts};
    });
    return {records,nextCursor:cursor,completeness:'UNKNOWN',timezoneSource:'caller-supplied'};
  }
}
