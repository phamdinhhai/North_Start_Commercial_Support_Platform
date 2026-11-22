import type { SourceEvidence } from './source-observation';
export interface LinkedSourceEvidenceReader {
  read(workspaceId:string,connectionId:string,receiptId:string,envelopeId:string,actorId:string):Promise<SourceEvidence|null>;
}
export const LINKED_SOURCE_EVIDENCE_READER=Symbol('LINKED_SOURCE_EVIDENCE_READER');
