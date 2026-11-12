# Project Status and Handover — North_Start_Commercial_Support_Platform

**Checkpoint SHA hiện tại (được đo tại đây):** `6a98fdfe6d62932f6464c763c485ed06e4ed660f` (`6a98fdf`) — branch `main`, ahead 5 commits so với `origin/main` (`1b72b61`)
**Baseline lịch sử (phát hiện 3 cạnh P1 còn hở):** `1b72b61c1ef7a208eb0f291d21a61a8149f1b701` (`1b72b61`, ngày 2026-10-08)
**Ngày cập nhật báo cáo:** 2026-10-27
**Loại tài liệu:** Bàn giao trạng thái (delivery-tier, tổng hợp từ Tier 1–3). **Không phải canonical**, không thay thế verification record chuẩn thức tại `docs/implementation-plan/08-verification.md`.

**Nguồn kết quả — phân biệt ba mức (mục 5 có chi tiết):**
- `[đo @ 6a98fdf]` = lệnh chạy trực tiếp tại commit `6a98fdf` trong phiên 2026-10-27, môi trường Windows 11 + Node v22.21.0 + npm 10.9.0 + PostgreSQL 16 trong container `north-star-pg` (host port 55432; credentials dev defaults trong `product/docker-compose.yml`).
- `[lịch sử @ 1b72b61]` = kết quả tái hiện HTTP độc lập trước khi vá `6a98fdf` (giữ lại làm hồ sơ đối chứng lịch sử để giải thích vì sao cần commit `6a98fdf`).
- `[doc]` = tuyên bố trong tài liệu kiến trúc/kế hoạch.

---

## 1. Tóm tắt trạng thái tại HEAD (`6a98fdf`)

