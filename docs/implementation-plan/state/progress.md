# Progress Tracker

**Updated:** 2026-10-07 (đợt sửa 5 P1 theo review của user tại `b81edd9` + 1 race self-found)
**Mode:** Build — PH1 + PH2 code reported done; PH3 persistence verified on real PostgreSQL 16; pilot-loop P0 flow running live (in-memory).
**Problem framing:** `docs/Dinh_nghia_bai_toan_V2.md` (2026-10-06) is a problem-definition and validation-plan source, not a frozen product/domain specification; see `discovery/v2-validation-and-traceability.md`.
**Sources:** `docs/implementation-plan/discovery/2026-10-01-qa.md` (QA-01…59), `discovery/2026-10-01-specification-draft.md`, `discovery/v2-validation-and-traceability.md`, `discovery/q3-annotation-guide.md`, `discovery/q4-provenance-time-mapping.md`, `discovery/q3-q4-synthetic-scenarios-edu-b2c.md`, `03-requirements.md` (R-01…R-41), `SERVICE_MODEL.md`, `state/features.json`
**Code evidence (2026-10-07→08 — P1 checkpoint `0f1da07` đã push, cộng correction của migration 004 commit `35c18b5`+):** `product/` — `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` **không** set DB env → exit 0, **228 pass / 10 skipped** (3 integration specs skip theo thiết kế); `npm test` **có** `TEST_DATABASE_URL` → exit 0, **238 pass / 0 skip** (3 run liên tiếp sạch, flaky đã hết sau `e93e82d`); `npm run test:integration` exit 0 (**10 pass**); `scripts/pilot-smoke.sh` exit 0 (**PASS=53 FAIL=0**, gồm restart tiến trình app). PostgreSQL 16 thật: docker `postgres:16-alpine`, host **:55432** (5432 bị `edura-postgres` của dự án khác chiếm — không đụng), `migrate up/down 4/re-up` exit 0.
**Verification report:** `08-verification.md` đã được điền cho PH3 + matrix I-01…I-12 (kèm ghi chú trung thực: **repo không có `.github/workflows/`** nên không có CI host — mọi con số là local).

> **Evidence boundary:** V2 H1–H8 and numeric thresholds are proposed validation hypotheses, not empirical results or industry benchmarks. QA-01…59/spec draft are intent/proposal records, not frozen requirements. R-29…R-41 remain proposed/deferred and do not expand PH3. CE-1/CE-2/PM-1/MM-1/ID-1/ID-2/LG-1 remain open; no canonical decision is resolved by V2.

---

## PH0 — Spike & Research
- [x] T0-01: Q-03 spike (Pancake API docs + auth + paging) — spike docs có, cần re-verify live trước PH4
- [x] T0-02: Q-04 spike (webhook semantics + payload) — như trên
- [x] T0-03: Envelope schema v1 draft — `domain/envelope` đã implement + test (12 tests)
- [x] T0-04: RFC CE-1 + CE-2 draft — ADR-001 interim hypothesis (citations đã fix 51f9732 — chỉ là rà soát trích dẫn, không phải phê duyệt gate)
- [x] T0-05: Synthetic/manual adapter spec — `adapters/manual` (7 tests), synthetic demo path có
- [~] T0-06: Human Gate #A — **VẪN CHỜ** (sửa 2026-10-07): ADR-001 vẫn `Proposed — chờ Human Gate #A`; CE-1/CE-2 chưa có phê duyệt transition table/scope. Code chỉ chạy hypothesis interim và abort ngoài boundary (422 CE1_BOUNDARY). Citation fix 51f9732 chỉ là rà soát trích dẫn, không tự chứng minh gate đã được duyệt — đánh dấu [x] trước đó là quá phạm vi.

**Kết luận PH0:** Spike + envelope đủ để không block PH1/PH2; Pancake feasibility (Q-03/Q-04) vẫn BLOCKED-BY cho PH4.

