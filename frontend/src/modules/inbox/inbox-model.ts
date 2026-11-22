import { filterDuplicateSourceMessages, getLastMessage, type PreviewMessage } from './chatwoot-conversation-helper.mjs';

export type Channel = 'pancake' | 'meta' | 'web';
export interface InboxConversation {
  id: string;
  channel: Channel;
  contact: string;
  initials: string;
  subject: string;
  owner: string;
  label: string;
  color: string;
  messages: PreviewMessage[];
}
const time = (minutes: number) => Date.parse('2026-11-22T02:00:00Z') / 1000 + minutes * 60;
const message = (id: string, content: string, minute: number, message_type = 0): PreviewMessage => ({ id, source_id: id, content, created_at: time(minute), message_type });

/** Fabricated UI fixtures only. These are never provider events or commercial claims. */
export const inboxFixtures: InboxConversation[] = [
  { id: 'demo-pancake-1', channel: 'pancake', contact: 'Studio Lá Xanh', initials: 'LX', subject: 'Tư vấn không gian làm việc', owner: 'Owner · mẫu', label: 'Đang tìm hiểu', color: 'bg-emerald-100 text-emerald-800', messages: [
    message('demo-message-1', 'Chào bạn, studio của mình đang tìm bàn làm việc cho một không gian nhỏ. Có thể tư vấn giúp mình không?', 0),
    message('demo-message-2', 'Chào studio Lá Xanh! Bạn muốn bố trí cho bao nhiêu người và diện tích dự kiến là bao nhiêu?', 3, 1),
    message('demo-message-3', 'Khoảng 4 người, diện tích 25m². Mình ưu tiên phong cách tối giản và vật liệu tự nhiên.', 8),
    message('demo-message-4', 'Tình huống minh họa: cần một cuộc trao đổi tư vấn. Chưa có lịch hẹn hoặc kết quả được xác nhận.', 9, 2),
  ] },
  { id: 'demo-meta-1', channel: 'meta', contact: 'Mai An · mẫu', initials: 'MA', subject: 'Thông tin bộ sưu tập mới', owner: 'Chưa phân công · mẫu', label: 'Cần phản hồi', color: 'bg-blue-100 text-blue-800', messages: [
    message('demo-message-5', 'Mình thấy bộ sưu tập trên trang mẫu. Có thể gửi thêm thông tin về kích thước không?', 14),
    message('demo-message-6', 'Tin nhắn minh họa. Chưa có bằng chứng về điều kiện gửi hoặc tình trạng đọc.', 15, 2),
  ] },
  { id: 'demo-web-1', channel: 'web', contact: 'Café Mây · mẫu', initials: 'CM', subject: 'Hỏi về không gian quán', owner: 'Recipient · mẫu', label: 'Chờ tư vấn', color: 'bg-violet-100 text-violet-800', messages: [
    message('demo-message-7', 'Quán mình đang chuẩn bị một góc đọc sách. Mình muốn trao đổi về cách bố trí.', 21),
    message('demo-message-8', 'Cảm ơn bạn đã chia sẻ. Đây là cuộc hội thoại mẫu để đánh giá trải nghiệm hộp thư.', 24, 1),
  ] },
];

export const channelLabels: Record<Channel, string> = { pancake: 'Pancake', meta: 'Meta Messenger', web: 'Webchat mẫu' };
export function visibleConversations(items: InboxConversation[], channel: string, query: string): InboxConversation[] {
  const search = query.trim().toLocaleLowerCase('vi');
  return items.filter(item => (channel === 'all' || item.channel === channel) && [item.contact, item.subject, ...item.messages.map(m => m.content)].join(' ').toLocaleLowerCase('vi').includes(search));
}
export function previewMessages(item: InboxConversation): PreviewMessage[] { return filterDuplicateSourceMessages(item.messages); }
export function lastPreview(item: InboxConversation): string { return getLastMessage({ messages: previewMessages(item) })?.content ?? 'Chưa có tin nhắn'; }

export interface SourceEvidence {
  receipt: { receiptId: string; disposition: string; completeness: string; verification: string };
  observation: { provider: string; displayName: string; observedAt: string; native: { conversationId: string | null; messageId: string | null }; completeness: string; verification: string };
}
export interface AccessibleLead { id: string; displayName?: string; lead?: { displayName?: string }; }
