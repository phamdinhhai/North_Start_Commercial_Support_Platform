# Mô hình triển khai dịch vụ cho North Star
### Nền tảng hợp nhất Marketing – Sales – CRM tích hợp AI, đóng gói cài một lệnh, hai chế độ triển khai: VPS do bạn vận hành hoặc server của khách

> **Lưu ý về độ tin cậy.** Số sao, giấy phép và mức bảo trì của các repo trong tài liệu này là hiểu biết sẵn có, **chưa kiểm tra lại**. Cần xác minh trước khi chốt. Phần pháp lý chỉ là điểm cần hỏi luật sư, không phải tư vấn pháp lý.

---

## 1. Tóm tắt mô hình

> **Phạm vi / maturity:** Đây là đề xuất mô hình dịch vụ và triển khai dài hạn, chưa được duyệt thành LVP scope hay cam kết thương mại. Theo `docs/Dinh_nghia_bai_toan_V2.md` §§11–12, MVP validation hiện chỉ chọn vai trò A (nền tảng vận hành nhẹ); vai trò B, control plane, licensing, installer và fleet operations cần quyết định/gate riêng. Quyền có thẩm quyền trên từng loại dữ liệu/trường phải được xác nhận theo pilot; bảng dưới đây chưa phải cấu hình khách hàng.

**Sản phẩm:** North Star, một nền tảng gộp dữ liệu khách hàng, hội thoại đa kênh, chiến dịch marketing, pipeline bán hàng và AI trên cùng một lớp dữ liệu (xem blueprint).

**Cách bán và triển khai:**

1. Đóng gói sản phẩm để cài được bằng **một lệnh / một nút**, chạy bằng Docker Compose.
2. Có **phễu dùng thử**: khách đăng ký, hệ thống kích hoạt một bản riêng.
3. Mỗi khách có **một bản triển khai riêng (single-tenant)**, theo một trong hai chế độ: **Chế độ A** – VPS do bạn mua, vận hành và gắn cho khách (managed); **Chế độ B** – cài trên **server/VPS của khách** (customer-hosted). Cùng một gói phần mềm, khác nhau ở chủ hạ tầng và người vận hành (xem 1.1).
4. Doanh thu chính từ **thiết lập, thuê bao vận hành, tùy biến, tích hợp, đào tạo**, cộng phí AI theo mức dùng.
5. Bạn sở hữu **lớp điều khiển** để tạo, giám sát, nâng cấp, sao lưu, tạm dừng và xóa các bản triển khai. Đây là phần giúp mô hình mở rộng được khi số khách tăng. Với chế độ B, lớp điều khiển chủ yếu quản lý giấy phép, phiên bản và sức khỏe, không giữ hạ tầng của khách.

### 1.1 Hai chế độ triển khai

| Tiêu chí | Chế độ A: VPS do bạn vận hành | Chế độ B: server của khách |
|---|---|---|
| Chủ hạ tầng, tài khoản nhà cung cấp | Bạn | Khách |
| Người vận hành hằng ngày | Bạn | Khách (hoặc IT của khách), bạn hỗ trợ |
| Cách cài | Lớp điều khiển tự cấp máy và cài | Khách chạy script cài, hoặc bạn cài giúp qua quyền truy cập tạm thời |
| Dữ liệu nằm ở | Hạ tầng của bạn | Hạ tầng của khách |
| Vai trò về dữ liệu cá nhân (cần luật sư xác nhận) | Thường là bên xử lý dữ liệu, nghĩa vụ nặng hơn | Nhẹ hơn, trừ khi bạn truy cập từ xa hoặc nhận dữ liệu qua telemetry |
| Nghĩa vụ giấy phép copyleft (AGPL...) | Cung cấp dịch vụ qua mạng | Phân phối phần mềm cho khách |
| Kiểm soát phiên bản, nâng cấp | Cao, bạn chủ động | Thấp hơn, phụ thuộc khách |
| Chi phí cố định của bạn | VPS theo từng khách | Gần như không có chi phí hạ tầng theo khách |
| Mô hình giá | Thuê bao gồm hạ tầng | Phí cài, giấy phép/thuê bao phần mềm, gói cập nhật và hỗ trợ |
| Rủi ro chính | Chi phí, công vận hành, trách nhiệm dữ liệu | Môi trường không đồng nhất, phiên bản cũ, khó hỗ trợ, sao chép giấy phép |
| Hợp với khách | Doanh nghiệp nhỏ và vừa không có IT, muốn "bấm là chạy" | Khách có IT, yêu cầu dữ liệu nằm nội bộ, hoặc muốn tự quản hạ tầng |

**Nguyên tắc chung cho cả hai chế độ:**
- Một **gói phần mềm duy nhất** (cùng image, cùng template Compose, cùng migration), chỉ khác phần cấp máy và quản lý.
- Cùng một bộ cài một lệnh, có bước kiểm tra môi trường (preflight) trước khi cài.
- Cùng chuẩn secret riêng cho từng khách và cùng quy ước đặt tên theo `customer_code`.
- Khách có thể **chuyển từ B sang A hoặc ngược lại** bằng sao lưu và khôi phục, nên cần thiết kế dữ liệu dễ di chuyển.

**Gợi ý thứ tự:** bắt đầu với chế độ A cho 1–3 khách đầu để kiểm soát chất lượng và học vận hành, đồng thời giữ template tương thích chế độ B. Mở chế độ B khi bộ cài, giấy phép và quy trình hỗ trợ đã ổn, hoặc sớm hơn nếu khách mục tiêu bắt buộc dữ liệu nằm trên server của họ.

---

