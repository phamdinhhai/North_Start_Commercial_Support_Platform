// Runs in the isolated content world only. No MAIN-world injection or provider requests.
(() => {
  if (globalThis.__northStartHybridObserver) { globalThis.__northStartHybridObserver.start(); return; }
  let active = false, interval, debounce, last = '';
  const allowed = ['accountId','pageId','campaignId','adsetId','adId','contactId','companyId','dealId','currency','timezone','fixtureLabel','fixtureLifecycle'];
  function snapshot() {
    if (!active) return;
    const url = new URL(location.href), safe = new URL(url.origin + url.pathname);
    for (const key of ['c_id','act','selected_campaign_ids','selected_adset_ids','selected_ad_ids']) if (url.searchParams.has(key)) safe.searchParams.set(key,url.searchParams.get(key));
    const root = document.querySelector('[data-ns-context]');
    const dom = Object.fromEntries(allowed.filter(key => typeof root?.dataset[key] === 'string').map(key => [key,root.dataset[key].slice(0,256)]));
    const signature = JSON.stringify([safe.href,dom]);
    if (signature === last) return;
    last = signature;
    chrome.runtime.sendMessage({kind:'context-observed',url:safe.href,dom}).catch(() => {});
  }
  const observer = new MutationObserver(() => { clearTimeout(debounce); debounce = setTimeout(snapshot,100); });
  function start() { if (active) return; active=true;last='';observer.observe(document.documentElement,{attributes:true,childList:true,subtree:true});interval=setInterval(snapshot,1000);snapshot(); }
  function stop() { active=false;observer.disconnect();clearInterval(interval);clearTimeout(debounce); }
  chrome.runtime.onMessage.addListener(message => { if (message?.kind === 'stop-observer') stop(); });
  globalThis.__northStartHybridObserver = {start,stop}; start();
})();
