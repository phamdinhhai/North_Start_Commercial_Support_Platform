import {resolveSiteContext} from './platform-registry.mjs';
import {matchesEnrollment} from './permission-policy.mjs';
const operations = new Set(['ConversationQuery','ConversationMessages','AdsInsights','CRMRecord']);
/** URL candidates must still name the enrolled object; stale DOM context alone
 * cannot authorize diagnostics after same-origin account or SPA navigation. */
export function diagnosticTabMatches(url,session,enrollment) {
  const current=resolveSiteContext(url,{},Boolean(enrollment?.fixture));
  if(!current||current.origin!==session?.origin||current.provider!==enrollment?.scope?.provider||!session?.lastContext)return false;
  const target=enrollment.scope.target??{};
  if(!Object.entries(target).some(([key,value])=>key!=='pageId'&&current.native[key]===value))return false;
  if(current.native.pageAlias&&session.lastContext.native.pageAlias&&current.native.pageAlias!==session.lastContext.native.pageAlias)return false;
  return matchesEnrollment({...current,native:{...session.lastContext.native,...current.native}},enrollment);
}
export function createDiagnosticSession({activated=false,tabId,origin,allowedOrigins=[]}={}) {
  if (activated !== true || !Number.isInteger(tabId) || tabId < 0) throw new Error('DIAGNOSTIC_ACTIVATION_REQUIRED');
  const parsed = (() => { try { return new URL(origin); } catch { return null; } })();
  if (!parsed || !allowedOrigins.includes(parsed.origin)) throw new Error('DIAGNOSTIC_ORIGIN_DENIED');
  let active = true;
  return Object.freeze({
    tabId, origin: parsed.origin,
    isActive: () => active,
    stop: () => { active = false; },
    accept: (candidateTabId, candidateOrigin) => {
      if (!active || candidateTabId !== tabId || candidateOrigin !== parsed.origin) return false;
      return true;
    },
  });
}
export function inspectGraphQL(raw) {
  if (typeof raw !== 'string' || raw.length > 8192) return null;
  try { const parsed=JSON.parse(raw);return operations.has(parsed?.operationName) ? {kind:'graphql',operationName:parsed.operationName,authority:'PRIVATE_OBSERVED',completeness:'UNKNOWN'} : null; } catch { return null; }
}
export function inspectNetwork(url,status) {
  let parsed;try {parsed=new URL(url);}catch{return null;}
  if (!['http:','https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  return {kind:'http',status:Number.isSafeInteger(status)?status:null,authorization:[401,403].includes(status)?'DENIED':'UNKNOWN',completeness:'UNKNOWN'};
}
export function inspectRealtime(raw) {
  if (typeof raw!=='string'||raw.length>16384)return null;
  try{const value=JSON.parse(raw);const event=Array.isArray(value)?value[3]:value?.event;return ['pages:update_messages','pages:update_conversation','synthetic:changed'].includes(event)?{kind:'realtime',event,authority:'PRIVATE_OBSERVED',completeness:'UNKNOWN'}:null;}catch{return null;}
}
