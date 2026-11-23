import type {SourceObservation,SourceReceipt} from './source-observation';
import type {SourceConnection} from './source-observation';
export type SyncObservationAdmission=(value:unknown,workspaceId:string,connection:SourceConnection)=>SourceObservation;
/** Current server credential binding; callback must not perform network/pool acquisition. */
export type SyncCommitAuthorization=(binding:{workspaceId:string;connectionId:string;provider:'pancake'|'meta-page';accountId:string})=>Promise<void>;
export type SyncStatus='active'|'paused'|'revoked'|'degraded'|'blocked';
export type SyncFailure='AUTH_REVOKED'|'RATE_LIMITED'|'TIMEOUT'|'SCHEMA_INVALID'|'GAP_DETECTED'|'DATABASE_UNAVAILABLE'|'RETRY_EXHAUSTED';
/** No token or plaintext credential belongs in this state or diagnostic projection. */
export interface SyncStream {
 readonly id:string; readonly workspaceId:string; readonly connectionId:string; readonly provider:'pancake'|'meta-page'; readonly accountId:string;
 readonly capability:'synthetic-messages'; readonly mode:'offline-synthetic'; readonly status:SyncStatus;
 readonly cursor:string|null; readonly completed:boolean; readonly cursorVersion:number; readonly schemaVersion:1;
 readonly lastAttemptedAt:string|null; readonly lastCommittedAt:string|null; readonly retryCount:number; readonly pageCount:number;
 readonly nextRetryAt:string|null; readonly failureCode:SyncFailure|null; readonly gapStatus:'UNKNOWN'|'NONE'|'DETECTED';
 readonly leaseOwner:string|null; readonly leaseUntil:string|null;
}
export interface SyncLease {readonly stream:SyncStream;readonly token:string;readonly owner:string;}
export interface SyncPage {
 readonly pageKey:string; readonly expectedVersion:number; readonly expectedCursor:string|null;
 readonly nextCursor:string|null; readonly completed:boolean; readonly observations:readonly SourceObservation[];
}
export interface SyncPageResult {readonly accepted:number;readonly duplicates:number;readonly cursor:string|null;readonly version:number;readonly replay:boolean;readonly receipts:readonly SourceReceipt[];}
export interface SyncCheckpointStore {
 createStream(workspaceId:string,connectionId:string):Promise<SyncStream>;
 getStream(workspaceId:string,id:string):Promise<SyncStream|null>;
 claimLease(workspaceId:string,id:string,owner:string,ttlMs:number):Promise<SyncLease|null>;
 releaseLease(workspaceId:string,id:string,token:string):Promise<void>;
 commitPage(workspaceId:string,id:string,token:string,page:SyncPage):Promise<SyncPageResult>;
 recordFailure(workspaceId:string,id:string,token:string,failure:SyncFailure,nextRetryAt:string|null):Promise<void>;
 control(workspaceId:string,id:string,action:'pause'|'resume'|'revoke',actorId:string):Promise<void>;
}
