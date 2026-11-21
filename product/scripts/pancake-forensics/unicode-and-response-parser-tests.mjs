import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { describe, it } from 'node:test';

const VIET = 'Xin chào khách hàng — đã nhận yêu cầu ✅';
const fixture = { ok: true, message: VIET, nested: { n: 7 } };

function serverFor(handler) {
  const server = createServer(handler);
  return new Promise(async resolve => { server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` })); });
}
async function request(base, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 1000);
  try {
    const response = await fetch(base + path, { method: options.method ?? 'GET', headers: options.headers, body: options.body, signal: controller.signal, redirect: 'error' });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? '';
    let json = null; let parseError = null;
    if (contentType.toLowerCase().includes('application/json')) { try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch (error) { parseError = error; } }
    return { status: response.status, contentType, bytes, text: new TextDecoder().decode(bytes), json, parseError };
  } finally { clearTimeout(timer); }
}
function redactQuery(url) { const u = new URL(url); for (const key of ['access_token', 'token', 'api_key', 'password']) if (u.searchParams.has(key)) u.searchParams.set(key, '[REDACTED]'); return u.toString(); }

export async function runScenarios() {
  const scenarios = [];
  const add = (name, fn) => scenarios.push({ name, fn });
  add('UTF-8 exact bytes', async () => { const x = await serverFor((_, r) => { r.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }); r.end(JSON.stringify(fixture)); }); try { const got = await request(x.base, '/utf8'); assert.deepEqual([...got.bytes], [...Buffer.from(JSON.stringify(fixture))]); assert.equal(got.json.message, VIET); } finally { x.server.close(); } });
  add('body JSON round trip', async () => { const x = await serverFor(async (req, r) => { let b=''; for await (const c of req) b += c; r.writeHead(201, {'content-type':'application/json'}); r.end(JSON.stringify(JSON.parse(b))); }); try { const got=await request(x.base,'/body',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(fixture)}); assert.equal(got.status,201); assert.deepEqual(got.json,fixture); } finally{x.server.close();} });
  add('query redaction', async () => { const u='http://127.0.0.1/x?access_token=secret&token=two&safe=ok'; assert.equal(redactQuery(u),'http://127.0.0.1/x?access_token=%5BREDACTED%5D&token=%5BREDACTED%5D&safe=ok'); });
  add('content type case insensitive', async()=>{const x=await serverFor((_,r)=>{r.writeHead(200,{'content-type':'Application/JSON'});r.end('{}')});try{assert.deepEqual((await request(x.base,'/')).json,{});}finally{x.server.close()}});
  for (const status of [200,201,204,400,401,403,404,409,429,500,502,503,504]) add(`status ${status}`,async()=>{const x=await serverFor((_,r)=>{r.writeHead(status,{'content-type':'application/json'});r.end('{}')});try{assert.equal((await request(x.base,'/')).status,status)}finally{x.server.close()}});
  add('malformed JSON retained as parse error',async()=>{const x=await serverFor((_,r)=>{r.writeHead(200,{'content-type':'application/json'});r.end('{bad')});try{const g=await request(x.base,'/');assert(g.parseError);assert.equal(g.json,null)}finally{x.server.close()}});
  add('text response does not parse JSON',async()=>{const x=await serverFor((_,r)=>{r.writeHead(200,{'content-type':'text/plain'});r.end('{"ok":true}')});try{const g=await request(x.base,'/');assert.equal(g.json,null);assert.equal(g.text,'{"ok":true}')}finally{x.server.close()}});
  add('timeout aborts stalled response',async()=>{const x=await serverFor((_,r)=>{});try{await assert.rejects(request(x.base,'/',{timeout:30}),e=>e.name==='AbortError')}finally{x.server.close()}});
  add('business rejection survives HTTP 200',async()=>{const x=await serverFor((_,r)=>{r.writeHead(200,{'content-type':'application/json'});r.end('{"success":false,"error_code":105}')});try{const g=await request(x.base,'/');assert.equal(g.status,200);assert.equal(g.json.success,false);assert.equal(g.json.error_code,105)}finally{x.server.close()}});
  add('Python UTF-8 bytes and JSON body',async()=>{let captured;const x=await serverFor(async(req,r)=>{const chunks=[];for await(const c of req)chunks.push(c);captured=Buffer.concat(chunks);r.writeHead(200,{'content-type':'application/json'});r.end(captured)});try{const child=spawn('python',[new URL('./unicode-fixture-client.py',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),x.base+'/echo'],{env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='';let err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);const [code]=await once(child,'close');assert.equal(code,0,err);assert.deepEqual(JSON.parse(out),{status:200,utf8Exact:true,jsonValid:true});assert.equal(captured.toString('utf8'),JSON.stringify({text:VIET}));}finally{x.server.close()}});
  add('killed child loses stdout metadata',async()=>{const child=spawn(process.execPath,['-e',"process.stdout.write('partial'); setTimeout(()=>{},10000)"]); let out=''; child.stdout.on('data',d=>out+=d); await once(child.stdout,'data'); const closed=once(child,'close'); child.kill('SIGTERM'); await closed; assert.equal(out,'partial'); assert.equal(/status|requestId/.test(out),false); });
  return scenarios;
}

describe('offline Pancake transport boundary fixtures', async () => { for (const s of await runScenarios()) it(s.name, s.fn); });
