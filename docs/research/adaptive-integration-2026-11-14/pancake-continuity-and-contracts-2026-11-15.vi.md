# Pancake: reconnect và bổ sung contract hội thoại

Ngày: 15/11/2026. Branch: `feat/adaptive-integration-pancake-research`.
Tiếp nối [phép thử settings có hoàn tác](pancake-research-2026-11-15.vi.md).
Trạng thái: nghiên cứu; chưa commit/push, chưa duyệt production hoặc gate PH4.

## Kết quả quan trọng

Đã quan sát **socket đóng → retry → socket mới → Facebook join ACK ok**, rồi
đọc lại API thành công. Đây là kiểm chứng reconnect sau một lỗi transport ngắn;
chưa phải bằng chứng replay hoặc phục hồi đầy đủ các sự kiện bị bỏ lỡ.

| Phép thử | Kết quả quan sát | Giới hạn |
|---|---|---|
| CDP HTTP offline khoảng 15 giây | 4 HTTP request báo ERR_INTERNET_DISCONNECTED; GET sau phục hồi thành công; socket cũ không đóng | Không dùng kết quả này để tuyên bố reconnect |
| Ngắt WebSocket và chặn retry cục bộ 15 giây | 1 socket bị đóng; 11 retry bị từ chối cục bộ; sau mở lại có socket mới và page join ACK ok | Chạy qua bridge thử nghiệm trên tab tạm; không phải mất mạng hạ tầng tự nhiên |
| Đọc lại sau ngắt WebSocket | 2 hội thoại; so sánh sâu và fingerprint canonical trước/sau bằng nhau; settings vẫn 6 tag | Snapshot giống nhau không chứng minh đã nhận mọi sự kiện trung gian |
| Cleanup | Phục hồi transport; đóng tab thử; tab inbox ban đầu và phiên đăng nhập còn nguyên | Không đổi thông tin đăng nhập hoặc cấu hình provider |

Thời gian quan sát từ lúc socket đóng đến join ACK mới: **19,432 giây**. Từ lúc
bỏ chặn đến join ACK: **4,450 giây**. Đây là một lần đo trên tài khoản hiện tại,
không phải SLA, không suy ra p95/p99 hoặc độ tin cậy dài hạn.

Không tạo sự kiện nghiệp vụ trong cửa sổ ngắt. Không sửa hội thoại hay gửi tin
nhắn trong lượt này. Các dữ liệu TikTok tiếp tục chỉ được đọc.

## Phương pháp và bằng chứng

REA thực hiện navigation, các bước chờ và GET trước/sau được khai báo. Fault
injection do runner cục bộ thực hiện, không gán thành một action của REA:

- Phép đầu dùng `Network.emulateNetworkConditions` trên target nghiên cứu.
- Phép sau dùng Playwright WebSocket routing trên **tab tạm riêng**. Bridge
  forward mặc định, không đăng ký message handler và không sửa payload. Khi
  fault bật, đóng hai phía kết nối và từ chối các retry trong phạm vi URL socket
  Pancake. Chỉ hai lần kết nối được forward tới provider: baseline và recovery;
  11 retry bị từ chối tại local.
- Playwright không có public `unrouteWebSocket`, vì vậy tab này được đóng trong
  cleanup thay vì để instrumentation tồn tại trong tab của người dùng.
- Listener CDP cục bộ theo dõi socket lifecycle và tương quan ref của phx_join/
  phx_reply đúng page; không ghi join payload, cookie hay raw frame vào report.
- Cleanup phục hồi mạng trong finally. Kiểm tra sau chạy còn 1 page target,
  đúng target inbox ban đầu.

Evidence REA:

- HTTP offline: `ev_9ad8699e5139c8413fc3cc66ccfc548948dbdd3ea888b58e523f2e80952b1ff0`.
- WebSocket interruption: `ev_529b9caca67e42c2f7fa8d9d9ea02089d31b87eac9d828aa8b29ff1982fe9868`.

Hai capture đều 0 dropped events theo REA nhưng vẫn được đánh dấu `incomplete`.
Snapshot, bridge audit và listener CDP là các nguồn bằng chứng riêng, không phải
REA trực tiếp xác nhận toàn bộ payload hoặc recovery. Evidence đầy đủ nằm trong
thư mục credential đã Git ignore; bản khử dữ liệu nhạy cảm ở
[continuity-experiment.json](continuity-experiment.json).

## Contract hội thoại tìm thấy trong bundle

Đã kiểm tra các handler thực trong bundle HAR ordinal 42, với SHA-256 và offset
ở [conversation-protocol-static-evidence.json](conversation-protocol-static-evidence.json).

| Event | Contract được đọc từ source | Ứng dụng vào prototype |
|---|---|---|
| pages:update_messages | page_id, conversation_id, messages; lọc theo page/hội thoại được chọn | Tiếp tục chỉ xuất metadata và hash |
| pages:update_conversation | conversation; có thể lấy page_id từ conversation khi field ngoài thiếu | Kiểm tra page claim trong object lồng |
| messages:mark_as_deleted | message.id và **message.conversation_id** | Sửa decoder đọc tham chiếu lồng; giữ fallback field ngoài của fixture relay |

