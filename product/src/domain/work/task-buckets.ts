export type TaskBucket='overdue'|'today'|'tomorrow'|'this-week'|'later'|'completed'|'unknown';
export interface TaskBucketInput { readonly status:string; readonly dueAt?:string; readonly now?:Date; readonly timeZone?:string }
/** Pure bucket projection adapted from Atomic CRM date-grouping behavior, applied to pilot_work_item only. */
export function classifyTaskBucket(input:TaskBucketInput):TaskBucket {
 if(input.status==='completed')return 'completed'; if(input.status==='cancelled'||input.status==='rescheduled')return 'unknown'; if(!input.dueAt)return 'unknown';
 const due=new Date(input.dueAt);const now=input.now??new Date();if(!Number.isFinite(due.getTime())||!Number.isFinite(now.getTime()))return 'unknown';
 try {
  const zone=input.timeZone??'UTC';const format=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});
  const parts=(date:Date)=>Object.fromEntries(format.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  const localNow=parts(now),localDue=parts(due);const date=(p:Record<string,string>)=>Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
  const delta=Math.round((date(localDue)-date(localNow))/86400000);if(delta<0)return 'overdue';if(delta===0)return 'today';if(delta===1)return 'tomorrow';
  const weekday=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(localNow.weekday);const mondayIndex=weekday===0?7:weekday;return delta<=7-mondayIndex?'this-week':'later';
 } catch { return 'unknown'; }
}
