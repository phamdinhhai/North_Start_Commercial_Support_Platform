# Pancake — Tổng hợp tri thức, kiểm chứng và công việc còn lại

Ngày: 15/11/2026. Branch: `feat/adaptive-integration-pancake-research`, base `12aabd1`.
Đây là tài liệu nghiên cứu non-canonical. Thay đổi đang ở working tree, chưa commit/push.

## 1. Kết luận để quyết định triển khai

**Đã có bằng chứng trực tiếp cho hướng kết nối browser-assisted với Pancake Conversations:**
đọc hội thoại/tin nhắn, thay đổi tag có giới hạn, nhận event batch và đọc lại trạng thái.
Phép ngắt socket 15 giây có thay đổi trong khoảng ngắt cho thấy không thể dựa vào
rejoin ACK để khẳng định đã nhận lại sự kiện. Reconciliation là năng lực bắt buộc.

**Chưa đủ điều kiện gọi đây là connector thương mại hoàn chỉnh.** Các thiếu hụt chính
là quyền/contract vận hành dài hạn, account/tenant enrollment, durable intake,
reconciliation có coverage chứng minh được, POS webhook thật, kiểm thử tin nhắn bằng
tài khoản test, session expiry, IAM và vận hành production. PH4 vẫn OFF.

Tổ chức code hiện tại phù hợp để tiếp tục phát triển modular monolith. Cần hoàn thiện
những boundary và vận hành nói trên trước pilot thật; chưa có lý do từ bằng chứng
hiện tại để tách microservices hay đưa thêm Kafka chỉ vì tham chiếu một repo ingestion.

## 2. Mục tiêu và ràng buộc đã đối chiếu

Nguồn cao nhất: [Product Constitution](../../canonical/PRODUCT_CONSTITUTION.md),
[Domain Invariants](../../canonical/DOMAIN_INVARIANTS.md),
[Open Decisions](../../canonical/OPEN_DECISIONS.md). Kế hoạch triển khai:
[Requirements R-01…R-28](../../implementation-plan/03-requirements.md),
[Phase Map](../../implementation-plan/05-phase-map.md).

| Mục tiêu/yêu cầu | Ý nghĩa đối với nghiên cứu Pancake |
|---|---|
| Revenue Continuity: acquisition → conversation → lead → handoff → action → outcome | Pancake cung cấp evidence tương tác; không sở hữu Lead, outcome, revenue hay attribution của North Star |
| LVP: Sales hiểu nhu cầu, xem chứng cứ gốc, biết việc tiếp theo | Ưu tiên đường đọc và provenance phục vụ handoff; không xây lại toàn bộ inbox/POS |
| R-01…R-03: workspace/auth/RBAC | Page membership của Pancake không thay thế lead-scoped authorization của North Star |
| R-05/R-06/R-26/R-27: intake, envelope, idempotency và Pancake | HTTP 200 và frame hash chưa đủ cho provider identity, full sync hay contract chính thức |
| R-07…R-17: Lead, handoff, next action, outcome và evidence | Không đổi tag Pancake thành trạng thái Lead hoặc kết quả kinh doanh một cách tự động |
| R-18…R-25/R-28: persistence, AI, audit, telemetry, health và segregation | Observation có scope; UNKNOWN được giữ; synthetic fixtures tách khỏi dữ liệu thật; AI vẫn draft-only |
| CE-1/CE-2/MM-1/ID-1/ID-2/PM-1/LG-1 | Vẫn OPEN; nghiên cứu này không tự chốt transition, event scope, merge, CRM mapping hay permission matrix |
| Quyền người dùng đã cấp | Facebook được kiểm thử chức năng; TikTok chỉ đọc. Cookie/profile/capture nhạy cảm giữ cục bộ ngoài Git |

AIL là kiến trúc thử nghiệm: Integration Intelligence → Adaptive Connectivity →
Governed Commercial Actions. REA tạo bằng chứng nghiên cứu; không phải dịch vụ
subscription, tenant authorization hoặc production execution engine.

## 3. Những repository đã khai thác thực sự

Commit đầy đủ, file và SHA-256 ở [source-ledger.json](source-ledger.json).
Không chạy code của các repo tham chiếu; không coi README hay repo public là quyền
vận hành private protocol.

