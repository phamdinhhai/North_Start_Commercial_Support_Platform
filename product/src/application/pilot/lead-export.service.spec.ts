import {describe,it,expect,vi} from 'vitest';
import {LeadExportService} from './lead-export.service';
import type {AuthContext} from '../../ports/auth';
describe('lead export policy',()=>{
 const ctx:AuthContext={workspaceId:'ws',userId:'admin',role:'admin',isDemo:false};
 const lead='00000000-0000-4000-8000-000000000001';
 it('denies every non-admin and demo before accessing data',async()=>{
  const exportLead=vi.fn();const service=new LeadExportService({exportLead});
  for(const role of ['viewer','sales','manager'] as const)await expect(service.export({...ctx,role},lead)).rejects.toMatchObject({status:403});
  await expect(service.export({...ctx,isDemo:true},lead)).rejects.toMatchObject({status:403});expect(exportLead).not.toHaveBeenCalled();
 });
 it('validates input and scopes missing lead lookup to authenticated workspace',async()=>{
  const exportLead=vi.fn().mockResolvedValue(undefined);const service=new LeadExportService({exportLead});
  await expect(service.export(ctx,'bad')).rejects.toMatchObject({status:400});expect(exportLead).not.toHaveBeenCalled();
  await expect(service.export(ctx,lead)).rejects.toMatchObject({status:404});expect(exportLead).toHaveBeenCalledWith('ws',lead,'admin');
 });
});
