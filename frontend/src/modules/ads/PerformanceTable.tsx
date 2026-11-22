/** Adapted from nalarin-agentic-ads-studio PerformanceTable.jsx (MIT),
 * c500cc5a132142ff3de815bf6d15c50d490ea522. See NOTICE.md. */
import {useMemo, useState, type ReactNode} from 'react';
import {ArrowUpDown, Inbox, Loader2} from 'lucide-react';
import type {CampaignSummary} from './fixtures';
export interface PerformanceColumn {
  key:keyof CampaignSummary; label:string; numeric?:boolean;
  format?:(value:CampaignSummary[keyof CampaignSummary])=>ReactNode;
}
interface Props {rows:CampaignSummary[];columns:PerformanceColumn[];loading?:boolean;renderActions?:(row:CampaignSummary)=>ReactNode;emptyMessage?:string;}
export default function PerformanceTable({rows,columns,loading=false,renderActions,emptyMessage='Không có chiến dịch trong bộ lọc này.'}:Props) {
  const [sortKey,setSortKey]=useState<keyof CampaignSummary>('spend');
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc');
  const sortedRows=useMemo(()=>[...rows].sort((a,b)=>{
    const av=a[sortKey],bv=b[sortKey];
    if(typeof av==='number'&&typeof bv==='number')return sortDir==='asc'?av-bv:bv-av;
    return sortDir==='asc'?String(av??'').localeCompare(String(bv??'')):String(bv??'').localeCompare(String(av??''));
  }),[rows,sortKey,sortDir]);
  const handleSort=(key:keyof CampaignSummary)=>{if(key===sortKey)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortKey(key);setSortDir('desc');}};
  return <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm" aria-label="Hiệu suất chiến dịch giả lập">
      <thead className="bg-muted/50 text-muted-foreground"><tr>{columns.map(col=><th key={col.key} scope="col" aria-sort={sortKey===col.key?(sortDir==='asc'?'ascending':'descending'):'none'} className={`px-4 py-3 font-medium ${col.numeric?'text-right':'text-left'}`}>
        <button type="button" className={`inline-flex items-center gap-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary ${col.numeric?'flex-row-reverse':''}`} onClick={()=>handleSort(col.key)}>{col.label}<ArrowUpDown size={12} aria-hidden="true"/></button>
      </th>)}{renderActions&&<th scope="col" className="px-4 py-3 text-right font-medium">Chi tiết</th>}</tr></thead>
      <tbody className="divide-y divide-border">
        {loading&&<tr><td colSpan={columns.length+(renderActions?1:0)} className="px-4 py-12 text-center text-muted-foreground"><Loader2 size={20} className="inline-block animate-spin mr-2"/>Đang tải…</td></tr>}
        {!loading&&sortedRows.length===0&&<tr><td colSpan={columns.length+(renderActions?1:0)} className="px-4 py-12 text-center text-muted-foreground"><Inbox size={24} className="inline-block mb-2"/><p>{emptyMessage}</p></td></tr>}
        {!loading&&sortedRows.map(row=><tr key={row.id} className="hover:bg-muted/30">{columns.map(col=><td key={col.key} className={`px-4 py-4 ${col.numeric?'text-right tabular-nums':'text-left'}`}>{col.format?col.format(row[col.key]):row[col.key]}</td>)}{renderActions&&<td className="px-4 py-4 text-right">{renderActions(row)}</td>}</tr>)}
      </tbody>
    </table></div>
  </div>;
}