| Repository/revision | Đã đọc được | Điều cần tránh khi áp dụng |
|---|---|---|
| Pancake webhook relay `23e2409` | Phoenix channel, socket lifecycle, event forwarding | Dedup bằng object ID + message_count trong 500ms có thể làm mất thay đổi hợp lệ; license chưa xác định |
| Pancake streaming ingestion `3dd8686` | FastAPI → Kafka → ClickHouse, retry/DLQ | ACK trước durable Kafka confirmation; flush DLQ chưa được xác nhận; tác giả chưa đăng ký webhook Pancake thật |
| AIECOS `dba1bdb` | Extension quan sát DOM → receiver/CRM; MIT | Có giá trị về UX/companion; không chứng minh network event coverage hoặc quyền SaaS |
| Pancake POS MCP `c9a67fa` | Tool mapping và wrapper; MIT | Webhook CRUD trong wrapper không khớp contract cấu hình shop của tài liệu official hiện kiểm tra |
| Python Pancake MCP `1e6678b` | Phân biệt user/page token và request mapping | Chưa chạy với credential thật; license chưa xác định; không suy ra production authorization |

Các repo Meta/TikTok/Google trong đề xuất rộng vẫn là nhánh nghiên cứu riêng.
HEAD/metadata hay nghiên cứu từ phiên trước không được nâng thành live verification
trong đợt Pancake này.

## 4. HAR và mô hình giao tiếp đã xác định

File `download.devtools` được phân tích cục bộ; 53.386.113 byte, SHA-256
`bcb58184278c4407cc8e2a117461e74dc41dea6c2247fc296cdaf30c23932640`.
Có 589 HTTP entries, 5 WebSocket entries, 104 Phoenix tuples; trích 180 JS assets
để đọc source tĩnh. Không thực thi các bundle trích xuất.

- Socket inbox chính: `wss://pancake.vn/socket/websocket`, Phoenix tuple 5 phần,
  topic family `pages`, `users`, `phoenix`.
- Bốn socket `pages.fm` trong HAR thuộc chat plugin; không được dùng làm bằng
  chứng cho inbox transport.
- HAR lịch sử không chứa ba event message/update/delete đã tìm trong handler.
- Dashboard dùng same-origin session; helper bỏ access_token khỏi URL nội bộ.
  Đây không phải bằng chứng có credential public API cho backend.
- Cookie export cũ không thay thế profile hiện đang đăng nhập. Profile nghiên cứu
  giữ cục bộ; không xuất cookie sang hệ thống North Star.

## 5. Những gì đã kiểm chứng trực tiếp

Tài khoản hiện có 1 page Facebook và 3 page TikTok Business Messaging. Chỉ page
Facebook được dùng cho thao tác thử; không công khai page/customer/shop identity.

