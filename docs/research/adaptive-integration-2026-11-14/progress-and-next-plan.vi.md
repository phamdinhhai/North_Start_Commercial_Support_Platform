# Báo cáo thực hiện AIL và kế hoạch hoàn thiện Pancake

Ngày đối chiếu: 14/11/2026. Phạm vi: đợt triển khai Adaptive Integration Layer trên
branch `feat/adaptive-integration-pancake-research`, nền `12aabd1`.
Trạng thái: thử nghiệm, non-canonical; thay đổi chưa commit/push.

**Cập nhật cuối 15/11:** đã xác minh tag hội thoại và batch event, ngắt socket
15 giây/15 phút có thay đổi trong gap, đọc bù lịch sử và scope POS. Xem
[báo cáo tổng hợp đầy đủ, các fail và kế hoạch triển khai](pancake-evidence-and-completion-2026-11-15.vi.md).
Các phần dưới là snapshot ngày 14/11, gồm các fail và giới hạn tại thời điểm đó.

## 1. Đánh giá hiện trạng

Đã có nền tảng nghiên cứu, xử lý observation và Browser Companion hoạt động với
dữ liệu giả lập. Chưa có connector Pancake chạy đầy đủ từ nguồn thật tới North Star.

| Mảng | Đạt được | Chưa chứng minh |
|---|---|---|
| P1 Conversations | Đọc source Phoenix relay; decoder và continuity tests; browser thật có WebSocket activity | Đăng nhập/quyền hiện tại, socket cụ thể, schema sự kiện nghiệp vụ, replay và recovery |
| P2 POS | Tài liệu chính thức, synthetic receiver, hợp đồng lưu receipt trước ACK | Webhook thật, shop/API credential, persistence PostgreSQL, reconciliation |
| P3 Companion | Extension MV3; scope tab/page; local outbox; Chromium + WebSocket giả lập; giữ dữ liệu sau browser restart | Enrollment theo tenant, upload backend, flow cấp quyền UI đầy đủ, kiểm thử trên hội thoại thật |
| POS App | Đọc tài liệu runtime, token, quyền, data-change | Chưa xây/cài/chạy app trong POS |
| Outbound action | Chưa triển khai | Preview, approval, thực thi, xác minh kết quả, audit |

**Lỗi đang mở, mới tái hiện khi lập báo cáo:** tại
`product/src/adapters/adaptive-connectivity/continuity.ts:36`, reducer chặn reconnect
trực tiếp sau `auth-expired`, nhưng nhận `disconnected` sẽ đổi trạng thái; một lệnh
`connected` tiếp theo được chấp nhận. Chuỗi tái hiện:

```text
connected -> auth-expired -> disconnected -> connected
                                             recorded
```

Đây là lỗi kiểm soát vòng đời quyền trong prototype, chưa phải bypass trên endpoint
production vì prototype chưa được nối vào application. Chưa sửa code trong lượt
lập báo cáo này. Cần thêm regression test và sửa trước pilot. Kết quả 383 test pass
của lượt triển khai vẫn đúng, nhưng không bao phủ chuỗi này.

## 2. Công việc đã thực hiện