## PH1 — Walking Skeleton
- [x] T1-01: package.json + tsconfig — Node 22, TS, Vitest
- [x] T1-02: NestJS shell + Fastify adapter — `app.module.ts`, `main.ts`
- [x] T1-03: Health endpoint — `health.controller` + test (3 tests)
- [x] T1-04: Lead entity (stable ID) — `domain/lead/lead.ts` + `lead.spec` (13 tests)
- [x] T1-05: Handoff entity — `domain/handoff` (7 tests)
- [x] T1-06: Manual adapter shell — `adapters/manual` (7 tests), raw preserved, no fabrication
- [x] T1-07: Workspace isolation shell — `infra/workspace` (10 tests), synthetic segregation
- [x] T1-08: npm ci/typecheck/test/build pass — pass 2026-09-22 (132 tests)

**Gate L1:** Comprehension — smoke health + domain shell + workspace isolation shell → **đạt (code).**

## PH2 — Domain & Events
- [x] T2-01: Lead entity + state — `lead`, `lead-state` (18 tests), transitions append-audited, interim CE-1
- [x] T2-02: Customer ≠ Lead — `customer` (8 tests), I-01 enforced, không collapse
- [x] T2-03: Handoff entity — `handoff` (7 tests), stable Lead ID, evidence ref, audit
- [x] T2-04: CommercialEvent envelope v1 — `commercial-event` (13 tests), provenance, inferred-only interim (CE-2)
- [x] T2-05: UNKNOWN states — `unknown-states` (7 tests), 5 truth states distinct, không null
- [x] T2-06: Outcome Won/Lost/Unknown — `outcome` (7 tests), claimed + correction append-only
- [x] T2-07: Lead state machine (hypothesis) — `lead-state` interim New→Accepted→Contacting→Follow-up→Won/Lost/Unknown, reversible + audit (BLOCKED-BY CE-1, ADR-001)
- [x] T2-08: Audit/Provenance store — `infra/audit` (8 tests), append-only in-memory
- [x] T2-09: Invariant sweep tests — `domain/invariants.spec` (19 tests), mỗi I-01…I-12 ≥1 test (I-06/I-09 cần thay bằng meaningful check ở lần sweep tới — xem qa.md §10)

**Gate L2:** Vertical slice — lead lifecycle + audit + UNKNOWN visible → **code đạt, chờ human review ADR-001 + sweep I-06/I-09 meaningful.**

## PH3 — Persistence & Auth

> Cập nhật 2026-10-07, tách 3 mức trạng thái: **[✓code]** đã code + unit test · **[✓DB]** đã kiểm chứng trên PostgreSQL thật · **[pilot-ready]** đủ điều kiện cho pilot dữ liệu thật. Mức `[✓DB]` chỉ đạt khi integration test chạy (không skip) trên Postgres 16 local (docker compose, host port 55432 — port 5432 đang bị `edura-postgres` chiếm). Gate L2→L3 chỉ đóng khi `[✓DB]` VÀ auth/RBAC được gắn HTTP guard.