| Hạng mục | Bằng chứng/kết quả | Phạm vi kết luận |
|---|---|---|
| Membership và quyền Facebook | Inventory trả HTTP 200; platform facebook, role ADMINISTER, không có tag sync group | Quyền của tài khoản hiện tại; không phải policy tenant North Star |
| Settings và danh sách hội thoại | HTTP 200/success=true; 6 tag gốc, 2 hội thoại đã đọc | Snapshot tài khoản này tại thời điểm thử |
| Shop POS liên kết | GET shop và CRM automation đều HTTP 200/success=true | Đường đọc dashboard POS hoạt động; chưa kiểm tra official API key |
| Automation liên quan tag | CRM automation rỗng; auto_sync_tags và auto_create_by_pages rỗng; sync_conversation_tags_pancake=false; sync_tag_to_botcake=false; auto_tagging=false | Kiểm tra cấu hình hiện thấy; không bảo đảm mọi integration bên ngoài không có automation |
| POS webhook config | webhook_enable/types/url/headers null hoặc chưa cấu hình | Chưa nhận delivery thật; không tự tạo credential hay sửa shop |
| Tag settings | Hai tag nghiên cứu riêng được dùng ở các lượt thử, tạo/xóa qua UI có guard | HTTP success + pages:update_settings + readback; provider counters vẫn tăng |
| Tag hội thoại | Tag thử gắn/gỡ qua UI; exact FormData được kiểm tra; readback 1 → 0 | Có thao tác reversible trên hội thoại Facebook đã đọc; không gửi tin nhắn |
| Event hội thoại thật | Khi toggle tag nhận **pages:tag_conversations** dạng batch | Không chỉ event đơn như giả thuyết ban đầu |
| Ngắt HTTP 15 giây | HTTP lỗi rồi phục hồi; socket cũ vẫn sống | Không chứng minh socket reconnect |
| Ngắt WebSocket 15 giây | Socket cũ đóng, retry bị chặn cục bộ, socket mới join ACK ok | Transport rejoin đã kiểm chứng; không có SLA/p95/p99 |
| Event trong gap 15 giây | Actor nhận batch tag + readback; observer không nhận batch trong cửa sổ phục hồi, GET thấy trạng thái mới | Không thấy replay cho phép thử này; không khẳng định provider tuyệt đối không có replay |
| Ngắt WebSocket 15 phút | 900.004ms local fault; actor đổi tag trong gap; rejoin sau restore 2.502ms; observer không thấy batch replay; GET thấy tag mới | Một phép thử browser transport có kiểm soát; không phải outage hạ tầng hoặc bảo đảm recovery toàn bộ |
| Đọc theo ID | take_conversation_ids[] trả 1; GET single-conversation thành công | Có thể đối soát object đã biết |
| Phân trang hội thoại | Initial 2; current_count=2 trả 0; không có next_cursor trong mẫu | Chỉ chứng minh mẫu nhỏ/filter này; chưa stress khi dữ liệu thay đổi đồng thời |
| Tin nhắn đã có | 25 + 16 = 41 ID không trùng; khớp message_count=41; current_count=41 trả 0 | Lịch sử nhìn thấy của 1 hội thoại; không chứng minh tombstone/full history của mọi tài khoản |
| Đọc lặp trang đầu | Lượt đã thêm settle trả 25, action completed | Lượt đầu timeout vẫn được giữ là failed |
| Lịch sử tag | tags_update_histories trả entries có id/editor/action/source/inserted_at/tag_id | Có thể nghiên cứu phục hồi riêng cho tag; chưa có cursor/retention/đảm bảo đầy đủ |

Contract tĩnh và kết quả đọc ở [pancake-read-contracts.json](pancake-read-contracts.json).
Evidence các phép đổi tag/gap ở
[pancake-conversation-recovery-experiment.json](pancake-conversation-recovery-experiment.json).
Toàn bộ response body, raw frame và DOM có thông tin khách hàng nằm trong thư mục
private đã ignore; tài liệu công khai chỉ có shape, số lượng và hash.

## 6. Reconnect, reconciliation và giới hạn chứng minh

Phép 15 giây có actor: socket observer đóng; một tab actor riêng gắn tag; actor
nhận batch event và GET xác nhận. Observer rejoin thành công sau khi bỏ chặn nhưng
không có batch tag được quan sát lại; snapshot GET sau gap khác baseline.

Điều này chứng minh **trạng thái hiện tại có thể đọc bù trong mẫu**, không chứng
minh đã phục hồi toàn bộ event trung gian. Nếu tag được gắn rồi gỡ khi offline,
snapshot cuối có thể giống baseline mà vẫn mất lịch sử. Một snapshot không đủ để
đóng event gap; lịch sử riêng của capability cần được đánh giá độc lập.

Phép 15 phút: từ 09:44:11.387 đến 09:59:11.391 UTC, fault kéo dài **900.004ms**.
Actor nhận event lúc 09:44:20.141, nằm trong gap. Bridge đóng 1 connection, chặn
187 retry cục bộ, chỉ forward 2 connection lên provider (baseline/recovery).
Socket mới join ACK lúc 09:59:13.893: **2.502ms sau restore**, **902.483ms sau
socket close**. Những số này là một lần đo, không phải SLA.

Trong capture chỉ có document navigation ban đầu; không có document reload hoặc
request hội thoại trong gap. Hai request trong bước chờ dài là analytics nền.
Đối chiếu snapshot sau gap: chỉ field `tags` của 1 hội thoại đổi; message_count,
seen và hội thoại còn lại giữ nguyên. Observer không ghi nhận batch tag replay
trong cửa sổ phục hồi. REA Evidence:
`ev_5686644b1323e5e85faaad191ff9b8494888c854227169568847690fe38291df`;
actor `ev_6cbcb4d1201f8d77629ade0cbb3e9e3dfdab8c366e8e548d9a688ef4915a7fba`.

