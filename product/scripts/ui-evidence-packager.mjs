import {cp,mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {join,relative,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';

const allowed=new Set(['.png','.html','.json','.md']);
const forbidden=/(cookie|login data|local storage|session storage|history|har|manifest\.json|profile|credentials|\.db$)/i;
async function files(root,current=root){const out=[];for(const entry of await readdir(current,{withFileTypes:true})){const p=join(current,entry.name);if(entry.isDirectory())out.push(...await files(root,p));else out.push(p);}return out;}
export async function packageEvidence(input,output){
 const source=resolve(input),target=resolve(output);if(source===target||target.startsWith(source+sep))throw Error('OUTPUT_MUST_BE_SEPARATE');
 await mkdir(target,{recursive:true});const copied=[];
 for(const file of await files(source)){const rel=relative(source,file),ext=rel.toLowerCase().slice(rel.lastIndexOf('.'));if(forbidden.test(rel)||!allowed.has(ext))throw Error('ARTIFACT_REFUSED:'+rel);const destination=join(target,rel);await mkdir(resolve(destination,'..'),{recursive:true});await cp(file,destination);const bytes=await readFile(file);copied.push({file:rel,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
 await writeFile(join(target,'evidence-manifest.json'),JSON.stringify({kind:'NORTH_START_UI_EVIDENCE_V1',syntheticOnly:true,files:copied},null,2)+'\n');return copied;
}
if(process.argv[1]&&process.argv[1].endsWith('ui-evidence-packager.mjs')){try{const [input,output]=process.argv.slice(2);if(!input||!output)throw Error('Usage: ui-evidence-packager.mjs input output');console.log(JSON.stringify(await packageEvidence(input,output)));}catch(error){console.error(error.message);process.exitCode=1;}}
