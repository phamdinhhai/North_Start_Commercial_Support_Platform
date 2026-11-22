import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolveAsset,registerFrontend} from './frontend.mjs';
test('build asset allowlist rejects traversal, unknown types and linked private files',()=>{
 const root=mkdtempSync(join(tmpdir(),'north-ui-static-'));writeFileSync(join(root,'index.html'),'<html>fabricated</html>');writeFileSync(join(root,'config.json'),'{}');mkdirSync(join(root,'assets'));writeFileSync(join(root,'assets','app.js'),'void 0');
 assert.match(resolveAsset(root,'').type,/html/);assert.match(resolveAsset(root,'assets/app.js').type,/javascript/);
 for(const p of ['../x','assets/../index.html','/index.html','a\\b','%2e%2e/x','config.json','index.html?token=x'])assert.throws(()=>resolveAsset(root,p));
 const outside=mkdtempSync(join(tmpdir(),'north-ui-private-'));writeFileSync(join(outside,'private.js'),'private');symlinkSync(outside,join(root,'linked'),process.platform==='win32'?'junction':'dir');assert.throws(()=>resolveAsset(root,'linked/private.js'),/OUTSIDE_BUILD/);
});
test('frontend registration never installs a general external proxy',()=>{const routes=[];registerFrontend({get:(path)=>routes.push(path)});assert.ok(routes.every(p=>p.startsWith('/v1/app')));});
