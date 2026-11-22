/** Serve the reviewed React build on the OIDC/CSRF origin. No provider proxy. */
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const build=resolve(dirname(fileURLToPath(import.meta.url)),'../../../frontend/dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
export function resolveAsset(root,path){
 if(typeof path!=='string'||path.includes('\\')||path.includes('\0')||path.split('/').some(p=>p==='.'||p==='..')||!/^([A-Za-z0-9_./-]*)$/.test(path))throw Error('ASSET_PATH_INVALID');
 const actualRoot=realpathSync(root),file=realpathSync(resolve(root,path||'index.html'));
 if(!file.startsWith(actualRoot+sep))throw Error('ASSET_OUTSIDE_BUILD');
 const type=Object.entries(mime).find(([ext])=>file.endsWith(ext))?.[1];if(!type)throw Error('ASSET_TYPE_REFUSED');
 return {file,type};
}
export function registerFrontend(server){
 if(!existsSync(resolve(build,'index.html')))return false;
 const serve=(req,res)=>{try{const {file,type}=resolveAsset(build,req.params?.['*']??'');return res.header('cache-control','no-store').header('x-content-type-options','nosniff').header('referrer-policy','no-referrer').header('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'").type(type).send(readFileSync(file));}catch{return res.code(404).send({code:'ASSET_NOT_AVAILABLE'});}};
 server.get('/v1/app',(_req,res)=>res.redirect('/v1/app/'));
 server.get('/v1/app/',serve);server.get('/v1/app/*',serve);return true;
}