## 2. Vòng đời một khách hàng

```
Đăng ký → (Dùng thử) → Thanh toán → Cấp VPS → Cài bản riêng → Bàn giao
   → Vận hành (nâng cấp, giám sát, sao lưu) → Gia hạn / Quá hạn → Tạm dừng
   → Hủy → Xuất dữ liệu → Xóa sạch (có hạn giữ lại thỏa thuận)
```

**Trạng thái instance:** `pending`, `provisioning`, `trial`, `active`, `past_due`, `suspended`, `cancelled`, `deleted`.

**Luồng cấp máy (tự động hóa):**

1. Khách đăng ký trên website → tạo bản ghi `customer` + `subscription`.
2. Thanh toán thành công (webhook từ SePay hoặc cổng khác) hoặc duyệt dùng thử thủ công.
3. Lớp điều khiển đưa tác vụ `provision_instance` vào hàng đợi.
4. Gọi API nhà cung cấp VPS tạo máy, gắn SSH key và `cloud-init`.
5. `cloud-init` cài Docker, cài **agent** nhẹ của lớp điều khiển, kéo template Compose.
6. Sinh secret ngẫu nhiên riêng cho từng khách (JWT, khóa mã hóa, mật khẩu DB, khóa object storage).
7. Tạo DNS `ten-khach.tenmien-cua-ban.com` qua API (ví dụ Cloudflare) và cấp HTTPS (Caddy hoặc Cloudflare Tunnel).
8. Chạy migration, tạo tổ chức và tài khoản chủ, kiểm tra sức khỏe.
9. Gửi thông tin đăng nhập cho khách, ghi nhật ký.

Nếu một bước lỗi thì tác vụ phải có thể **chạy lại an toàn (idempotent)** và có **hoàn tác** (xóa máy dở dang để không mất tiền).

Phần trên là luồng của **chế độ A**. Chế độ B có luồng riêng ở 2.1.

### 2.1 Vòng đời chế độ B (server của khách)

```
Đăng ký / mua giấy phép → Khách chuẩn bị server → Nhận mã kích hoạt
   → Cài (khách tự chạy hoặc bạn cài giúp) → Kích hoạt giấy phép → Kết nối kênh
   → Bàn giao → Vận hành (nâng cấp có kiểm soát, sao lưu do khách)
   → Gia hạn / Hết hạn (chế độ chỉ đọc) → Hủy (dữ liệu vẫn ở khách)
```

**Trạng thái giấy phép:** `trial`, `active`, `grace`, `expired_readonly`, `revoked`.

**Luồng cài:**

1. Khách đăng ký hoặc mua, nhận **mã kích hoạt** (license key) và tài liệu yêu cầu máy chủ.
2. Khách chuẩn bị server: hệ điều hành, Docker, tên miền, mở cổng 80/443, có đường ra internet để kéo image và kích hoạt.
3. Khách chạy **một lệnh cài** (hoặc bạn cài giúp qua quyền SSH tạm thời, tính phí thiết lập). Script chạy **preflight**: kiểm tra hệ điều hành, Docker, RAM, ổ đĩa, cổng, DNS, kết nối tới registry. Không đạt thì dừng và báo rõ lý do.
4. Script đăng nhập **registry riêng** của bạn bằng token theo khách, kéo image, sinh secret ngẫu nhiên, tạo `.env`, chạy migration, mở trang `/setup` tạo tổ chức và tài khoản chủ.
5. Agent **kích hoạt giấy phép** bằng cách gọi ra lớp điều khiển (khách không cần mở cổng vào).
6. Khách kết nối OA/Page của họ, kiểm tra webhook, import dữ liệu, phân quyền.
7. Bàn giao, đào tạo, ghi lại phiên bản và ngày kích hoạt.

**Khi giấy phép hết hạn:** có thời gian ân hạn (`grace`), sau đó chuyển sang `expired_readonly` (đọc và xuất dữ liệu, không nhận thao tác mới). **Không khóa hay xóa dữ liệu của khách.** Quy tắc này nên ghi trong hợp đồng.

---

## 3. Kiến trúc tổng thể

Hai chế độ dùng chung một template phần mềm. Sơ đồ dưới là **chế độ A**; chế độ B ở mục 3.4.

```
                         ┌────────────────────────────────────────┐
                         │          LỚP ĐIỀU KHIỂN (của bạn)      │
 Website đăng ký ───────▶│ Portal khách │ Admin nội bộ │ Billing  │
 (thanh toán SePay...)   │ Hàng đợi tác vụ │ Registry instance    │
                         │ Giám sát tập trung │ Kho cấu hình/bản  │
                         └───────────┬────────────────────────────┘
                                     │ API nhà cung cấp VPS, DNS, agent (mạng quản trị)
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│ VPS khách A   │            │ VPS khách B   │            │ VPS khách N   │
│ Compose stack │            │ Compose stack │            │ Compose stack │
└───────────────┘            └───────────────┘            └───────────────┘
```

### 3.1 Mỗi VPS khách chạy gì (template Compose)

| Service | Vai trò |
|---|---|
| `app` | Backend + frontend của North Star (hoặc nhiều service nếu ghép module) |
| `worker` | Tác vụ nền: đồng bộ kênh, chấm điểm, gợi ý AI, báo cáo |
| `channel-gateway` | Webhook Meta/Zalo OA/ZNS, form web, chuẩn hóa sự kiện về một định dạng |
| `postgres` | CSDL chính (kèm `pgvector` nếu dùng RAG) |
| `redis` | Hàng đợi, cache, buffer sự kiện |
| `object-storage` | MinIO hoặc S3/R2 cho file đính kèm |
| `caddy` / tunnel | HTTPS và reverse proxy |
| `backup` | Sao lưu có lịch (restic/pgBackRest) |
| `agent` | Báo heartbeat, phiên bản, số liệu; nhận lệnh nâng cấp từ lớp điều khiển |

