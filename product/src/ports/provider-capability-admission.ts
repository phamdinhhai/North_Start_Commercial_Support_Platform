export type ProviderId='pancake'|'meta-page';
export type ProviderAdmissionStage='RESEARCHED'|'CONTRACT_PREPARED'|'OFFLINE_VERIFIED'|'CREDENTIALS_CONFIGURED'|'ACCOUNT_RIGHTS_VERIFIED'|'AUTHORIZED_SANDBOX_READY'|'AUTHORIZED_SANDBOX_VERIFIED'|'LIVE_READ_ONLY_APPROVED'|'PRODUCTION_APPROVED';
export type CredentialBackend='NONE'|'TEST_ONLY'|'VAULT_REFERENCE';
export interface ProviderCapabilityEvidence {
 readonly provider:ProviderId; readonly capability:string; readonly stage:ProviderAdmissionStage;
 readonly evidenceId:string; readonly sourceVersion?:string; readonly recordedAt:string;
 readonly credentialBackend:CredentialBackend; readonly syntheticOnly:boolean;
 readonly accountBinding:'NONE'|'SERVER_BOUND'; readonly approvedBy?:string;
}
export interface ProviderCapabilityAdmission {
 readonly provider:ProviderId; readonly capability:string; readonly stage:ProviderAdmissionStage;
 readonly syntheticOnly:boolean; readonly credentialBackend:CredentialBackend; readonly accountBinding:'NONE'|'SERVER_BOUND';
 readonly evidenceIds:readonly string[]; readonly networkActivation:'NOT_ENABLED';
}
/** Ordered status is deliberately explicit; never collapse this into connected=true. */
export const PROVIDER_ADMISSION_ORDER:readonly ProviderAdmissionStage[]=[
 'RESEARCHED','CONTRACT_PREPARED','OFFLINE_VERIFIED','CREDENTIALS_CONFIGURED','ACCOUNT_RIGHTS_VERIFIED','AUTHORIZED_SANDBOX_READY','AUTHORIZED_SANDBOX_VERIFIED','LIVE_READ_ONLY_APPROVED','PRODUCTION_APPROVED'];
export const admissionRank=(stage:ProviderAdmissionStage):number=>PROVIDER_ADMISSION_ORDER.indexOf(stage);

