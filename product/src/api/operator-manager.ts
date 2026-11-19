/** Standalone read-only operator extension. Call cleanup when the session/workspace changes. */
export const OPERATOR_MANAGER_SCRIPT = String.raw`
window.mountManagerExceptions = ({container, request, openLead}) => {
 let active = true, epoch = 0, after;
 const labels = {owner_unassigned:'Owner unassigned',awaiting_acceptance:'Handoff awaiting acceptance (age only; no SLA judgment)',recipient_inactive:'Recipient membership revoked, ineligible or user disabled',recipient_unknown:'Recipient membership unknown',overdue_open_work:'Current open work past its recorded due date',claimed_outcome_with_open_work:'Claimed outcome with current open work',source_evidence_missing:'Source evidence reference unavailable',context_unknown:'Context UNKNOWN',source_unknown:'Conversation source UNKNOWN'};
 const make = (tag,text) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 container.replaceChildren();
 const title=make('h2','Manager exceptions'),note=make('p','Workspace observations only. Claims remain claims; UNKNOWN remains visible. No revenue or attribution inference.'),filter=make('select'),refresh=make('button','Refresh'),next=make('button','Scan next page'),status=make('p'),list=make('div');
 for(const [value,label] of [['real','Real data'],['synthetic','Synthetic data'],['unknown','Classification UNKNOWN'],['all','All classifications']]){const option=make('option',label);option.value=value;filter.append(option);}
 filter.setAttribute('aria-label','Manager exceptions data classification');refresh.type=next.type='button';next.hidden=true;
 container.append(title,note,filter,refresh,status,list,next);
 async function load(reset){if(reset)after=undefined;const ticket=++epoch;refresh.disabled=next.disabled=true;status.textContent='Scanning bounded page…';list.replaceChildren();
  try{const q=new URLSearchParams({classification:filter.value,limit:'50'});if(after)q.set('after',after);const page=await request('/v1/pilot/manager-exceptions?'+q);if(!active||ticket!==epoch)return;
   status.textContent='Scanned '+page.scannedLeads+' leads in this page. '+page.items.length+' leads have observations. '+(page.hasMore?'More leads remain; these are not workspace totals.':'End of this scan. Refresh to see later changes.');
   for(const item of page.items){const card=make('article'),button=make('button',item.displayName+' · '+item.leadId+' · '+item.classification);button.type='button';button.onclick=()=>openLead(item.leadId);card.append(button);const reasons=make('ul');for(const code of item.observations){let label=labels[code]||code;if(code==='awaiting_acceptance'&&Number.isFinite(item.awaitingAgeSeconds))label+=' · '+item.awaitingAgeSeconds+' seconds since '+item.awaitingSince;reasons.append(make('li',label));}card.append(reasons);list.append(card);}
   if(!page.items.length)list.append(make('p','No observations in this scanned page.'));after=page.nextAfter;next.hidden=!page.hasMore;
  }catch(e){if(!active||ticket!==epoch)return;next.hidden=true;status.textContent=e.status===403?'Manager access required.':e.status===503?'Manager exceptions require durable storage.':'Unable to load manager exceptions. Refresh to retry.';}
  finally{if(active&&ticket===epoch)refresh.disabled=next.disabled=false;}}
 refresh.onclick=()=>load(true);filter.onchange=()=>load(true);next.onclick=()=>load(false);load(true);
 return ()=>{active=false;epoch++;container.replaceChildren();};
};
`;

