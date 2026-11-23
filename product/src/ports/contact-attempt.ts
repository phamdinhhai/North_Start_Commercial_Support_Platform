import type { ContentDigest } from './content-digester';
export const CONTACT_ATTEMPT_STORE = Symbol('CONTACT_ATTEMPT_STORE');
export interface ContactAttemptInput {
 expectedVersion:number; idempotencyKey:string; occurredAt:string;
 channel:'phone'|'message'|'email'|'other'; claimedResult:'reached'|'no-answer'|'left-message'|'unknown';
 evidenceRef?:string; followUpImplication:string; reason:string;
}
export interface ContactAttempt extends Omit<ContactAttemptInput,'expectedVersion'|'idempotencyKey'> {
 id:string; leadId:string; workspaceId:string; actor:string; recordedAt:string;
 acquisitionMode:'claimed'; assertionStatus:'claimed'; supersedesAttemptId?:string;
}
export interface ContactAttemptReceipt {actor:string;digest:ContentDigest;attemptId:string;version:number}
export interface ContactAttemptStore {
 list(workspaceId:string,leadId:string,limit:number,after?:string):Promise<readonly ContactAttempt[]>;
 receipt(workspaceId:string,leadId:string,key:string):Promise<ContactAttemptReceipt|undefined>;
 append(attempt:ContactAttempt,input:ContactAttemptInput,digest:ContentDigest):Promise<ContactAttemptReceipt>;
}