- [✓code][✓DB] T3-01: PostgreSQL setup — `docker-compose.yml`, `.env.example`, `PostgresService` (pool lazy, `withTransaction` rollback khi lỗi — QA-35). Kiểm chứng 2026-10-07: `SELECT 1` OK, container restart giữ dữ liệu (insert → restart → read = 1 row)
- [✓code][✓DB] T3-02: Domain migration — `001_domain`, `002_telemetry_feedback`, **`003_pilot_loop`** (owner/recipient/`pilot_work_item` — validation schema cho P0 flow, không phải canonical model) và **`004_envelope_workspace_scope`** (P1-1: workspace-scoped idempotency). Chính sách dữ liệu cũ của `004` (sau review của user): backfill **chỉ tất định**; envelope bị lead ở nhiều workspace cùng tham chiếu → `RAISE EXCEPTION` (không đoán); envelope **không** có lead tham chiếu → **quarantine giữ nguyên payload**, không xóa — người vận hành mới là người quyết định gán workspace hay bỏ. Kiểm chứng: `migration-004.integration.spec.ts` (2 tests, DB phụ tạm) + `migrate up/down 4/re-up` exit 0.
- [✓code][✓DB] T3-05: Workspace isolation (DB) — `WorkspaceRepository` + `postgres.integration.spec.ts` XPASS (2/2, không skip); pilot integration bổ sung xác thực workspace-scoped qua PG thật
- [✓code][✓DB] T3-08: Migration rollback — `migrate down`/re-`up` pass trên DB thật (unit + integration exit 0)
- [✓code][✓live] T3-03: Auth (1-A stub) — `AuthService`: demo header, bootstrap token, Bearer unsigned **chỉ khi `AUTH_DEV_UNSIGNED_TOKENS=true`**; không đọc workspace từ body. **Demo đã là sandbox (P1-4, `e62a0b2`)**: `x-demo-workspace` cần opt-in `DEMO_WORKSPACES=true` (mặc định **tắt** → fail closed) và luôn resolve thành `demo:<tên đã sanitize>` — header không còn cho phép chỉ định workspace THẬT của tenant khác. **Đã enforce 401 trong `PilotLoopController` (R-02)** qua HTTP thật — nhưng **chưa phải APP_GUARD/middleware toàn cục**; các route ngoài pilot loop chưa được bảo vệ; credential model thật vẫn `OPEN: PM-1` (QA-28).
- [✓code][✓live][pilot-ready?] T3-04: RBAC — `RbacService` lead-scoped + deny-by-default; **ba quyền tách biệt (P1-2, `948851b`)**: *view* = owner/recipient/manager-admin cùng workspace, *accept* = recipient hoặc owner, *mutation* = **chỉ owner hiện tại** và kiểm theo từng work item thuộc lead đó. Recipient chưa accept **không** complete/dời lịch/advance/ghi outcome hộ owner (403 `NOT_OWNER`). **403 cross-user + 404 cross-workspace đã verify qua HTTP thật** (smoke steps 5, 6; step 5 có thêm demo-sandbox 404). Manager vẫn workspace-wide tạm ở quyền view (QA-58 chờ PM-1); mutation **không** mở cho manager/admin trong P0. Chưa pilot-ready cho dữ liệu thật: thiếu credential model + guard toàn cục.
- [✓code] T3-06: Telemetry — `TelemetryService` tag `releaseVersion` + `flagExposure`, bảng `product_event` (2 unit tests; wiring HTTP endpoint chưa)
- [✓code] T3-07: Structured feedback — `FeedbackService`, bảng `feedback` tách telemetry (3 unit tests; endpoint chưa)

**Verify tại `HEAD` (đã push `1a2fd73` — correction của migration 004 là `35c18b5`) (exit codes kiểm tra riêng, không qua pipe):** `typecheck` exit 0 · `build` exit 0 · `npm test` không DB exit 0 (**228 pass / 10 skipped**) · `npm test` có DB exit 0 (**238 pass**, 3 run liên tiếp) · `npm run test:integration` exit 0 (**10 pass**, `--no-file-parallelism`) · `migrate:up`/`down 4`/re-`up` exit 0 · `scripts/pilot-smoke.sh` exit 0 (**PASS=53 FAIL=0**). `docs/canonical/**` không đổi trong đợt fix này (`git diff --stat b81edd9..HEAD -- docs/canonical/` rỗng); forbidden paths không đụng.

**Sự cố test-integrity đã sửa (ghi lại trung thực):**
1. (2026-10-07, sáng) `postgres.integration.spec.ts` teardown gọi `migrator.down(2)` trên DB dev **dùng chung** → xóa `003_pilot_loop` sau mỗi lần chạy, làm mọi suite kế tiếp chết `column owner_user_id does not exist`. Đã sửa: teardown chỉ dọn rows.
2. Hai integration spec chạy parallel trên cùng DB va nhau → `test:integration` dùng `--no-file-parallelism`.
3. Smoke tự `migrate up` trước khi boot app (idempotent).
4. **(2026-10-07, đợt P1-fix — self-found) `e93e82d`:** `migrator.up()` đọc danh sách migration pending **ngoài** transaction → hai spec file boot song song trên cùng DB **cùng** DDL. Tái hiện trên PG 16 thật với 5 tiến trình `migrate up` đồng thời trên schema trống: 1 thắng, **3 fail** `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`. Đây chính là nguyên nhân `npm test` (có DB env) fail không ổn định 1 test. Đã sửa: `pg_advisory_xact_lock(hashtext(version))` + re-check `schema_migrations` **bên trong** transaction (kể cả bootstrap `ensureTable`); chạy lại 5 tiến trình đồng thời → 1 apply, 4 "up to date", schema nguyên vẹn (13 bảng khi đó; 14 sau khi 004 thêm bảng quarantine).


**Không tự mở rộng PH3 bằng R-29…R-41** (control plane, provisioning, licensing, installer, fleet upgrade). PH3 đã duyệt vẫn là persistence/auth/RBAC/telemetry-feedback cho app/data plane.

