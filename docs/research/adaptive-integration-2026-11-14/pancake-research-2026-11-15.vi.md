# Pancake: kết quả nghiên cứu và kiểm thử ngày 15/11/2026

Branch: `feat/adaptive-integration-pancake-research`. Trạng thái: nghiên cứu,
non-canonical; thay đổi chưa commit/push. Báo cáo này cập nhật các điểm còn mở
trong báo cáo ngày 14/11, giữ nguyên giới hạn và bằng chứng lịch sử của lượt đó.

Cập nhật tiếp theo: [reconnect, contract hội thoại và sửa decoder](pancake-continuity-and-contracts-2026-11-15.vi.md).

## Kết quả đã xác minh

Đã hoàn thành một phép thử ghi có kiểm soát trên Facebook: tạo tag thử không gắn
vào hội thoại, quan sát response và sự kiện realtime, đọc lại, xóa tag, rồi tải
lại inbox để xác nhận danh sách ban đầu được khôi phục.

| Bước | HTTP và trạng thái | WebSocket được quan sát |
|---|---|---|
| Xác định scope hiện tại | 4 page: 1 Facebook, 3 TikTok; Facebook có role ADMINISTER, không có tag sync group | Chưa suy ra quyền từ socket |
| Baseline | GET settings thành công; 6 tag và có current_settings_key | — |
| Tạo `NSR-1115-A7C2` qua UI | POST settings 200, success=true; GET sau ghi có 7 tag | pages:update_settings trên topic pages, đúng Facebook page, chứa marker thử |
| Xóa đúng tag thử qua UI | POST settings 200, success=true; GET sau xóa có 6 tag | pages:update_settings đúng page; marker đã vắng |
| Tải lại inbox và đọc lại | GET settings 200; 6 tag ban đầu còn nguyên | Không cần suy luận từ giao diện |

So sánh cấu trúc của toàn bộ 6 tag trước/sau cho kết quả bằng nhau. Không gửi tin
nhắn và không sửa các hội thoại khách hàng trong phép thử này.

Hoàn tác **không làm toàn bộ settings giống hệt từng byte**: provider tăng
`current_tag_index` và `current_settings_key`; thao tác xóa của UI lưu thêm
`toggle_tag_when_call_success=[]` và `toggle_tag_when_call_fail=[]`, trước đó hai
field chưa hiện diện. Hai danh sách vẫn rỗng về mặt giá trị. Không cố hạ counter
hay phiên bản provider để xóa dấu vết của phép thử.

## Bằng chứng và phạm vi kết luận

| Evidence ID | Nội dung |
|---|---|
| `ev_ba98792623971a80c7500280ffacb3f9e97599fffedb6cba9aaca7a709f08b62` | Lượt đọc inventory trả 429; bước settings chủ động bị hủy; app vẫn đọc settings nền thành công |
| `ev_56a153f0d9d37745cda27f7e92870cbb9bfbaeeff26b5fc50f750a3ab7f37cea` | Đọc lại inventory thành công; xác minh scope hiện tại |
| `ev_7b8b55eed5b16991b4c775cd459504b30f0e20d1a4864081a02a176ecabf436e` | Quan sát thụ động 10 giây; không thấy request/socket mới trong cửa sổ attach, không phủ định socket đã tồn tại |
| `ev_9a9ed4443c771594d17037449955ed1f185ca9a7e5e771b3771a9271d92f2f9d` | REA thực hiện tạo tag và GET readback |
| `ev_52b4e830df0b8e8f8910d6b5d193dc811f1f5fea5298663acc160ba34ae5201a` | REA thực hiện xóa tag và GET readback |
| `ev_39c769099b666dd713f5f021af63c1a36e4a800edf42440c8269d192a9cb5287` | Tải lại inbox và xác minh cleanup |

