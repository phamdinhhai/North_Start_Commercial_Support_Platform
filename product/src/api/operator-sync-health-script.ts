/** Separate optional mount; root composition chooses when an operator sees it. No HTML interpolation. */
export const OPERATOR_SYNC_HEALTH_SCRIPT=String.raw`
window.mountSyncHealth=({container,request,canControl=false})=>{
 let active=true,generation=0;
 const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const refresh=node('button','Refresh synchronization health'),status=node('p',''),list=node('div','');
 refresh.type='button';status.setAttribute('role','status');
 container.replaceChildren(node('h2','Integration data health'),node('p','Operational telemetry only. Offline synthetic work does not prove provider connectivity. Completeness and external lag remain UNKNOWN.'),refresh,status,list);
 const load=async()=>{
  const ticket=++generation;refresh.disabled=true;status.textContent='Loading...';
  try{
   const data=await request('/v1/source-integrations/sync-health');if(!active||ticket!==generation)return;
   list.replaceChildren();status.textContent=data.truncated?'Bounded result. Additional streams may exist; completeness UNKNOWN.':'Completeness UNKNOWN.';
   for(const row of data.items){
    const card=node('article',''),details=node('pre',JSON.stringify(row,null,2));card.append(details);
    if(canControl)for(const action of ['pause','resume','revoke']){const b=node('button',action+' synthetic synchronization');b.type='button';b.onclick=async()=>{
     if(action==='revoke'&&!confirm('Revoke this stream? Immutable evidence remains.'))return;
     b.disabled=true;try{await request('/v1/source-integrations/sync-health/'+encodeURIComponent(row.streamId)+'/control',{method:'POST',body:JSON.stringify({action})});await load();}catch{if(active)status.textContent='Control unavailable. Refresh current authorization and stream status.';}finally{if(active)b.disabled=false;}
    };card.append(b);}
    list.append(card);
   }
   if(!data.items.length)list.append(node('p','No synchronization streams visible in this workspace.'));
  }catch{if(active&&ticket===generation)status.textContent='Synchronization health unavailable. Check current operator access.';}
  finally{if(active&&ticket===generation)refresh.disabled=false;}
 };
 refresh.onclick=load;load();return()=>{active=false;generation++;container.replaceChildren();};
};
`;