| Đầu việc | Kết quả / artifact |
|---|---|
| Tách nhánh | Tạo branch riêng, giữ thay đổi có sẵn và tài liệu người dùng |
| Đối chiếu kiến trúc | Kế thừa adapter Pancake hiện có; code mới thuộc adapters/ports, không đưa semantics provider vào domain |
| Nghiên cứu repo | Clone và đọc có trọng tâm 5 repo Pancake/AIECOS; pin commit và hash file; không chạy code hoặc cài dependency của repo ngoài |
| Nghiên cứu chính thức | Đọc 7 tài liệu POS về webhook, authentication, schema, Apps runtime/data access/overview |
| Bằng chứng | Source ledger 12 nguồn; capability registry 7 mục; liên kết vào registry nghiên cứu có sẵn |
| Phoenix decoder | Validate tuple, topic/page, direction, event type, kích thước; chỉ xuất metadata/hash |
| Continuity | State có thể serialize; retry theo capture ID; conflict; out-of-order; UNKNOWN gap; có lỗi auth-expiry nêu trên |
| POS fixture receiver | Kiểm tra secret header, UTF-8/JSON, kích thước và metadata receipt; chỉ ACK sau khi sink xác nhận |
| Persistence port | Contract append nguyên tử, duplicate/conflict theo scope; chưa có sink PostgreSQL |
| Browser Companion | Manifest MV3, popup start/stop/export, debugger Network events, scope và local persistent outbox |
| Bảo vệ credential | Đọc cookie trong process cục bộ; secret references cho REA; ignore `docs/login_info/`; quét 22 file thay đổi không thấy giá trị cookie |
| Live research runner | Browser profile riêng, navigation + idle observation, chặn HTTP ngoài GET/HEAD/OPTIONS, chỉ xuất aggregate metadata |
| Tự kiểm thử | 45 test mới; smoke Chromium thật với TLS/WebSocket cục bộ; typecheck/lint/build/architecture/registry checks |

Các giá trị workspace/account/connection trong popup hiện là nhãn do người dùng
nhập. Chúng chưa chứng minh quyền truy cập tenant. Local outbox lưu tối đa 1.000
record, chưa upload và chưa có ACK backend hay cơ chế dọn dữ liệu sau ACK.

## 3. Tri thức khai thác từ repository

| Repository / commit | Đã đọc và phát hiện | Hướng sử dụng |
|---|---|---|
| `trananhhh/pancake-webhook-relay` / `23e2409` | Phoenix v2 tuple `[joinRef, ref, topic, event, payload]`; page topic; heartbeat/reconnect; 3 event labels. Dedup conversation bằng ID + message_count trong 500 ms | Tham khảo protocol; không kế thừa dedup hoặc coi là live contract |
| `trongvan722000/pancake-streaming-ingestion` / `3dd8686` | Gateway trả thành công sau enqueue/poll(0), chưa đợi delivery callback; DLQ flush không kiểm tra số record còn chờ trước commit; README ghi webhook thật chưa đăng ký được | Học mô hình ingestion; phải thiết kế lại bảo đảm durable ACK/DLQ |
| `aiecosvietnam/aiecos-social-crm` / `dba1bdb` | Manifest/content script dùng selector DOM, message elements, MutationObserver; MIT | Reference browser companion; chưa audit toàn bộ receiver/database/MCP |
| `nguyennguyenit/pancake-pos-mcp` / `c9a67fa` | Webhook tool CRUD `webhooks`, ví dụ order.created/order.updated; không khớp contract cấu hình hiện đọc từ POS; MIT | Không dùng wrapper làm nguồn chuẩn cho endpoint/schema |
| `lynguyenvu/pancake-mcp-server` / `1e6678b` | Chat client tách user API và public page API; phân biệt access token/page token; có write/generate-token methods | Tham khảo auth/surface mapping; chưa thực thi các phương thức |

Ba repo relay, streaming và Python MCP chưa xác định được license từ phạm vi kiểm
tra. Không sao chép implementation vào sản phẩm. Có source không đồng nghĩa có
quyền vận hành giao thức nội bộ lâu dài.

Các label từ source relay đã dùng cho fixture:
`pages:update_messages`, `pages:update_conversation`, `messages:mark_as_deleted`.
Chưa xác nhận chúng trong frame nghiệp vụ của tài khoản thật ở đợt này.

## 4. Tri thức từ tài liệu POS chính thức

- Webhook cấu hình qua `PUT /shops/{SHOP_ID}`, body `shop.webhook_*`.
- Loại dữ liệu: `orders`, `customers`, `products`, `variations_warehouses`,
  `einvoices`, `auto_call`.
