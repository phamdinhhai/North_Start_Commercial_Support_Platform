> **Tier 2 — Kiến trúc tích hợp dạng khảo sát (exploratory).** Tài liệu này ghi lại quá trình brainstorm phương án đồng bộ Pancake và **không**override Tier 1 (`docs/canonical/**`) hay phase scope đã duyệt.
> - **Phạm vi P0 hiện hành** theo `docs/canonical/ARCHITECTURE_CONSTITUTION.md` + `ADR-003` + `ADR-004`: manual/synthetic adapter là nguồn duy nhất được bật; **Pancake read-sync thuộc P1, phase PH4, feature flag OFF**, và bị chặn bởi spike live `T4-00` (Q-03/Q-04 — `spike/Q-03-pancake-api-feasibility.md` là **KB snapshot, chưa verify live**).
> - Bảng xếp hạng phương án ở §12 ("P0", "P0 khi được duyệt", "P0/P1 prototype") phản ánh **thứ tự ưu tiên kỹ thuật trong cuộc thảo luận về riêng lớp đồng bộ Pancake**, **không phải** P0 scope của sản phẩm. Thứ tự bắt buộc của dự án vẫn là PH0→PH1→PH2→PH3→PH5 (PH4 song song, flag OFF) — xem `docs/implementation-plan/05-phase-map.md`.
> - Không có khả năng API nào dưới đây được xác nhận bởi tài liệu này; chỉ live verification tại `T4-00` mới được phép bật code path Pancake (I-11, I-12).

Đúng. Điểm bạn vừa nêu làm thay đổi khá nhiều cách đánh giá hướng “đi thẳng Meta/TikTok”.

Nếu lấy premise vận hành hiện tại là: **Pancake đã đứng giữa người dùng và các nền tảng, xử lý phần partner/app authorization/review để người dùng chỉ cần đăng nhập/kết nối**, thì với sản phẩm của mình, Pancake không chỉ là một “nguồn dữ liệu”. Nó còn là một **lớp hạ tầng ủy quyền và tuân thủ đã được đóng gói sẵn**.

Vì vậy direct Meta/TikTok không phải một shortcut kỹ thuật. Nó gần như kéo chúng ta sang một business khác:

```text
Tích hợp trực tiếp Meta/TikTok
        ↓
App registration
OAuth
App Review
Business verification
Permission review
Policy compliance
Data handling
Token lifecycle
Security review
Region/account restrictions
Support khi account bị revoke
...
```

Trong khi nếu đi qua Pancake:

```text
Customer
   ↓
Login / connect Pancake
   ↓
Pancake đã xử lý phần platform relationship
   ↓
Our Platform đọc qua Pancake
```

Nên tôi sửa lại đánh giá trước đó:

> **Direct Meta/TikTok không nên là phương án chính để giải bài toán realtime ở giai đoạn đầu.**

Nó có thể là hướng chiến lược dài hạn, nhưng **chi phí tổ chức/pháp lý/vận hành** lớn hơn rất nhiều chi phí viết API connector.

---

## Vậy bài toán thật sự trở thành

Không phải:

> “Làm sao bỏ Pancake để realtime?”

Mà là:

> **“Làm sao tận dụng Pancake làm lớp platform authorization nhưng giảm phụ thuộc vào Pancake Webhook?”**

Đây là câu hỏi hay hơn.

Tôi thấy kiến trúc hợp lý nhất lúc này là **Official API + Adaptive Polling + Browser Signal**, thay vì direct Meta/TikTok.

---

# 1. Pancake vẫn là Integration Gateway

Tôi sẽ đặt Pancake vào architecture như sau:

```text
Meta / TikTok / ...
        │
        │ authorization / partner / platform complexity
        ▼
     PANCAKE
        │
        │ official API
        ▼
   OUR PLATFORM
```

Tức chúng ta tận dụng đúng giá trị mà Pancake đã giải quyết.