REA thực hiện các action UI được khai báo. Listener CDP cục bộ độc lập ghi nhận
frame trong cùng cửa sổ, chỉ xuất event label, topic family, kiểm tra page,
marker và SHA-256; không xuất raw frame hoặc credential. Vì vậy thông tin payload
trong summary là bằng chứng của listener cục bộ, không được gán thành kết quả
decode payload của REA. Hash là hash toàn frame, gồm tuple transport.

Lượt tạo/xóa/reload cuối đều có 0 dropped events theo REA; công cụ vẫn đánh dấu
`incomplete`, với một số nội dung body không sẵn có. Không tuyên bố đã thu đầy đủ
stream hoặc đảm bảo quan hệ nhân quả chỉ từ thứ tự network event.

Tương quan marker riêng + đúng page + response success + readback là bằng chứng
cho phép thử settings này. Nó chưa xác minh `pages:update_messages`,
`pages:update_conversation` hay `messages:mark_as_deleted` của luồng hội thoại.
Không nâng settings observation thành Commercial Event hay commercial outcome.

Chi tiết khử dữ liệu nhạy cảm: [live experiment JSON](facebook-live-settings-experiment.json).
Evidence đầy đủ, payload phục vụ kiểm tra guard và snapshot trước/sau được giữ
trong `docs/login_info/research-2026-11-15/`, đã Git ignore. Chrome profile vẫn
được giữ cục bộ; browser đang ở inbox Facebook.

## Tri thức từ bundle trong HAR

Đã đối chiếu byte của ba bundle với đúng ordinal trong HAR gốc, lưu hash và
offset marker trong [static evidence](facebook-settings-static-evidence.json).
Không chạy code của bundle để nghiên cứu.

- `asset-434`: UI tạo tag với id=null, text, color, lighten_color,
  is_lead_event=false; bỏ index/ordinalNumber trước khi lưu. Xóa tag cũng lọc
  hai danh sách tag dùng cho cuộc gọi. UI có cảnh báo tag sync group.
- `asset-404`: parent gửi `changes` là JSON string và `current_settings_key`.
- `asset-42`: `Koh` trỏ tới `httpPost`, dùng FormData. Handler
  `pages:update_settings` được đăng ký riêng với các handler tag/seen conversation.
- Helper auth cùng bundle loại bỏ access_token khỏi URL API cùng origin và có
  nhánh cookie-session. Đây là quan sát static của build trong HAR, không phải
  bảo đảm provider luôn hỗ trợ cùng contract hoặc quyền chạy client server-side.

Live UI xác nhận FormData contract cho phép thử settings hiện tại. Chưa thử
concurrent update nên chưa kết luận server enforce current_settings_key ra sao.

## Phần đã sửa và tự kiểm thử

- Sửa continuity reducer: `auth-expired` được giữ qua disconnected/restart;
  connected và observation vẫn bị chặn. Tái ủy quyền dùng connection mới.
- Bốn regression case tái hiện lỗi trước sửa, sau sửa đều pass; có serialize/
  restore giữa các bước để bao phủ checkpoint.
- Runner chỉ nhận endpoint đọc cố định hoặc kế hoạch UI tag do code sinh; ghi
  settings chỉ được gửi nếu membership Facebook hiện tại và snapshot hợp lệ.
- Guard parse FormData, đối chiếu concurrency key, giữ nguyên tag có sẵn và chỉ
  cho tạo/xóa marker nghiên cứu. Mọi settings write ngoài kế hoạch bị chặn.
- Summary chỉ xuất endpoint được phép và key nằm trong allowlist; request lỗi
  hoặc cancelled được báo fail. Background response không được nhận là action
  thành công chỉ vì có cùng step_index.
- Kết quả ghi được kiểm tra bằng write audit và readback; click hoàn tất chưa
  đủ. Cookie ngắn được loại khỏi danh sách secret redaction để tránh làm hỏng
  các từ thông thường trong capture; credential dài vẫn dùng env secret refs.

