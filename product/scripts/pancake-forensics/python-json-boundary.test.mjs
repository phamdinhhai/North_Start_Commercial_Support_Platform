import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';
const script=fileURLToPath(new URL('./python-json-boundary.py',import.meta.url));
const message='\u0110\u00e2y l\u00e0 tin nh\u1eafn ki\u1ec3m th\u1eed \u0111\u01b0\u1ee3c \u1ee7y quy\u1ec1n \u2705';
function run(mode,input=JSON.stringify({message})){
 const result=spawnSync('python',[script,mode],{input:Buffer.from(input,'utf8'),encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONIOENCODING:'cp1258'}});
 assert.equal(result.status,0);return JSON.parse(result.stdout);
}
test('legacy locale cannot establish Vietnamese UTF8 preservation',()=>assert.equal(run('legacy-locale').unicodePreserved,false));
test('explicit binary UTF8 decoding preserves Vietnamese even under cp1258 locale',()=>assert.deepEqual(run('explicit-utf8'),{parsed:true,unicodePreserved:true}));
test('truncated IPC JSON fails categorically without raw input output',()=>assert.deepEqual(run('explicit-utf8','{"message":'),{parsed:false,unicodePreserved:false}));
