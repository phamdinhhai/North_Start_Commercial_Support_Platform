# Bổ sung HAR và phiên đăng nhập do người dùng thực hiện

Trạng thái: nghiên cứu non-canonical; không thay đổi gate PH4.

Tiếp nối ngày 15/11: đã hoàn thành phép thử settings Facebook có cleanup và sửa
lỗi lifecycle. Kết quả mới nằm trong [báo cáo ngày 15/11](pancake-research-2026-11-15.vi.md);
nội dung dưới giữ lại bằng chứng và giới hạn của lượt đăng nhập/HAR ban đầu.

Người dùng đã đăng nhập vào Chrome profile riêng do agent mở và xác nhận phạm vi:
Facebook được phép kiểm thử chức năng; TikTok chỉ đọc. Phạm vi này thay thế giả định
read-only chung cho các phép thử Facebook tiếp theo, nhưng không mở quyền ghi TikTok.

## Phiên browser

- Chrome riêng với CDP bind loopback, profile nằm trong `docs/login_info/` đã được
  Git ignore. Chrome giữ session cục bộ; không tạo thêm file cookie export.
- Metadata reconnect và phân loại page được giữ trong cùng thư mục private.
- REA đã mở trang Pancake; người dùng tự đăng nhập và chọn inbox Facebook.
- Phép đọc chủ động trên page Facebook: `GET .../conversations` và `GET .../settings`
  đều trả HTTP 200. Không thu response body, nên không suy ra content/schema/permission
  của từng record từ status HTTP này.
- Không có agent-authored mutation trong lượt này. Browser vẫn phát sinh các
  request và WebSocket frame nền theo hoạt động của ứng dụng; không áp dụng guard
  chặn mọi POST gây retry storm như thí nghiệm trước.
- Capture ghi 0 dropped events, nhưng REA đánh dấu `incomplete` với missing section
  `events`. Không gọi đây là capture đầy đủ.
- Browser được để mở cho các lượt làm việc tiếp; endpoint CDP có thể thay đổi khi
  browser khởi động lại. Đọc `DevToolsActivePort` trong profile để xác định lại.

## File download.devtools

File là HAR JSON, 53.386.113 byte. SHA-256:
`bcb58184278c4407cc8e2a117461e74dc41dea6c2247fc296cdaf30c23932640`.

| Dữ liệu trong file | Kết quả |
|---|---:|
| HTTP entries | 589 |
| WebSocket entries, status 101 | 5 |
| WebSocket messages | 104 |
| Message parse được thành Phoenix tuple 5 phần tử | 104 |
| Ba business-event label đã biết từ source relay | 0 |
| Page trong response inventory lịch sử | 4: 3 TikTok, 1 Facebook |

Socket `wss://pancake.vn/socket/websocket` có topic families `users`, `pages`,
`phoenix`. Ghi nhận `phx_join`, `phx_reply`, `phx_leave`, `phx_close`, `heartbeat`,
`get_online_status`, `online_status`; reply được phân loại là `ok`.

Bốn socket `wss://pages.fm/socket/websocket` mang `pke_chat_plugin` và `phoenix`,
có query name `pke_chat_plugin_page_id`. Không có bằng chứng để xem chúng là event
transport cho inbox kinh doanh hoặc mở rộng allowlist của Browser Companion.

Trong file không có `pages:update_messages`, `pages:update_conversation` hay
`messages:mark_as_deleted`. Điều này chỉ nói về capture đã cung cấp; không chứng
minh provider không hỗ trợ các event đó. Chưa có correlation giữa mutation thử
nghiệm trên Facebook với business frame và trạng thái server được đọc lại.

## Phương pháp xử lý và evidence

HAR gốc vượt giới hạn 32 MiB của REA network capture decoder. Script
`product/scripts/ail/inspect-pancake-har.mjs` đọc file cục bộ, thống kê cấu trúc
và tạo derivative chỉ chứa metadata của 5 WebSocket handshake.

Derivative không có header/cookie/query values, response text hay frame payload.
Nó không thay thế raw capture. `har-derivation.json` giữ SHA-256 nguồn/derivative
và ordinals gốc `[82, 97, 197, 243, 429]` để đối chiếu.

REA đã giải mã thành công cả 5 record của derivative. Parent evidence:
`ev_02731fb6fc5080ca80e6caa80d56e9892b795fa63c8122adecc0434149f84300`.
Đây là xác minh derivative lịch sử, không phải REA trực tiếp giải mã toàn bộ HAR
gốc hoặc xác minh tính đầy đủ của phiên mạng ban đầu.

Live Facebook read evidence:
`ev_c0b5a0cc99e7b595c176e2005008f36903f825029a1c671d45be152f68342871`.

Các artifact công khai trong repository chỉ là metadata đã chọn lọc:
[HAR review](har-review.json), [derivation](har-derivation.json),
[authorized browser summary](authorized-browser-summary.json).
Source ledger và capability registry đã được cập nhật; production approval vẫn false.

## Bước kiểm thử tiếp theo

1. Sửa lỗi auth-expiry đã tái hiện trong báo cáo trước và bổ sung regression test.
2. Xác định target Facebook cho một thay đổi có thể đảo ngược; kiểm tra page/channel
   trước khi thực hiện để không ảnh hưởng TikTok.
3. Thu before/action/after evidence: mutation response, business frame nếu có,
   API readback và rollback. Lưu fixture khử thông tin nhạy cảm, không suy `click`
   hoặc `online_status` thành provider-confirmed commercial outcome.
4. Sau khi có event mapping thật mới điều chỉnh decoder/Companion và kiểm thử
   reconnect/gap/reconciliation. Live POS webhook vẫn cần xác minh riêng.