| Câu hỏi | Trả lời hiện tại |
|---|---|
| Product giải quyết gì, cho ai | Tầng "Revenue Operating System" giữ ý nghĩa thương mại liên tục khi khách đi qua nhiều hệ thống/bộ phận; người dùng chính là **Sales được gán một lead** (`docs/canonical/PRODUCT_CONSTITUTION.md:24,49`) |
| Phạm vi triển khai hiện tại | **P0 pilot loop giáo dục B2C bằng tay/synthetic**: intake → handoff A→B → accept → work item → reschedule/complete/unobserved → advance → outcome/correction. Adapter manual, PostgreSQL durable, **11 route JSON dưới `/v1/pilot` + `/health`** |
| Giai đoạn | PH0 (5/6, chờ Gate #A) + PH1 + PH2 code xong; **PH3 đang ở chặng đóng Gate L2→L3** (`docs/implementation-plan/05-phase-map.md`); PH4 (Pancake) / PH5 / PH6 chưa viết code thực thi. Gate L2→L3 **CHƯA ĐÓNG** (`08-verification.md:31`) |
| Trạng thái 5 nhóm lỗi P1 | **ĐÃ ĐÓNG CẢ 5 NHÓM TẠI `6a98fdf`**: P1-1 (JSON tuple `idempotencyKey`), P1-2 (per-item recipient RBAC + `activeWorkRecipients`), P1-3 (supersession chain `409 WORK_SUPERSEDED`), P1-4 (`EVIDENCE_NOT_ACTION_PROOF` + `EVIDENCE_INSUFFICIENT_TO_CLOSE`), P1-5 (lead-scoped audit) |
| Luồng chạy/trình diễn được | Toàn bộ loop qua HTTP thật, có restart process, trên PostgreSQL 16 (`scripts/pilot-smoke.sh`) — `[đo @ 6a98fdf]` **16 bước, PASS=60 / FAIL=0**; Vitest có DB **243/243 pass** (10 PG integration tests), coverage có DB **91.45% lines**. **Không có UI** → người nghiệp vụ chưa tự thao tác được |
| Còn thiếu để đóng Gate kỹ thuật L2→L3 | (1) **Optimistic locking** (`WHERE version = $expected` → `409 VERSION_CONFLICT`), (2) **Tách `pilot-loop.service.ts`** (đang 665 dòng > quy tắc `< 500` dòng), (3) **Wire `TelemetryService` & `FeedbackService`** vào HTTP/loop, (4) **Global `APP_GUARD`** cho auth, (5) **CI workflow có PostgreSQL test DB riêng** + xử lý `vitest.config.e2e.ts` |
| Còn thiếu để người nghiệp vụ dùng thử / pilot thật | Một lớp thao tác tối giản (UI hoặc CLI — `T5-10`) cho lượt thử synthetic; và **server-verified credential model (`PM-1`/`QA-28`)** + Won/Lost open-action gate (`T5-02`/`T5-04`) trước khi dùng dữ liệu thật |
| % hoàn thành | **Không tự đặt** — chưa có mẫu số: R-01…R-28 chưa có tiêu chí đo nghiệm thu từng cái trên người dùng thật, RFC-005 vẫn Draft, VH1/VH2 chưa có kết quả gán nhãn thật |

**Kết luận trung thực tại `6a98fdf`:** backend P0 loop **chạy bền vững trên PostgreSQL 16 qua HTTP thật (`243/243` tests, `60/60` smoke checks)** và **cả ba lỗ hổng P1 còn sót tại `1b72b61` cùng 3 assertion sai cũ đều đã được sửa triệt để**. Những gì còn chặn tiếp theo là **kiểm soát tương tranh (optimistic locking), nối telemetry/feedback, tách file >500 dòng, dựng CI có PG, và làm màn hình thao tác tối giản cho người dùng thật**.

---

## 2. Tri thức và quyết định cần giữ

### 2.1 Gốc bài toán (`docs/Dinh_nghia_bai_toan_V2.md`)

Trạng thái file: `:6` — *"Định nghĩa bài toán và kế hoạch kiểm chứng; chưa phải đặc tả sản phẩm hay mô hình dữ liệu đã đóng băng"*; `:16` — **mọi ngưỡng định lượng là đặt trước**, không phải số liệu thực nghiệm. Không được nâng VH1–VH8 (H1–H8) thành quyết định domain.

- `:33` — *"Về mặt kinh doanh, đây là một quá trình liên tục. Về mặt dữ liệu và trách nhiệm, nó thường bị chia cắt."*
- `:34` — khi chuyển kênh/chuyển người phụ trách, doanh nghiệp **giữ được số điện thoại nhưng mất**: nhu cầu đã xác định, điều đã hứa, người tham gia quyết định, việc cần làm tiếp theo.
- `:44` — hệ quả theo vai trò: Marketing khó thấy chất lượng thương mại của nguồn; **Sales phải đọc lại, hỏi lại và tự nhớ việc**; Manager khó biết khách bị bỏ quên ở đâu; doanh nghiệp khó nối thu hút với kết quả cuối cùng.
- `:36` — định nghĩa cốt lõi: danh tính, nguồn gốc, ngữ cảnh, ý nghĩa thương mại, **trách nhiệm xử lý** và kết quả kinh doanh không được duy trì trong một chuỗi dữ liệu liên tục.
- `:20` — không mặc định mọi doanh nghiệp đều gặp vấn đề này **ở mức đáng trả tiền**; phân khúc giáo dục B2C pilot là nơi kiểm chứng.
- Giả thuyết mà P0 đang kiểm chứng: **VH1 (H1)** mất ngữ cảnh bàn giao là vấn đề đủ thường xuyên/hữu ích; **VH2 (H2)** việc cần làm có giá trị xuất hiện đủ nhiều (`:469-470`). Điều kiện fail ghi rõ ở VH1: *nếu chỉ thiếu ít thông tin mà không gây hậu quả thì chưa coi là giá trị cốt lõi*. **VH3 (H3)** (AI trích việc, precision ≥95%) thuộc **sau L3**.

### 2.2 Tầm nhìn đa nền tảng ≠ phạm vi P0

| Thuộc tầm nhìn (North Star) | Thuộc phạm vi đang build |
|---|---|
| Pancake read-sync, AI extraction sau feature flag, manager exception view, usage/data-coverage view → **"In scope (P1 — sau learning gate L3/L4)"** (`docs/implementation-plan/01-scope-and-principles.md:39-45`) | manual/synthetic loop một chiều, intake do người thao tác; PG persistence; audit; RBAC lead-scoped (`:29-38`) |
| R-29…R-41 / C-13 C-14 (control plane, provisioning, licensing, installer, backup) → **PH7+ Deferred**, cần human gate + legal (`05-phase-map.md`, `state/progress.md:118`) | không tự mở rộng PH3 bằng R-29…R-41 |
| — | **Out of scope** (`01-scope:47-58`): public SaaS/billing/enterprise multi-tenancy, full CRM, generic inbox/task/workflow/BI, connectors Meta/TikTok, revenue attribution, lost-revenue prediction, gửi tin Pancake, auto-merge identity, AI tự đổi trạng thái/routing/outbound |

### 2.3 Invariants và boundary

`docs/canonical/DOMAIN_INVARIANTS.md` (Canonical normative, 2026-09-16) định nghĩa **I-01…I-12** (đã đồng bộ đủ I-01…I-12 trong `AGENTS.md` tại commit `6680868`). Ràng buộc nền: *"A passing test suite does not override a violated invariant"* (`:12`).

Canon cấm rõ mà prototype dễ đụng: AI không mutate trực tiếp/opaque (`COMMERCIAL_EVENT_MODEL.md:20`); event "đề xuất, không thực thi" (`:71`); manual loop phải chạy khi AI tắt/sai (`TRUST_AND_EVIDENCE.md:76`); không lấy ID Pancake/display identity làm Lead ID (`IDENTITY_MODEL.md:32,73`); không backfill unknown (`TRUST_AND_EVIDENCE.md:70`, I-08); **synthetic/manual không được tính là bằng chứng khách thật** (`INTEGRATION_PRINCIPLES.md:55`; nhãn `isSynthetic` trong code); không trừu tượng sớm — connector framework, workflow DSL, event platform, control plane (`ARCHITECTURE_CONSTITUTION.md:41`); không token/PII thô trong log/telemetry (`TRUST_AND_EVIDENCE.md:76`).

### 2.4 Bảy quyết định mở — DO NOT RESOLVE

`docs/canonical/OPEN_DECISIONS.md:19-27`: **CE-1** (transition table/state enum), **CE-2** (CommercialEvent scope), **MM-1** (attribution), **ID-1** (merge thresholds), **ID-2** (CRM mapping), **PM-1** (capability matrix), **LG-1** (North Star vs LVP). Quy tắc toàn cục: không tự chế cách giải quyết, để comment seam, dừng nếu có thể chạm invariant (`:13,34`).

Trạng thái decision records: `ADR-001` = **`Proposed — chờ Human Gate #A`** (`decisions/ADR-001-ce1-ce2.md:4`) → state machine trong code chỉ là hypothesis; `RFC-005` = **Draft**, và ghi rõ việc Q3/Q4 **"Does not block manual/synthetic prototype or existing non-frozen interim work"** (`RFC-005:90`); `ADR-004` = **Accepted** nhưng quyền hạn chỉ framing/validation, không sửa canonical.

### 2.5 Năm phân biệt cần giữ — và trạng thái thực thi tại `6a98fdf`

| Phân biệt | Canon | Code tại `6a98fdf` |
|---|---|---|
| **Người nói ≠ người được giao ≠ bên chịu trách nhiệm** | **PARTIAL**: chỉ có "conversation assignment ≠ Sales ownership" (`DOMAIN_MODEL.md:43`); "speaker" **NOT IN CANON** | `rawPayload.speaker`; `activeWorkRecipients(state)` dẫn xuất từ mọi `workItems` còn actionable; `work.responsibleParty` (`internal`/`external`); `work.actor` (recipient được giao item đó); `ownerUserId` |
| **Quyền xem ≠ quyền accept ≠ quyền mutation** | taxonomy này **NOT IN CANON** (thuộc PM-1) — seam tầng pilot nhân danh I-09 | `view` = `ownerUserId` + `activeWorkRecipients(state)` + manager/admin cùng workspace; `accept` = **chỉ đúng `item.actor`** của item `proposed`; `mutation` = **chỉ `ownerUserId` hiện tại VÀ đúng `item.actor`** trên item đã `accepted`/`open`/`awaiting-external` (`pilot-loop.service.ts`, `rbac.service.ts`) |
| **Quan sát thấy tin nhắn ≠ quan sát thấy hành động được mô tả** | Áp dụng `TRUST_AND_EVIDENCE.md` §4 + I-12 | **Đã enforce tại `6a98fdf` (P1-4):** `completeWork` từ chối `observed` nếu `evidenceRef` trỏ vào tin nhắn mở đầu của khách (`sourceEnvelopeId` / `speaker === 'customer'`) với `422 EVIDENCE_NOT_ACTION_PROOF`; từ chối `absent`/`conflicted` với `422 EVIDENCE_INSUFFICIENT_TO_CLOSE` |
| **Lời khai / suy luận / quan sát / vắng mặt / mâu thuẫn** | canon dùng `claimed`; từ **"declared" NOT IN CANON** (`TRUST_AND_EVIDENCE.md:22-30`: acquisition mode × assertion status là **hai chiều độc lập**) | `CompletionEvidence` 5 giá trị (`pilot.types.ts`) cho work item vs `AssertionStatus` (`recorded/claimed/inferred/conflicted/unknown`) cho outcome — cần task `T3-12` đối chiếu schema/vocabulary trước PH5 |
| **Thời điểm sự kiện / thu nhận / ghi hệ thống** | canon có `occurred_at` + `captured_at`; **time hệ thống thứ ba NOT IN CANON** | `occurredAt` (hoặc `UNKNOWN_SENTINEL`, không backfill — Q4), `sourceCapturedAt`, `ingestedAt`/`recordedAt` |

---

## 3. Những phần đã thực hiện được (đo tại `6a98fdf`)

| Hạng mục | Hành vi hiện có | Source/module/API | Nối vào luồng? | Bằng chứng `[đo @ 6a98fdf]` | Giới hạn còn lại |
|---|---|---|---|---|---|
| Ingest + envelope | raw immutable, SHA-256 hash, scope theo workspace, `idempotencyKey = JSON.stringify([ws,conn,ext])` | `domain/envelope/envelope.ts`, `adapters/manual/`, `POST /pilot/scenarios` | **Có** | unit 13+12 tests, PG integration, smoke step 3b | **P1-1 đã đóng**; provider extension chờ PH4 |
| Lead + state machine | hypothesis New→Accepted→Contacting→Follow-up→Won/Lost/Unknown, ngoài boundary → 422 `CE1_BOUNDARY` | `domain/lead/lead-state.ts` | **Có** | 18 unit tests, smoke step 12 | CE-1 chưa freeze (ADR-001 Proposed) |
| Bàn giao 2 người + accept | context + evidenceRefs + proposed action; `activeWorkRecipients` giữ quyền GET qua nhiều handoff; `salesAccept` kiểm đúng `item.actor` | `pilot-loop.service.ts`, `/handoff`, `/accept` | **Có** | smoke steps 4, 4b, 5, 6 + 17 controller tests | **P1-2 đã đóng**; multi-handoff read projection/UI chờ PH5 |
| Work items (trục Q3) | `responsibleParty × origin × status × completionEvidence` | `pilot.types.ts`, migration `003` | **Có** | 22 service tests | **validation construct**, cần reconcile với schema canonical (`T3-12`) |
| Đóng việc + gate evidence | `observed` cần pointer chứng minh hành động (`EVIDENCE_NOT_ACTION_PROOF` nếu trỏ intake message); chặn `inferred`, `absent`, `conflicted` (`EVIDENCE_INSUFFICIENT_TO_CLOSE`) | `pilot-loop.service.ts`, `/complete` | **Có** | 8 evidence tests + PG integration + smoke step 9b | **P1-4 đã đóng**; Won/Lost open-action gate chờ PH5 (`T5-02`/`T5-04`) |
| Supersession chain | item cũ `rescheduled`, từ chối 409 `WORK_SUPERSEDED` + `details.replacementId` | `pilot-loop.service.ts`, `/reschedule` | **Có** | smoke steps 7, 7b, 8 + PG integration | **P1-3 đã đóng** |
| Durable PG + migrations | 001–004 applied; mutation + audit **một transaction** (QA-35); `pg_advisory_xact_lock`; 004 = backfill tất định / `RAISE EXCEPTION` khi mâu thuẫn / quarantine thay vì xóa | `pg-pilot.store.ts`, `migrations/00{1..4}*.sql` | **Có** | `test:integration` **10/10 pass**, schema dev 14 bảng | `PgPilotStore` chưa ghi vào bảng `customer` (`customer_id = NULL`) |
| Audit append-only, lead-scoped | history không lộ trail của lead khác | `pilot.store.ts`, `pg-pilot.store.ts`, `/audit` | **Có** | smoke step 13b + PG integration | **P1-5 đã đóng**; cần DB test riêng để không tích tụ orphan audit trên dev DB |
| Auth stub | 401 unauthenticated; demo header opt-in + sandbox `demo:<name>`; bootstrap token; Bearer unsigned chỉ khi `AUTH_DEV_UNSIGNED_TOKENS=true` | `infra/auth/auth.service.ts` | **Có** (trong controller, **chưa phải `APP_GUARD` toàn cục**) | 13 unit tests + smoke step 2 | **token dev là base64 JSON tự khai → chờ `T3-10` & `PM-1`** |
| RBAC deny-by-default | cross-workspace 404 (invisible), unrelated user 403, per-item recipient check | `infra/rbac/rbac.service.ts` | **Có** | 5 unit tests + 17 controller tests + smoke steps 4b, 5 | manager/admin vẫn workspace-wide ở quyền view (QA-58 chờ PM-1) |
| Error contract 4xx | 16 machine code tại boundary (thêm `EVIDENCE_NOT_ACTION_PROOF`, `EVIDENCE_INSUFFICIENT_TO_CLOSE`, `WORK_NOT_ASSIGNED_TO_ACTOR`) | `pilot-loop.controller.ts`, `pilot-validation.ts` | **Có** | 17 controller + 8 validation tests + smoke | chưa có global exception filter + `correlationId` (`T5-09`) |
| Telemetry / Feedback | `TelemetryService` + `FeedbackService` + bảng `product_event`, `feedback` | `infra/telemetry/`, `modules/feedback/` | **KHÔNG** — mới chỉ được gọi trong `.spec.ts` | 2 + 3 unit tests | chờ wire vào HTTP/service (`T3-10`) |
| `WorkspaceRepository` | CRUD workspace trên PG | `infra/workspace/workspace.repository.ts` | **KHÔNG** — chỉ gọi trong `postgres.integration.spec.ts` | 2 integration tests | chờ wire hoặc dọn (`T3-10`) |
| **UI / Operator CLI** | **không tồn tại** (chỉ có JSON API) | — | — | — | chặn L1/L2/L3 user validation (`T5-10`) |
| CI / E2E / contract suite | **không có** `.github/workflows/`; `package.json:19` tham chiếu `vitest.config.e2e.ts` chưa tồn tại | — | — | — | chờ `T3-11` |

---

## 4. Kết quả kiểm chứng tại `6a98fdf` và Hồ sơ đối chứng lịch sử `1b72b61`

### 4.1 Kết quả đo trực tiếp tại `6a98fdf` (`[đo @ 6a98fdf]`)

| Lệnh | Kết quả tại `6a98fdf` |
|---|---|
| `npm run typecheck` | exit **0** |
| `npm run build` | exit **0** |
| `npm test` (KHÔNG set DB env) | exit **0** — **233 pass / 10 skipped** (tổng 243; 3 file integration skip theo thiết kế) |
| `npm test` (CÓ `TEST_DATABASE_URL`) | exit **0** — **243 pass / 0 skipped** (26/26 spec files) |
| `npm run test:integration` (CÓ `TEST_DATABASE_URL`) | exit **0** — **10 pass / 0 skip** (`--no-file-parallelism`) |
| `npm run test:cov` (CÓ DB) | exit **0** — 243 pass; **All files 91.45% lines / 84.66% branch / 93.50% funcs** |
| `npm run test:cov` (KHÔNG DB) | **exit 1** — `Coverage for lines (76.1%) does not meet global threshold (80%)` |
| `bash scripts/pilot-smoke.sh` | exit **0** — **16 bước (gồm 3b, 4b, 7b, 9b, 13b), PASS=60 / FAIL=0**, có kill & restart app process trên PG 16 |
| `git log --oneline -- docs/canonical/` | chỉ có `88528db first commit` — **canonical nguyên vẹn 100%**; forbidden paths không chạm |

### 4.2 Bảng đối chiếu đóng lỗi P1 (`1b72b61` lịch sử → `6a98fdf` hiện tại)

| Hạng mục | Trạng thái lịch sử tại `1b72b61` (`[lịch sử @ 1b72b61]`) | Trạng thái hiện tại tại `6a98fdf` (`[đo @ 6a98fdf]`) |
|---|---|---|
| **P1-1 (Idempotency key)** | `idempotencyKey` nối chuỗi bằng `:` (`ws:conn:ext`) → `(review-tenant, b:inbox, msg-1)` và `(review-tenant:b, inbox, msg-1)` ra cùng envelope ID | **ĐÃ ĐÓNG:** `JSON.stringify([workspaceId, connection, externalRecordId])`; 2 tuple có dấu `:` tạo 2 envelope tách biệt trên cả In-Memory, PG (`pilot-loop.integration.spec.ts`) và HTTP (`smoke step 3b`) |
| **P1-2 (Per-item RBAC & multi-handoff view)** | Owner `A` tự accept/complete được item giao cho `B`; `C` accept được item của `B`; handoff thứ 2 cho `C` ghi đè `handoffRecipient` làm `B` mất quyền `GET` (403) | **ĐÃ ĐÓNG:** `salesAccept` và `requireMutableWork` kiểm tra `item.actor === actor` (`403 NOT_ASSIGNED_RECIPIENT`) trước khi kiểm tra trạng thái sống/đóng của item; `activeWorkRecipients(state)` giữ quyền `GET` cho mọi recipient còn item actionable (`smoke step 4b`) |
| **P1-3 (Supersession chain)** | Đã đóng từ `406ca8e` | **ĐÃ ĐÓNG:** reschedule trả `replacementId`; complete ID cũ → `409 WORK_SUPERSEDED` + `details.replacementId` (`smoke steps 7, 7b, 8`) |
| **P1-4 (Action proof & absent/conflicted guard)** | Tin nhắn khách hỏi ban đầu (`sourceEnvelopeId`) đóng được việc với `observed`; `absent`/`conflicted` đóng được việc sang `completed`; 3 file test/smoke assert hành vi sai này | **ĐÃ ĐÓNG:** `completeWork` từ chối `absent`/`conflicted` (`422 EVIDENCE_INSUFFICIENT_TO_CLOSE`), từ chối `observed` khi trỏ vào intake message của khách (`422 EVIDENCE_NOT_ACTION_PROOF`); cả 3 file test/smoke đã sửa sang assert chiều đúng (`smoke step 9b`) |
| **P1-5 (Lead-scoped audit)** | Đã đóng từ `a04f162` | **ĐÃ ĐÓNG:** `history(leadId)` chỉ trả các bản ghi thuộc đúng lead đó (`smoke step 13b`) |
| **Optimistic locking** | Chưa làm (`lead.version` tăng nhưng không có `WHERE version = $expected`) | **CHƯA LÀM** — được lên lịch chính thức vào task **`T3-09`** |

---

## 5. Giới hạn bằng chứng & Các phát hiện kiểm toán còn mở

1. **Không có CI host (`T3-11`).** Repo chưa có `.github/workflows/`; mọi con số kiểm thử hiện là local. Ngoài ra `npm run test:cov` khi không có PostgreSQL vẫn đỏ (`76.1% < 80%`) vì `PgPilotStore` bị skip — CI bắt buộc phải gắn service container `postgres:16-alpine`.
2. **File `pilot-loop.service.ts` vượt ngưỡng 500 dòng (`T3-09`).** Sau khi thêm các guard P1-2/P1-4, `product/src/modules/pilot-loop/pilot-loop.service.ts` dài **665 dòng** và `pilot-loop.service.spec.ts` dài **624 dòng**, vượt quy tắc `< 500 lines` trong `AGENTS.md`. Cần tách module/helper mà không đổi hành vi.
3. **Chưa có Optimistic Locking (`T3-09`).** `PgPilotStore.save()` cập nhật `version = EXCLUDED.version` nhưng chưa kiểm tra `WHERE lead.version = $expected` nên hai yêu cầu đồng thời vẫn ghi đè nhau.
4. **Code chưa nối (`Unwired Code` — `T3-10`, `T3-12`).** `TelemetryService`, `FeedbackService`, `WorkspaceRepository` và `CommercialEvent` mới chỉ được gọi trong `.spec.ts`; bảng `customer` trong PostgreSQL hiện có `0` dòng vì `PgPilotStore` chưa lưu thực thể `Customer` tách rời khi ingest (`lead.customer_id = NULL`).
5. **Vệ sinh DB phát triển (`T3-11`).** Trong DB `north_star` hiện có 1.014 dòng `audit_record`, trong đó 864 dòng thuộc các workspace test đã xóa. Việc không đặt `ON DELETE CASCADE` lên `audit_record` là **đúng nguyên tắc I-05 (append-only)**, nhưng cần tách database kiểm thử riêng (`north_star_test`) để không làm bẩn DB dev.
6. **Chưa có giao diện thao tác (`T5-10`) và xác thực thật (`PM-1`).** Chưa có UI/CLI cho người làm kinh doanh tự chạy; chế độ `AUTH_DEV_UNSIGNED_TOKENS=true` chỉ dùng cho smoke test local trên dữ liệu giả định.

---

## 6. Lộ trình thực thi tiếp theo (đã đồng bộ với Phase Plan PH0–PH6)

| Thứ tự | Task ID | Hạng mục công việc | Tiêu chí nghiệm thu (DoD) |
|---|---|---|---|
| **Bước 1 (ĐÃ XONG @ `6a98fdf`)** | `P1-1`, `P1-2`, `P1-4` | Khóa 3 cạnh P1 còn hở + sửa 3 test/smoke sai | **ĐÃ ĐẠT:** `243/243` tests pass (10 PG integration), `60/60` HTTP smoke checks pass, coverage có DB `91.45%`. |
| **Bước 2 (Trọng tâm kế tiếp — Đóng Gate L2→L3)** | **`T3-09`** | Optimistic locking (`WHERE version = $expected` → `409 VERSION_CONFLICT`) + tách `pilot-loop.service.ts` xuống `< 500` dòng | 2 cập nhật song song cùng `version` → 1 bên `200`, 1 bên `409 VERSION_CONFLICT`; mọi file `.ts` trong `product/src/` `< 500` dòng. |
| **Bước 2b** | **`T3-10`** | Global `APP_GUARD` + nối `TelemetryService` & `FeedbackService` vào HTTP/pilot-loop + kiểm tra redaction | Route không gắn `@Public()` trả `401` toàn cục; thực hiện thao tác pilot ghi dòng vào `product_event` và `POST /v1/pilot/feedback` ghi vào `feedback`. |
| **Bước 2c** | **`T3-11`, `T3-12`** | Dựng `.github/workflows/ci.yml` có Postgres 16 + DB test riêng + cấu hình `vitest.config.e2e.ts` + nối persistence `Customer` / đối chiếu schema `003` vs `001` | CI chạy xanh `typecheck`, `test`, `test:integration`, `test:cov` (≥80% tổng, 100% auth/RBAC), `build`; ingest tạo dòng `customer` thật trên PG (I-01). |
| **Bước 3 (Mở đường cho L1/L2/L3 User Loop)** | **`T5-10`** | Màn hình thao tác tối giản (Web UI hoặc CLI) + cổng chặn `Won`/`Lost` khi còn việc mở (`T5-02`/`T5-04`) | Một tư vấn viên chạy trọn kịch bản synthetic mà không cần kỹ sư gõ `curl`; đóng `Won`/`Lost` khi còn việc active bị chặn `422 OPEN_ACTIONS_REMAIN`. |

---

## 7. Nguồn cần đọc khi tiếp tục

- **Tier 1 (normative, cao nhất — KHÔNG SỬA):** `docs/canonical/DOMAIN_INVARIANTS.md` · `OPEN_DECISIONS.md` · `TRUST_AND_EVIDENCE.md` · `DOMAIN_MODEL.md` · `PRODUCT_CONSTITUTION.md`.
- **Tier 2:** `docs/Dinh_nghia_bai_toan_V2.md` · `docs/north-star/SERVICE_MODEL.md` · `docs/architecture/pancake-realtime-sync-architecture.md`.
- **Tier 3 (kế hoạch & trạng thái đã đồng bộ tại `6a98fdf`):** `docs/implementation-plan/00-README.md` · `03-requirements.md` · `04-architecture.md` · `05-phase-map.md` · `06-test-strategy.md` · `08-verification.md` · `phases/PH0..PH6.md` · `state/features.json` · `state/progress.md`.
- **Công cụ REA (cô lập ngoài repo):** `docs/config/rea-tooling.md` (hướng dẫn dùng `morluto/rea` và `JoasASantos/REA-Prompts` phục vụ khảo sát hợp đồng tích hợp Pancake/CRM cho `T0-01/T0-02/T4-00`).
