import { buildZip, moduleReferences, scanSecrets } from '../companion-package.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,posix} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const product=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),source=resolve(product,'src/adapters');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function packageHybrid(outDir=resolve(product,'dist/hybrid-browser-runtime'),fixture=false){
 const manifest=JSON.parse(await readFile(resolve(source,'hybrid-browser-runtime/manifest.json'),'utf8'));
 if(manifest.manifest_version!==3||JSON.stringify(manifest.permissions)!==JSON.stringify(['activeTab','scripting','storage'])||manifest.host_permissions?.length)throw Error('UNREVIEWED_PERMISSION');
 manifest.background.service_worker='hybrid-browser-runtime/worker.mjs';manifest.action.default_popup='hybrid-browser-runtime/popup.html';
 if(fixture)manifest.optional_host_permissions.push('http://127.0.0.1/*');
 const files=new Map([['manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')]]);
 const pending=[manifest.background.service_worker,manifest.action.default_popup,'hybrid-browser-runtime/dom-observer.js'];
 while(pending.length){const name=posix.normalize(pending.pop());if(files.has(name))continue;
  if(!/^(hybrid-browser-runtime|browser-companion)\/[A-Za-z0-9_.-]+\.(mjs|js|html|json)$/.test(name)||/\.(test|spec)\./.test(name))throw Error('PACKAGE_PATH_REFUSED');
  const text=(await readFile(resolve(source,name),'utf8')).replace(/\r\n/g,'\n');
  if(scanSecrets(name,text).length)throw Error('PACKAGE_SECRET_PATTERN');
  files.set(name,Buffer.from(text));const refs=/\.(mjs|js)$/.test(name)?moduleReferences(name,text):[...text.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
  for(const ref of refs)pending.push(posix.join(posix.dirname(name),ref));
 }
 const entries=[...files].sort(([a],[b])=>a.localeCompare(b));const zip=buildZip(entries);
 await mkdir(outDir,{recursive:true});for(const [name,bytes]of entries){await mkdir(dirname(resolve(outDir,name)),{recursive:true});await writeFile(resolve(outDir,name),bytes);}
 await writeFile(resolve(outDir,'north-start-hybrid-runtime.zip'),zip);
 const descriptor={version:manifest.version,fixtureOnly:fixture,files:entries.map(([path,bytes])=>({path,bytes:bytes.length,sha256:sha(bytes)})),zipSha256:sha(zip),permissions:manifest.permissions,optionalPermissions:manifest.optional_permissions,distribution:'Unpacked local MV3 build; not store-published',reusedModules:['Research Companion lifecycle.mjs','Research Companion deterministic ZIP builder, static module closure and secret-pattern scanner']};
 await writeFile(resolve(outDir,'package-evidence.json'),JSON.stringify(descriptor,null,2)+'\n');return descriptor;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const fixture=process.argv.includes('--fixture');const destination=process.argv.find((v,i)=>i>1&&!v.startsWith('--'));console.log(JSON.stringify(await packageHybrid(destination?resolve(destination):undefined,fixture)));}