- Provider gửi POST JSON kèm header đã cấu hình; tài liệu yêu cầu 2xx trong 30 giây.
- Tài liệu mô tả retry sau 10 phút, rồi thêm 30 phút; sau đó dừng. Đây là thông tin
  documented, chưa quan sát live. Trả 2xx phải sau khi đã nhận bền vững; xử lý nặng
  có thể chạy bất đồng bộ sau đó.
- Tài liệu gợi ý API đọc lại dữ liệu theo thời gian cập nhật để khôi phục. Chưa
  chứng minh mọi loại dữ liệu đều có lịch sử đầy đủ hoặc replay từng event.
- API key cửa hàng, API key tài khoản và app token có scope/quyền khác nhau.
  Cookie người dùng cung cấp chưa thay thế được việc xác minh các credential này.
- App token hết hạn sau 15 phút theo tài liệu; quyền là quyền user giao với access
  của app, gắn shop/user/app/version. Không đưa app token sang backend tùy ý.
- POS Apps chỉ chạy khi có người mở POS. Backend webhook/API cần thiết cho nền.
- `pos.on('data-change')` có thể là thay đổi form draft hoặc route, batched 300 ms;
  không đủ để khẳng định server đã lưu thành công.
- Per-app webhook với HMAC nằm trong phần planned phase 2 của tài liệu đã đọc;
  không dựng một HMAC contract giả cho cơ chế webhook hiện tại.
- Markdown `WebhookOrderResponse` và `WebhookCustomerResponse` có mô tả nhưng
  thiếu danh sách field; cần sample thật hoặc schema đầy đủ trước khi map.

Nguồn: [source-ledger.json](source-ledger.json), có URL, commit/hash và ngày truy xuất.

## 5. Quan sát Pancake thật và giới hạn

Đã dùng file cookie được cung cấp trong browser nghiên cứu riêng. Không xuất giá
trị cookie ra report; không chủ động gửi tin, tạo đơn, đổi settings hoặc tạo token.
HTTP guard không phải cơ chế chứng minh mọi tác động server bằng không: browser
vẫn có thể gửi WebSocket frames và GET tự động.

| Chỉ số capture thành công | Kết quả |
|---|---:|
| Thời gian | 19.596 ms |
| WebSocket opened | 2 |
| Frames sent / received được giữ lại | 2 / 2 |
| Request events được giữ lại | 1.024 |
| Request-failed events được giữ lại | 921 |
| HTTP ngoài nhóm đọc bị chặn ở local | 6.190 |
| Events bị bỏ khỏi capture | 10.301 |

10.301 là số event của công cụ quan sát bị omitted, **không phải** bằng chứng mất
10.301 tin nhắn Pancake. Chặn mọi POST làm ứng dụng retry mạnh; capture này bị ảnh
hưởng bởi cách thiết kế thí nghiệm và không đại diện cho vận hành bình thường.

Chưa xác nhận đăng nhập/quyền hiện tại, socket origin, Phoenix transport hay nội
dung nghiệp vụ. Bộ xuất summary lúc đó chưa đọc đúng object URL nên danh sách
origin trống không có giá trị phủ định. Chỉ lưu aggregate derivative, chưa lưu
bản evidence đầy đủ đã khử thông tin nhạy cảm để audit lại từng event.

Verdict ngày 11/11 trong repository ghi nhận dashboard authenticated và internal
GET 200. Tuy nhiên, thư mục `docs/research/pancake-rea-2026-11-11/` được dẫn chiếu
không có trong checkout hiện tại. Xem đó là ghi nhận lịch sử chưa đối chiếu lại,
không dùng để nâng kết luận của capture ngày 14/11.

## 6. Những việc đã thử nhưng fail hoặc chỉ đạt một phần