## Pilot-loop (P0 flow giáo dục B2C — PostgreSQL-backed, HTTP live)

> Mức trạng thái: `[✓code]` unit test · `[✓DB]` integration chạy trên Postgres 16 thật (không skip) · `[✓live]` chạy qua HTTP trên tiến trình `node dist/main.js` thật, smoke script **tự assert và exit non-zero khi sai**.

- [✓code][✓DB][✓live] `product/src/modules/pilot-loop/` — `PilotLoopService` (store port) + `PgPilotStore` (durable: envelope I-12, lead+owner, handoff+recipient, work items Q3-axes, outcome supersedes, audit — MỘT transaction, QA-35) + `InMemoryPilotStore` (demo/DB-less, không durable). Unit: 21 service + 7 evidence + 5 store + 16 controller + 6→8 boundary-validation tests, 10→13 auth tests; specs khác giữ nguyên (envelope 12, manual-adapter 11 incl. P1-1 regressions, domain/invariants 25, …) → tổng **238 tests khi có DB, 228 + 10 skip khi không có DB**; **10 integration tests trên PG thật** (restart-pool durability, P1-1 cross-workspace, P1-3 chain qua DB, P1-4 evidence durable, P1-5 audit scoping, atomic refusal, migration-004 quarantine/refusal)
- [✓code][✓DB][✓live] Bàn giao hai người: **marketing-A tạo + handoff → sales-B**; B xem gói (context + evidenceRefs) và accept; owner chuyển B. `sales-C` không liên quan bị **403 qua HTTP thật** (step 5 smoke) — quyền recipient là lead-scoped I-09 cho đúng gói addressed to them, KHÔNG mở rộng role; **P1-2 tách rõ**: recipient chưa-accept không có quyền mutation; matrix đầy đủ vẫn **OPEN: PM-1**.
- [✓code][✓live] `scripts/pilot-smoke.sh` — 15 bước (1–14 + 7b/9b/13b), **53 assertions, PASS=53 FAIL=0, exit 0** (2026-10-07 tại `e93e82d`). Step 14 kill app → process mới → đọc lại từ PG: lead Won, chuỗi thay thế `1 completed / 1 rescheduled / 0 active`, outcome claimed, envelope refs, đủ 6 eventType audit (append-only I-05). **Lưu ý trung thực:** phiên bản smoke ở `b81edd9` (31/31 pass) đã **encode chính lỗi P1-3** (complete ID cũ); các assertion mới ở step 7b/8/13b được viết để kiểm chiều đúng của hành vi.
- [✓code][✓live] Error contract: guardrail refusal trả **4xx + machine code**, không còn 500: 400 `INPUT_INVALID` (validate boundary: required/enum/ISO date/`leadId` UUID), 422 `EVIDENCE_POINTER_REQUIRED` (message observed ≠ hành động), 422 `EVIDENCE_NOT_FOUND`/`EVIDENCE_NOT_RELATED`, 403 `EVIDENCE_OUT_OF_SCOPE`, 422 `INFERRED_CANNOT_CLOSE` (I-03/V2 §9.6), 422 `EXTERNAL_NOT_DECLAREABLE`, 422 `CE1_BOUNDARY` (New→Won ngoài hypothesis), 409 `WORK_ALREADY_CLOSED`/`WORK_ALREADY_COMPLETED`, **409 `WORK_SUPERSEDED` + `details.replacementId`**, 403 `NOT_ASSIGNED_RECIPIENT`/`NOT_OWNER`, 404 `WORK_NOT_FOUND`/`OUTCOME_NOT_FOUND`/cross-workspace (QA-32/AC-03), 401 unauth (R-02). Smoke **assert mã lỗi** và assert state không đổi sau khi bị từ chối.
- [✓live] Demo route vẫn chạy (`x-demo-workspace`, không token — R-02 AC) nhưng **đã sandbox + opt-in** (xem T3-03). Token Bearer unsigned dùng trong smoke chỉ với `AUTH_DEV_UNSIGNED_TOKENS=true` — **dev-only**, credential model thật chờ RFC PM-1/QA-28.
- Trạng thái Q3/Q4: work axes (`responsibleParty`/`origin`/`completionEvidence`) và `occurredAt=unknown` không backfill là **candidate validation constructs** — RFC-005 vẫn Draft, EXP-06 vẫn proposed; migration `003_pilot_loop` là pilot-validation schema, không phải canonical model đã duyệt.
- Còn thiếu cho Gate L2→L3: telemetry/feedback endpoints chưa wire vào luồng (T3-06/07 mới `[✓code]`), auth chưa qua middleware toàn cục, **optimistic locking chưa làm** (`version` được bump nhưng chưa có check nếu-nhiều-người-cùng-sửa — vòng kế tiếp trước pilot nhiều người), RFC-005 Q3/Q4 chưa có kết quả gán nhãn thật, chưa có E2E/contract suite thật (`vitest.config.e2e.ts` được package.json tham chiếu nhưng file không tồn tại).


