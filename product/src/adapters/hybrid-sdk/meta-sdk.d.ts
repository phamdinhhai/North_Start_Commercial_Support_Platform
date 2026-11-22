/** Typed subset used by the read-only adapter. Upstream package ships no TS declarations. */
declare module 'facebook-nodejs-business-sdk' {
 export class FacebookAdsApi {
  constructor(accessToken:string,locale?:string,crashLog?:boolean);
  call(method:string,path:string|string[],params?:Record<string,unknown>,files?:Record<string,unknown>,multipart?:boolean,urlOverride?:string):Promise<unknown>;
 }
}
