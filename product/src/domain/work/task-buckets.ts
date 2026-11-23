export type TaskBucket='overdue'|'today'|'tomorrow'|'this-week'|'later'|'completed'|'unknown';
export interface TaskBucketInput { readonly status:string; readonly dueAt?:string; readonly now?:Date; readonly timeZone?:string }
/** Pure bucket projection adapted from Atomic CRM date-grouping behavior, applied to pilot_work_item only. */
export function classifyTaskBucket(input:TaskBucketInput):TaskBucket {
 if(input.status==='completed')return 'completed'; if(input.status==='cancelled'||input.status==='rescheduled')return 'unknown'; if(!input.dueAt)return 'unknown'; const due=new Date(input.dueAt);const now=input.now??new Date();if(!Number.isFinite(due.getTime()))return 'unknown';
 const day=(d:Date)=>Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());const today=day(now),dueDay=day(due),delta=Math.round((dueDay-today)/86400000);if(dueDay<today)return 'overdue';if(delta===0)return 'today';if(delta===1)return 'tomorrow';const weekday=now.getUTCDay()||7;if(delta<=7-weekday+7)return 'this-week';return 'later';
}
