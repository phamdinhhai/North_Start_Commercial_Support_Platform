# Project Status and Handover — North_Start_Commercial_Support_Platform

**Checkpoint SHA (được đo tại đây):** `1b72b61c1ef7a208eb0f291d21a61a8149f1b701` — branch `main`, sync `origin/main` (0 ahead / 0 behind)
**Ngày báo cáo:** 2026-10-11
**Loại tài liệu:** Bàn giao trạng thái (delivery-tier, tổng hợp từ Tier 1–3). **Không phải canonical**, không phải verification record chuẩn thức — bản chuẩn thức vẫn là `docs/implementation-plan/08-verification.md`.
**Cách tạo:** đọc + phân tích + chạy kiểm chứng **read-only**. Không sửa code, không sửa `docs/canonical/**`, không chạy migration, chưa commit/push. File này là thay đổi duy nhất.

**Nguồn kết quả — phân biệt ba mức (mục 5 có chi tiết):**
- `[đo]` = lệnh tôi tự chạy tại đúng SHA này, trong phiên 2026-10-11, môi trường Windows 11 + Node v22.21.0 + npm 10.9.0 + PostgreSQL 16 trong container `north-star-pg` (host port 55432; credentials là dev defaults trong `product/docker-compose.yml`).
- `[agent báo]` = con số do agent ghi trong `08-verification.md`/`state/progress.md`, tôi **không** chạy lại → coi là chưa xác minh độc lập.
- `[doc]` = tuyên bố trong tài liệu, chưa đối chiếu được bằng chạy.

---

## 1. Tóm tắt trạng thái tại HEAD

| Câu hỏi | Trả lời |
|---|---|
| Product giải quyết gì, cho ai | Tầng "Revenue Operating System" giữ ý nghĩa thương mại liên tục khi khách đi qua nhiều hệ thống/bộ phận; người dùng chính là **Sales được gán một lead** (`docs/canonical/PRODUCT_CONSTITUTION.md:24,49`) |
| Phạm vi triển khai hiện tại | **P0 pilot loop giáo dục B2C bằng tay/synthetic**: intake → handoff A→B → accept → work item → evidence → outcome. Adapter manual, PostgreSQL durable, 12 route JSON + `/health` |
| Giai đoạn | PH1 + PH2 code xong; **PH3 đang giữa chừng** (`docs/implementation-plan/05-phase-map.md:17`); PH4 (Pancake) / PH5 / PH6 chưa dòng nào. Gate L2→L3 **CHƯA ĐÓNG** (`08-verification.md:31`) |
| Luồng chạy/trình diễn được | Toàn bộ loop qua HTTP thật, có restart process, trên PG (`scripts/pilot-smoke.sh`) — `[agent báo]` PASS=53/FAIL=0; tôi xác minh **backend chạy được** bằng app thật + curl `[đo]`. **Không có UI** → người nghiệp vụ chưa tự thao tác được |
| Còn thiếu để người nghiệp vụ dùng thử | Một lớp dùng được (1 trang/CLI tối thiểu) + một danh tính thật cho từng người (xem mục 6, bước 3) |
| Còn thiếu để pilot nhiều người/dữ liệu thật | Ba P1 còn hở (mục 4), optimistic locking, credential model do server kiểm chứng (PM-1/QA-28), wire telemetry/feedback, CI host + database test riêng |
| % hoàn thành | **Không tự đặt** — chưa có mẫu số: R-01…R-28 chưa có tiêu chí đo từng cái, RFC-005 vẫn Draft, H1/H2 chưa có kết quả gán nhãn thật |

**Kết luận trung thực:** backend P0 loop **chạy được và có bằng chứng local**, nhưng **ba lỗ hổng reviewer nêu tại checkpoint này vẫn còn tồn tại** (tôi tái hiện cả ba qua HTTP), **suite hiện đang encode một hành vi sai**, và **mọi bằng chứng dừng ở mức synthetic một người vận hành**.

---

## 2. Tri thức và quyết định cần giữ

### 2.1 Gốc bài toán (`docs/Dinh_nghia_bai_toan_V2.md`)

Trạng thái file: `:6` — *"Định nghĩa bài toán và kế hoạch kiểm chứng; chưa phải đặc tả sản phẩm hay mô hình dữ liệu đã đóng băng"*; `:16` — **mọi ngưỡng định lượng là đặt trước**, không phải số liệu thực nghiệm. Không được nâng H1–H8 thành quyết định domain.

