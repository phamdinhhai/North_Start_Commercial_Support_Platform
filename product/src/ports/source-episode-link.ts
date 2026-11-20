import type { AuthContext } from './auth';
import type { ContentDigest } from './content-digester';
export interface SourceEpisodeLinkInput {
 readonly connectionId:string; readonly receiptId:string; readonly evidenceEnvelopeId:string;
 readonly expectedVersion:number; readonly idempotencyKey:string;
 readonly action:'link'|'unlink'|'reject'; readonly reason:string;
}
export interface SourceEpisodeLink {
 readonly id:string; readonly leadId:string; readonly connectionId:string; readonly receiptId:string;
 readonly evidenceEnvelopeId:string; readonly originLeadId:string; readonly effectiveLeadId:string|null;
 readonly version:number; readonly action:SourceEpisodeLinkInput['action']; readonly reason:string;
 readonly actorId:string; readonly recordedAt:string;
 readonly linkage:'human_confirmed'|'rejected'|'unknown'; readonly verification:'UNVERIFIED';
}
/** Store-derived locked row, never accepted from HTTP input. Avoid nested pool acquisition. */
export interface SourceLinkLockedAuthority {readonly workspaceId:string;readonly ownerUserId:string|null;}
export type SourceLinkAuthorization = (ctx:AuthContext,leadId:string,locked?:SourceLinkLockedAuthority)=>Promise<unknown>;
/** Store invokes authorization inside its serialized command boundary, before disclosing history. */
export interface SourceEpisodeLinkStore {
 command(ctx:AuthContext,leadId:string,input:SourceEpisodeLinkInput,content:string,digester:import('./content-digester').ContentDigester,authorize:SourceLinkAuthorization):Promise<SourceEpisodeLink>;
 list(workspaceId:string,leadId:string):Promise<readonly SourceEpisodeLink[]>;
 /** Current effective links only; historical origin receipts remain separately inspectable. */
 linkedReceipts(workspaceId:string,leadId:string):Promise<readonly {connectionId:string;receiptId:string;envelopeId:string;originLeadId:string}[]>;
}
export interface SourceLinkStoredCommand { readonly digest:ContentDigest; readonly actorId:string; }
export const SOURCE_EPISODE_LINK_STORE=Symbol('SOURCE_EPISODE_LINK_STORE');
