import {readFileSync,readdirSync,unlinkSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('src/components');
const keep=new Set(JSON.parse(readFileSync('licenses/atomic-source-selection.json','utf8')).files.map(p=>resolve('src',p)));
function walk(d){for(const x of readdirSync(d,{withFileTypes:true})){const p=join(d,x.name);if(x.isDirectory())walk(p);else if(!keep.has(p))unlinkSync(p);}}
walk(root);
