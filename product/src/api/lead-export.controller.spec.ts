import {describe,it,expect,vi} from 'vitest';
import {LeadExportController} from './lead-export.controller';
import type {AuthContext} from '../ports/auth';
describe('lead export HTTP boundary',()=>{
 const id='00000000-0000-4000-8000-000000000001';
 const admin:AuthContext={workspaceId:'ws',userId:'admin',role:'admin',isDemo:false};
 it('rejects anonymous and non-admin without store reads',async()=>{
  const exportLead=vi.fn();
  await expect(new LeadExportController({resolve:()=>null},{exportLead}).export({},id)).rejects.toMatchObject({status:401});
  await expect(new LeadExportController({resolve:()=>({...admin,role:'sales'})},{exportLead}).export({},id)).rejects.toMatchObject({status:403});
  expect(exportLead).not.toHaveBeenCalled();
 });
 it('masks store error detail and forwards trusted scope',async()=>{
  const exportLead=vi.fn().mockRejectedValue(new Error('secret database string'));
  const controller=new LeadExportController({resolve:()=>admin},{exportLead});
  await expect(controller.export({authorization:'Bearer token'},id)).rejects.toMatchObject({status:500,response:{code:'INTERNAL'}});
  expect(exportLead).toHaveBeenCalledWith('ws',id,'admin');
 });
});