**Quy ước bắt buộc ngay từ đầu** (để chạy được nhiều khách trên một máy khi cần):
- Đặt tên container, mạng, volume, cổng theo `customer_code`.
- Mỗi khách một bộ secret riêng, không dùng chung.
- Mọi cấu hình nằm trong `.env` sinh tự động, không sửa tay.

### 3.2 Lớp điều khiển gồm gì

| Thành phần | Chức năng |
|---|---|
| Registry | Danh sách khách, instance, máy chủ, phiên bản, trạng thái, hạn dùng |
| Provisioner | Chế độ A: tạo/xóa VPS, DNS, cài template. Chế độ B: sinh mã kích hoạt, token registry, script cài |
| Lifecycle manager | Dùng thử, gia hạn, quá hạn, tạm dừng, hủy, xóa |
| Upgrade manager | Nâng cấp theo đợt (canary → số đông), rollback |
| Observability | Sức khỏe, tài nguyên, lỗi, sao lưu gần nhất |
| Billing | Gói, hóa đơn, thanh toán, ví token AI |
| License server (chế độ B) | Cấp, gia hạn, thu hồi giấy phép; xác minh định kỳ; ghi trạng thái ân hạn/chỉ đọc |
| Support tooling | Truy cập có kiểm soát vào instance, nhật ký thao tác |

### 3.3 Hai cách chọn lõi sản phẩm

> **Guardrail phạm vi (2026-10-27).** Mục 3.3 chỉ là **đề xuất dài hạn ở Tier 2**, chưa được duyệt thành quyết định kiến trúc. Thực tại dự án: **Đường B đang được đi** — modular monolith TypeScript tự xây tại `product/` (xem `docs/canonical/ARCHITECTURE_CONSTITUTION.md`, `ADR-002`, `04-architecture.md` C-01…C-12). Việc "chạy Đường A để thử với 1–3 khách đầu" **không** nằm trong P0 LVP scope và **không** được phép import ngữ nghĩa ngoại lai vào canonical (I-10, I-11); nếu sau này kích hoạt Đường A, phải qua RFC + human gate riêng. Các mục §1–3 và §5–10 (control plane, licensing, installer, fleet ops, SLA) là backlog deferred `R-29…R-41` / `PH7+`, không tự mở rộng PH3.

- **Đường A – Ghép module mã nguồn mở rồi bọc lại.** Twenty (CRM/pipeline) + Chatwoot (inbox) + n8n/Dittofeed (automation) + Metabase (báo cáo) + lớp định danh/attribution của bạn. Ra thị trường nhanh nhất. Đổi lại phải tích hợp nhiều thành phần, giấy phép phức tạp, trải nghiệm kém liền mạch.
- **Đường B – Tự xây lõi** (Next.js/React + Node/TypeScript hoặc Python/FastAPI + PostgreSQL), dùng thư viện mã nguồn mở cho phần phụ trợ. Kiểm soát giấy phép và trải nghiệm tốt nhất, tốn công nhất.
- **Gợi ý:** chạy Đường A để thử với 1–3 khách đầu, đồng thời xây dần lớp riêng (Customer 360, attribution, AI) bằng code của bạn để có thể thay các module dần.

### 3.4 Kiến trúc chế độ B (server của khách)

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────┐
│ LỚP ĐIỀU KHIỂN (của bạn)             │          │ SERVER CỦA KHÁCH                 │
│ Portal │ License server │ Billing    │◀─────────│ agent (chỉ gọi ra ngoài, HTTPS): │
│ Registry image riêng, ký image       │  gọi ra  │  - kích hoạt / kiểm tra giấy phép│
│ Thông báo bản mới, changelog         │          │  - heartbeat, số liệu vận hành   │
│ Truy cập hỗ trợ tạm thời (tùy chọn)  │          │  - hỏi có bản cập nhật không     │
└──────────────────────────────────────┘          │ Compose stack (như mục 3.1)      │
                                                  │ Dữ liệu khách ở lại đây          │
                                                  └──────────────────────────────────┘