## PH4 — Pancake Sync (P1 flagged)
- [ ] T4-01: Pancake adapter
- [ ] T4-02: Envelope mapping + raw preserve
- [ ] T4-03: Idempotency + duplicate audit
- [ ] T4-04: Checkpoint/cursor store
- [ ] T4-05: Redaction
- [ ] T4-06: Feature flag wiring

BLOCKED-BY Q-03/Q-04; flag OFF; manual fallback (QA-07/10).

## PH5 — LVP Slice Hardening
- [ ] T5-01: Queues module
- [ ] T5-02: NextAction lifecycle (QA-18/52)
- [ ] T5-03: Contact attempt/outcome (QA-19/57, BR-10/11/24)
- [ ] T5-04: Outcome Won/Lost/Unknown (correction, Won/refund phân biệt)
- [ ] T5-05: Data Health view (QA-55, AC-08)
- [ ] T5-06: Export/delete + retention (QA-47/48)
- [ ] T5-07: Structured feedback

## PH6 — Pilot & Learning
- [ ] T6-01: Pilot workspace isolation (QA-58: 1 customer → 1 deployment → 1 workspace)
- [ ] T6-02: Experiment exposure logging
- [ ] T6-03: Learning signal instrumentation (QA-55: external user L0)
- [ ] T6-04: Gate review template
- [ ] T6-05: Direction decision document (Continue/Narrow/Pivot/Stop)

---

## Discovery đã brainstorm (2026-10-01/02)

- **Q&A:** QA-01…59 trong `discovery/2026-10-01-qa.md` — phạm vi North Star, journey social-led, Lead = independent purchase decision, event/version dedup, handoff/SLA, Won/payment allocation (QA-59), Lost policy (QA-57), workspace cardinality (QA-58), expiry khóa cả read/export (QA-45), RPO≤15m/RTO≤1h (QA-53), v.v. — là biên bản ý định, không phải đặc tả freeze.
- **Spec draft:** `discovery/2026-10-01-specification-draft.md` — J-01…J-09, BR-01…26, AC-01…08, error matrix, access model proposal (PM-1), logical data contract — là đề xuất, nhiều AC/permission do assistant suy ra cần user review (QA-57…59 đã xác nhận nhưng taxonomy/schema/quyền liên quan chưa duyệt).
- **Deferred backlog:** R-29…R-41 trong `03-requirements.md` §10 (từ `SERVICE_MODEL.md` §1…3) — C-13 Control Plane / C-14 licensing dự kiến, chỉ promote sau human gate và khi chốt mode A/B, license strategy, LLM key custody, provider/data location, v.v.

## Việc tiếp theo (không tự resolve open decisions)

1. Human Gate #A/#B: RFC CE-1 (state matrix) + CE-2 (event scope) → ADR-001 supersede nếu chốt; PM-1 (manager scope theo team/branch — QA-58), MM-1/ID-1/ID-2/LG-1 giữ boundary.
2. Sửa invariant sweep: thay placeholder I-06/I-09 bằng meaningful no-auto-merge/undo và cross-workspace/reassigned/evidence checks; fix nhãn I-10/I-11 nếu còn mismatch.
3. Quyết định scope cho R-29…R-41 trước khi đưa vào phase map (mode A/B sequencing, đường build-vs-compose, license/distribution, expiry/export lock cần legal review).
4. PH3: PostgreSQL + auth + lead-scoped RBAC + workspace isolation DB + telemetry/feedback — đúng phạm vi đã duyệt.
