import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const product=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const packages=[
 {name:'@hubspot/api-client',license:'ISC'},
 {name:'facebook-nodejs-business-sdk',license:'Platform License'},
];
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
const records=[];
for(const item of packages){
 const dir=resolve(product,'node_modules',...item.name.split('/'));
 const pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));
 const licenseFile=join(dir,'LICENSE');
 records.push({name:item.name,version:pkg.version,declaredLicense:pkg.license,licenseSha256:await digest(licenseFile),distribution:'CONDITIONAL_REVIEW_REQUIRED'});
}
const output={generatedAt:new Date().toISOString(),source:'installed node_modules',redistributionAllowed:false,records,moderateDevelopmentAdvisories:'REVIEW_REQUIRED'};
if(process.argv.includes('--write')) await writeFile(resolve(product,'scripts/hybrid-browser/sdk-distribution-review.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output));
if(!process.argv.includes('--allow-review')) process.exitCode=2;