Hai lượt contract-read lỗi đã chọn nhầm target observer trong thời gian phép dài;
đây là hạn chế cách ly instrumentation cần ghi nhận. Capture không cho thấy
navigation/đọc hội thoại/socket phục hồi sớm do hai lượt đó. Runner đã sửa pin
target và fail nếu target phiên gốc biến mất; không suy ra phép đo là môi trường
outage hạ tầng hoàn toàn biệt lập.

REA ghi 0 dropped trong các lượt thành công nhưng vẫn đánh dấu `incomplete`.
Không chuyển thành cam kết capture đầy đủ, exactly-once, không mất dữ liệu hoặc
provider-confirmed chỉ vì có ACK hoặc hash payload.

## 7. Code đã có và sửa từ bằng chứng

| Thành phần | Trạng thái |
|---|---|
| `adapters/adaptive-connectivity` | Decoder Phoenix, scope/size checks, observation metadata, continuity reducer và POS synthetic receiver |
| `ports/research-receipt.port.ts` | Contract append/duplicate/conflict; chưa có PostgreSQL implementation |
| `adapters/browser-companion` | MV3 local-only, explicit start/stop, selected page/tab, persistent bounded outbox; revision **0.1.2** |
| `scripts/ail` | REA scenario runner, tag guards, local socket fault bridge, summaries và browser smoke |
| Synthetic contract corpus | Ghi provenance từng case: source-derived message/update/delete; live-observed batch tag shape; toàn bộ giá trị giả lập |

Các sửa lỗi đã có regression test:

1. Giữ auth-expired qua disconnected/connected/restart/checkpoint; không reset bằng lifecycle thông thường.
2. Đọc deletion reference tại `message.conversation_id`; chặn outer/nested reference mâu thuẫn.
3. Chặn page claims mâu thuẫn dù topic được cho phép.
4. Hash snapshot canonical, không nhầm thứ tự JSON thành thay đổi dữ liệu; raw-frame hash giữ nguyên nghĩa byte.
5. Không bỏ qua batch `pages:tag_conversations`; cả backend và Companion nhận metadata, kiểm tra nested page và malformed batch.
6. Batch giữ externalObjectId=null, externalEventId=null, occurredAt=null; không tùy tiện chọn 1 object hay diễn giải đơn vị timestamp.
7. Reporter giữ failed/cancelled action là failed dù có HTTP 200 nền.
8. Bỏ cookie ngắn không bí mật khỏi redaction references để tránh xóa nhầm văn bản bình thường.
9. Runner ưu tiên target ID của phiên gốc; không chọn nhầm tab observer đang được dùng bởi lượt nghiên cứu khác.

Không có production uploader, enrollment, action runner, backfill service hoặc route
webhook mới được wire vào Nest. Không tự bật adapter Pancake hiện có.

## 8. Các lượt fail và phần chưa làm

| Hạng mục | Kết quả/thất bại | Cách xử lý/việc còn lại |
|---|---|---|
| Runner cũ chặn POST quá rộng | App retry; POST có thể là thao tác đọc | Runner cũ đã fail-fast trước khi truy cập profile/network; giữ source để đối chiếu. Runner mới giới hạn mutation theo endpoint/payload |
| Tạo tag ngay sau fill | React gửi tên mặc định; guard chặn 3 lần | Keyboard input + chờ 750ms cho payload đúng; chưa chứng minh root cause |
| Capture settings ban đầu | 160/161 events bị dropped | Điều chỉnh allocation, lượt cuối 0 dropped nhưng vẫn incomplete |
| CDP offline ban đầu | Không đóng socket | Dùng local WebSocket fault bridge ở tab tạm riêng |
| Hash snapshot đầu tiên | Khác do key order dù deep-equal | Sửa canonical fingerprint và test |
| Contract-reads hai lần đầu | REA execution_failure/cleanup_incomplete; runner chọn nhầm tab đang được quan sát | Giữ diagnostic private; sửa pin target; lượt đúng target thành công. Capture dài không thấy reload/đọc hội thoại hoặc phục hồi socket sớm |
| Message-tail lượt đầu | Tail 0 hoàn thành; repeat-page timeout dù thấy response 200 | Giữ failed; lượt riêng thêm settle/deadline hoàn thành. Chưa kết luận nguyên nhân gốc |
| Multi-agent review | Spawn lỗi Unknown model cx/gpt-6.1-sol | Không có independent sub-agent review; thao tác tuần tự một writer |
| Message send/receive/delete mới | Chưa làm trên 2 khách hàng thật | Cần hội thoại/tài khoản Facebook test riêng; đã hỏi thông tin, không suy đoán người nhận |
| POS live webhook | Chưa có receiver HTTPS sandbox/credential scoped/config được đăng ký | Synthetic receiver đã có; chưa thể kiểm tra retry/order/delivery identity thật |
| Session expiry live | Chưa ép logout/expire phiên người dùng | Expiry latch mới kiểm chứng synthetic; cần phiên test riêng cho fault auth |
| Full history/replay/tombstone | Chưa có coverage contract, retention hoặc durable provider cursor | Không đóng gap toàn cục; đề xuất hybrid polling + history-specific research |
| Tenant/backend enrollment/upload | Chưa triển khai | Cần signed/scoped enrollment, revoke, persistence/ACK atomic và PM-1 seam |
| PostgreSQL/hosted CI/soak | 21 DB test skip; Docker executable có nhưng Linux engine pipe không chạy | Không lấy unit/memory checks thay bằng DB crash/concurrency hoặc hosted result; cần disposable TEST_DATABASE_URL |

