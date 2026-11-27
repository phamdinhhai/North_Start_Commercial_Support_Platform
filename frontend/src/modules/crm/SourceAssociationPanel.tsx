import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { northStart, useSession } from '@/providers/north-start';

type Evidence = { receipt: { connectionId: string; receiptId: string; envelopeId?: string | null }; observation: { displayName?: string; provider?: string } };
type LinkRow = { id: string; leadId: string; connectionId: string; receiptId: string; evidenceEnvelopeId: string; version: number; action: 'link' | 'unlink' | 'reject'; linkage: string; verification: string };
type LeadOption = { leadId: string; displayName?: string; id?: string };

/** Native UI for the existing append-only source-link commands. Admin-only mutations remain server-authorized. */
export function SourceAssociationPanel({ leadId }: { leadId: string }) {
  const { session } = useSession();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [targetLeadId, setTargetLeadId] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const admin = session.context?.role === 'admin';
  const reload = async () => {
    setError('');
    try {
      const [historyResult, sourceResult, directoryResult] = await Promise.allSettled([
        northStart.request<{ items: LinkRow[] }>(`/v1/source-integrations/leads/${leadId}/source-links`),
        northStart.request<{ items: Evidence[] }>(`/v1/source-integrations/leads/${leadId}/evidence?limit=25`),
        northStart.request<{ items: LeadOption[] }>(`/v1/pilot/leads?classification=synthetic&limit=100`),
      ]);
      if (historyResult.status === 'fulfilled') setLinks(historyResult.value.items);
      if (sourceResult.status === 'fulfilled') setEvidence(sourceResult.value.items);
      if (directoryResult.status === 'fulfilled') setLeads(directoryResult.value.items.filter(item => (item.leadId ?? item.id) !== leadId));
      if (historyResult.status === 'rejected' || sourceResult.status === 'rejected') throw new Error('SOURCE_ASSOCIATION_READ_UNAVAILABLE');
    } catch (e: any) { setError(e?.message ?? 'Không thể đọc liên kết nguồn.'); }
  };
  useEffect(() => { void reload(); }, [leadId]);
  async function command(action: 'link' | 'unlink' | 'reject', row: { connectionId: string; receiptId: string; evidenceEnvelopeId: string; expectedVersion: number }) {
    setBusy(true); setError(''); setNotice('');
    try {
      await northStart.request(`/v1/source-integrations/leads/${leadId}/source-links`, { method: 'POST', body: JSON.stringify({ ...row, action, reason: `React source association: ${action}`, idempotencyKey: crypto.randomUUID() }) });
      setNotice('Đã ghi nhận liên kết nguồn vào audit.'); await reload();
    } catch (e: any) { setError(e?.message ?? 'Lệnh liên kết nguồn bị từ chối.'); }
    finally { setBusy(false); }
  }
  async function linkToTarget(item: Evidence) {
    if (!targetLeadId) return;
    setBusy(true); setError(''); setNotice('');
    try {
      // The command version is receipt scoped. Read the server-authoritative
      // current state immediately before posting; target history may be bounded
      // or incomplete and is not a valid concurrency source.
      const current = await northStart.request<{ version: number }>(`/v1/source-integrations/leads/${targetLeadId}/source-links/current?connectionId=${encodeURIComponent(item.receipt.connectionId)}&receiptId=${encodeURIComponent(item.receipt.receiptId)}`);
      const latest = current.version;
      await northStart.request(`/v1/source-integrations/leads/${targetLeadId}/source-links`, {
        method: 'POST',
        body: JSON.stringify({
          connectionId: item.receipt.connectionId,
          receiptId: item.receipt.receiptId,
          evidenceEnvelopeId: item.receipt.envelopeId ?? '',
          expectedVersion: latest,
          action: 'link',
          reason: 'React source association: link',
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await northStart.request(`/v1/source-integrations/leads/${targetLeadId}/source-links`);
      setNotice('Đã ghi nhận liên kết nguồn vào audit.');
      await reload();
    } catch (e: any) { setError(e?.message ?? 'Lệnh liên kết nguồn bị từ chối.'); }
    finally { setBusy(false); }
  }
  return <Card className="mt-5" data-testid="source-associations"><CardHeader><CardTitle className="text-base">Liên kết source episode</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Origin receipt và effective Lead là các khái niệm riêng. Liên kết vẫn UNVERIFIED, append-only và không merge Customer.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-teal-50 p-2 text-sm text-teal-900">{notice}</p>}
    {links.length ? links.map(link => <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs" data-testid={`source-link-${link.receiptId}`}><span className="min-w-0 break-all">{link.action} · receipt {link.receiptId} · v{link.version}</span><div className="flex gap-1"><Badge variant="outline">{link.verification}</Badge>{admin && (link.action === 'link' || link.action === 'unlink') && <>{link.action === 'link' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void command('unlink', { connectionId: link.connectionId, receiptId: link.receiptId, evidenceEnvelopeId: link.evidenceEnvelopeId, expectedVersion: link.version })}>Unlink</Button>}<Button size="sm" variant="outline" disabled={busy} onClick={() => void command('reject', { connectionId: link.connectionId, receiptId: link.receiptId, evidenceEnvelopeId: link.evidenceEnvelopeId, expectedVersion: link.version })}>Reject</Button></>}</div></div>) : <p className="text-sm text-muted-foreground">Chưa có liên kết explicit trong phạm vi được phép.</p>}
    {admin && evidence.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-xs font-medium">Link receipt từ origin tới Lead đích</p><select aria-label="Lead đích cho source association" className="mb-2 h-9 w-full rounded border px-2 text-sm" value={targetLeadId} onChange={event => setTargetLeadId(event.target.value)}><option value="">Chọn Lead đích…</option>{leads.map(item => <option key={item.leadId ?? item.id} value={item.leadId ?? item.id}>{item.displayName ?? item.leadId ?? item.id}</option>)}</select><div className="space-y-2">{evidence.slice(0, 5).map(item => <div key={item.receipt.receiptId} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{item.observation.displayName ?? item.receipt.receiptId} · {item.observation.provider ?? 'UNKNOWN'}</span><Button size="sm" variant="outline" disabled={busy || !targetLeadId} onClick={() => void linkToTarget(item)}>Link</Button></div>)}</div></div>}
  </CardContent></Card>;
}
