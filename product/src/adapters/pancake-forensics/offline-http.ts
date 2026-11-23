import {request as httpRequest} from 'node:http';
import {TextDecoder} from 'node:util';

export type OfflineHttpFailure = 'CONNECT_FAILURE' | 'REQUEST_RESET' | 'RESPONSE_RESET' |
  'CONNECT_TIMEOUT' | 'WRITE_TIMEOUT' | 'RESPONSE_HEADERS_TIMEOUT' | 'RESPONSE_TIMEOUT' | 'RESPONSE_TOO_LARGE' | 'INVALID_JSON' |
  'NON_JSON_RESPONSE' | 'HTTP_ERROR' | 'PROVIDER_BUSINESS_FAILURE' | 'MALFORMED_SUCCESS';
export type OfflineHttpResult = {kind:'confirmed';httpStatus:number;requestFinished:boolean} |
  {kind:'rejected'|'ambiguous';category:OfflineHttpFailure;httpStatus?:number;requestFinished:boolean};
export interface OfflineHttpOptions {timeoutMs:number;maxBytes:number;fixtureFault?:'connect-stall'|'write-stall';}

/** Drops all query values, user-info and path IDs. Never serializes an authenticated URL. */
export function redactTransportUrl(input: string): string {
  try {const u=new URL(input);return u.protocol+'//'+u.host+'/{redacted-route}';}
  catch {return 'INVALID_URL';}
}

/** Corrected UTF-8 HTTP implementation restricted mechanically to loopback fabricated fixtures. */
export function sendOfflineFixture(url: string, message: string, options: OfflineHttpOptions): Promise<OfflineHttpResult> {
  const target=new URL(url);
  if (target.protocol!=='http:' || target.hostname!=='127.0.0.1' || target.username || target.password ||
      !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs<1 || options.timeoutMs>2000 ||
      !Number.isSafeInteger(options.maxBytes) || options.maxBytes<1 || options.maxBytes>1024*1024 ||
      typeof message!=='string' || Buffer.byteLength(message,'utf8')>8192) throw new Error('OFFLINE_HTTP_FIXTURE_REQUIRED');
  const bytes=Buffer.from(JSON.stringify({action:'reply_inbox',message}),'utf8');
  if(options.fixtureFault==='connect-stall')return new Promise(resolve=>setTimeout(()=>resolve({kind:'ambiguous',category:'CONNECT_TIMEOUT',requestFinished:false}),options.timeoutMs));
  return new Promise(resolve=>{
    let settled=false,connected=false,finished=false,responseStarted=false,status:number|undefined;
    let bodyTimer:ReturnType<typeof setTimeout>|undefined;
    const complete=(result:OfflineHttpResult)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(bodyTimer);resolve(result);};
    const ambiguous=(category:OfflineHttpFailure)=>complete({kind:'ambiguous',category,requestFinished:finished,...(status?{httpStatus:status}:{})});
    const req=httpRequest(target,{method:'POST',agent:false,headers:{'content-type':'application/json; charset=utf-8','content-length':bytes.length}},res=>{
      responseStarted=true;status=res.statusCode;
      if(status!==200){res.resume();return complete({kind:'ambiguous',category:'HTTP_ERROR',httpStatus:status,requestFinished:finished});}
      if(!/^application\/json(?:\s*;|$)/iu.test(res.headers['content-type']??'')){res.resume();return ambiguous('NON_JSON_RESPONSE');}
      const parts:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>options.maxBytes){ambiguous('RESPONSE_TOO_LARGE');res.destroy();req.destroy();}else parts.push(chunk);});
      res.on('aborted',()=>ambiguous('RESPONSE_RESET'));
      res.on('error',()=>ambiguous('RESPONSE_RESET'));
      res.on('end',()=>{
        if(settled)return;
        let value:unknown;
        try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}catch{return ambiguous('INVALID_JSON');}
        if(!value||typeof value!=='object'||Array.isArray(value))return ambiguous('MALFORMED_SUCCESS');
        const success=(value as {success?:unknown}).success;
        if(success===false)return complete({kind:'rejected',category:'PROVIDER_BUSINESS_FAILURE',httpStatus:200,requestFinished:finished});
        if(success!==true)return ambiguous('MALFORMED_SUCCESS');
        complete({kind:'confirmed',httpStatus:200,requestFinished:finished});
      });
    });
    const timer=setTimeout(()=>{ambiguous(responseStarted?'RESPONSE_TIMEOUT':!connected?'CONNECT_TIMEOUT':!finished?'WRITE_TIMEOUT':'RESPONSE_HEADERS_TIMEOUT');req.destroy();},options.timeoutMs);
    req.on('socket',socket=>{if(!socket.connecting)connected=true;socket.once('connect',()=>{connected=true;});});
    req.on('finish',()=>{finished=true;});
    req.on('error',()=>ambiguous(responseStarted?'RESPONSE_RESET':finished?'REQUEST_RESET':'CONNECT_FAILURE'));
    if(options.fixtureFault==='write-stall'){req.flushHeaders();bodyTimer=setTimeout(()=>req.end(bytes),options.timeoutMs*3);}
    else req.end(bytes);
  });
}