Settings rollback chỉ phục hồi danh sách tag gốc; counter/index/version tăng và
hai call-tag fields trước đây absent đã trở thành mảng rỗng. Conversation tag
rollback vẫn để lại audit/history provider; đó là dấu vết cần giữ, không xóa lịch sử.

Cleanup cuối đã đọc lại sau navigation: **6 tag gốc deep-equal**, không còn tag
nghiên cứu; cả 2 snapshot hội thoại deep-equal với đầu lượt nghiên cứu mới. So với
snapshot settings đầu lượt mới, chỉ current_tag_index/current_settings_key đổi.
Còn đúng 1 browser page, đúng target gốc; local transport đã restore và tab tạm
đóng. Phiên đăng nhập vẫn hoạt động. Evidence cleanup:
`ev_fb225f6f94d84b527318e19d3616bd5bcbcd6d779dfea64599f8294f0086ead4`.

## 9. Đánh giá folder, file, code và kiến trúc baseline

Tham chiếu [architecture map](../../reports/rebuild-baseline-2026-11-12/architecture-map.md)
và [acceptance status](../../reports/rebuild-baseline-2026-11-12/acceptance-status.md).

| Khía cạnh | Đánh giá và việc cần hoàn thiện |
|---|---|
| Folder ownership | domain/application/ports/adapters/infra/api/composition có ranh giới rõ; strict architecture hiện pass. Giữ modular monolith |
| Tổ chức file | Test co-located, research scripts ở scripts/ail, evidence ở docs/research, private material ngoài Git. Runner vẫn là công cụ workstation, cần cấu hình/runtime packaging trước khi dùng chung |
| Research vs runtime | AIL chưa wire vào commercial core là seam phù hợp. Khi mature, tách contract provider-specific khỏi assurance dùng chung để tránh gắn mọi provider vào tên Phoenix/Pancake |
| Dependency enforcement | Checker TypeScript pass; **không kiểm tra import graph .mjs của extension**. Cần bổ sung lane lint/check/package cho extension nếu đưa vào product |
| Identity/authorization | Scope labels và page filter không phải tenant enrollment. Cần identity được server cấp, revoke, lead-scoped projections; browser session không tự cấp quyền đọc toàn inbox cho Sales |
| Data durability | Reducer serialize được và chrome.storage giữ outbox không thay durable receipt/checkpoint transaction của backend |
| Observability/health | Cần last-observed, gap window, rejected unknown schema, outbox lag/full, refresh/reconcile result và honest coverage; không gắn UNKNOWN thành healthy |
| Lifecycle/operations | Cần retention/export/delete, backup/restore được diễn tập, secrets/key rotation, support runbook, release lane và incident/rollback |
| Product validation | Code tests không chứng minh người dùng hiểu handoff hoặc giữ revenue continuity; L1…L5 vẫn cần evidence người dùng |
| Documentation freshness | Báo cáo phase/status cũ có test count/path cũ; đọc theo ngày + SHA. Báo cáo này là checkpoint nghiên cứu mới, không tự sửa canonical/gate bằng tổng số test |

**Verdict:** baseline kỹ thuật để tiếp tục phát triển: phù hợp có điều kiện.
Baseline vận hành thương mại/end-to-end Pancake: chưa đạt.

