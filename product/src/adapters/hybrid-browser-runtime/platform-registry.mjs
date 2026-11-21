const id = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256 && /^[A-Za-z0-9_.:-]+$/.test(value);
export const PLATFORMS = Object.freeze({
  pancake: {origins: ['https://pancake.vn', 'https://app.pancake.vn'], surface: 'pancake-conversations'},
  'meta-ads': {origins: ['https://adsmanager.facebook.com', 'https://business.facebook.com'], surface: 'meta-ads'},
  hubspot: {origins: ['https://app.hubspot.com'], surface: 'hubspot-crm'},
});
export const validId = id;
export function resolveSiteContext(raw, dom = {}, fixture = false) {
  let url; try { url = new URL(raw); } catch { return null; }
  if (url.username || url.password || url.href.length > 4096) return null;
  let provider = Object.entries(PLATFORMS).find(([, value]) => value.origins.includes(url.origin))?.[0];
  if (fixture && url.protocol === 'http:' && url.hostname === '127.0.0.1') provider = ({pancake: 'pancake', ads: 'meta-ads', crm: 'hubspot'})[url.pathname.split('/')[1]];
  if (!provider) return null;
  const native = {};
  const put = (key, value) => { if (id(value)) native[key] = value; };
  if (provider === 'pancake') {
    put('pageAlias', url.pathname.split('/').filter(Boolean).at(-1));
    put('conversationId', url.searchParams.get('c_id'));
    put('pageId', dom.pageId); put('accountId', dom.accountId);
  } else if (provider === 'meta-ads') {
    put('accountId', url.searchParams.get('act') ?? dom.accountId);
    for (const [key, query] of [['campaignId','selected_campaign_ids'],['adsetId','selected_adset_ids'],['adId','selected_ad_ids']]) put(key, url.searchParams.get(query) ?? dom[key]);
    for (const key of ['currency','timezone']) if (typeof dom[key] === 'string' && /^[A-Za-z0-9_+\-/:]{1,64}$/.test(dom[key])) native[key] = dom[key];
  } else {
    const parts = url.pathname.split('/').filter(Boolean);
    put('accountId', dom.accountId ?? parts[parts.indexOf('contacts') + 1]);
    for (const key of ['contactId','companyId','dealId']) put(key, dom[key]);
    const record = parts.indexOf('record');
    if (record >= 0 && parts[record + 1] === '0-1') put('contactId', parts[record + 2]);
    if (record >= 0 && parts[record + 1] === '0-2') put('companyId', parts[record + 2]);
    if (record >= 0 && parts[record + 1] === '0-3') put('dealId', parts[record + 2]);
  }
  return {provider, providerSurface: PLATFORMS[provider].surface, origin: url.origin, native, identityAuthority: 'CLIENT_ASSERTED', completeness: 'UNKNOWN'};
}

/** The allowlisted projection never copies element text, HTML, forms, cookie or storage. */
export function minimizeDOM(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(['accountId','pageId','campaignId','adsetId','adId','contactId','companyId','dealId','currency','timezone']
    .filter(key => typeof input[key] === 'string' && input[key].length <= 256).map(key => [key,input[key]]));
}
