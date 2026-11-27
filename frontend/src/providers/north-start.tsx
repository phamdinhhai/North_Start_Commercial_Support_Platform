import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {HttpError,type AuthProvider,type DataProvider} from 'ra-core';

export interface Session {authenticated:boolean;csrfToken?:string;loginAvailable?:boolean;syntheticOnly?:boolean;sourceIntegration?:boolean;context?:{workspaceId:string;userId:string;role:string;displayName?:string}}
export interface LeadRecord {id:string;leadId:string;displayName:string;status:string;ownerUserId?:string;version:number;isSynthetic?:boolean;currentContext?:string|null;[key:string]:unknown}
export interface LeadDetail {version:number;isSynthetic:boolean;currentContext:string|null|{text:string};lead:{id:string;displayName:string;status:string;owner?:string;handoffRecipient?:string};workItems:Array<{id:string;action:string;status:string;actor:string;dueAt?:string;completionEvidence:string}>;outcomes:Array<{id:string;value:string;actor:string;reason:string;timestamp:string;assertionStatus?:string}>}
let current:Session={authenticated:false};let generation=0;
const changed=()=>window.dispatchEvent(new Event('north-start-session'));
const identity=(s:Session)=>[s.authenticated,s.context?.workspaceId,s.context?.userId,s.context?.role].join(':');
export const northStart={
 get session(){return current;},get generation(){return generation;},
 async request<T=any>(path:string,init:RequestInit={}):Promise<T>{
  if(!path.startsWith('/v1/')||path.startsWith('//'))throw new Error('Chá»‰ cho phĂ©p API North Start cĂ¹ng origin.');
  const ticket=generation;const mutation=init.method&&init.method!=='GET';
  const response=await fetch(path,{...init,credentials:'same-origin',redirect:'error',headers:{...(mutation?{'Content-Type':'application/json','X-CSRF-Token':current.csrfToken??''}:{}),...init.headers}});
  const body=response.status===204?null:await response.json().catch(()=>({code:'INVALID_RESPONSE',message:'Pháº£n há»“i khĂ´ng há»£p lá»‡.'}));
  if(ticket!==generation)throw new HttpError('PhiĂªn hoáº·c workspace Ä‘Ă£ thay Ä‘á»•i.',409,{code:'STALE_SESSION'});
  if(!response.ok){if(response.status===401){current={authenticated:false,loginAvailable:true};generation++;changed();}else if(response.status===403){window.location.hash='#/access-denied';generation++;changed();}throw new HttpError(body?.message??'YĂªu cáº§u khĂ´ng thĂ nh cĂ´ng.',response.status,body);}
  return body as T;
 },
 async refresh(){const fresh=await northStart.request<Session>('/v1/auth/session');if(identity(fresh)!==identity(current))generation++;current=fresh;changed();return fresh;},
 async logout(){try{await northStart.request('/v1/auth/logout',{method:'POST',body:'{}'});}finally{current={authenticated:false,loginAvailable:true};generation++;changed();}},
 async command(leadId:string,version:number,path:string,body:Record<string,unknown>,operationKey=crypto.randomUUID()){return northStart.request('/v1/pilot/leads/'+encodeURIComponent(leadId)+path,{method:'POST',body:JSON.stringify({...body,expectedVersion:version,idempotencyKey:operationKey})});},
};
const SessionContext=createContext({session:current,generation:0,refresh:northStart.refresh,logout:northStart.logout});
export function SessionProvider({children}:{children:ReactNode}){const [state,setState]=useState({session:current,generation});const [loading,setLoading]=useState(true);const [error,setError]=useState('');useEffect(()=>{const update=()=>setState({session:current,generation});const refresh=()=>{void northStart.refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));};window.addEventListener('north-start-session',update);window.addEventListener('focus',refresh);refresh();return()=>{window.removeEventListener('north-start-session',update);window.removeEventListener('focus',refresh);};},[]);if(loading)return <div className="grid min-h-screen place-items-center">Äang kiá»ƒm tra phiĂªn North Startâ€¦</div>;return <SessionContext.Provider value={{...state,refresh:northStart.refresh,logout:northStart.logout}}>{error&&<p role="alert" className="bg-amber-50 p-2 text-center text-sm">{error}</p>}{children}</SessionContext.Provider>;}
export const useSession=()=>useContext(SessionContext);
export const roleLabel=(role?:string)=>({sales:'Sales',manager:'Manager',admin:'Admin',viewer:'Viewer'}[role??'']??'Workspace member');
export const subjectLabel=(s:Session)=>s.context?.displayName??roleLabel(s.context?.role);
export const NorthStartPermissionProvider={canManage:(s:Session)=>['admin','manager'].includes(s.context?.role??''),canWrite:(s:Session)=>s.context?.role==='sales',canAdmin:(s:Session)=>s.context?.role==='admin'};
export const NorthStartResourceMapper={lead:(value:any):LeadRecord=>({...value,id:value.leadId??value.id}),detail:(value:LeadDetail)=>({...value.lead,id:value.lead.id,detail:value})};
export const NorthStartAuthProvider:AuthProvider={login:async()=>{window.open('/v1/auth/login','_blank','noopener');},logout:northStart.logout,checkAuth:async()=>{if(!current.authenticated)throw new Error('ÄÄƒng nháº­p láº¡i.');},checkError:async error=>{if(error.status===401)throw error;},getIdentity:async()=>({id:current.context?.userId??'unknown',fullName:subjectLabel(current)}),getPermissions:async()=>current.context?.role,canAccess:async({action})=>action==='list'||action==='show'||NorthStartPermissionProvider.canWrite(current)};
const cursors=new Map<string,string>();
export const NorthStartDataProvider:DataProvider={
 getList:async(resource,params)=>{if(resource!=='leads')throw new HttpError('Unsupported resource',404);const page=params.pagination?.page??1;const limit=params.pagination?.perPage??25;const search=typeof params.filter?.q==='string'?params.filter.q.trim():'';const key=identity(current)+':'+limit+':'+page+':'+search;const after=page===1?undefined:cursors.get(key);if(page>1&&!after)throw new HttpError('Cursor required',400);const result=await northStart.request<{items:LeadRecord[];nextCursor?:string}>('/v1/pilot/leads?classification=synthetic&limit='+limit+(search.length>=2?'&search='+encodeURIComponent(search):'')+(after?'&after='+encodeURIComponent(after):''));if(result.nextCursor)cursors.set(identity(current)+':'+limit+':'+(page+1)+':'+search,result.nextCursor);return {data:result.items.map(NorthStartResourceMapper.lead) as any,pageInfo:{hasNextPage:!!result.nextCursor,hasPreviousPage:page>1}};},
 getOne:async(_resource,params)=>({data:NorthStartResourceMapper.detail(await northStart.request<LeadDetail>('/v1/pilot/leads/'+encodeURIComponent(params.id))) as any}),
 getMany:async(_resource,params)=>({data:await Promise.all(params.ids.map(async id=>NorthStartResourceMapper.detail(await northStart.request<LeadDetail>('/v1/pilot/leads/'+encodeURIComponent(id))))) as any}),
 getManyReference:async()=>({data:[],total:0}),
 create:async(_resource,params)=>{const result=await northStart.request<{leadId:string}>('/v1/pilot/scenarios',{method:'POST',body:JSON.stringify(params.data)});return {data:{...params.data,id:result.leadId} as any};},
 update:async()=>{throw new HttpError('DĂ¹ng hĂ nh Ä‘á»™ng cĂ³ phiĂªn báº£n vĂ  kiá»ƒm toĂ¡n.',405);},updateMany:async()=>{throw new HttpError('KhĂ´ng cho phĂ©p sá»­a hĂ ng loáº¡t.',405);},delete:async()=>{throw new HttpError('KhĂ´ng cho phĂ©p xĂ³a Lead.',405);},deleteMany:async()=>{throw new HttpError('KhĂ´ng cho phĂ©p xĂ³a Lead.',405);},
};
