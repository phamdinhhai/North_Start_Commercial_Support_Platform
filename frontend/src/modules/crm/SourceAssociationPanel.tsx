import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { northStart, useSession } from '@/providers/north-start';

type Evidence = { receipt: { connectionId: string; receiptId: string; envelopeId?: string | null }; observation: { displayName?: string; provider?: string } };
type LinkRow = { id: string; leadId: string; connectionId: string; receiptId: string; evidenceEnvelopeId: string; version: number; action: 'link' | 'unlink' | 'reject'; linkage: string; verification: string };

/** Native UI for the existing append-only source-link commands. Admin-only mutations remain server-authorized. */
export function SourceAssociationPanel({ leadId }: { leadId: string }) {
  const { session } = useSession();
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const admin = session.context?.role === 'admin';
  const reload = async () => {
    setError('');
    try {
      const [history, source] = await Promise.all([
        northStart.request<{ items: LinkRow[] }>(`/v1/source-integrations/leads/${leadId}/source-links`),
        northStart.request<{ items: Evidence[] }>(`/v1/source-integrations/leads/${leadId}/evidence?limit=25`),
      ]);
      setLinks(history.items); setEvidence(source.items);
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
  return <Card className="mt-5" data-testid="source-associations"><CardHeader><CardTitle className="text-base">Liên kết source episode</CardTitle></CardHeader><CardContent className="space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Origin receipt và effective Lead là các khái niệm riêng. Liên kết vẫn UNVERIFIED, append-only và không merge Customer.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-800">{error}</p>}{notice && <p role="status" className="rounded bg-teal-50 p-2 text-sm text-teal-900">{notice}</p>}
    {links.length ? links.map(link => <div key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs" data-testid={`source-link-${link.receiptId}`}><span className="min-w-0 break-all">{link.action} · receipt {link.receiptId} · v{link.version}</span><div className="flex gap-1"><Badge variant="outline">{link.verification}</Badge>{admin && link.action === 'link' && <><Button size="sm" variant="outline" disabled={busy} onClick={() => void command('unlink', { connectionId: link.connectionId, receiptId: link.receiptId, evidenceEnvelopeId: link.evidenceEnvelopeId, expectedVersion: link.version })}>Unlink</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void command('reject', { connectionId: link.connectionId, receiptId: link.receiptId, evidenceEnvelopeId: link.evidenceEnvelopeId, expectedVersion: link.version })}>Reject</Button></>}</div></div>) : <p className="text-sm text-muted-foreground">Chưa có liên kết explicit trong phạm vi được phép.</p>}
    {admin && evidence.length > 0 && <div className="border-t pt-3"><p className="mb-2 text-xs font-medium">Link receipt hiện có tới Lead này</p><div className="space-y-2">{evidence.slice(0, 5).map(item => <div key={item.receipt.receiptId} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{item.observation.displayName ?? item.receipt.receiptId} · {item.observation.provider ?? 'UNKNOWN'}</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void command('link', { connectionId: item.receipt.connectionId, receiptId: item.receipt.receiptId, evidenceEnvelopeId: item.receipt.envelopeId ?? '', expectedVersion: Math.max(0, ...links.filter(link => link.receiptId === item.receipt.receiptId).map(link => link.version)) })}>Link</Button></div>)}</div></div>}
  </CardContent></Card>;
}
