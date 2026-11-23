export type AdditionalProvider='google-ads'|'shopify'|'sapo'|'salesforce'|'twenty'|'frappe';
export interface AdditionalRecord {readonly provider:AdditionalProvider;readonly nativeId:string;readonly label:string|null}
export interface ReadTransport {request(path:string,query:Record<string,string>):Promise<unknown>}

const routes:Record<AdditionalProvider,string>={
 'google-ads':'/googleads/v18/customers',shopify:'/admin/api/2025-01/products.json',sapo:'/admin/products',salesforce:'/services/data/v61.0/query',twenty:'/rest/people',frappe:'/api/resource/CRM%20Lead',
};
/** Read-only boundary contracts; each provider uses an injected official-client/HTTP transport. */
export class AdditionalReadConnector {
 constructor(private readonly provider:AdditionalProvider,private readonly transport:ReadTransport){}
 async list(query:Record<string,string>={}):Promise<AdditionalRecord[]> {
  const payload=await this.transport.request(routes[this.provider],query);
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('PROVIDER_SCHEMA_INVALID');
  const value=payload as Record<string,unknown>;
  const key=this.provider==='shopify'?'products':this.provider==='sapo'?'products':this.provider==='salesforce'?'records':this.provider==='twenty'?'data':this.provider==='frappe'?'data':'results';
  if(!Array.isArray(value[key]))throw new Error('PROVIDER_SCHEMA_INVALID');
  return (value[key] as unknown[]).map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row))throw new Error('PROVIDER_SCHEMA_INVALID');
   let fields=row as Record<string,unknown>;
   if(this.provider==='google-ads'){if(!fields.customer||typeof fields.customer!=='object')throw new Error('PROVIDER_SCHEMA_INVALID');fields=fields.customer as Record<string,unknown>;}
   const id=fields.id??fields.Id??fields.resourceName??(this.provider==='frappe'?fields.name:undefined);
   if((typeof id!=='string'&&typeof id!=='number')||!String(id)||String(id).length>256)throw new Error('PROVIDER_NATIVE_ID_MISSING');
   const label=fields.title??fields.Name??fields.name??fields.descriptiveName??null;
   return {provider:this.provider,nativeId:String(id),label:typeof label==='string'?label:null};
  });
 }
}
