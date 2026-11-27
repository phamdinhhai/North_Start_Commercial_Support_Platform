import {lstatSync,readFileSync,realpathSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {validateManifest} from '../pilot/safety.mjs';

export const fixturePaths=Object.freeze({
 pancake:'/pancake/fixture-page-pancake?c_id=fixture-conversation-pancake',
 ads:'/ads/manage?act=act_123&selected_campaign_ids=fixture-campaign-ads',
 crm:'/crm/contacts/fixture-account-crm/record/0-1/fixture-contact-crm',
});
export const fixtureNative=Object.freeze({
 pancake:{accountId:'fixture-account-pancake',pageId:'fixture-page-pancake'},
 ads:{accountId:'act_123',campaignId:'fixture-campaign-ads'},
 crm:{accountId:'fixture-account-crm',contactId:'fixture-contact-crm'},
});
export function localOrigin(port){if(!Number.isInteger(port)||port<=1024||port>=65536)throw Error('PREVIEW_PORT_INVALID');return 'http://127.0.0.1:'+port;}
export function previewProof(secret,domain,id,challenge){
 if(!/^[a-f0-9]{64}$/.test(secret)||!['app','fixture'].includes(domain)||!/^[a-f0-9]{32}$/.test(id)||!/^[a-f0-9]{64}$/.test(challenge))throw Error('PREVIEW_CHALLENGE_INVALID');
 return createHmac('sha256',secret).update(id+'|'+domain+'|'+challenge).digest('hex');
}
export function verifyPreviewProof(value,expected){return typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)&&timingSafeEqual(Buffer.from(value),Buffer.from(expected));}
export function assertPrivatePath(path){
 for(let current=resolve(path);;current=dirname(current)){
  if(existsSync(current)&&(lstatSync(current).isSymbolicLink()||realpathSync(current)!==current))throw Error('PREVIEW_LINK_REFUSED');
  if(dirname(current)===current)break;
 }
}
export function assertExtensionTree(directory,home){
 if(directory!==join(home,'extension'))throw Error('PREVIEW_PATH_INVALID');assertPrivatePath(directory);
 const pending=existsSync(directory)?[directory]:[];let count=0;
 while(pending.length){const path=pending.pop();assertPrivatePath(path);if(++count>100)throw Error('PREVIEW_PACKAGE_TREE_UNEXPECTED');if(lstatSync(path).isDirectory())for(const name of readdirSync(path))pending.push(join(path,name));}
}
export function validatePreview(file,privateRoot){
 const root=resolve(privateRoot),home=join(root,'hybrid-preview'),absolute=resolve(file);
 if(absolute!==join(home,'manifest.json'))throw Error('PREVIEW_PATH_INVALID');
 for(const path of [root,home,absolute])assertPrivatePath(path);
 const m=JSON.parse(readFileSync(absolute,'utf8'));
 if(m.kind!=='NORTH_START_HYBRID_PREVIEW_V2'||!/^[a-f0-9]{32}$/.test(m.id)||!/^[a-f0-9]{64}$/.test(m.control)||m.extensionDirectory!==join(home,'extension'))throw Error('PREVIEW_MANIFEST_INVALID');
 const p=validateManifest(m.pilotManifest);
 if(p.id!==m.id||p.home!==join(root,'north-synthetic-pilot-'+m.id)||m.appOrigin!==localOrigin(p.appPort)||m.fixtureOrigin!==localOrigin(m.fixturePort)||!p.hybridPreview||p.hybridPreview.fixturePort!==m.fixturePort||!/^[a-f0-9]{64}$/.test(p.hybridPreview.signingSecret)||!["running","stopped"].includes(m.state))throw Error('PREVIEW_BINDING_INVALID');
 if(new Set([p.pgPort,p.appPort,p.controlPort,p.idpPort,m.fixturePort]).size!==5)throw Error('PREVIEW_PORT_COLLISION');
 assertExtensionTree(m.extensionDirectory,home);
 return m;
}
export function fixtureHtml(kind,appOrigin){
 if(!Object.hasOwn(fixturePaths,kind))throw Error('FIXTURE_KIND_INVALID');
 const app=new URL(appOrigin);if(app.origin!==localOrigin(Number(app.port))||app.pathname!=='/')throw Error('PREVIEW_ORIGIN_INVALID');
 const attrs=Object.entries(fixtureNative[kind]).map(([k,v])=>'data-'+k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+'="'+v+'"').join(' ');
 return '<!doctype html><html lang="en"><meta charset="utf-8"><title>North Start '+kind+' fixture</title><style>body{font:18px system-ui;max-width:850px;margin:40px auto;padding:20px}a{margin:12px}</style><h1>Fabricated '+kind+' context</h1><p>Invented integration data only. No real provider connection. Browser authority: UNVERIFIED. Completeness: UNKNOWN.</p><div data-ns-context '+attrs+' data-fixture-label="fixture-label-v1" data-fixture-lifecycle="present">Fixture label v1</div><p><a href="'+app.origin+'/v1/hybrid-preview" target="_blank" rel="noopener">Preview enrollment and receipt console</a></p><nav>'+Object.entries(fixturePaths).map(([k,p])=>'<a href="'+p+'">'+k+'</a>').join('')+'</nav></html>';
}
