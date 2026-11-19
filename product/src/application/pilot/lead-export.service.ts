import { LeadExportError } from '../../ports/lead-export';
import type { AuthContext } from '../../ports/auth';
import type { LeadExport, LeadExportStore } from '../../ports/lead-export';
/** ADR-006: privacy export is an existing admin capability, never granted from request bodies. */
export class LeadExportService {
  constructor(private readonly store:LeadExportStore){}
  async export(ctx:AuthContext,leadId:string):Promise<LeadExport>{
    if(ctx.role!=='admin'||ctx.isDemo) throw new LeadExportError('FORBIDDEN',403);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) throw new LeadExportError('INVALID_INPUT',400);
    const result=await this.store.exportLead(ctx.workspaceId,leadId,ctx.userId);
    if(!result)throw new LeadExportError('NOT_FOUND',404);
    return result;
  }
}
