export const OPERATOR_CLIENT_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>North Star Operator</title>
<style>
:root{color-scheme:light;--ink:#17202a;--muted:#5b6875;--line:#d9e0e7;--accent:#146c94;--danger:#a61b1b;--surface:#f6f8fa}*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,sans-serif;color:var(--ink);background:var(--surface)}header{background:#fff;border-bottom:1px solid var(--line);padding:1rem 4vw;display:flex;gap:1rem;align-items:center;justify-content:space-between}h1,h2,h3,h4{margin:.25rem 0}main{display:grid;grid-template-columns:minmax(18rem,30rem) minmax(20rem,1fr);gap:1rem;max-width:1200px;margin:1rem auto;padding:0 1rem}.panel{background:#fff;border:1px solid var(--line);border-radius:.5rem;padding:1rem}label{display:block;font-weight:600;margin:.65rem 0 .2rem}input,select,button,textarea{font:inherit;padding:.55rem;border:1px solid #aeb9c4;border-radius:.3rem;max-width:100%}input,select,textarea{width:100%}input[type=checkbox]{width:auto;margin-right:.45rem}button{background:var(--accent);color:#fff;border:0;cursor:pointer;margin:.35rem .35rem .35rem 0}button.secondary{background:#52606d}button.danger{background:var(--danger)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #ffbf47;outline-offset:2px}.subpanel{margin-top:.85rem;padding:.75rem;border:1px solid var(--line);border-radius:.4rem;background:#fafcfd}.notice{padding:.65rem;margin:.7rem 0;border-radius:.3rem;background:#eef5f8}.error{background:#fff0f0;color:var(--danger)}.muted{color:var(--muted)}.queue-item{display:block;width:100%;text-align:left;background:#fff;color:var(--ink);border:1px solid var(--line);padding:.8rem;margin:.5rem 0}.queue-item:hover,.queue-item[aria-current=true]{border-color:var(--accent);background:#f1f8fb}.meta{font-size:.9rem;color:var(--muted)}.badge{display:inline-block;border-radius:1rem;padding:.1rem .5rem;background:#e4eef3;font-size:.85rem}.actions{display:flex;gap:.4rem;flex-wrap:wrap}.hidden{display:none}@media(max-width:760px){main{display:block}.panel{margin-bottom:1rem}header{display:block}}
</style>
</head>
<body>
<header><div><h1>North Star Operator</h1><div class="muted">Queue, handoff, action and audit</div></div><button id="refresh" type="button">Refresh queue</button></header>
<main>
<section class="panel" aria-labelledby="settings-title"><h2 id="settings-title">Connection</h2>
<label for="token">Bearer token</label><input id="token" type="password" autocomplete="off" placeholder="Paste a test/development token">
<label for="limit">Queue page size</label><select id="limit"><option>10</option><option>25</option><option>50</option></select>
<div class="actions"><button id="load" type="button">Load queue</button><button id="next" class="secondary hidden" type="button">Next page</button></div>
<div id="queue-status" class="notice" role="status" aria-live="polite">Enter a token and load the queue.</div>
<div id="queue" aria-label="Operator queue"></div></section>
<section class="panel" aria-labelledby="context-title"><h2 id="context-title">Context and evidence</h2><div id="context-status" class="notice" role="status" aria-live="polite">Select a queue item.</div><div id="context"></div></section>
</main>
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  let cursor = null, selected = null;
  const token = () => ($('token').value || '').trim();
  const headers = () => ({authorization: token().startsWith('Bearer ') ? token() : 'Bearer ' + token(), 'content-type':'application/json'});
  const message = (id, text, error=false) => { const node=$(id); if(!node) return; node.textContent=text; node.className='notice' + (error?' error':''); };
  const request = async (url, options={}) => { const response=await fetch(url,{...options,headers:{...headers(),...(options.headers||{})}}); let body=null; try{body=await response.json()}catch{} if(!response.ok){const error=new Error(body?.message || 'Request failed ('+response.status+')'); error.status=response.status; error.body=body; throw error} return body; };
  const formatDate = (value) => value ? new Date(value).toLocaleString() : 'UNKNOWN';
  const escapeHtml = (value) => String(value??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const showQueue = (page) => { const root=$('queue'); root.replaceChildren(); cursor=page.nextCursor || null; $('next').classList.toggle('hidden',!cursor); if(!page.items.length){root.innerHTML='<p class="muted">Queue is empty for this scope.</p>';return} page.items.forEach(item=>{const button=document.createElement('button');button.type='button';button.className='queue-item';button.dataset.workId=item.id;button.setAttribute('aria-current',selected?.id===item.id?'true':'false');button.innerHTML='<strong>'+escapeHtml(item.action)+'</strong> <span class="badge">'+escapeHtml(item.status)+'</span><br><span>'+escapeHtml(item.lead.displayName)+'</span><br><span class="meta">Due: '+escapeHtml(formatDate(item.dueAt))+' · Evidence: '+escapeHtml(item.completionEvidence)+'</span>';button.addEventListener('click',()=>select(item));root.append(button)})};
  const select = async (item) => { selected=item; document.querySelectorAll('.queue-item').forEach(node=>node.setAttribute('aria-current',node.dataset.workId===item.id?'true':'false')); message('context-status','Loading context…'); try{const lead=await request('/v1/pilot/leads/'+encodeURIComponent(item.leadId)); renderContext(lead,item)}catch(error){const text=error.status===403?'Permission denied for this lead.':error.status===404?'Lead not found in this workspace scope.':error.message; message('context-status',text,true);$('context').replaceChildren()}};
  const syncModeFields = () => { const mode=$('complete-mode')?.value; if(!mode) return; $('declared-fields').classList.toggle('hidden',mode!=='declared'); $('observed-fields').classList.toggle('hidden',mode!=='observed'); $('inferred-note').classList.toggle('hidden',mode!=='inferred'); };
  const renderContext = (lead,item) => {
    message('context-status','Recorded projection; business truth and runtime causality remain UNKNOWN.');
    $('context').innerHTML='<h3>'+escapeHtml(lead.lead.displayName)+'</h3><p>Status: <span class="badge">'+escapeHtml(lead.lead.status)+'</span></p><p><strong>Action:</strong> '+escapeHtml(item.action)+'</p><p><strong>Handoff context:</strong> '+escapeHtml(lead.handoff?.context || 'UNKNOWN')+'</p><p><strong>Evidence references:</strong> '+escapeHtml((lead.handoff?.evidenceRefs||[]).length)+' redacted reference(s); raw payload is not exposed.</p>'
      + '<div class="actions"><button id="accept" type="button">Accept handoff</button><button id="reschedule" type="button">Reschedule</button><button id="outcome" type="button">Record outcome</button><button id="audit" class="secondary" type="button">View audit</button></div>'
      + '<div class="subpanel" aria-labelledby="complete-title"><h4 id="complete-title">Complete work item</h4>'
      + '<label for="complete-mode">Completion evidence basis</label><select id="complete-mode"><option value="declared">Declared (human claim — requires declaration and confirmation)</option><option value="observed">Observed (system action proof pointer required)</option><option value="inferred">Inferred (AI/draft — cannot close without human confirmation)</option></select>'
      + '<div id="declared-fields"><label for="declaration-input">Human declaration (required)</label><textarea id="declaration-input" rows="2" placeholder="State what action you personally completed"></textarea><label for="declaration-confirm"><input id="declaration-confirm" type="checkbox">I confirm this completion is my human declaration, not observed system proof.</label></div>'
      + '<div id="observed-fields" class="hidden"><label for="evidence-ref-input">System action-proof evidence pointer (required)</label><input id="evidence-ref-input" type="text" autocomplete="off" placeholder="Envelope ID proving staff action"></div>'
      + '<p id="inferred-note" class="muted hidden">Inferred completion cannot close work automatically; submitting will be refused unless a human declares or supplies observed proof.</p>'
      + '<button id="complete" type="button">Submit completion</button></div>'
      + '<div id="action-status" class="notice" role="status" aria-live="polite"></div>';
    $('complete-mode').addEventListener('change',syncModeFields);
    $('accept').addEventListener('click',()=>mutate('/accept',{workId:item.id,reason:'operator_handoff_acceptance'}));
    $('complete').addEventListener('click',()=>{
      const mode=$('complete-mode').value;
      if(mode==='declared'){
        const declaration=($('declaration-input').value||'').trim();
        const confirmed=$('declaration-confirm').checked;
        if(!declaration){message('action-status','Refused: enter a non-blank human declaration before completing.',true);return}
        if(!confirmed){message('action-status','Refused: explicitly confirm your human declaration before completing.',true);return}
        mutate('/complete',{workId:item.id,evidence:'declared',declaration,confirmed:true});
        return;
      }
      if(mode==='observed'){
        const evidenceRef=($('evidence-ref-input').value||'').trim();
        if(!evidenceRef){message('action-status','Refused: observed completion requires a system evidence pointer.',true);return}
        mutate('/complete',{workId:item.id,evidence:'observed',evidenceRef});
        return;
      }
      mutate('/complete',{workId:item.id,evidence:mode});
    });
    $('reschedule').addEventListener('click',()=>{const due=window.prompt('New due time (ISO 8601)','')||''; const reason=window.prompt('Reschedule reason (required)','')||''; if(!due.trim()||!reason.trim()){message('action-status','Refused: new due time and reason are both required to reschedule.',true);return} mutate('/reschedule',{workId:item.id,newDueAt:due.trim(),reason:reason.trim()})});
    $('outcome').addEventListener('click',()=>{const value=window.prompt('Outcome: Won, Lost or Unknown','Unknown'); if(!value) return; if(!['Won','Lost','Unknown'].includes(value)){message('action-status','Refused: outcome must be Won, Lost or Unknown.',true);return} mutate('/outcome',{value})});
    $('audit').addEventListener('click',async()=>{try{const audit=await request('/v1/pilot/leads/'+encodeURIComponent(item.leadId)+'/audit');message('action-status','Audit records: '+audit.history.length+'; provenance: '+audit.metadata.provenance)}catch(error){message('action-status',formatMutationError(error),true)}});
  };
  const formatMutationError = (error) => {
    const code=error?.body?.code;
    if(code==='WORK_SUPERSEDED'){const repl=error.body?.details?.replacementId; return 'Conflict (WORK_SUPERSEDED): this work item was superseded'+(repl?' by '+repl:'')+'; reload queue and act on the replacement item.'}
    if(code==='STALE_VERSION') return 'Conflict (STALE_VERSION): lead state changed concurrently; reload before retrying.';
    if(error?.status===403) return 'Permission denied ('+(code||'FORBIDDEN')+'): '+error.message;
    return (code?code+': ':'')+error.message;
  };
  const mutate = async (path,payload) => { try{const result=await request('/v1/pilot/leads/'+encodeURIComponent(selected.leadId)+path,{method:'POST',body:JSON.stringify(payload)}); const note=result?.replacementId?'Action recorded. Replacement item: '+result.replacementId+'. Refreshing queue.':'Action recorded. Refreshing queue.'; message('action-status',note); await loadQueue()}catch(error){message('action-status',formatMutationError(error),true)}};
  const loadQueue = async () => { if(!token()){message('queue-status','A bearer token is required.',true);return} message('queue-status','Loading queue…'); try{const query=new URLSearchParams({limit:$('limit').value});if(cursor)query.set('cursor',cursor);const page=await request('/v1/pilot/queue?'+query);showQueue(page);message('queue-status',page.items.length?'Queue loaded.':'Queue is empty.')}catch(error){const text=error.status===401?'Authentication failed (401).':error.status===403?'Access denied for this workspace scope.':error.message; message('queue-status',text,true)}};
  $('load').addEventListener('click',()=>{cursor=null;loadQueue()});$('refresh').addEventListener('click',()=>{cursor=null;loadQueue()});$('next').addEventListener('click',loadQueue);
})();
</script>
</body>
</html>`;
