import {createServer, request} from 'node:http';
import type {AddressInfo} from 'node:net';

/** Fabricated-only SDK transport boundary. Never forwards redirects or DNS names. */
export async function withBoundedFixtureRelay<T>(base:string, operation:(base:string)=>Promise<T>):Promise<T> {
 const destination=new URL(base);
 if(destination.protocol!=='http:'||destination.hostname!=='127.0.0.1'||!destination.port||destination.pathname!=='/'||destination.username||destination.password||destination.search||destination.hash)throw new Error('LOCAL_PROVIDER_BASE_REQUIRED');
 const relay=createServer((incoming,outgoing)=>{
  if(incoming.method!=='GET'||!incoming.url?.startsWith('/')||incoming.url.startsWith('//')){outgoing.writeHead(400).end();return;}
  let settled=false; const deadline=setTimeout(()=>{if(!settled)upstream.destroy(new Error('TIMEOUT'));},2000);
  const upstream=request({hostname:'127.0.0.1',port:destination.port,path:incoming.url,method:'GET',headers:{authorization:incoming.headers.authorization??'',accept:'application/json'}},response=>{
   if((response.statusCode??0)>=300&&(response.statusCode??0)<400){response.destroy();outgoing.writeHead(502).end('{"error":"REDIRECT_REJECTED"}');return;}
   const chunks:Buffer[]=[];let bytes=0;
   response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>1024*1024){response.destroy();outgoing.writeHead(502).end('{"error":"RESPONSE_TOO_LARGE"}');}else chunks.push(chunk);});
   response.on('end',()=>{if(!outgoing.writableEnded){settled=true;clearTimeout(deadline);outgoing.writeHead(response.statusCode??502,{'content-type':'application/json'});outgoing.end(Buffer.concat(chunks));}});
   response.on('error',()=>{if(!outgoing.writableEnded)outgoing.writeHead(502).end('{"error":"PARTIAL_RESPONSE"}');});
  });
  upstream.setTimeout(2000,()=>upstream.destroy(new Error('TIMEOUT')));
  upstream.on('error',()=>{settled=true;clearTimeout(deadline);if(!outgoing.writableEnded)outgoing.writeHead(502).end('{"error":"TRANSPORT_FAILURE"}');});
  outgoing.on('close',()=>{settled=true;clearTimeout(deadline);if(!outgoing.writableEnded)upstream.destroy(new Error('CLIENT_DISCONNECTED'));});
  upstream.end();
 });
 await new Promise<void>((resolve,reject)=>{relay.once('error',reject);relay.listen(0,'127.0.0.1',resolve);});
 try{return await operation(`http://127.0.0.1:${(relay.address() as AddressInfo).port}`);}finally{relay.closeAllConnections();await new Promise<void>((resolve,reject)=>relay.close(error=>error?reject(error):resolve()));}
}