- `:33` — *"Về mặt kinh doanh, đây là một quá trình liên tục. Về mặt dữ liệu và trách nhiệm, nó thường bị chia cắt."*
- `:34` — khi chuyển kênh/chuyển người phụ trách, doanh nghiệp **giữ được số điện thoại nhưng mất**: nhu cầu đã xác định, điều đã hứa, người tham gia quyết định, việc cần làm tiếp theo.
- `:44` — hệ quả theo vai trò: Marketing khó thấy chất lượng thương mại của nguồn; **Sales phải đọc lại, hỏi lại và tự nhớ việc**; Manager khó biết khách bị bỏ quên ở đâu; doanh nghiệp khó nối thu hút với kết quả cuối cùng.
- `:36` — định nghĩa cốt lõi: danh tính, nguồn gốc, ngữ cảnh, ý nghĩa thương mại, **trách nhiệm xử lý** và kết quả kinh doanh không được duy trì trong một chuỗi dữ liệu liên tục.
- `:20` — không mặc định mọi doanh nghiệp đều gặp vấn đề này **ở mức đáng trả tiền**; phân khúc giáo dục B2C pilot là nơi kiểm chứng.
- Giả thuyết mà P0 đang kiểm chứng: **H1** mất ngữ cảnh bàn giao là vấn đề đủ thường xuyên/hữu ích; **H2** việc cần làm có giá trị xuất hiện đủ nhiều (`:469-470`). Điều kiện fail ghi rõ ở H1: *nếu chỉ thiếu ít thông tin mà không gây hậu quả thì chưa coi là giá trị cốt lõi*. **H3** (AI trích việc, precision ≥95%) thuộc **sau L3**.

### 2.2 Tầm nhìn đa nền tảng ≠ phạm vi P0

| Thuộc tầm nhìn (North Star) | Thuộc phạm vi đang build |
|---|---|
| Pancake read-sync, AI extraction sau feature flag, manager exception view, usage/data-coverage view → **"In scope (P1 — sau learning gate L3/L4)"** (`docs/implementation-plan/01-scope-and-principles.md:39-45`) | manual/synthetic loop một chiều, intake do người thao tác; PG persistence; audit; RBAC lead-scoped (`:29-38`) |
| R-29…R-41 / C-13 C-14 (control plane, provisioning, licensing, installer, backup) → **PH7+ Deferred**, cần human gate + legal (`05-phase-map.md:22`, `state/progress.md:118`) | không tự mở rộng PH3 bằng R-29…R-41 |
| — | **Out of scope** (`01-scope:47-58`): public SaaS/billing/enterprise multi-tenancy, full CRM, generic inbox/task/workflow/BI, connectors Meta/TikTok, revenue attribution, lost-revenue prediction, gửi tin Pancake, auto-merge identity, AI tự đổi trạng thái/routing/outbound |

### 2.3 Invariants và boundary

`docs/canonical/DOMAIN_INVARIANTS.md` (Canonical normative, 2026-09-16) định nghĩa **I-01…I-12** — lưu ý `AGENTS.md` **liệt kê thiếu I-10** ("CRM adapters không sở hữu semantics canonical", `:73`). Ràng buộc nền: *"A passing test suite does not override a violated invariant"* (`:12`).

Canon cấm rõ mà prototype dễ đụng: AI không mutate trực tiếp/opaque (`COMMERCIAL_EVENT_MODEL.md:20`); event "đề xuất, không thực thi" (`:71`); manual loop phải chạy khi AI tắt/sai (`TRUST_AND_EVIDENCE.md:76`); không lấy ID Pancake/display identity làm Lead ID (`IDENTITY_MODEL.md:32,73`); không backfill unknown (`TRUST_AND_EVIDENCE.md:70`, I-08); **synthetic/manual không được tính là bằng chứng khách thật** (`INTEGRATION_PRINCIPLES.md:55`; nhãn `isSynthetic` trong code); không trừu tượng sớm — connector framework, workflow DSL, event platform, control plane (`ARCHITECTURE_CONSTITUTION.md:41`); không token/PII thô trong log/telemetry (`TRUST_AND_EVIDENCE.md:76`).

### 2.4 Bảy quyết định mở — DO NOT RESOLVE

`docs/canonical/OPEN_DECISIONS.md:19-27`: **CE-1** (transition table/state enum), **CE-2** (CommercialEvent scope), **MM-1** (attribution), **ID-1** (merge thresholds), **ID-2** (CRM mapping), **PM-1** (capability matrix), **LG-1** (North Star vs LVP). Quy tắc toàn cục: không tự chế cách giải quyết, để comment seam, dừng nếu có thể chạm invariant (`:13,34`).

Trạng thái decision records: `ADR-001` = **`Proposed — chờ Human Gate #A`** (`decisions/ADR-001-ce1-ce2.md:4`) → state machine trong code chỉ là hypothesis; `RFC-005` = **Draft**, và ghi rõ việc Q3/Q4 **"Does not block manual/synthetic prototype or existing non-frozen interim work"** (`RFC-005:90`); `ADR-004` = **Accepted** nhưng quyền hạn chỉ framing/validation, không sửa canonical.

### 2.5 Năm phân biệt cần giữ — và vị trí thật của chúng

