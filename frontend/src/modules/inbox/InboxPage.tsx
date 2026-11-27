import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, CircleHelp, Database, Filter, Inbox, LockKeyhole, MessageCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { northStart, useSession } from '@/providers/north-start';
import { channelLabels, inboxFixtures, lastPreview, previewMessages, visibleConversations, type AccessibleLead, type SourceEvidence } from './inbox-model';
import { NativeConversationPanel } from './NativeConversationPanel';

const clock = (seconds: number) => new Intl.DateTimeFormat('vi', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(seconds * 1000));
const emptyEvidence = 'Chưa có bằng chứng nguồn trong trang kết quả này. Không suy ra toàn bộ lịch sử trống.';

/** Chatwoot community inbox structure, rendered with the Atomic CRM design system. Read-only. */
export function InboxPage() {
  const { generation } = useSession();
  const [mode, setMode] = useState<'preview' | 'evidence' | 'native'>('preview');
  const [channel, setChannel] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(inboxFixtures[0].id);
  const [leads, setLeads] = useState<AccessibleLead[]>([]);
  const [leadId, setLeadId] = useState('');
  const [evidence, setEvidence] = useState<SourceEvidence[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const epoch = useRef(0);
  useEffect(() => {
    epoch.current++;
    setLeads([]); setLeadId(''); setEvidence([]); setSelectedReceipt(''); setNotice(''); setLoading(false);
    return () => { epoch.current++; };
  }, [generation]);
  const items = visibleConversations(inboxFixtures, channel, query);
  const current = items.find(item => item.id === selected) ?? items[0];
  const activeEvidence = evidence.find(item => item.receipt.receiptId === selectedReceipt) ?? evidence[0];

  async function loadLeads() {
    const token = ++epoch.current; setLoading(true); setNotice(''); setEvidence([]); setSelectedReceipt('');
    try {
      const page = await northStart.request<{ items: AccessibleLead[] }>('/v1/pilot/leads?classification=synthetic&limit=25');
      if (token !== epoch.current) return;
      setLeads(page.items); setLeadId('');
      setNotice(page.items.length ? 'Chọn Lead được phép truy cập để đọc bằng chứng đã lưu.' : 'Không có Lead trong trang kết quả được phép truy cập.');
    } catch { if (token === epoch.current) { setLeads([]); setLeadId(''); setEvidence([]); setNotice('Không thể tải danh sách. Kiểm tra phiên đăng nhập và quyền truy cập.'); } }
    finally { if (token === epoch.current) setLoading(false); }
  }
  async function loadEvidence(id: string) {
    const token = ++epoch.current; setLeadId(id); setEvidence([]); setSelectedReceipt(''); setNotice('');
    if (!id) return;
    setLoading(true);
    try {
      const page = await northStart.request<{ items: SourceEvidence[]; nextCursor?: string | null }>('/v1/source-integrations/leads/' + encodeURIComponent(id) + '/evidence?limit=25');
      if (token !== epoch.current) return;
      setEvidence(page.items); setSelectedReceipt(page.items[0]?.receipt.receiptId ?? '');
      setNotice(page.items.length ? `${page.items.length} quan sát trong trang hiện tại. Độ đầy đủ: UNKNOWN${page.nextCursor ? ' · Còn trang tiếp theo.' : '.'}` : emptyEvidence);
    } catch { if (token === epoch.current) { setEvidence([]); setNotice('Bằng chứng không khả dụng hoặc không được phép truy cập. Không hiển thị dữ liệu đã tải trước.'); } }
    finally { if (token === epoch.current) setLoading(false); }
  }
  function changeMode(next: 'preview' | 'evidence' | 'native') { epoch.current++; setMode(next); setEvidence([]); setLeads([]); setLeadId(''); setSelectedReceipt(''); setNotice(''); setLoading(false); }

  return <div className="space-y-5" data-testid="inbox-page">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="size-4" /> Liên tục hội thoại <ChevronRight className="size-3" /> Hộp thư</div><h1 className="text-2xl font-semibold tracking-tight">Hộp thư đa kênh</h1><p className="mt-1 text-sm text-muted-foreground">Một nơi để đọc ngữ cảnh, kiểm tra nguồn và chuẩn bị bước tiếp theo.</p></div>
      <Badge variant="outline" className="gap-1.5 px-3 py-1.5"><LockKeyhole className="size-3.5" /> Chỉ đọc · Gửi tin bị khóa</Badge>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3">
      <div className="flex flex-wrap gap-2"><Button size="sm" variant={mode === 'preview' ? 'default' : 'outline'} onClick={() => changeMode('preview')}>Tình huống mẫu</Button><Button size="sm" variant={mode === 'native' ? 'default' : 'outline'} onClick={() => changeMode('native')}><Database className="mr-2 size-4"/>Conversation native</Button><Button size="sm" variant={mode === 'evidence' ? 'default' : 'outline'} onClick={() => changeMode('evidence')}><Database className="mr-2 size-4" />Bằng chứng North Start</Button></div>
      <span className="text-xs text-muted-foreground">{mode === 'preview' ? 'Dữ liệu hoàn toàn hư cấu · Không kết nối nhà cung cấp' : 'Đọc API thật · Phân quyền North Start · PostgreSQL'}</span>
    </div>
    {mode === 'preview' ? <div className="grid min-h-[620px] min-w-0 grid-cols-1 overflow-hidden rounded-xl border bg-background shadow-sm lg:grid-cols-[280px_minmax(0,1fr)_280px]">
      <section className="min-w-0 border-b lg:border-r lg:border-b-0" aria-label="Danh sách hội thoại">
        <div className="space-y-3 border-b p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Hội thoại <span className="ml-1 text-muted-foreground">{items.length}</span></h2><Filter className="size-4 text-muted-foreground" /></div><label className="relative block"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="Tìm hội thoại" placeholder="Tìm tên hoặc nội dung..." className="pl-9" value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Kênh hội thoại" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={event => setChannel(event.target.value)}><option value="all">Tất cả kênh</option><option value="pancake">Pancake</option><option value="meta">Meta Messenger</option><option value="web">Webchat mẫu</option></select></div>
        <div className="max-h-[520px] overflow-y-auto">{items.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className={`flex w-full gap-3 border-b p-4 text-left transition-colors hover:bg-muted/60 ${current?.id === item.id ? 'border-l-2 border-l-primary bg-primary/5' : ''}`} aria-pressed={current?.id === item.id}>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${item.color}`}>{item.initials}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{item.contact}</span><span className="text-[10px] text-muted-foreground">Mẫu</span></span><span className="mt-1 block truncate text-xs text-muted-foreground">{lastPreview(item)}</span><span className="mt-2 inline-flex rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{channelLabels[item.channel]}</span></span>
        </button>)}{!items.length && <div className="p-8 text-center text-sm text-muted-foreground"><Inbox className="mx-auto mb-3 size-7" />Không tìm thấy hội thoại. Thử đổi bộ lọc.</div>}</div>
      </section>
      <section className="flex min-w-0 flex-col" aria-label="Dòng thời gian hội thoại">
        {current ? <><header className="flex items-center gap-3 border-b p-4"><span className={`flex size-10 items-center justify-center rounded-full text-sm font-semibold ${current.color}`}>{current.initials}</span><div className="min-w-0"><h2 className="truncate font-semibold">{current.contact}</h2><p className="text-xs text-muted-foreground">{channelLabels[current.channel]} · {current.subject}</p></div></header><div className="flex-1 space-y-5 bg-muted/20 p-5"><div className="text-center text-xs text-muted-foreground">22 tháng 11 · Tình huống hoàn toàn hư cấu</div>{previewMessages(current).map(message => message.message_type === 2 ? <div key={message.id} className="mx-auto max-w-sm rounded-lg border border-dashed bg-background p-3 text-center text-xs leading-relaxed text-muted-foreground">{message.content}</div> : <div key={message.id} className={`flex ${message.message_type === 1 ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${message.message_type === 1 ? 'rounded-br-sm bg-primary/10' : 'rounded-bl-sm border bg-background'}`}><p className="whitespace-pre-wrap leading-relaxed">{message.content}</p><div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">{message.message_type === 1 ? <ArrowUpRight className="size-3" /> : <ArrowDownLeft className="size-3" />}{clock(message.created_at)} · Mẫu</div></div></div>)}</div><footer className="border-t p-4"><div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground"><LockKeyhole className="size-4 shrink-0" /><p>Gửi tin chưa được mở. Không thực hiện gửi thử hoặc tự động gửi lại.</p></div></footer></> : <div className="m-auto p-10 text-center text-muted-foreground">Chọn một hội thoại để xem ngữ cảnh.</div>}
      </section>
      <aside className="min-w-0 space-y-5 border-t p-4 lg:border-t-0 lg:border-l" aria-label="Ngữ cảnh thương mại">
        <div><h2 className="text-sm font-semibold">Ngữ cảnh thương mại</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tách biệt hội thoại, danh tính và kết quả bán hàng.</p></div>
        <dl className="space-y-4 text-sm"><div><dt className="text-xs text-muted-foreground">Người phụ trách minh họa</dt><dd className="mt-1 font-medium">{current?.owner ?? 'UNKNOWN'}</dd></div><div><dt className="text-xs text-muted-foreground">Nhãn tình huống</dt><dd className="mt-1">{current?.label ?? 'UNKNOWN'}</dd></div><div><dt className="text-xs text-muted-foreground">Lead / Customer đã liên kết</dt><dd className="mt-1"><Badge variant="outline">UNKNOWN</Badge></dd></div><div><dt className="text-xs text-muted-foreground">Giao / Đọc / Điều kiện gửi</dt><dd className="mt-1 text-xs">UNKNOWN / UNKNOWN / UNKNOWN</dd></div></dl>
        <div className="rounded-lg border border-dashed p-3"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4" />Nguồn & bằng chứng</div><p className="text-xs leading-relaxed text-muted-foreground">Các tin nhắn mẫu này không phải sự kiện nhà cung cấp, không tự tạo Lead và không ghi nhận kết quả.</p></div>
        <div className="rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"><CircleHelp className="mb-2 size-4" />Pancake: SEND_UNRESOLVED. Lần gửi lịch sử chưa xác định. Việc không quan sát thấy tin không chứng minh chưa gửi.</div>
      </aside>
    </div> : mode === 'native' ? <NativeConversationPanel/> : <div className="space-y-4">
      <Card><CardHeader><CardTitle className="text-base">Quan sát đã lưu theo phạm vi Lead</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Chọn Lead để đọc receipt và định danh nguồn từ API North Start. Không tự liên kết với hội thoại mẫu hoặc tạo danh tính thương mại.</p><div className="flex flex-wrap gap-3"><Button variant="outline" onClick={loadLeads} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />Tải Lead được phép truy cập</Button><select aria-label="Lead đọc bằng chứng" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={leadId} onChange={event => void loadEvidence(event.target.value)} disabled={!leads.length || loading}><option value="">Chọn Lead...</option>{leads.map(lead => <option key={lead.leadId} value={lead.leadId}>{lead.displayName ?? lead.lead?.displayName ?? lead.leadId}</option>)}</select></div><p className="text-sm text-muted-foreground" role="status">{loading ? 'Đang đọc dữ liệu được phép truy cập...' : notice || 'Chưa tải dữ liệu. Không có dữ liệu cache từ workspace trước.'}</p></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]"><Card><CardHeader><CardTitle className="text-base">Receipt nguồn</CardTitle></CardHeader><CardContent className="space-y-2">{evidence.map(item => <button key={item.receipt.receiptId} aria-pressed={activeEvidence?.receipt.receiptId === item.receipt.receiptId} className={`w-full rounded-lg border p-3 text-left hover:bg-muted ${activeEvidence?.receipt.receiptId === item.receipt.receiptId ? 'border-primary bg-primary/5' : ''}`} onClick={() => setSelectedReceipt(item.receipt.receiptId)}><div className="text-sm font-medium">{item.observation.displayName}</div><div className="mt-1 text-xs text-muted-foreground">{item.observation.provider} · {item.receipt.disposition}</div><Badge variant="outline" className="mt-2">{item.receipt.verification}</Badge></button>)}{!evidence.length && <p className="py-6 text-center text-sm text-muted-foreground">Chưa có receipt được chọn.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">Chi tiết bằng chứng</CardTitle></CardHeader><CardContent>{activeEvidence ? <dl className="space-y-4 text-sm">{[['Receipt', activeEvidence.receipt.receiptId], ['Nhà cung cấp', activeEvidence.observation.provider], ['Conversation ID ứng viên', activeEvidence.observation.native.conversationId], ['Message ID ứng viên', activeEvidence.observation.native.messageId], ['Thời điểm quan sát', activeEvidence.observation.observedAt], ['Xác minh', activeEvidence.receipt.verification], ['Độ đầy đủ', activeEvidence.receipt.completeness]].map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{key}</dt><dd className="mt-1 break-all font-medium">{value ?? 'UNKNOWN'}</dd></div>)}<p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">Đây là receipt lưu trữ North Start. Không đồng nghĩa với xác nhận từ nhà cung cấp, danh tính Customer, trạng thái đã đọc hoặc gửi thành công.</p></dl> : <div className="py-12 text-center text-sm text-muted-foreground"><Database className="mx-auto mb-3 size-8" />Chọn một receipt để kiểm tra nguồn và độ đầy đủ.</div>}</CardContent></Card></div>
    </div>}
  </div>;
}
export default InboxPage;
