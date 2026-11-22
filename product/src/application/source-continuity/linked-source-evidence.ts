import type { AuthContext } from '../../ports/auth';
import type { LinkedSourceEvidenceReader } from '../../ports/linked-source-evidence';
import { sourceEvidenceView } from '../source-integration/source-integration.service';
import { SourceContinuityService } from './source-continuity.service';
/** Human context links never grant source access; continuity filters each origin first. */
export class LinkedSourceEvidenceQuery {
  constructor(private readonly continuity:SourceContinuityService,private readonly reader:LinkedSourceEvidenceReader){}
  async evidence(ctx:AuthContext,leadId:string){
    const pointers=await this.continuity.linkedReceipts(ctx,leadId),items=[];
    for(const p of pointers){
      const evidence=await this.reader.read(ctx.workspaceId,p.connectionId,p.receiptId,p.envelopeId,ctx.userId);
      if(evidence)items.push({...sourceEvidenceView(evidence),association:{linkage:'human_confirmed',verification:'UNVERIFIED',identityMerge:false}});
    }
    return {items,limit:100,possiblyTruncated:items.length===100,completeness:'UNKNOWN',verification:'UNVERIFIED'};
  }
}