| Vấn đề | Kết quả xử lý | Trạng thái còn lại |
|---|---|---|
| GitHub REST trả 403 rate limit | Chuyển sang Git clone/ls-remote | Đã lấy được 5 repo Pancake |
| Spawn agent lỗi model `cx/gpt-6.1-sol` | Làm tuần tự | Chưa sửa cấu hình agent; không có review độc lập từ agent phụ |
| Một số URL tài liệu đoán ban đầu trả 404 | Tìm qua sitemap và llms.txt | Đã tìm đúng developer docs |
| Fetch tài liệu/source gặp timeout | POS tải lại được; Meta/TikTok raw source không lấy được | Meta/TikTok chỉ pin HEAD, chưa source-verified |
| Các lần REA capture đầu fail | Bổ sung stage/error-code diagnostics | Một số lỗi đầu thiếu đủ bằng chứng để kết luận nguyên nhân gốc |
| Parser đọc sai cấu trúc Evidence | Đổi sang normalized_result/raw_result | Đã có aggregate capture thành công |
| Parser URL không lấy được socket origin | Sửa hỗ trợ URL object | Chưa rerun live để xác minh sửa này |
| Chặn POST làm retry storm, capture omitted nhiều | Thêm ngưỡng dừng 100 request bị chặn hoặc 500 tổng request | Chưa rerun live; ngưỡng dừng không giải quyết nguyên nhân retry |
| Chromium smoke đầu không ghi được outbox | Đổi xác minh tab URL sang debugger target inventory | Smoke đã pass sau sửa |
| Test/typecheck fail do thiếu argument và kiểu mock | Sửa fixture/call signature | Suite cuối đã pass |
| Auth-expiry bị xóa bởi disconnected | Tái hiện trong lượt lập báo cáo | Chưa sửa; phải xử lý trước pilot |
| 21 test PostgreSQL không chạy | Run trước không cung cấp TEST_DATABASE_URL | Skip, không phải pass hoặc fail |

## 7. Kiểm thử thực sự chứng minh được gì

- 45 test mới kiểm tra decoder, isolation, metadata privacy, retry/conflict,
  ordering/gap, auth-expiry cơ bản, receipt ACK, malformed input và worker lifecycle.
- Full suite lượt triển khai: 383 pass, 21 skip. Không chạy lại toàn bộ suite trong
  lượt báo cáo; chỉ tái hiện riêng lỗi lifecycle bằng dữ liệu giả lập.
- TypeScript adaptive-connectivity: 100% line, 95,88% branch coverage trong run
  có phạm vi chọn lọc. Không phải coverage toàn project hay toàn extension.
- Smoke Chromium thật dùng TLS/WebSocket giả lập cục bộ, không gọi Pancake. Chứng
  minh CDP frame -> local outbox và persistence qua browser restart.
- Smoke seed cấu hình vào trusted worker; chưa kiểm chứng đầy đủ thao tác người
  dùng qua popup, cấp/từ chối quyền và enrollment backend.
- Typecheck, lint, strict architecture, build và registry validation đã pass.
  Validator hiện có chưa validate sâu schema của registry AIL mới.
- Chưa có kiểm thử provider-delivered webhook, mất mạng thật 15 phút rồi backfill,
  concurrent PostgreSQL writes, crash recovery, tải dài hạn hoặc release packaging.

## 8. Kế hoạch triển khai tiếp, theo thứ tự phụ thuộc

