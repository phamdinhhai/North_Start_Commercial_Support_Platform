import {localOrigin} from './preview-policy.mjs';
import {previewPage} from './preview-page.mjs';

/** Preview is opt-in in its own private pilot manifest, never a Sales default. */
export function previewConfiguration(m) {
 if(m.hybridPreview===undefined)return null;
 const c=m.hybridPreview;
 if(!c||typeof c!=='object'||Object.keys(c).sort().join()!=='fixturePort,signingSecret'||!/^[a-f0-9]{64}$/.test(c.signingSecret)||c.signingSecret===m.control||[m.appPort,m.pgPort,m.idpPort,m.controlPort].includes(c.fixturePort))throw Error('HYBRID_PREVIEW_CONFIG_INVALID');
 const fixtureOrigin=localOrigin(c.fixturePort);
 const scope=(connectionId,accountId,providerSurface,pageId,target)=>({workspaceId:m.workspace,connectionId,accountId,providerSurface,pageId,target});
 return {
  env:{AIL_RESEARCH_ENABLED:'true',HYBRID_FIXTURE_ENABLED:'true',AIL_SIGNING_SECRET:c.signingSecret,AIL_SCOPE_ALLOWLIST:JSON.stringify([
   scope('fixture-connection-pancake','fixture-account-pancake','pancake-conversations','fixture-page-pancake',{pageId:'fixture-page-pancake',conversationId:'fixture-conversation-pancake'}),
   scope('fixture-connection-ads','act_123','meta-ads','fixture-page-ads',{campaignId:'fixture-campaign-ads'}),
   scope('fixture-connection-crm','fixture-account-crm','hubspot-crm','fixture-page-crm',{contactId:'fixture-contact-crm'}),
  ])},
  html:previewPage(fixtureOrigin),
 };
}
