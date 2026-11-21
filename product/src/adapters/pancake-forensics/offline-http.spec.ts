import {createServer} from 'node:http';
import {describe, expect, it} from 'vitest';
import {redactTransportUrl, sendOfflineFixture} from './offline-http';

async function server(handler:(request:import('node:http').IncomingMessage,response:import('node:http').ServerResponse)=>void){
  const s=createServer(handler);await new Promise<void>(resolve=>s.listen(0,'127.0.0.1',resolve));const a=s.address();return {s,url:`http://127.0.0.1:${typeof a==='object'&&a? a.port:0}`};
}
const opts={timeoutMs:300,maxBytes:4096};
describe('offline transport forensic fixture',()=>{
  it('preserves exact Vietnamese UTF-8 JSON bytes',async()=>{
    const message='\u0110\u00e2y l\u00e0 tin nh\u1eafn ki\u1ec3m th\u1eed \u0111\u01b0\u1ee3c \u1ee7y quy\u1ec1n \u2705';
    let received:Buffer|undefined;let type:string|undefined;
    const x=await server((req,r)=>{const chunks:Buffer[]=[];type=req.headers['content-type'];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{received=Buffer.concat(chunks);r.writeHead(200,{'content-type':'application/json'});r.end('{"success":true}');});});
    try{await expect(sendOfflineFixture(x.url,message,opts)).resolves.toMatchObject({kind:'confirmed',requestFinished:true});expect(received).toEqual(Buffer.from(JSON.stringify({action:'reply_inbox',message}),'utf8'));expect(type).toBe('application/json; charset=utf-8');expect(JSON.parse(received!.toString('utf8')).message).toBe(message);}finally{x.s.close();}
  });
  it('classifies business rejection and malformed responses',async()=>{for(const body of ['{"success":false}','{bad']){const x=await server((_,r)=>{r.writeHead(200,{'content-type':'application/json'});r.end(body)});try{const result=await sendOfflineFixture(x.url,'fixture',opts);expect(result.kind).toBe(body==='{bad'?'ambiguous':'rejected');}finally{x.s.close();}}});
  it('keeps tokens out of URL redaction',()=>{expect(redactTransportUrl('http://127.0.0.1:1/path?access_token=secret')).toBe('http://127.0.0.1:1/{redacted-route}');});
  it('handles HTML, HTTP errors and response timeout',async()=>{const cases:[number,string][]=[[200,'text/html'],[500,'application/json']];for(const [status,type] of cases){const x=await server((_,r)=>{r.writeHead(status,{'content-type':type});r.end(type==='text/html'?'<html/>':'{}')});try{const result=await sendOfflineFixture(x.url,'fixture',opts);expect(['ambiguous','rejected']).toContain(result.kind);}finally{x.s.close();}}const x=await server(()=>{});try{await expect(sendOfflineFixture(x.url,'fixture',{timeoutMs:40,maxBytes:4096})).resolves.toMatchObject({kind:'ambiguous',category:'RESPONSE_HEADERS_TIMEOUT'});}finally{x.s.closeAllConnections();x.s.close();}});
  it('classifies fabricated connect and write stalls distinctly',async()=>{const x=await server((req,r)=>{req.resume();req.on('end',()=>{r.writeHead(200,{'content-type':'application/json'});r.end('{"success":true}')})});try{await expect(sendOfflineFixture(x.url,'fixture',{...opts,fixtureFault:'connect-stall'})).resolves.toMatchObject({kind:'ambiguous',category:'CONNECT_TIMEOUT'});await expect(sendOfflineFixture(x.url,'fixture',{...opts,fixtureFault:'write-stall'})).resolves.toMatchObject({kind:'ambiguous',category:'WRITE_TIMEOUT'});}finally{x.s.close();}});
  it('rejects non-loopback fixture destinations',()=>expect(()=>sendOfflineFixture('https://pages.fm/path','fixture',opts)).toThrow('OFFLINE_HTTP_FIXTURE_REQUIRED'));
  it('preserves 4xx/5xx without treating status alone as provider rejection',async()=>{
    for(const status of [400,401,403,409,429,500,503]){
      const x=await server((_,r)=>{r.writeHead(status,{'content-type':'application/json'});r.end('{}')});
      try{await expect(sendOfflineFixture(x.url,'fixture',opts)).resolves.toMatchObject({kind:'ambiguous',httpStatus:status,category:'HTTP_ERROR'});}finally{x.s.close();}
    }
  });
  it('does not acknowledge truncated JSON or missing business success',async()=>{
    for(const text of ['{"success":','{}','null','[]']){
      const x=await server((_,r)=>{r.writeHead(200,{'content-type':'application/json'});r.end(text)});
      try{await expect(sendOfflineFixture(x.url,'fixture',opts)).resolves.toMatchObject({kind:'ambiguous'});}finally{x.s.close();}
    }
  });
  it('bounds response bytes without leaking raw content',async()=>{
    const x=await server((_,r)=>{r.writeHead(200,{'content-type':'application/json'});r.end('x'.repeat(5000))});
    try{await expect(sendOfflineFixture(x.url,'fixture',{timeoutMs:300,maxBytes:32})).resolves.toMatchObject({kind:'ambiguous',category:'RESPONSE_TOO_LARGE'});}finally{x.s.close();}
  });
  it('keeps response timeout ambiguous after the emulator receives the complete body',async()=>{
    let received=false;const x=await server((req,r)=>{req.resume();req.on('end',()=>{received=true;r.writeHead(200,{'content-type':'application/json'});r.flushHeaders();});});
    try{await expect(sendOfflineFixture(x.url,'fixture',{timeoutMs:60,maxBytes:4096})).resolves.toMatchObject({kind:'ambiguous',category:'RESPONSE_TIMEOUT',requestFinished:true});expect(received).toBe(true);}finally{x.s.closeAllConnections();x.s.close();}
  });
  it('keeps reset after transmitted body ambiguous despite local finish evidence',async()=>{
    let received=false;const x=await server((req,r)=>{req.resume();req.on('end',()=>{received=true;r.socket?.destroy();});});
    try{await expect(sendOfflineFixture(x.url,'fixture',opts)).resolves.toMatchObject({kind:'ambiguous',requestFinished:true});expect(received).toBe(true);}finally{x.s.close();}
  });
  it('keeps reset before a parsed request ambiguous',async()=>{
    let parsed=0;const x=await server(()=>{parsed++;});x.s.on('connection',socket=>socket.destroy());
    try{await expect(sendOfflineFixture(x.url,'fixture',opts)).resolves.toMatchObject({kind:'ambiguous'});expect(parsed).toBe(0);}finally{x.s.close();}
  });
  it('rejects partial response bytes rather than claiming a parsed success',async()=>{
    const x=await server((_,r)=>{r.writeHead(200,{'content-type':'application/json'});r.write('{"success":');setTimeout(()=>r.destroy(),5);});
    try{await expect(sendOfflineFixture(x.url,'fixture',opts)).resolves.toMatchObject({kind:'ambiguous',category:'RESPONSE_RESET'});}finally{x.s.close();}
  });
});
