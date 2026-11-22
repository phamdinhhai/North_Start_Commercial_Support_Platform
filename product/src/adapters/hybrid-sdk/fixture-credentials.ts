/** No real secret support: scoped fabricated credential admission for SDK tests. */
export class FixtureCredentialRegistry {
 private readonly entries=new Map<string,{token:string;expires:number;revoked:boolean}>();
 private key(workspace:string,connection:string){if(!/^[A-Za-z0-9_-]{1,128}$/u.test(workspace)||!/^[A-Za-z0-9_-]{1,128}$/u.test(connection))throw new Error('CREDENTIAL_SCOPE_INVALID');return JSON.stringify([workspace,connection]);}
 register(workspace:string,connection:string,token:string,expires:number){if(!/^(hs|meta)-fixture(?:-[A-Za-z0-9_-]+)?$/u.test(token)||!Number.isFinite(expires))throw new Error('FIXTURE_CREDENTIAL_REQUIRED');this.entries.set(this.key(workspace,connection),{token,expires,revoked:false});}
 resolve(workspace:string,connection:string,now=Date.now()){const entry=this.entries.get(this.key(workspace,connection));if(!entry||entry.revoked||entry.expires<=now)throw new Error('CREDENTIAL_UNAVAILABLE');return entry.token;}
 revoke(workspace:string,connection:string){const entry=this.entries.get(this.key(workspace,connection));if(entry)entry.revoked=true;}
}