Source còn có Phoenix reconnect/rejoin backoff defaults và helper refresh theo
filter hiện tại, áp dụng tối đa 60 hội thoại trả về. Runtime có thể override
backoff. Refresh có giới hạn này chưa chứng minh full history hoặc replay.

Đây là contract từ source lịch sử. Chưa xóa tin nhắn thật hay tạo mới tin nhắn
để xác nhận các event nghiệp vụ trên tài khoản hiện tại.

## Lỗi đã tái hiện và sửa

1. Decoder backend và Companion bỏ sót `message.conversation_id`, làm mất
   externalObjectId của deletion observation. Đã sửa cả hai và kiểm tra parity.
2. Topic hợp lệ nhưng payload khai báo page khác vẫn được nhận. Nay từ chối khi
   page_id/pageId hoặc page_id trong conversation/message mâu thuẫn với topic.
   Đây là lỗi tại boundary prototype; chưa phải bypass production endpoint.
3. Hai tham chiếu deletion ngoài/trong mâu thuẫn từng bị chọn tùy vị trí. Nay
   từ chối thay vì chọn một tham chiếu rồi ghi thành observation.
4. Hash snapshot ban đầu phụ thuộc thứ tự key của JSON. Có hash khác nhau dù so
   sánh sâu cùng nội dung; đã thêm canonical fingerprint để không ghi nhận nhầm
   state change. Raw frame hash vẫn giữ nguyên nghĩa hash byte, không đổi sang
   hash canonical.

Companion tăng revision lên **0.1.1** để phân biệt decoder mới trong evidence.
Không thêm event mới vào allowlist Commercial Event, không đổi domain semantics
hoặc quyết định canonical đang OPEN.

## Kiểm thử và các phần chưa đạt

- Bảy regression test mới fail trước sửa và pass sau sửa.
- Full suite: **394 pass, 21 PostgreSQL skip**; targeted AIL suite: **56 pass**.
- Runner suite: **9 pass**, gồm Chromium thật + fixture WebSocket local kiểm tra
  đóng connection, chặn retry và forward lại sau restore. Fixture không gọi provider.
- Typecheck, lint, build và strict architecture pass. Smoke Companion thật với
  local TLS/WebSocket và persistence qua browser restart cũng pass.
- Coverage chọn lọc cho phoenix-observer.ts và protocol.mjs: 100% line,
  92,03% branch. Không phải coverage toàn project, toàn extension hoặc toàn runner.
- Registry validator hiện có pass; registry AIL có 9 capability, tất cả
  production_approved=false. Validator chưa kiểm tra sâu schema AIL mới.
- Quét 41 file trong phạm vi thay đổi bằng giá trị credential phiên hiện tại và
  file export cũ: không tìm thấy giá trị credential trong các file được quét.
- Không có review độc lập từ agent phụ: spawn vẫn lỗi model cx/gpt-6.1-sol;
  triển khai tuần tự theo one-writer.

Phép HTTP offline ban đầu không đạt mục tiêu đóng WebSocket; đã ghi nhận giới
hạn và dùng phép fault riêng. So sánh hash ban đầu cũng không đủ để kết luận
nội dung thay đổi; đã đối chiếu sâu và sửa thuật toán cho snapshot.

**Replay/gap vẫn UNKNOWN.** Một reconnect ACK không đóng gap trong continuity
state. Chưa chạy mất mạng 15 phút, session expiry live, checkpoint provider,
provider event ID, full backfill hay tải dài hạn. Chưa xác minh POS webhook thật,
tenant enrollment/uploader hoặc sink PostgreSQL.

## Bước triển khai tiếp

1. Tạo bộ contract fixture tổng hợp theo handler đã đọc; chỉ dùng ID/nội dung
   giả lập. Ghi rõ trường nào source-derived, trường nào live-observed.
2. Kiểm thử một sự kiện hội thoại có kiểm soát trên dữ liệu test riêng, kiểm tra
   các automation có thể bị kích hoạt trước khi đổi tag/trạng thái. Dùng event
   thực xuất hiện trong cửa sổ ngắt để chứng minh hoặc bác bỏ khả năng replay.
3. Xác minh endpoint đọc bù, filter/cursor và coverage. Chỉ đóng gap khi có bằng
   chứng đối soát theo từng capability; phần không xác minh được giữ UNKNOWN.
4. Hoàn thiện receipt/checkpoint bền vững cùng tenant authorization theo gate
   persistence; kiểm thử PostgreSQL và crash recovery trước pilot.
5. POS dùng nhánh official riêng: shop, credential, receiver sandbox, sample thật,
   retry và reconciliation. Reconnect của Conversations không thay thế contract POS.