Nhưng không để realtime phụ thuộc duy nhất:

```text
Pancake Webhook
```

---

# 2. Baseline: Adaptive Polling

Thay vì polling đơn giản kiểu:

```text
5 giây
→ query tất cả conversations
```

ta xây một **Sync Engine có scheduler thích ứng**.

Ví dụ:

```text
Page đang có hoạt động
        ↓
poll 2–5 giây

Page vừa có event
        ↓
temporary burst polling

Page ít hoạt động
        ↓
poll 30–60 giây

Page im lâu
        ↓
poll 2–5 phút
```

Nếu API cho phép lọc bằng timestamp/cursor/updated state phù hợp, ta chỉ lấy delta.

Kiến trúc:

```text
             SYNC SCHEDULER
                   │
           ┌───────┴───────┐
           ▼               ▼
      HOT PAGES        COLD PAGES
       2–5 sec          30–300 sec
           │               │
           └───────┬───────┘
                   ▼
             PANCAKE API
                   │
                   ▼
             CHANGE DETECTOR
                   │
                   ▼
               EVENT BUS
```

Đây có thể đã đủ cho rất nhiều use case Sales.

Vì thực tế:

```text
0.5 giây realtime
```

và:

```text
3–8 giây near-realtime
```

có thể không khác biệt đáng kể về business outcome.

Cái này phải đo chứ không đoán.

---

# 3. Browser Extension không nên scrape dữ liệu làm source-of-truth

Ý Browser Extension trước đó tôi vẫn giữ, nhưng **đổi vai trò**.

Sai:

```text
Extension
→ scrape toàn bộ conversation
→ gửi data lên server
→ dùng thay Pancake API
```

Cách đó brittle và có nhiều rủi ro.

Tốt hơn:

# Browser Extension = Realtime Signal Layer

Ví dụ nhân viên đang mở Pancake.

Extension nhận thấy:

```text
conversation mới xuất hiện
message count đổi
active conversation đổi
UI có activity
```

Extension chỉ gửi:

```json
{
  "workspace": "...",
  "page": "...",
  "conversation_hint": "...",
  "event": "possible_change",
  "time": "..."
}
```

Backend nhận signal:

```text
Browser signal
      ↓
Wake sync job
      ↓
Call official Pancake API
      ↓
Get canonical data
      ↓
Persist
```

Đây là một architecture rất khác.

```text
Extension = trigger

Pancake API = data source
```

Như vậy nếu UI thay đổi, extension có thể mất khả năng trigger nhanh, nhưng **data model của mình không bị corrupt**.

---

# 4. Hybrid này có thể tạo near-realtime rất đẹp

Ví dụ bình thường:

```text
Pancake API
    ↑
poll mỗi 20 giây
```

Nhưng khi browser đang hoạt động:

```text
Pancake UI
    ↓
Browser extension detects change
    ↓
wake sync immediately
    ↓
Pancake API
    ↓
data vào platform sau 1–3 giây
```

Architecture:

```text
                    PANCAKE
                       │
              official public API
                       │
                       ▼
                  SYNC ENGINE
                   ▲       ▲
                  /         \
                 /           \
        Scheduler             Signal
          Polling              Bus
                                ▲
                                │
                         Browser Extension
                                ▲
                                │
                         Pancake Web UI
```

Và nếu sau này Pancake duyệt webhook:

```text
                    PANCAKE
              ┌────────┴─────────┐
              ▼                  ▼
           Webhook              API
              │                  │
              ▼                  ▼
            EVENT          Reconciliation
              │                  │
              └────────┬─────────┘
                       ▼
                  EVENT STORE
```

Extension lúc đó có thể giảm vai trò hoặc bỏ hẳn.

---

# 5. Chúng ta có thể sử dụng chính product action để tránh phải sync một số Pancake-native state

Ví dụ handoff.

Nếu hôm nay Marketing làm:

```text
Pancake
→ tag
→ note
→ gửi Zalo cho Sales
```

rồi mình cố suy ra:

```text
"đây có phải handoff không?"
```

thì rất khó.

Thay vào đó Extension có thể chèn một side panel rất nhỏ:

```text
┌───────────────────────────┐
│ Pancake conversation      │
│                           │
│ Customer A                │
│ ...                       │
│                           │
│ [ Bàn giao cho Sales ]    │
└───────────────────────────┘
```

Khi user click:

```text
Our Extension
      ↓
Our API
      ↓
create Lead
create Handoff
assign Sales
capture timestamp
```

Nếu cần, backend dùng **official Pancake API** để lấy context đầy đủ.

Tức:

> Commercial event quan trọng nhất không cần phải được suy ra từ Pancake.

Nó được tạo trực tiếp trong hệ thống của mình.

---

# 6. Đây có thể là mô hình sản phẩm rất mạnh: “Sidecar for Pancake”

Thay vì cố xây một platform đứng xa Pancake:

```text
Pancake
    ↓
Data synchronization
    ↓
Our application
```

có thể MVP tốt hơn là:

```text
             PANCAKE WEB
                  │
        ┌─────────┴──────────┐
        │                    │
     Pancake           Our Sidecar
    functions          Extension/UI
        │                    │
        └─────────┬──────────┘
                  ▼
             OUR BACKEND
                  │
             Commercial
                layer
```

Marketing gần như **không phải rời Pancake**.

Trong khi Sales/Manager dùng app của mình.

```text
Marketing
    │
    ▼
Pancake + sidecar
    │
    │ Handoff
    ▼
Our Platform
    │
    ▼
Sales workspace
    │
    ▼
Manager / Revenue
```

Điều này còn phù hợp với product thesis ban đầu hơn.

---

# 7. Một insight nữa: không nhất thiết sync mọi thứ realtime

Ta nên chia dữ liệu theo **SLA đồng bộ**.

Ví dụ:

| Dữ liệu                 |       SLA cần thiết |
| ----------------------- | ------------------: |
| New customer message    |               2–10s |
| Handoff                 |            realtime |
| New Lead                |            realtime |
| Sales assignment        |            realtime |
| Message history         |       vài giây/phút |
| Customer profile update |            1–5 phút |
| Tags                    |    10–60s có thể đủ |
| Historical conversation |          background |
| Reports                 | 5–30 phút có thể đủ |

Như vậy sync architecture có thể thông minh hơn rất nhiều.

Không cần:

```text
EVERYTHING REALTIME
```

Mà:

```text
commercial-critical events → fast lane
supporting data             → normal lane
history                     → background lane
```

---

# 8. Tôi sẽ thiết kế Sync Engine theo ba lane

```text
                     PANCAKE API

                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼

     FAST LANE       NORMAL LANE    BACKFILL LANE

   2–10 seconds      30–120 sec        hours

   active convo      customer/tag     history
   hot lead          assignments      reconciliation
   handoff context   metadata         full repair
```

Thêm:

```text
Browser Signal
      ↓
promote object
Normal → Fast Lane
```

Rất hiệu quả.

---

# 9. Reconciliation quan trọng hơn realtime

Ngay cả khi có webhook cũng không nên tin:

```text
Webhook = perfect truth
```

Production sync tốt thường phải có:

```text
Realtime path
+
Reconciliation path
```

Ví dụ:

```text
Realtime
────────
Event arrives
→ update state

Periodic reconciliation
───────────────────────
Every N minutes
→ compare remote/current state
→ find gaps
→ repair
```

Nên Pancake Webhook nếu sau này được duyệt chỉ là:

```text
Acceleration Channel
```

không phải:

```text
Only synchronization mechanism
```

Đây là một architecture khỏe hơn nhiều.

---

# 10. Còn internal Pancake WebSocket/private API?

Sau nhận xét của bạn, tôi càng thấy nó **không nên là production strategy**.

