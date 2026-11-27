// Reproducible, dependency-closed source selection from the pinned external checkout.
import {readFileSync,writeFileSync,mkdirSync,existsSync,copyFileSync,statSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
const upstream=resolve(process.argv[2]);const target=resolve('src');const copied=new Set();
function copy(relative){if(copied.has(relative))return;copied.add(relative);const source=join(upstream,'src',relative);const contents=readFileSync(source,'utf8');mkdirSync(dirname(join(target,relative)),{recursive:true});writeFileSync(join(target,relative),contents);for(const match of contents.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/from\s+["'](@\/[^"']+|\.\.?\/[^"']+)["']/g)){const base=match[1].startsWith('@/')?join(upstream,'src',match[1].slice(2)):resolve(dirname(source),match[1]);const file=[base,base+'.tsx',base+'.ts',join(base,'index.tsx'),join(base,'index.ts')].find(p=>existsSync(p)&&statSync(p).isFile());if(file)copy(file.slice(join(upstream,'src').length+1).replaceAll('\\','/'));}}
for(const seed of ['components/admin/data-table.tsx','components/admin/list.tsx','components/admin/simple-form.tsx','components/admin/text-input.tsx','components/ui/sidebar.tsx','components/ui/card.tsx','components/ui/dialog.tsx','components/ui/badge.tsx','components/ui/textarea.tsx','components/ui/avatar.tsx','components/ui/tabs.tsx','components/ui/label.tsx'])copy(seed);
copyFileSync(join(upstream,'LICENSE.md'),'licenses/atomic-crm-MIT.txt');
writeFileSync('licenses/atomic-source-selection.json',JSON.stringify({repository:'https://github.com/marmelab/atomic-crm',commit:'832b07a89be2d9265a66bbf879fed0299c14ebfb',files:[...copied].sort()},null,2)+'\n');
console.log('Copied '+copied.size+' dependency-closed Atomic CRM files.');
