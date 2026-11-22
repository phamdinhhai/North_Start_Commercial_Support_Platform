import {readFileSync,writeFileSync} from 'node:fs';
let path='src/modules/crm/LeadList.tsx';writeFileSync(path,readFileSync(path,'utf8').replaceAll('sortable={false}','disableSort'));
path='src/modules/crm/LeadDetail.tsx';let s=readFileSync(path,'utf8');
s=s.replace("type Action='context'", "type Action='advance-contact'|'advance-follow'|'context'");
s=s.replace("const titles:Record<Action,string>={", "const titles:Record<Action,string>={'advance-contact':'Bắt đầu liên hệ','advance-follow':'Chuyển sang theo dõi',");
s=s.replace("const reason=value('reason');let path='',body:Record<string,unknown>={reason};try{", "const reason=value('reason');let path='',body:Record<string,unknown>={reason};try{if(action==='advance-contact'||action==='advance-follow'){path='/commands/advance';body.to=action==='advance-contact'?'Contacting':'Follow-up';}");
s=s.replace('<Button variant="outline" disabled={!owner} onClick={()=>setCommand({action:\'outcome\'})}>', '<Button variant="outline" disabled={!owner||!['+"'Follow-up','Unknown'"+'].includes(d.lead.status)} onClick={()=>setCommand({action:\'outcome\'})}>');
s=s.replace('<div className="mt-6 grid gap-2">','<div className="mt-6 grid gap-2">{d.lead.status===\'Accepted\'&&<Button variant="outline" disabled={!owner} onClick={()=>setCommand({action:\'advance-contact\'})}>Bắt đầu liên hệ</Button>}{d.lead.status===\'Contacting\'&&<Button variant="outline" disabled={!owner} onClick={()=>setCommand({action:\'advance-follow\'})}>Chuyển sang theo dõi</Button>}');
writeFileSync(path,s);