| Phân biệt | Canon | Code hiện tại |
|---|---|---|
| **Người nói ≠ người được giao ≠ bên chịu trách nhiệm** | **PARTIAL**: chỉ có "conversation assignment ≠ Sales ownership" (`DOMAIN_MODEL.md:43`); "speaker" **NOT IN CANON** | `rawPayload.speaker`; `state.handoffRecipient` (**một slot duy nhất, bị ghi đè**); `work.responsibleParty` (internal/external = *khách vs công ty*, không phải người); `work.actor`; `ownerUserId` |
| **Quyền xem ≠ quyền accept ≠ quyền mutation** | taxonomy này **NOT IN CANON** (thuộc PM-1) — code tự đặt ở P1-2 | `pilot-loop.service.ts:49-120`, `rbac.service.ts:14-21` |
| **Quan sát thấy tin nhắn ≠ quan sát thấy hành động được mô tả** | **NOT IN CANON** (canon chỉ có `automatic_observation` = "a product click") | **chưa enforce** = P1-4. Đây là **áp dụng** `TRUST_AND_EVIDENCE.md` §4 + I-12, **không phải term mới** → sửa guard P0 ngay được; phần còn mở chỉ là vocabulary/schema mapping (`declared` vs `claimed`) → để RFC, **không** mở PM-1/CE-2 mới |
| **Lời khai / suy luận / quan sát / vắng mặt / mâu thuẫn** | canon dùng `claimed`; từ **"declared" NOT IN CANON** (`TRUST_AND_EVIDENCE.md:22-30`: acquisition mode × assertion status là **hai chiều độc lập**) | `CompletionEvidence` 5 giá trị; assertion status của outcome (`recorded/claimed/inferred/conflicted/unknown`) — **hai bộ từ vựng song song, chưa ánh xạ** |
| **Thời điểm sự kiện / thu nhận / ghi hệ thống** | canon có `occurred_at` + `captured_at`; **time hệ thống thứ ba NOT IN CANON** | `occurredAt` (hoặc `UNKNOWN_SENTINEL`, không backfill — Q4), `sourceCapturedAt`, `ingestedAt`/`recordedAt` |

**Quyền theo bàn giao/item còn hiệu lực (hướng đã chốt):** với lỗi "B mất quyền xem sau khi handoff cho C", **không** đổi `handoffRecipient` thành tập hợp rồi cấp view vĩnh viễn. Thay vào đó: `recipients` là **tập dẫn xuất** từ `workItems` (handoff/work item vốn append-only nên lịch sử "ai từng được giao" đã có sẵn); quyền xem = người có item **đang actionable** (proposed/accepted/open/awaiting-external) hoặc owner hiện tại; quyền accept = **đúng recipient của item được nêu tên**. Đây là quyết định **tầng pilot nhân danh I-09** (lead-scope, deny-by-default), **không phải** quyết định PM-1; PM-1 vẫn mở cho manager/admin. Ghi seam tại `rbac.service.ts:19-21`.

---

## 3. Những phần đã thực hiện được