## 10. Kế hoạch hoàn thiện Pancake theo lát cắt có nghiệm thu

| Thứ tự | Đầu việc | Đầu ra/tiêu chí đạt | Phụ thuộc |
|---|---|---|---|
| 1 | Message capability trên Facebook test | Inbound/update/delete event + GET evidence; outbound preview/execute/readback; negative/retry/conflict; không dùng khách hàng thật làm người nhận test | Tài khoản/hội thoại test riêng |
| 2 | Reconciliation contract | Window/cursor/filter/pagination rõ; snapshot vs event-history coverage riêng; duplicate/order/concurrent insert/delete tests; gap không thể đóng vẫn visible | Message samples; quyền đọc/retention provider |
| 3 | Tenant-bound research intake | Server-issued enrollment, scope resolution/revocation, rate/body/schema limits; reject cross-tenant/replay/tampered scope | Engineering review; PM-1 không tự resolve |
| 4 | Durable receipt + checkpoint | Append raw immutable + hash trước ACK; cùng transaction với checkpoint; crash/retry/conflict tests trên PostgreSQL disposable | Persistence/migration human gate |
| 5 | Official POS webhook sandbox | Shop sandbox + official credential + HTTPS receiver; đăng ký qua shop.webhook_*; verify configured header; provider retry/duplicate/backfill experiments | Sandbox/configuration inputs |
| 6 | POS Apps capability riêng | Token lifecycle/permissions, data-change và browser-closed behavior; không coi route/draft events là committed orders | App development account/runtime |
| 7 | Companion product lane | Build/versioned package, UI consent test, worker suspension/offline/restart/revoke/full-storage/drift tests; lint/import boundary cho .mjs | Ownership release/security |
| 8 | Guarded action runner | Explicit preview, principal/policy/approval, provider action ID nếu có, timeout-unknown, verify-before-retry, audit/correction | Capability write contract; canonical gates |
| 9 | Controlled pilot | PH4 verdict + Product/Engineering gate; manual fallback, monitored data health, soak/recovery; PH4 chỉ bật sau review | Các tiêu chí trên; người dùng pilot |

Không dùng đồng loạt socket/webhook/polling để tạo ba bản ghi canonical khác nhau.
Mỗi lớp giữ acquisition method và provenance; provider-event identity chỉ dùng khi
có contract thật. Capture retry identity và logical event identity phải tách riêng.

Official POS docs hiện mô tả cấu hình `PUT /shops/{SHOP_ID}` với `shop.webhook_*`,
ACK 2xx trong 30 giây, retry 10 phút rồi 30 phút; đây là thông tin documented,
chưa đo delivery thật. Không tự phát minh HMAC. POS Apps token 15 phút và runtime
chỉ hoạt động khi mở POS cũng cần kiểm thử riêng; không suy rộng từ socket Conversations.

## 11. Kiểm thử của checkpoint

- Full Vitest: **397 pass, 21 PostgreSQL skip**; targeted AIL: **59 pass** (nằm trong full suite).
- E2E application/memory scope: **7 pass**; không phải provider E2E hay PostgreSQL proof.
- Node research runner suite: **12 pass**; có Chromium WebSocket fault fixture và privacy regression cho message/POS summaries.
- Typecheck, lint TypeScript, build, strict architecture: pass.
- Companion smoke Chromium thật + local TLS/WS + browser restart: pass, không gọi provider.
- Architecture checker fixtures: **8 pass**; backup guard tests: **6 pass**; không phải restore thật.
- Core registry validator: pass; không được diễn giải thành schema validation sâu cho extension registry AIL.
- Các thay đổi batch được test fail trước sửa và pass sau sửa. Coverage chọn lọc mới cho phoenix-observer.ts/protocol.mjs revision 0.1.2: **100% line, 95,26% branch**, 45 test pass; không phải coverage toàn project/extension/runner.

Không thêm migration, không truy cập DB shared/customer, không sửa canonical hoặc
các forbidden paths. Quét 45 file do đợt nghiên cứu sở hữu bằng credential hiện
tại + export cũ và một số identity thật: **0 literal credential match, 0 identity
match**. Đây không phải comprehensive secret/PII scanner. Kết quả và cleanup nằm
trong machine-readable experiment. Core registry validation pass không tự đóng
các human gate hoặc thay production_approved=false của 12 capability nghiên cứu.