```

**Điểm khác với chế độ A:**
- **Agent chỉ gọi ra ngoài, không mở cổng vào.** Khách không phải mở SSH hay cổng quản trị cho bạn. Lệnh từ lớp điều khiển (nếu có) do agent chủ động kéo về.
- **Giấy phép ký số** (ví dụ khóa bất đối xứng): server khách kiểm tra chữ ký, kiểm tra trực tuyến định kỳ, chịu được mất mạng ngắn.
- **Image phân phối qua registry riêng** với token theo khách, image có chữ ký để khách và bạn kiểm tra tính toàn vẹn.
- **Nâng cấp do khách quyết định** (nút bấm hoặc khung giờ), bạn chỉ thông báo và cung cấp bản.
- **Hỗ trợ từ xa là tùy chọn và tạm thời:** khách tạo mã truy cập có thời hạn, mọi thao tác được ghi nhật ký.

**Yêu cầu tối thiểu của server khách (ước lượng ban đầu, cần đo bằng thực tế):** 2–4 vCPU, 4 GB RAM trở lên nếu chạy đủ Postgres, Redis và object storage, 40 GB SSD, Ubuntu LTS gần đây, Docker và Compose phiên bản hiện hành, một tên miền hoặc tên miền con, cổng 80/443, đường ra internet tới registry và lớp điều khiển, đích sao lưu do khách chỉ định.


---

## 4. Lõi sản phẩm: thực thể và AI

> [!IMPORTANT]
> **Mục 4 subordinate to canonical Tier 1 — không phải mô hình dữ liệu đã duyệt.** Các điểm dưới đây là phác thảo dài hạn và bị ràng buộc bởi:
> - `Contact` (hồ sơ hợp nhất) **chưa phải entity lõi đã duyệt** — `docs/canonical/DOMAIN_MODEL.md` §2 và `IDENTITY_MODEL.md` §§1–2 chỉ định nghĩa `Customer` / `CustomerRef` / `Identity`.RFC-005 Q2 đang để ngỏ; không tạo bảng/cột `Contact` chỉ vì mô tả này.
> - `Order` / `Payment` / `Campaign/Ad/Source` là dữ liệu **thuộc module hoặc hệ bên ngoài**; nền tảng chỉ giữ claim/pointer cho tới khi adapter được duyệt (I-10, I-11).
> - **Attribution "truy ngược được về Campaign và Conversation đầu tiên" không được bảo đảm bởi schema** — mô hình ghi công vẫn `OPEN: MM-1`, và mọi chuỗi không nối được phải hiển thị UNKNOWN (I-02, I-08), không suy đoán.
> - **Gộp trùng theo SĐT/Zalo ID/PSID không được tự động** — merge là manual, cần bằng chứng và hoàn tác được (I-06, `OPEN: ID-1`).
> - **AI chỉ draft** — tóm tắt / soạn nháp / RAG đều không được tự mutate dữ liệu thương mại (I-03, I-04); mọi suy diễn đi qua Commercial Event + Evidence + Policy (CE-2 vẫn mở).

### 4.1 Mô hình dữ liệu tối thiểu
`Contact` (hồ sơ hợp nhất), `Identity` (SĐT, email, Zalo ID, PSID...), `Campaign/Ad/Source`, `Conversation/Message`, `Lead/Opportunity`, `Order/Payment`, `Activity/Task`, `EventLog` (nguyên liệu của AI).

**Nguyên tắc:** mọi `Opportunity` và `Order` truy ngược được về `Campaign` và `Conversation` đầu tiên (attribution). Đây là thứ phần lớn công cụ rời rạc không làm được.

### 4.2 Định danh và gộp trùng
- Định danh theo thời gian thực: **quy tắc tất định** (chuẩn hóa SĐT, khớp Zalo ID/PSID).

### 4.3 Lớp AI
- LLM qua API cho tóm tắt, soạn tin nháp, hỏi đáp dữ liệu; RAG bằng `pgvector`.
- **Khóa API LLM:** quyết định của bạn thì cần **ví token/hạn mức theo khách**, có thể tái dùng ý tưởng và portal nạp tiền token AI bạn đang có.


---

## 5. Repo / framework tham khảo và nên dùng

> Cột "Giấy phép" cần xác minh lại trên repo trước khi dùng.

### 5.1 Lõi CRM, inbox, automation, AI

| Repo | Vai trò | Giấy phép (cần xác minh) | Ghi chú |
|---|---|---|---|
| `twentyhq/twenty` | CRM, pipeline | AGPL-3.0 | API REST/GraphQL, MCP; ràng buộc khi host cho khách |
| `chatwoot/chatwoot` | Inbox đa kênh | MIT (phần cộng đồng) | Zalo phải tự làm qua API Channel |
| `dittofeed/dittofeed` | Automation đa kênh | MIT | Nhẹ, hợp TypeScript |
| `mautic/mautic` | Marketing automation | GPL/AGPL | Nặng (PHP) |
| `langgenius/dify` | Workflow AI, RAG | Apache có điều kiện thêm | Đọc kỹ điều kiện đa tenant |
| `langfuse/langfuse` | Quan sát/đánh giá LLM | MIT (phần lõi) | Hợp vòng học từ kết quả |
| `moj-analytical-services/splink` | Gộp trùng bản ghi | MIT | Dùng khi migrate dữ liệu |
| Metabase / Apache Superset | Dashboard | AGPL / Apache-2.0 | Dùng cho báo cáo attribution |

### 5.2 Yêu cầu đóng gói và thiết kế sản phẩm
- Script cài và nâng cấp **idempotent**, tự backup CSDL trước khi migrate, có hướng dẫn và lệnh rollback.
- Trang `/setup` tạo tổ chức và tài khoản chủ ở lần chạy đầu.
- RBAC theo ma trận chức năng × hành động, kèm audit log mọi thao tác quản trị.
- Public REST API (xác thực bằng API key) và webhook (ví dụ `message.received`, `contact.created`) để khách tự tích hợp mà không cần sửa lõi.
- Lead scoring theo luật ở giai đoạn đầu: nhiều tiêu chí có trọng số cấu hình được, tự giảm điểm khi khách im lặng, phát hiện lead đình trệ.
- Giới hạn tốc độ gửi tin và phát hiện gửi quá nhanh, theo hạn mức của từng nền tảng kênh.
- Dùng **migration có kiểm soát** và sao lưu bắt buộc trước mỗi lần nâng cấp; không dùng cơ chế tự đẩy schema có thể làm mất dữ liệu.

### 5.3 Lớp điều khiển và hạ tầng

| Nhu cầu | Công cụ |
|---|---|
| Tạo/xóa VPS tự động | API của nhà cung cấp (Hetzner, Vultr, DigitalOcean, hoặc nhà cung cấp trong nước), **OpenTofu/Terraform** |
| Cấu hình máy lặp lại | **Ansible**, `cloud-init` |
| Deploy ứng dụng lên máy từ xa | **Coolify** (Apache-2.0) hoặc **Dokploy**, có API; hoặc agent tự viết |
| HTTPS | **Caddy**, **Traefik**, **Cloudflare Tunnel** |
| Mạng quản trị riêng | **Tailscale** hoặc **Headscale/WireGuard**, tránh mở SSH công khai |
| Hàng đợi tác vụ dài | **Temporal** (đáng tin cậy, có thử lại) hoặc **BullMQ/Redis** (đơn giản hơn) |
| Đăng nhập tập trung cho đội bạn | **Authentik**, **Keycloak**, **Zitadel** |
| Thu phí thuê bao | Tự xây theo portal hiện có, hoặc **Lago** (AGPL), **Kill Bill** |
| Thanh toán nội địa | **SePay** (bạn đã dùng), cổng khác tùy nhu cầu |

### 5.3b Bổ sung cho chế độ B (server của khách)

| Nhu cầu | Công cụ / cách làm |
|---|---|
| Giấy phép và kích hoạt | Tự xây (JWT/khóa bất đối xứng, kiểm tra định kỳ) hoặc dịch vụ cấp phép như Keygen (cần xác minh giấy phép và phương án tự host) |
| Registry image riêng | GitHub Container Registry, GitLab Registry, Harbor, Docker Hub private; token theo khách |
| Ký và xác minh image | **cosign** (Sigstore) |
| Script cài và preflight | Shell/Docker Compose theo mã khách; Ansible nếu bạn cài giúp |
| Cài hoặc quản lý từ xa khi khách đồng ý | **Coolify/Dokploy** kết nối SSH tới server khách, hoặc Ansible với khóa tạm thời |
| Truy cập hỗ trợ tạm thời | **Tailscale**, **Cloudflare Tunnel/Access**, hoặc SSH reverse tunnel dùng mã có hạn |
| Cập nhật có kiểm soát | Agent tự viết kéo bản đã ký; tránh cập nhật tự động không kiểm soát trên production của khách |

### 5.4 Giám sát, bảo mật, sao lưu

| Nhu cầu | Công cụ |
|---|---|
| Sống/chết | **Uptime Kuma** |
| Số liệu tài nguyên và ứng dụng | **Prometheus + Grafana**, **Beszel**; **OpenTelemetry** để gửi số liệu về |
| Nhật ký | **Loki** hoặc **Vector** |
| Lỗi ứng dụng | **Sentry** self-host, **GlitchTip** |
| Sao lưu | **restic**, **pgBackRest**, đích S3/R2/MinIO; **kiểm thử khôi phục định kỳ** |
| Quản lý bí mật | **SOPS + age**, **HashiCorp Vault** (khi lớn) |
| Quét lỗ hổng | **Trivy**, **Dependabot/Renovate** |
| Truy cập hỗ trợ có kiểm soát | **Teleport** (nếu cần), hoặc bastion + nhật ký thao tác |

### 5.5 Dữ liệu và phân tích

PostgreSQL + `pgvector`; **ClickHouse** hoặc BigQuery khi dữ liệu lớn; **dbt** để chuẩn hóa; **PostHog** cho phân tích hành vi sản phẩm.

---

## 6. Vận hành: nâng cấp, sao lưu, an toàn

- **Nâng cấp:** phiên bản hóa image; nâng cấp **canary** (1–2 khách nội bộ) rồi theo đợt; mỗi lần nâng cấp: backup → migrate → kiểm tra sức khỏe → tự rollback nếu lỗi. Giữ ma trận phiên bản đang chạy của từng khách.
- **Sao lưu:** hằng ngày, giữ theo chính sách (ví dụ 7 ngày + 4 tuần); lưu **ngoài VPS khách**; thử khôi phục định kỳ và đo thời gian khôi phục.
- **Bảo mật:** SSH key, tắt đăng nhập mật khẩu, firewall chỉ mở 80/443, cập nhật hệ điều hành tự động, mã hóa dữ liệu nhạy cảm (khóa mã hóa riêng từng khách), audit log mọi truy cập quản trị.
- **Telemetry:** chỉ gửi về lớp điều khiển số liệu vận hành, không gửi dữ liệu cá nhân của khách hàng cuối (chi tiết ở 6.2).
- **Sự cố:** có runbook khôi phục từ backup sang VPS mới; đo RTO/RPO mục tiêu.

### 6.1 Khác biệt khi chạy trên server của khách (chế độ B)

- **Nâng cấp:** khách chọn khung giờ; mỗi bản có changelog; migration tương thích ngược; hỗ trợ ít nhất phiên bản hiện tại và một bản trước (N-1); chạy kiểm tra trước (đủ ổ đĩa, đã sao lưu) rồi mới nâng, tự rollback nếu lỗi.
- **Sao lưu:** đích do khách chỉ định (S3/R2/NAS). Script cảnh báo khi không có bản sao lưu gần đây. Trách nhiệm sao lưu và kiểm thử khôi phục ghi rõ trong hợp đồng.
- **Bảo mật máy chủ:** khách chịu trách nhiệm hệ điều hành, firewall, SSH. Bạn cung cấp checklist hardening và script kiểm tra cấu hình.
- **Môi trường không đồng nhất:** preflight bắt buộc; hỗ trợ một tập hệ điều hành và phiên bản Docker được liệt kê rõ; ngoài tập đó là "best effort".
- **Giấy phép:** dựa vào chữ ký số, kiểm tra định kỳ, ân hạn và chế độ chỉ đọc; không dựa vào làm rối mã. Giá trị bán hàng chủ yếu là cập nhật, hỗ trợ và dịch vụ.
- **Hỗ trợ:** truy cập tạm thời bằng mã do khách cấp, có hạn, có nhật ký; log chẩn đoán đã lọc dữ liệu cá nhân; gói hỗ trợ có SLA.

### 6.2 Telemetry: gửi / không gửi

| Được gửi về lớp điều khiển | Không được gửi |
|---|---|
| Instance còn sống (heartbeat), phiên bản đang chạy | Tên, số điện thoại, email, Zalo ID, PSID của khách hàng cuối |
| CPU, RAM, ổ đĩa, thời gian hoạt động | Nội dung tin nhắn, ghi chú, file đính kèm |
| Số lỗi, mã lỗi (đã lọc nội dung) | Lịch sử mua hàng, địa chỉ, bất cứ thứ gì nhận diện được một người |
| Kết quả và thời điểm sao lưu gần nhất | Nội dung prompt và phản hồi AI chứa dữ liệu khách |
| Số liệu tổng hợp theo ngày (số hội thoại, số lead, tỷ lệ gợi ý AI được chấp nhận) | Danh sách khách hay lead theo từng cá nhân |

**Lưu ý:** lọc sạch log và mã lỗi trước khi gửi (đây là chỗ hay rò rỉ nhất); cân nhắc ẩn con số quá nhỏ khi báo cáo; ghi rõ những gì được gửi trong hợp đồng và chính sách quyền riêng tư; thu thập thêm chẩn đoán chi tiết chỉ khi khách đồng ý (opt-in).

---

## 7. Mô hình doanh thu và chi phí

**Nguồn thu (tách bạch như đề xuất trước):**
1. **Phí thiết lập một lần:** cài đặt, kết nối kênh, import dữ liệu, thiết lập quyền.
2. **Thuê bao vận hành theo tháng/năm:** theo cấu hình VPS và số người dùng, gồm cập nhật, giám sát, sao lưu.
3. **Phí AI theo mức dùng:** ví token hoặc hạn mức, nếu bạn cấp khóa LLM.
4. **Tùy biến và tích hợp:** workflow, prompt AI, tích hợp ERP/kế toán/thanh toán, đào tạo.

**Khác biệt theo chế độ:**

| | Chế độ A | Chế độ B |
|---|---|---|
| Phí thiết lập | Có (cấp máy, kết nối kênh, import) | Có nếu bạn cài giúp; tùy chọn nếu khách tự cài |
| Định kỳ | Thuê bao gồm hạ tầng và vận hành | Giấy phép/thuê bao phần mềm, gói cập nhật và hỗ trợ (không gồm hạ tầng) |
| Chi phí của bạn | VPS, sao lưu, giám sát, công vận hành | Registry, license server, công hỗ trợ từ xa |
| Lưu ý | Biên lợi nhuận phụ thuộc chi phí máy | Tránh gói nhiều năm trả trước nếu chưa tính chi phí cập nhật theo kênh chính thức |

**Chi phí cần tính khi định giá:** VPS (cố định theo tháng, kể cả khi khách ít dùng), object storage và băng thông, sao lưu ngoài máy, tên miền/chứng chỉ, chi phí LLM, công hỗ trợ, thời gian máy "ngủ" sau khi khách hủy. Giá thuê bao phải phủ chi phí máy, công vận hành và có biên lợi nhuận; chưa có số liệu nên cần tính theo giá nhà cung cấp thực tế.

**Chỉ số kinh doanh nên theo dõi:** số instance hoạt động, chi phí hạ tầng trên mỗi khách, thời gian cấp máy, tỷ lệ chuyển từ dùng thử sang trả phí, tỷ lệ hủy, giờ hỗ trợ trên mỗi khách.

---

## 8. Pháp lý và tuân thủ (điểm cần hỏi luật sư)

1. **Vai trò xử lý dữ liệu:** ở **chế độ A**, VPS do bạn mua và vận hành nên bạn thường là bên xử lý dữ liệu cho khách. Ở **chế độ B**, dữ liệu nằm trên hạ tầng khách nên nghĩa vụ nhẹ hơn, nhưng nếu bạn truy cập từ xa để hỗ trợ, nâng cấp hoặc nhận dữ liệu qua telemetry thì có thể vẫn bị coi là bên xử lý trong phạm vi đó, nên cần điều khoản truy cập tạm thời và phạm vi telemetry rõ ràng. Cần hợp đồng/điều khoản xử lý dữ liệu, phạm vi truy cập, bảo mật, thông báo sự cố, xóa dữ liệu khi chấm dứt. Đối chiếu Nghị định 13/2023/NĐ-CP (đồng ý thu thập, phân quyền, nhật ký truy cập, quy định về lưu trữ/chuyển dữ liệu).
2. **Dịch vụ đám mây trong nước:** xem dịch vụ có phát sinh nghĩa vụ thông báo hay lưu trữ dữ liệu trong nước hay không.
3. **Điều khoản nhà cung cấp VPS (chế độ A):** có cho phép bán lại/gắn cho bên thứ ba, vị trí đặt dữ liệu. Ở chế độ B, khách tự chịu điều khoản với nhà cung cấp của họ.
4. **Chính sách kênh:** Meta và Zalo yêu cầu duyệt ứng dụng, có giới hạn nhắn tin theo khung thời gian; mỗi khách thường phải tự kết nối OA/Page của họ. Ở chế độ B cần chọn app riêng của từng khách hay app chung kèm relay (xem 3.4).
5. **Hợp đồng dịch vụ:** SLA, giới hạn trách nhiệm, ai chịu trách nhiệm cho từng kênh, quy định giữ và xóa dữ liệu sau khi hủy, quyền đối với phần tùy biến.
6. **AI:** nếu dữ liệu khách đi qua LLM bên thứ ba cần thông báo và có lớp ẩn danh hóa dữ liệu nhạy cảm.
7. **Hợp đồng và EULA cho chế độ B:** phạm vi giấy phép sử dụng, hành vi khi hết hạn (không khóa hay xóa dữ liệu của khách), trách nhiệm hạ tầng và sao lưu thuộc về khách, giới hạn hỗ trợ phiên bản cũ, quyền truy cập tạm thời của bạn.

---

## 9. Quyết định giấy phép (cần chốt sớm)

Cả hai chế độ đều kích hoạt nghĩa vụ của giấy phép copyleft, theo hai đường khác nhau: ở **chế độ A** (bạn host, khách truy cập qua mạng) là điều khoản dịch vụ qua mạng (AGPL §13); ở **chế độ B** (bạn giao phần mềm cho khách tự chạy) là phân phối lại phần mềm, khách có quyền nhận mã nguồn đầy đủ và quyền sửa, chia sẻ lại theo cùng giấy phép. Vì vậy các thành phần **AGPL** (Twenty, Mautic, erxes, Lago...) buộc mở mã nguồn phần dựa trên chúng trong cả hai chế độ. **Fair-code** (n8n) và các giấy phép có điều kiện (Dify) hạn chế một số cách bán dịch vụ, và cần xem lại điều khoản khi giao cho khách tự chạy.

| Lựa chọn | Hệ quả |
|---|---|
| Chủ yếu thành phần MIT/Apache + code tự viết | Có thể đóng mã phần của bạn; ít ràng buộc |
| Dùng thành phần AGPL | Phải mở mã phần liên quan, hoặc mua giấy phép thương mại của tác giả |
| Mở mã sản phẩm của bạn (AGPL + giấy phép thương mại) | Dựa vào uy tín, dịch vụ, thương hiệu; mức bảo vệ mã nguồn thấp |
| Gọi thành phần bên thứ ba qua API riêng biệt | Có thể giảm ràng buộc, nhưng cần luật sư xác nhận ranh giới |

Ở chế độ B, muốn giữ mã đóng thì phải dùng thành phần MIT/Apache, tự viết, hoặc có giấy phép thương mại của tác giả thành phần; nếu không thì giá trị bán hàng chuyển sang cập nhật, hỗ trợ, dịch vụ và thương hiệu.

Cũng cần chốt **thương hiệu** (tên, logo, quyền sử dụng) và **tên miền** của dịch vụ.

---

## 10. Lộ trình triển khai

| Giai đoạn | Nội dung | Tiêu chí hoàn thành |
|---|---|---|
| 0. Quyết định gốc (1–2 tuần) | Chốt giấy phép, đường A/B, nhà cung cấp VPS, ai giữ khóa LLM, gói giá | Tài liệu quyết định + danh sách rủi ro |
| 1. Template một lệnh (3–4 tuần) | Docker Compose theo mã khách, script cài/nâng cấp idempotent, preflight (hệ điều hành, Docker, cổng, RAM, ổ đĩa, DNS), `/setup`, backup, HTTPS; dùng chung cho cả hai chế độ | Cài mới trên VPS sạch (của bạn hoặc của khách) trong dưới 30 phút, không thao tác tay ngoài khai báo |
| 2. Lớp điều khiển tối thiểu (4–6 tuần) | Registry, provisioner (API VPS + DNS), vòng đời dùng thử/hủy, Uptime Kuma, nâng cấp từng máy | Cấp được máy cho khách thử bằng một nút |
| 2b. Chế độ B (3–4 tuần) | License server và giấy phép ký số, agent chỉ gọi ra ngoài, registry riêng và ký image, nâng cấp có kiểm soát, truy cập hỗ trợ tạm thời, tài liệu cho IT của khách | Một khách cài và vận hành được trên server của họ với hỗ trợ tối thiểu |
| 3. Sản phẩm lõi (song song, 2–3 tháng)  |
| 4. Thanh toán và vận hành (3–4 tuần) | Gói/hóa đơn, tạm dừng khi quá hạn, xuất và xóa dữ liệu, runbook sự cố | Chu trình đăng ký đến hủy chạy hết tự động |
| 5. AI hỗ trợ (1–2 tháng) | Tóm tắt, gắn thẻ ý định, soạn tin nháp, hỏi đáp dữ liệu, Langfuse | Tỷ lệ gợi ý được chấp nhận đo được |
| 6. AI dự đoán và quy mô | Lead scoring học từ kết quả, cảnh báo, nâng cấp canary, nhiều nhà cung cấp VPS | Mô hình vượt luật thủ công trên dữ liệu thật |

**Nguyên tắc:** làm cho Sales thấy lợi ích ngay (khỏi nhập Excel, có lịch sử chat), vì nếu họ không dùng thì dữ liệu phía sau sẽ trống. Thử với 1–3 khách thật trước khi tự động hóa mọi thứ.

---

## 11. Rủi ro chính

| Rủi ro | Cách xử lý |
|---|---|
| (Chế độ A) Chi phí VPS cố định, khách ít dùng hoặc hủy | Gói giá có mức tối thiểu, tạm dừng/xóa tự động, theo dõi chi phí trên mỗi khách |
| Công vận hành tăng nhanh theo số khách | Đầu tư lớp điều khiển sớm, nâng cấp theo đợt, giám sát tập trung |
| Chính sách Meta/Zalo thay đổi | Tách `channel-gateway`, xin duyệt sớm, dùng kênh chính thức |
| Mất hoặc lộ dữ liệu khách | Sao lưu ngoài máy, thử khôi phục, mã hóa, audit log, hợp đồng rõ trách nhiệm |
| Xung đột giấy phép | Chốt chiến lược giấy phép từ đầu, hỏi luật sư |
| Phụ thuộc vào một người/nhà cung cấp | Tài liệu hóa runbook, hỗ trợ ít nhất hai nhà cung cấp VPS về lâu dài |
| Dữ liệu Excel cũ bẩn | Dành thời gian chuẩn hóa và gộp trùng khi onboard |
| Chi phí và độ tin cậy của LLM | Mô hình nhỏ cho tác vụ đơn giản, cache, hạn mức theo khách, người duyệt tin gửi ra ngoài |
| (Chế độ B) Server khách cấu hình sai, thiếu tài nguyên, không sao lưu | Preflight bắt buộc, checklist hardening, cảnh báo thiếu sao lưu, hợp đồng ghi rõ trách nhiệm hạ tầng |
| (Chế độ B) Nhiều phiên bản cũ rải rác ở khách | Hỗ trợ N-1, nâng cấp có kiểm soát, thông báo trước khi hết hỗ trợ phiên bản |
| (Chế độ B) Sao chép hoặc dùng giấy phép trái phép | Giấy phép ký số, kiểm tra định kỳ, EULA; giá trị nằm ở cập nhật và hỗ trợ, không dựa vào làm rối mã |
| (Chế độ B) Khó hỗ trợ vì không có quyền truy cập | Truy cập tạm thời có mã, log chẩn đoán đã lọc, gói hỗ trợ có SLA |
| (Chế độ B) Relay webhook trở thành điểm tập trung rủi ro | Cân nhắc app riêng cho từng khách; nếu dùng relay thì không lưu nội dung, ghi nhật ký tối thiểu |

---

## 12. Quyết định còn bỏ ngỏ (cần bạn chốt)

1. Đường A (ghép module) hay đường B (tự xây lõi) cho 3 tháng đầu?
2. Giấy phép sản phẩm: đóng mã, mở mã kiểu AGPL kèm bản thương mại, hay lai?
3. Ai giữ khóa API LLM: khách hay bạn (kèm ví token)?
4. Chế độ A: bạn mua toàn bộ VPS (trọn gói), hay khách tự mua tài khoản nhà cung cấp rồi cấp quyền cho bạn?
5. Nhà cung cấp VPS đầu tiên và vị trí đặt dữ liệu.
6. Ngành và quy mô khách mục tiêu đầu tiên (B2C bán lẻ, giáo dục, bất động sản, B2B dịch vụ có pipeline rất khác nhau).
7. Kênh mang doanh thu chính của nhóm khách đầu tiên (Zalo OA, Messenger, hotline...).
8. Chế độ B (server của khách): mở từ đầu hay sau khi chế độ A ổn định? Bạn cài giúp (tính phí thiết lập) hay khách tự cài bằng script?
9. Meta App và Zalo App: mỗi khách một app riêng hay app chung của bạn kèm webhook relay?
10. Hành vi khi giấy phép hết hạn ở chế độ B (thời gian ân hạn, chế độ chỉ đọc, thời gian hỗ trợ phiên bản cũ).

---

## Phụ lục A. Checklist bàn giao chế độ A (VPS do bạn vận hành)
- [ ] VPS đã cấp, SSH key và firewall đúng chuẩn
- [ ] Tên miền con và HTTPS chạy
- [ ] Secret riêng được sinh, không dùng lại
- [ ] Tổ chức và tài khoản chủ đã tạo
- [ ] Kênh đã kết nối (OA/Page của khách), webhook kiểm thử thành công
- [ ] Phân quyền theo phòng ban đã cấu hình
- [ ] Import dữ liệu cũ và gộp trùng đã chạy
- [ ] Sao lưu hằng ngày chạy và đã thử khôi phục một lần
- [ ] Agent báo heartbeat về lớp điều khiển
- [ ] Hợp đồng và điều khoản xử lý dữ liệu đã ký
- [ ] Đào tạo đội khách và kênh hỗ trợ đã bàn giao

## Phụ lục B. Checklist bàn giao chế độ B (server của khách)
- [ ] Server đạt yêu cầu tối thiểu, preflight chạy qua không lỗi
- [ ] Tên miền và HTTPS chạy, cổng 80/443 mở đúng
- [ ] Mã kích hoạt đã kích hoạt, giấy phép hiển thị trạng thái `active`
- [ ] Image kéo từ registry riêng bằng token của khách, chữ ký image đã kiểm tra
- [ ] Secret riêng được sinh, `.env` không lộ ra ngoài
- [ ] Tổ chức và tài khoản chủ đã tạo
- [ ] Kênh đã kết nối (OA/Page của khách), webhook kiểm thử thành công; đã chốt app riêng hay app chung kèm relay
- [ ] Đích sao lưu do khách chỉ định, đã chạy thử sao lưu và khôi phục một lần
- [ ] Agent báo heartbeat, đã thống nhất danh sách telemetry được gửi
- [ ] Khung giờ nâng cấp và quy trình thông báo bản mới đã thống nhất
- [ ] Quy trình cấp quyền hỗ trợ tạm thời đã hướng dẫn cho khách
- [ ] Hợp đồng, EULA và điều khoản xử lý dữ liệu đã ký (gồm hành vi khi hết hạn giấy phép)
- [ ] Đào tạo đội khách và kênh hỗ trợ đã bàn giao