| Hạng mục | Hành vi hiện có | Source/module/API | Nối vào luồng? | Bằng chứng | Giới hạn còn lại |
|---|---|---|---|---|---|
| Ingest + envelope | raw immutable, SHA-256 hash, scope theo workspace | `domain/envelope/envelope.ts`, `adapters/manual/`, `POST /pilot/scenarios` | **Có** | unit 12+11 `[đo]` | **idempotency key còn nhập nhằng (P1-1)** |
| Lead + state machine | hypothesis New→Accepted→Contacting→Follow-up→Won/Lost/Unknown, ngoài boundary → 422 `CE1_BOUNDARY` | `domain/lead/lead-state.ts:7-15` | **Có** | 18 tests `[đo]`, smoke step 12 `[agent báo]` | CE-1 chưa freeze (ADR-001 Proposed) |
| Bàn giao 2 người + accept | context + evidenceRefs + proposed action; recipient được xem gói; owner chuyển khi accept | `pilot-loop.service.ts:217-330`, `/handoff`, `/accept` | **Có** | smoke 4–6, 16 controller tests `[đo]` | **P1-2 còn hở + B mất view sau handoff thứ 2** |
| Work items (trục Q3) | responsibleParty × origin × status × completionEvidence | `pilot.types.ts:13-43`, migration `003` | **Có** | 21 service tests `[đo]` | **validation construct**, không canonical (RFC-005 Draft) |
| Đóng việc + gate evidence | `observed` cần pointer; `inferred` không được đóng; external không declare-complete hộ | `pilot-loop.service.ts:360-420`, `/complete` | **Có** | 7 evidence tests `[đo]` | **P1-4: pointer không chứng minh hành động; `absent`/`conflicted` vẫn đóng** |
| Supersession chain | item cũ `rescheduled`, từ chối 409 `WORK_SUPERSEDED` + `details.replacementId` | `pilot-loop.service.ts:76-97` | **Có** | **P1-3 `[đo]` qua HTTP: 200 có replacementId; complete ID cũ → 409** | đã đóng |
| Durable PG + migrations | 001–004 applied; mutation + audit **một transaction** (QA-35); 004 = backfill tất định / `RAISE EXCEPTION` khi mâu thuẫn / quarantine thay vì xóa | `pg-pilot.store.ts`, `migrations/00{1..4}*.sql` | **Có** | `test:integration` **10 pass `[đo]`**, schema dev có 14 bảng + `commercial_envelope_quarantine` `[đo]` | migrate up/down số của `[agent báo]` |
| Audit append-only, lead-scoped | history không lộ trail của lead khác | `pilot.store.ts:88-107`, `pg-pilot.store.ts:101` | **Có** | **P1-5 `[đo]` qua HTTP: 4 entry của mình, id lead khác absent** | `audit_record.workspace_id` **không FK** (xem 5.5) |
| Auth stub | 401 unauthenticated; demo header opt-in + sandbox `demo:<name>`; bootstrap token; Bearer unsigned chỉ khi `AUTH_DEV_UNSIGNED_TOKENS=true` | `infra/auth/auth.service.ts` | **Có** (trong controller, **không phải guard toàn cục**) | 13 tests `[đo]`, smoke step 2 `[agent báo]` | **token là base64 JSON tự khai → không cách ly quyền** |
| RBAC deny-by-default | cross-workspace 404 (invisible), unrelated user 403, recipient được view | `infra/rbac/rbac.service.ts` | **Có** | **`[đo]` qua HTTP: 404 / 403 đúng** | manager/admin vẫn workspace-wide ở quyền view (QA-58 chờ PM-1) |
| Error contract 4xx | 13 machine code tại boundary | `pilot-loop.controller.ts:59-85` | **Có** | controller tests + smoke 9b `[đo/agent báo]` | đúng cho **các guardrail đã assert**; lỗi chưa phân loại vẫn fallback 500, `main.ts` **không** có global filter |
| Boundary validation | required/enum/ISO date/UUID → 400 `INPUT_INVALID` + danh sách field | `api/pilot-validation.ts` | **Có** | 8 tests `[đo]`, coverage 94.37 `[đo]` | quy tắc "100% security-critical" **không được enforce** (chỉ `lines:80`) |
| Telemetry / Feedback | service + bảng `product_event`, `feedback` | `infra/telemetry/`, `modules/feedback/` | **KHÔNG** — chỉ được import bởi spec của chính nó `[đo: grep]` | 5 unit tests `[đo]` | T3-06/07 chưa wire endpoint |
| `WorkspaceRepository` | CRUD workspace | `infra/workspace/workspace.repository.ts` | **KHÔNG** — không reference nào ngoài spec `[đo: grep]` | — | unwired |
| **UI** | **không tồn tại** (không `.html/.tsx/.vue`; chỉ 12 route JSON + `/health`) `[đo: find/grep]` | — | — | — | người nghiệp vụ chưa tự dùng được |
| CI / E2E / contract suite | **không có** `.github/workflows/`; `package.json:19` tham chiếu `vitest.config.e2e.ts` **không tồn tại trên đĩa** `[đo]` | — | — | — | mọi con số hiện là local |

---

## 4. Kiểm chứng ba phát hiện P1 và hai điểm tự thân