Có thể research để trả lời:

> Pancake UI có update realtime bằng gì?

Nhưng không nên:

```text
reverse engineer
→ copy auth
→ consume undocumented socket
```

làm core.

Bởi chính lợi thế của việc đi Pancake là:

> tránh phải sống trong vùng undocumented/platform-policy complexity.

Nếu mình quay lại phụ thuộc private interface của Pancake thì mất lợi thế đó.

---

# 11. Một phương án khác đáng hỏi Pancake: Partner Integration

Nếu product bắt đầu có traction, thay vì đi vòng Meta:

```text
Our Company
   ↓
Pancake partnership / developer relationship
   ↓
Supported webhook
   ↓
Supported scopes
   ↓
possibly partner APIs
```

Mức effort có thể thấp hơn rất nhiều so với:

```text
Meta partnership
+
TikTok partnership
+
platform compliance
+
app review
+
support
```

Nếu chúng ta trở thành **value-added layer trên Pancake**, Pancake cũng có incentive để hỗ trợ.

Cái này là GTM/platform strategy chứ không chỉ technical strategy.

---

# 12. Tôi sẽ sửa lại ranking kiến trúc

Sau insight của bạn:

| Phương án                                       | Ưu tiên mới           |
| ----------------------------------------------- | --------------------- |
| Pancake Public API incremental/adaptive polling | **P0**                |
| Pancake Webhook chính thức                      | **P0 khi được duyệt** |
| Browser sidecar/signal                          | **P0/P1 prototype**   |
| Own commercial actions in extension             | **P1 rất đáng thử**   |
| Pancake partnership                             | **P1 chiến lược**     |
| Direct Meta API                                 | **P2/P3**             |
| Direct TikTok API                               | **P2/P3**             |
| Private Pancake API/WebSocket                   | **Research only**     |

Khác khá nhiều so với đề xuất trước.

---

# 13. POC tôi muốn chạy trước khi quyết định

Tôi nghĩ chỉ cần 3 experiment là đủ làm rõ 80% bài toán.

**Experiment A — Polling latency**

```text
Pancake activity
→ API detection

Measure:
p50
p95
p99
miss rate
API requests/event
```

**Experiment B — Browser Signal**

```text
Pancake UI event
→ extension trigger
→ backend poll
→ API retrieves event

Measure:
latency
reliability
UI change sensitivity
```

**Experiment C — Sidecar Handoff**

```text
Pancake conversation
→ [Bàn giao]
→ Lead created in our system

Measure:
steps
time
context captured
Marketing usability
```

Nếu B+C tốt thì webhook trở thành:

> Nice upgrade.

Không còn là:

> Blocking dependency để product tồn tại.

---

# 14. Và đây là architectural thesis tôi sẽ giữ lúc này

Tôi sẽ không nói:

> “Pancake là dependency phải thoát.”

Mà là:

> **Pancake là abstraction layer có giá trị mà mình nên tận dụng. Nhưng mình cần thiết kế sync architecture để Pancake Webhook không trở thành single point of failure.**

Cụ thể:

```text
                       PANCAKE
                          │
                     Official API
                          │
                          ▼
                   SYNC / RECONCILE
                    ▲            ▲
                   /              \
           Timer polling       Browser signal
                                  ▲
                                  │
                            Pancake Sidecar
                                  │
                             Marketing
                                  │
                              Handoff
                                  ▼
                         COMMERCIAL EVENTS
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
                  Sales                       Manager
```

Theo tôi đây là hướng **thực dụng hơn, giảm đáng kể gánh nặng pháp lý/platform integration, đồng thời vẫn có con đường tiến tới near-realtime**.

Và quan trọng nhất: nó giữ cho MVP tập trung vào **Commercial Continuity**, thay vì biến startup của mình thành một **Meta/TikTok integration compliance company** trước khi biết khách hàng có thực sự trả tiền cho pain cốt lõi hay không.
