import type {ProviderCapabilityAdmission,ProviderCapabilityEvidence} from '../../ports/provider-capability-admission';
import {admissionRank,PROVIDER_ADMISSION_ORDER} from '../../ports/provider-capability-admission';
const fail=(code:string):never=>{throw new Error(`PROVIDER_ADMISSION_INVALID:${code}`);};
/** Read projection of server-owned evidence, never transport authentication or network permission. */
export function buildProviderAdmission(evidence:readonly ProviderCapabilityEvidence[]):ProviderCapabilityAdmission{
 if(!Array.isArray(evidence)||evidence.length===0||evidence.length>100)fail('EVIDENCE_BOUND');
 const first=evidence[0];
 if(!first||!['pancake','meta-page'].includes(first.provider)||!first.capability||first.capability.length>128)fail('IDENTITY');
 for(const e of evidence){
  if(e.provider!==first.provider||e.capability!==first.capability||!e.evidenceId||e.evidenceId.length>256||
   !Number.isFinite(Date.parse(e.recordedAt))||admissionRank(e.stage)<0)fail('MIXED_SCOPE');
 }
 const highest=evidence.reduce((a,e)=>admissionRank(e.stage)>admissionRank(a)?e.stage:a,first.stage);
 for(const stage of PROVIDER_ADMISSION_ORDER.slice(0,admissionRank(highest)+1)){
  const rows=evidence.filter(e=>e.stage===stage);if(!rows.length)fail('MISSING_PREDECESSOR');
  for(const e of rows){
   if(admissionRank(stage)>=admissionRank('CREDENTIALS_CONFIGURED')&&e.credentialBackend==='NONE')fail('NO_CREDENTIAL_REFERENCE');
   if(admissionRank(stage)>=admissionRank('ACCOUNT_RIGHTS_VERIFIED')&&
    (e.accountBinding!=='SERVER_BOUND'||e.credentialBackend!=='VAULT_REFERENCE'||!e.approvedBy))fail('UNBOUND_OR_UNAPPROVED');
   if(admissionRank(stage)>=admissionRank('AUTHORIZED_SANDBOX_READY')&&!e.syntheticOnly)fail('REAL_DATA_NOT_ALLOWED');
  }
 }
 const last=evidence.filter(e=>e.stage===highest).at(-1)!;
 return {provider:first.provider,capability:first.capability,stage:highest,syntheticOnly:evidence.every(e=>e.syntheticOnly),
  credentialBackend:last.credentialBackend,accountBinding:last.accountBinding,evidenceIds:evidence.map(e=>e.evidenceId),networkActivation:'NOT_ENABLED'};
}