**Bốn lệnh kiểm tra toàn bộ `[đo]` tại `1b72b61`, Windows 11, Node v22.21.0/npm 10.9.0, PG 16 (container `north-star-pg`, host :55432):**

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck` | exit **0** |
| `npm run build` | exit **0** |
| `npm test` (KHÔNG set DB env) | exit **0** — **228 pass / 10 skipped** (tổng 238; 3 file integration skip theo thiết kế) |
| `npm run test:integration` (CÓ `TEST_DATABASE_URL`) | exit **0** — **10 pass / 0 skip** |
| `npm run test:cov` (CÓ DB) | exit **0** — 238 pass; **All files 91.43 lines / 84.58 branch / 93.42 funcs** |
| `npm run test:cov` (KHÔNG DB) | **exit 1** — `Coverage for lines (75.79%) does not meet global threshold (80%)` |
| `git diff --stat b81edd9..HEAD -- docs/canonical/` | **rỗng** (canonical không đổi); forbidden paths `src/bernstein/**`, `templates/**`, `.agents/skills/**`: **rỗng**; 12 commits trong range |

**Repro HTTP qua app thật (`node dist/main.js`, in-memory store, dữ liệu synthetic):**

| # | Kết quả `[đo]` |
|---|---|
| **P1-1 còn hở** | hai tuple `(ws=review-tenant, conn=b:inbox)` và `(ws=review-tenant:b, conn=inbox)` cùng external id → **cùng một envelope id** `71532155-7b8d-4b24-b3cb-9e063750b338`, lead B mang **raw hash của A** (`6625e2e01a775073…`). Kiểm tra logic thuần: `idempotencyKey(A) === idempotencyKey(B)` = `review-tenant:b:inbox:msg-1`; object trả cho B còn **báo `workspaceId = "review-tenant"`** → `insertEnvelope` ghi/xác nhận row theo tuple **của A** trên cả đường PG. Process mới (map trống) lại cho 2 row phân biệt → **hành vi phụ thuộc thời điểm restart**. **Chưa tái hiện trực tiếp trên PG.** |
| **P1-2 còn hở** | (a) A complete item đang `proposed` cho B → **HTTP 200 completed**, owner vẫn `a`, `handoffRecipient` vẫn `sales-b`; (b) A accept item addressed cho `sales-b` → **201**, owner=`a`; (c) handoff B rồi C, **C accept được item của B** → **201**, owner=`sales-c` |
| **P1-2 (thêm)** | sau handoff thứ hai cho C, **B bị HTTP 403 ngay trên GET** dù item của B vẫn `proposed` → mất quyền *xem*, không chỉ mất quyền sửa (`handoffRecipient` là một slot bị ghi đè, `pg-pilot.store.ts:81`) |
| **P1-4 còn hở** | (a) evidence duy nhất là tin nhắn *"Chị gửi em bảng học phí nhé."* vẫn đóng được việc **"Gửi bảng học phí"** với `observed` → **200**, `occurredAt=unknown`; (b) `absent` và `conflicted` cũng đóng được → **200 completed**; (c) hồ sơ đóng bằng `absent` vẫn advance Contacting → Follow-up → **outcome `Won`** (`assertionStatus: claimed`) |
| **P1-3 đã đóng** | reschedule → 200 kèm `replacementId`; complete ID cũ → **409 WORK_SUPERSEDED** + `details.{workId,status,replacementId,replacementStatus,dueAt}` |
| **P1-5 đã đóng** | audit lead-scoped: 4 entry của mình, id lead khác **absent** |
| **RBAC đã đóng** | cross-workspace GET **404**, unrelated user GET **403** |
| **Optimistic locking** | **CHƯA LÀM** — `lead.version` được `+1` (`pg-pilot.store.ts:147`) nhưng **không có `WHERE version` nào** trong `src/` `[đo: grep]` |

**Test và smoke đang kỳ vọng hành vi SAI** (lý do suite xanh mà lỗi vẫn còn):
- `scripts/pilot-smoke.sh:152-153` lấy **envelope intake của hồ sơ** làm chứng cứ cho việc "Gửi bảng học phí" và **assert** `"own evidence pointer accepted (observed closes)"`.
- `pilot-loop.evidence.spec.ts:88-107` cùng hình dạng ở unit level (utterance chính là lời xin bảng phí).
- `pilot-loop.integration.spec.ts:239-241` cùng hình dạng **trên PG thật**.
- **Không test nào** asserts `absent`/`conflicted` **không** được đóng; **không regression nào** có dấu `:` trong workspace/connection (`envelope.spec.ts:78` còn **khoá cứng định dạng chuỗi nối** → đổi key sẽ phải sửa test này).

**Di sản của phiên kiểm chứng (minh bạch):** tôi chạy suite có DB nên đã ghi row vào dev DB `north_star`; tests tự dọn `workspace`, nhưng vì `audit_record.workspace_id` **không có FK** nên còn lại **81 hàng audit mồ côi** từ các run của tôi (tổng mồ côi quan sát được: 756/841). Tôi **không** chạy `migrate`, **không** chạy `pilot-smoke.sh`, **không** sửa file nào khác ngoài tài liệu này.

---

## 5. Giới hạn bằng chứng

1. **Không có CI host.** Repo không có `.github/workflows/` `[đo]`; `08-verification.md:33` cũng tự ghi như vậy → **mọi con số là local**. `08:32` ghi rõ author là Claude, **chưa qua human review**.
2. **`[agent báo]` tôi không xác minh lại:** `pilot-smoke.sh` **PASS=53/FAIL=0** kèm restart step; `migrate up/down 1/re-up/down 4` exit 0; dev DB "12 envelope, 0 hàng quarantine". (Số coverage 91.43% thì tôi **đã** chạy lại và khớp `[đo]`.) Lý do không chạy `migrate`: bị từ chối theo quyền phiên (DB dev **dùng chung**) — đây là **giới hạn harness**, không phải lỗi code.
3. **Repro P1 chạy trên in-memory store.** Phần logic liên quan (`resolveEvidence`, `requireMutableWork`, `insertEnvelope`) **cũng được dùng trên đường PG**, và `pilot-loop.integration.spec.ts` chạy trên PG thật, nhưng **ba repro cụ thể chưa được tái hiện trực tiếp trên PG** → tiêu chí đóng P1 phải bao gồm bằng chứng PG.
4. **Không có E2E/contract suite.** `vitest.config.e2e.ts` được `package.json:19` tham chiếu nhưng **không tồn tại**; bằng chứng end-to-end hiện chỉ là smoke script + 3 file integration `[đo]`.
5. **Audit mồ côi là vấn đề vệ sinh dev DB, chưa tự chứng minh lỗi product.** `audit_record.workspace_id` không có FK là **lựa chọn bảo toàn history**: thêm `ON DELETE CASCADE` sẽ cho phép xóa workspace → xóa luôn audit nghiệp vụ, **phá I-05**. Gốc của số liệu là teardown từng `down(2)` trên DB dùng chung (`state/progress.md:65`). Hướng đúng: **database kiểm thử riêng** (pattern đã có: `migration-004.integration.spec.ts` tạo `CREATE DATABASE` tạm và `DROP DATABASE … WITH (FORCE)`), dọn **đúng dữ liệu test**, **không** thêm cascade để làm sạch số.
6. **Test xanh ≠ sẵn sàng pilot.** `08:62` tự ghi: còn thiếu credential model thật (PM-1), optimistic locking, Won/Lost open-action gate (outcome vẫn ghi được khi work item còn mở — PH5), telemetry/feedback wiring, và mọi bằng chứng về người dùng thật.
7. **Doc ↔ code drift (tôi đối chiếu từng cái):** `05-phase-map.md:5` "138 tests", `:17` "229 tests + 8 PG integration" (đếm trùng); `features.json:4` "132 tests"; `progress.md:45` "19 tests" cho invariant sweep (thực **25** `[đo]`); `progress.md:62` gọi HEAD là `1a2fd73` (thực `1b72b61`); `phases/PH0|PH1|PH2.md:5` vẫn "Draft — chưa bắt đầu" trong khi progress báo done; `GLOSSARY.md:63` và `OPEN_DECISIONS.md:38` chỉ viện "I-01..I-05" dù canon có I-12; `vitest.config.ts` **chỉ enforce `lines:80`** nên quy tắc 100% security-critical không được enforce (đo: `auth.service` **branch 93.33**); `state/gate-reviews/`, `state/direction-decision.md`, `state/perf-targets.md` mà PH6 tham chiếu: **NOT FOUND**.
8. **Hai bộ ngữ nghĩa "L3" đang xung đột.** `01-scope-and-principles.md:66-70` dùng L3 cho **learning loop** ("Pancake sync + AI improve loop không giảm trust"), còn `phases/PH5-lvp-slice-hardening.md:3` định nghĩa gate sau PH3 là **"usable manual loop + durable"**. Báo cáo này theo **nghĩa PH5** (kỹ thuật). Cần người đặt tên tách hai trục, nếu không mỗi lần đọc gate sẽ lại suy ra điều kiện sai.
9. **File transcript chưa track ở thư mục gốc** (`2026-10-07-112902-…txt`, 294 KB) — vi phạm chính quy tắc "NEVER save to root folder" của `AGENTS.md`; là log phiên làm việc, **không nên commit**.

---

## 6. Việc còn lại, blocker và ba bước tiếp theo

| Việc còn lại | Vì sao cần | Chặn mốc nào | Phụ thuộc / quyết định | Tiêu chí hoàn thành | Ưu tiên |
|---|---|---|---|---|---|
| **P1-1** key không nhập nhằng (VD `JSON.stringify([ws,conn,ext])`) + regression có dấu `:` | đang lộ raw evidence xuyên tenant (I-09/I-12) | L2→L3 ("auth/RBAC scoped") | không | 2 tuple có `:` → 2 envelope phân biệt, **cả in-memory và PG** | **1** |
| **P1-2** accept/complete theo recipient **của item đó**; quyền theo bàn giao/item còn hiệu lực (mục 2.5) | owner đóng/nhận hộ người khác; recipient mất quyền xem | L2→L3 | seam pilot nhân danh I-09; **PM-1 vẫn mở** cho manager/admin | A complete item `proposed` cho B → 403; C accept item của B → 403; B vẫn GET được khi item của B còn actionable | **1** |
| **P1-4** manual P0 ghi lời xác nhận nội bộ là `declared`; `observed` chỉ khi nguồn **chứng minh chính hành động**; chặn đóng việc với `absent`/`conflicted`; **sửa 3 assertion encode hành vi sai** | bằng chứng hoàn thành hiện vô nghĩa; Won vẫn ghi được trên hồ sơ không có chứng cứ | L2→L3 **và** độ tin cậy của phép đo H1/H2 | **không cần quyết định canonical mới** — provenance đã có (`TRUST_AND_EVIDENCE.md` §4); chỉ vocabulary/schema mapping để RFC | `absent`/`conflicted` → 422; `observed` với tin nhắn yêu cầu → bị từ chối; smoke/test mới asserts chiều đúng | **1** |
| **Optimistic locking** trên luồng đã đúng | hai người cùng sửa một version → mất ghi | L2→L3 | không | 2 mutation song song trên cùng version → một bên 409 | **2** |
| **CI có PostgreSQL + database test riêng** | 91% chỉ đúng khi có PG; `test:cov` không DB **đỏ** `[đo]` | bằng chứng L2→L3 | **người quyết**: provision PG trong CI vs tách threshold — **không tự nới 80** | 1 workflow chạy typecheck/test/build tại SHA; integration không dùng DB dev chung | **2** |
| Dọn drift tài liệu (mục 5.7) + đặt tên tách hai trục L3 (5.8) | không chặn code, nhưng chặn việc chỉ đạo tiếp | — | người quyết naming | doc khớp `npm test`/HEAD thật | 2 |
| **Một trang UI tối thiểu** (hoặc CLI) gọi được các route, cho **một người tư vấn thử bằng synthetic, local, có kiểm soát** | **không có UI**; không có bằng chứng usability nào | L1/L2 theo learning loop | không — **không** được dùng token tự khai cho dữ liệu thật | người đó tự chạy trọn loop, ghi điểm vấp | **3** |
| Wire telemetry/feedback endpoint; dùng `WorkspaceRepository` hay xóa; sweep I-06/I-10 meaningful (`08:50` tự nhận placeholder) | T3-06/07 mới `[✓code]` và unwired `[đo]` | L2→L3 (đầy đủ) | không | có route + test; I-06/I-10 không còn placeholder | sau |
| **Server-verified credential** (PM-1/QA-28) + guard toàn cục | token hiện là base64 JSON tự khai → **caller tự đổi identity/workspace/role, kể cả `admin`** (`auth.service.ts:60-75`) | **pilot nhiều người + dữ liệu thật** | **PM-1** | server ký/verify; hết mode tự khai ngoài dev | pilot |
| PH5 queues / contact-attempt / Won-vs-open-action gate; PH6 pilot isolation, exposure, direction | `progress.md:96-110` chưa dòng nào | L3, L4/L5 | CE-1, MM-1, ID-1/ID-2, LG-1 giữ boundary | theo phase file | sau |
| **PH4 Pancake** (T4-01…06), AI extraction, manager view | flag OFF; Q-03/Q-04 chỉ là spike docs | **KHÔNG chặn L3** — `01-scope:39` xếp chúng **sau L3/L4**; `05:66` chỉ gate **bắt đầu PH4** | Gate trước PH4 (verdict Q-03/Q-04) | contract tests trên fixture | sau — **không làm vòng này** |
| R-29…R-41 / PH7+ productization | deferred | không chặn prototype | human gate + legal | — | sau |

**Gate — thiếu gì:** **Human Gate #A** = thiếu **quyết định** (ADR-001 vẫn Proposed). **Gate trước PH3** = thiếu **bằng chứng review của người** (08 chỉ ghi đã chạy). **Gate trước PH4** = thiếu **bằng chứng live** Q-03/Q-04. **L1** = thiếu **bằng chứng người thật**. **L2** = quyết định (ADR-001) + implementation (sweep I-06/I-09). **L2→L3** = **cả ba**: quyết định (PM-1 cho credential/capability), implementation (ba P1 + optimistic locking + wire telemetry), bằng chứng (repro trên PG; CI host). **Không** đưa Pancake/AI hay nhãn Q3/Q4 thật vào danh sách điều kiện của L2→L3/L3 (`RFC-005:90`, `PH5:3`).

**Ba bước tiếp theo (thứ tự đã chốt, không mở rộng scope):**
1. **Sửa ba P1 và các assertion tương ứng trước**, kiểm chứng **cả in-memory và PG** (fails-first: key có `:`; owner không đóng/nhận hộ; rights theo item còn hiệu lực; `absent`/`conflicted` bị chặn; `observed` cần nguồn chứng minh hành động; đổi `pilot-smoke.sh:152-153`, `pilot-loop.evidence.spec.ts:88-107`, `pilot-loop.integration.spec.ts:239-241`).
2. **Optimistic locking**, rồi **CI có PostgreSQL** và **database kiểm thử riêng**.
3. **Một trang UI tối thiểu**, nối feedback/telemetry **cần thiết cho lượt thử**, cho **một người tư vấn thử bằng synthetic**.

Không cần thêm một vòng nghiên cứu rộng. **Mốc gần nhất: một luồng đúng + người nghiệp vụ tự thao tác được.**

---

## 7. Nguồn cần đọc khi tiếp tục

**Tier 1 (normative, cao nhất):** `docs/canonical/DOMAIN_INVARIANTS.md` → `OPEN_DECISIONS.md` → `TRUST_AND_EVIDENCE.md` (§2, §4, §6) → `DOMAIN_MODEL.md:28-43` → `PRODUCT_CONSTITUTION.md:24-49`.
**Tier 2:** `docs/Dinh_nghia_bai_toan_V2.md` (§§2–3, H1/H2 ở bảng `:469-470`) — framing/validation; `docs/implementation-plan/05-phase-map.md`, `03-requirements.md` (R-01…R-28 active, R-29…R-41 deferred §10), `04-architecture.md` (C-01…C-12), `01-scope-and-principles.md:28-58` (in/out scope).
**Tier 3:** `docs/implementation-plan/state/progress.md` (§ Pilot-loop + ba mức trạng thái `[✓code]/[✓DB]/[✓live]`), `state/features.json` (37 feature: 6 in_progress, 13 done, 5 planned, 13 proposed `[đo]`), `08-verification.md`, `06-test-strategy.md`, `decisions/ADR-001` / `ADR-004` / `RFC-005`, `phases/PH3…PH6`.
**Code trọng điểm:** `product/src/domain/envelope/envelope.ts:81` (P1-1) · `product/src/modules/pilot-loop/pilot-loop.service.ts:49-120,300-330,360-420` (P1-2/P1-4) · `pilot.types.ts` · `pg-pilot.store.ts:81,147,260-285` · `product/src/api/pilot-loop.controller.ts:59-85` + `pilot-validation.ts` · `infra/auth/auth.service.ts` + `infra/rbac/rbac.service.ts` · `migrations/003,004` · `scripts/pilot-smoke.sh:136-153`.

**Không đụng tới:** `docs/canonical/**` (frozen normative), `src/bernstein/**`, `templates/**`, `.agents/skills/**`. **Không tự resolve** CE-1/CE-2/PM-1/MM-1/ID-1/ID-2/LG-1; **không tự phát token/login**; **không tự nới** coverage threshold hay scope PH3.

---

## 8. Context để bắt đầu phiên mới

Repo `North_Start_Commercial_Support_Platform` (Revenue Continuity Platform), `main` @ **`1b72b61c1ef7a208eb0f291d21a61a8149f1b701`**, sync `origin/main`, tree sạch trừ transcript chưa track ở gốc (không commit). Bài toán gốc (`docs/Dinh_nghia_bai_toan_V2.md:33-36,44` — **framing/validation, chưa freeze**): một quá trình kinh doanh liên tục bị chia cắt về dữ liệu và trách nhiệm; chuyển kênh/chuyển người thì giữ được SĐT nhưng mất nhu cầu đã xác định, điều đã hứa, người quyết định và việc cần làm tiếp; Sales phải đọc lại/hỏi lại/**tự nhớ việc**. P0 kiểm chứng H1/H2 bằng **manual loop**: intake → handoff A→B → accept → work item → evidence → outcome. Pancake sync, AI extraction, manager view thuộc **sau L3/L4** (`01-scope:39`) — đừng làm vòng này. **Không có UI**: 12 route JSON + `/health`.

Đã có: NestJS+Fastify+Vitest, PG migrations 001–004, mutation+audit một transaction (QA-35), error contract 13 machine code, boundary validation, demo sandbox, supersession chain (P1-3 **đã đóng**), audit lead-scoped (P1-5 **đã đóng**), RBAC 404/403 verify qua HTTP. Verification `[đo]` tại HEAD: typecheck/build exit 0; `npm test` không DB **228 pass/10 skip**; `test:integration` có DB **10 pass**; `test:cov` có DB **91.43% lines exit 0**, không DB **exit 1 ở 75.79%**; canonical + forbidden paths không đổi trong `b81edd9..HEAD`. **Không có CI host**; smoke **53/53** và migrate up/down là số **`[agent báo]`, chưa xác minh độc lập**.

**Ba P1 còn hở** (tôi tái hiện HTTP trên HEAD, in-memory): **P1-1** `idempotencyKey` = `ws:conn:ext` nên `(review-tenant, b:inbox)` và `(review-tenant:b, inbox)` ra **cùng envelope id**, B mang raw hash của A, object trả về còn báo nhầm `workspaceId` của A → PG path lệch theo, **chưa repro trực tiếp trên PG**. **P1-2** owner complete item đang `proposed` cho B → 200; owner accept hộ B → 201; handoff B rồi C thì **C accept được item của B**; và **B bị 403 ngay cả GET** sau handoff thứ hai vì `handoffRecipient` là một slot bị ghi đè → quyền phải suy từ **bàn giao/item còn actionable**, không cấp view vĩnh viễn. **P1-4** tin nhắn *yêu cầu* được dùng làm `observed` để đóng *hành động* (200), `absent`/`conflicted` cũng đóng được, rồi vẫn ghi **`Won`** (`claimed`). **Ba assertion đang encode hành vi sai**: `pilot-smoke.sh:152-153`, `pilot-loop.evidence.spec.ts:88-107`, `pilot-loop.integration.spec.ts:239-241`; không regression nào có `:` trong id; `envelope.spec.ts:78` khoá cứng định dạng chuỗi nối.

Optimistic locking **chưa làm** (`lead.version` bump, không `WHERE version`). Telemetry/feedback + `WorkspaceRepository` **unwired**. Token dev = base64 JSON tự khai → **caller tự đổi identity/workspace/role, chỉ dùng local + synthetic**; dữ liệu thật cần server-verified credential (PM-1/QA-28). **L3 = usable manual loop + durable** (`PH5:3`) → **Pancake/AI và nhãn Q3/Q4 thật không phải điều kiện** (`RFC-005:90`); `08-verification.md:31` đang liệt nhầm, và `01-scope:66-70` dùng "L3" cho một trục khác — cần tách tên. Audit mồ côi trong dev DB là vấn đề vệ sinh test: **không** thêm FK cascade (sẽ cho phép xóa audit nghiệp vụ, phá I-05) → dùng **database kiểm thử riêng** theo pattern `migration-004.integration.spec.ts`. CE-1/CE-2/PM-1/MM-1/ID-1/ID-2/LG-1 vẫn mở; Gate #A vẫn chờ; ADR-001 **Proposed**, RFC-005 **Draft**, ADR-004 **Accepted** (chỉ framing/validation). **Bước 1:** fails-first regressions cho ba P1 + đổi ba assertion, sửa `envelope.ts:81` và các gate trong `pilot-loop.service.ts`, verify cả hai store. **Bước 2:** optimistic locking, CI có PG, DB test riêng, dọn drift tài liệu. **Bước 3:** một trang UI tối thiểu cho một người tư vấn thử bằng synthetic, nối feedback/telemetry cần thiết. Mốc gần nhất: **một luồng đúng + người nghiệp vụ tự thao tác được**.