Kiểm tra đã chạy: **387 Vitest pass, 21 PostgreSQL skip**; typecheck, lint,
build, strict architecture và registry validation pass. Thêm **6 Node tests**
cho phân loại summary, không xuất dữ liệu nhạy cảm, bảo vệ tag có sẵn, stale key
và rollback. Sáu đầu vào runner ngoài scope đã bị từ chối trước khi kết nối.
Không quy đổi các kết quả này thành coverage 100% của runner hay extension.
Lệnh chạy bộ kiểm tra runner: `cd product; npm run test:ail:research`.
Đã kiểm tra cú pháp các script, parse JSON của bộ evidence và quét 36 file thuộc
phạm vi thay đổi bằng giá trị credential của phiên hiện tại/file export cũ:
không tìm thấy giá trị credential trong các file được quét. Registry validator
hiện có pass nhưng chưa kiểm tra sâu schema của registry AIL mới.

## Đã thử nhưng fail hoặc chưa đủ

| Lần thử | Kết quả và cách xử lý |
|---|---|
| Kết nối ban đầu | Chrome ERR_ADDRESS_UNREACHABLE, Node DNS ENOTFOUND cho cả Pancake/GitHub; sau đó mạng phục hồi |
| GET inventory đầu | HTTP 429; không lặp liên tục. Lượt đọc sau có khoảng chờ và trả 200; chưa xác định nguyên nhân gốc của 429 |
| Các lượt tạo tag đầu | UI hiển thị marker nhưng POST còn tên mặc định; guard chặn, readback vẫn 6 tag |
| Keyboard thêm/bớt ký tự | Chưa đủ để payload đổi theo ô nhập; tiếp tục bị guard chặn |
| Chờ state trước save | Thêm 750 ms rồi thử lại: payload đúng marker, được gửi và xác minh thành công. Đây là workaround quan sát được; chưa chứng minh nguyên nhân gốc của độ trễ state |
| Capture ban đầu khi thử UI | Omitted 160/161 event do tổng allocation budget; giảm body budget và tăng tổng budget. Các lượt cuối 0 dropped; vẫn incomplete |
| Summary ban đầu | Có thể báo scenario completed dù guard chặn write; đã thêm mutation verification. Giữ audit cũ và đánh giá các lượt đó là fail |
| Phối hợp agent review | Spawn vẫn lỗi model cx/gpt-6.1-sol; thực hiện tuần tự, chưa có review độc lập |

## Công việc còn lại và thứ tự tiếp theo

1. **Conversations event contract:** chọn hội thoại thử riêng; thử thay đổi tag/
   trạng thái trong hội thoại mà không gửi cho khách; đối chiếu request, frame,
   readback, identity và rollback. Không suy contract tin nhắn từ settings event.
2. **Continuity thực:** reload, mất kết nối, session expiry; xác minh cửa sổ gap,
   khả năng đọc bù/cursor và duplicate. Không có replay thì giữ UNKNOWN.
3. **POS riêng:** xác định shop và credential/capability chính thức; dựng receiver
   sandbox, thu sample thật, test nguồn gửi, retry và API reconciliation. Shop ID
   có trong settings chưa chứng minh quyền POS API hoặc webhook.
4. **Ingestion bền vững:** sink PostgreSQL, atomic receipt/checkpoint, inbox/outbox,
   tenant enrollment/revocation và uploader ACK. Cần gate persistence hiện có.
5. **Companion pilot:** consent UI E2E, quyền theo tab/domain, restart/offline,
   retention, metrics và soak test trên surface đã xác minh.
6. **PH4 review:** gom evidence packet và giới hạn còn UNKNOWN để Product +
   Engineering quyết định. Chưa vận hành standalone socket 24/7 hoặc mở outbound
   commercial action từ kết quả nghiên cứu settings.

TikTok vẫn chỉ đọc. Không có agent-authored TikTok mutation; HTTP guard có ghi
0 lần chặn trong các lượt cuối, nhưng đây không phải bằng chứng bao phủ mọi tác
động nền qua browser/WebSocket. Các chức năng Meta/TikTok/Google khác vẫn là
backlog đã ghi trong báo cáo trước.