| Bước | Công việc | Bằng chứng hoàn thành |
|---|---|---|
| 0. Sửa nền thử nghiệm | Giữ auth-expired cho mọi lifecycle event đến khi có reauthorization hợp lệ; regression test; test ngưỡng capture và origin extraction; validate registry AIL | Không thể reconnect/accept observation sau expiry bằng chuỗi disconnected/restart; guard được test bằng local fixtures |
| 1. Xác định kết nối pilot | Xác minh session, một page Conversations và một shop POS; credential/quyền riêng cho từng surface; connection ID do backend cấp | Danh sách capability read/event/write độc lập, scope xác thực, không chứa secrets |
| 2A. Hoàn tất Conversations discovery | Quan sát phiên ổn định; phân loại endpoint theo hành vi, không chỉ HTTP method; thí nghiệm message/update/delete được cấp quyền; reload/offline/expiry | Mỗi user action có network/event/state correlation; frame schema, origin, event/object identity; limitation rõ |
| 2B. Hoàn tất POS contract | Đọc sample/schema thật; dựng receiver sandbox trước khi đổi cấu hình; webhook tới URL thử nghiệm riêng; API readback | Payload đúng shop, xác minh nguồn gửi, version/update semantics và event coverage được chứng minh |
| 3. Lưu bền vững | Migration theo gate hiện có; receipt/raw + hash + scope; transaction inbox/outbox; unique constraint; quarantine; checkpoint | Crash trước/sau commit không báo ACK sai; retries không mất record; conflict không overwrite; PostgreSQL tests chạy |
| 4. Recovery | Cursor theo từng endpoint đã xác minh; polling overlap; reconnect/backoff; gap windows; backfill và đối soát | Mất kết nối 15 phút: dữ liệu có thể phục hồi được đối soát; phần không thể xác minh vẫn UNKNOWN |
| 5. Hoàn thiện Companion | Backend enrollment/revocation, token scoped ngắn hạn; uploader/ACK/retry; retention; lifecycle migration; UI cấp quyền; build/release lane | Offline/restart không mất record đã lưu; tenant giả bị từ chối; revoke dừng upload/capture; popup flow đạt E2E |
| 6. Nối commercial pipeline | Map envelope/evidence theo canonical; kiểm tra Lead-scoped access; không suy tag/assignee/customer thành domain truth | Luồng pilot đi được từ input -> context -> handoff -> Sales action theo phần canonical đã duyệt; unresolved semantics giữ OPEN |
| 7. Pilot và review | Health/lag/duplicate/gap/quarantine metrics; runbook; disable/revoke; soak test; Product + Engineering review | Evidence packet đủ để quyết định gate PH4; connector chỉ bật khi gate đạt |
| Sau inbound ổn định | POS embedded app và delegated outbound actions | Mỗi action có preview/permission/approval/idempotency/result verification/audit; không click rồi mặc định success |

Ưu tiên chạy POS official ingestion làm tuyến backend khi quyền/capability đáp ứng;
Conversations discovery và Browser Companion giải quyết phần hội thoại được xác
minh riêng. Không chuyển ngay sang private WebSocket client chạy 24/7 từ bằng
chứng browser hiện có. Chưa chọn microservices/Kafka/WXT vì increment hiện tại
chưa chứng minh cần thêm các thành phần này.

## 9. Đầu vào cần để hoàn thiện với Pancake

- Một page pilot và shop POS xác định, cùng quyền đọc/sự kiện cần thử. File hiện
  có là cookie export; chưa có POS API credential được xác minh.
- Kênh hội thoại thử có thể tạo message/update/delete có kiểm soát; record POS
  synthetic/test riêng để phân biệt với vận hành kinh doanh thực.
- URL HTTPS sandbox để provider gửi webhook, cấu hình header riêng theo connection
  và kế hoạch khôi phục cấu hình trước khi thay đổi shop.
- PostgreSQL test environment, môi trường pilot, owner review gate Product/Engineering.

Các đầu vào này là điều kiện phụ thuộc của những bước live tương ứng. Sửa code,
test fixtures, xây persistence và chuẩn bị receiver có thể làm trước. Việc tạo
credential, đổi webhook hoặc thực hiện mutation thật phải nằm trong phạm vi pilot
đã được xác định; không suy ra từ quyền đọc cookie hiện có.

## 10. Phần ngoài Pancake chưa triển khai

Meta/Messenger/Instagram và hai TikTok LIVE repo chỉ mới tìm được revision; đọc
source từ raw GitHub chưa thành công. Chưa xây Meta ingestion, TikTok Business/Shop
connector, Google Ads change-feed poller, Group Listener, managed browser service,
session protocol daemon hay delegated action runner. Chúng giữ trạng thái backlog
trong registry, không được tính vào tiến độ hoàn thiện Pancake.

Tài liệu đối chiếu: [README](README.md), [source ledger](source-ledger.json),
[capability registry](protocol-capability-registry.json), [live summary](live-summary.json).
