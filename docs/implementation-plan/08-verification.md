# 08 — Verification Report

**Phiên:** 2026-10-07 (lần đầu điền dữ liệu thật; bản 2026-09-21 là scaffold rỗng)
**Trạng thái:** Đã điền cho PH1–PH3 + pilot-loop P0. PH4–PH6: chưa chạy → để trống có chủ đích.
**Quy tắc ghi:** một mục chỉ `[x]` khi có lệnh đã chạy và exit code được kiểm tra riêng (không suy từ output qua pipe).

---

## Template

Sau mỗi phase, cập nhật phần này:

### PH{N} Verification
- **Date:**
- **Author:**
- **Gate:**
- **Invariant coverage:** I-01…I-12 — [ ] mỗi cái ≥1 test
- **CI:** `npm ci && npm run typecheck && npm test && npm run build` — [ ] PASS
- **Canonical unchanged:** `docs/canonical/**` — [ ] Verified
- **Forbidden paths untouched:** — [ ] Verified
- **Open decisions respected:** — [ ] No silent resolution
- **Human Gate:** — [ ] Recorded
- **Issues found:** (list)

---

### PH3 Verification — P0 slice (persistence + auth/RBAC + pilot loop)

- **Date:** 2026-10-07 → **checkpoint 2026-10-08** (P1-fix round `b81edd9..0f1da07` đã push + migration 004 review follow-up) · **SHA:** xem "Checkpoint" cuối mục · **Đối chiếu tái kiểm tra 2026-10-27 qua HTTP thật tại `1b72b61`:** xem `docs/reports/project-status-and-handover.md`
- **Author:** Claude (assistant) — tự verified, **chưa** qua human review
- **Gate:** L2→L3 **CHƯA ĐÓNG**. Điều kiện chặn **milestone kỹ thuật L2→L3** (đã xác nhận bằng tái hiện HTTP 2026-10-27): ba cạnh P1 còn mở — **P1-1** ký tự `:` trong khoá chống trùng cho phép hai tenant đụng nhau khi tên connection chứa `:`, **P1-2** `salesAccept`/`completeWork` kiểm quyền theo recipient *hiện tại* thay vì theo recipient *của từng work item* (owner vẫn tự accept/complete việc giao cho người khác; recipient cũ mất quyền xem khi có handoff thứ hai), **P1-4** `resolveEvidence` chấp nhận chính tin nhắn intake của khách làm bằng chứng `observed` cho hành động đã hoàn tất, và `evidence: 'absent'`/`'conflicted'` vẫn đóng được work item — cộng optimistic locking và telemetry wiring (T3-06/07). **Ranh giới rõ ràng:** theo `RFC-005` §9, PM-1 matrix đầy đủ và kết quả gán nhãn Q3/Q4 trên dữ liệu thật **không** chặn prototype thủ công/synthetic; chúng chặn **cổng pilot dữ liệu thật** (pre-pilot), không phải L2→L3.
- **Environment đã dùng để verify (không phải CI host):** Node 22, PostgreSQL 16 (docker `postgres:16-alpine`, host port **55432** — 5432 đang bị container `edura-postgres` của dự án khác chiếm, không đụng tới), `TEST_DATABASE_URL=postgres://north_star:north_star@localhost:55432/north_star`
- **CI:** `npm ci && npm run typecheck && npm test && npm run build` — **[~] KHÔNG có CI host.** Repo không có `.github/workflows/` (đã kiểm tra 2026-10-07), nên "CI PASS" chỉ là **local runs**; mọi con số dưới đây là local. Cần người thật thêm workflow + báo cáo kết quả tại SHA.
  - `npm run typecheck` → exit 0
  - `npm ci` → exit 0
  - `npm test` (KHÔNG set DB env) → exit 0, **228 pass / 10 skipped** (3 file integration skip theo thiết kế khi thiếu `TEST_DATABASE_URL`)
  - `npm test` (CÓ set DB env) → exit 0, **238 pass / 0 skipped**
  - `npm run test:integration` → exit 0, **10 pass** (`--no-file-parallelism`)
  - `npm run build` → exit 0
  - `npm run test:cov` **CÓ** DB (`--no-file-parallelism`) → exit 0, lines **91.43%** (branch 84.61%, funcs 93.42%). Bảo mật-thiết-yếu: `rbac.service` 100/100, `auth.service` 100 lines (93.33 branch), `pilot-loop.service` 98.79, `pilot.store` 100, `pilot-validation` 94.37, `envelope` 100, `migrator` 97.22. **Threshold giữ nguyên 80% lines — không nới.**
  - `npm run test:cov` **KHÔNG** DB → **exit 1**: `Coverage for lines (75.79%) does not meet global threshold (80%)` — `PgPilotStore` + các đường PG-only không được bao phủ khi thiếu DB. **Nghĩa là: một CI host chạy `npm run test:cov` mà không provision PostgreSQL sẽ ĐỎ**, đây là sự thật về harness chứ không phải lỗi code. Cần người quyết: thêm service PG trong CI hay tách threshold cho run không-DB — tôi không tự đổi threshold.
  - `scripts/pilot-smoke.sh` → exit 0, **PASS=53 FAIL=0** (14 bước + 7b/9b/13b; giết và khởi động lại tiến trình app, đọc lại từ PG)
  - `migrate up` / `down 1` / re-`up` / `down 4` → exit 0 trên dev DB, gồm cả đường **down của một DB đã apply bản 004 cũ** (không có bảng quarantine) — xem bullet 004 bên dưới
  - **Migration `004` — dữ liệu cũ được xử lý thế nào (bản sau review, `product/src/infra/postgres/migration-004.integration.spec.ts`, chạy trên DB PHỤ tạm tạo/rời trong cùng instance):**
    - **Điều kiện xóa: KHÔNG CÒN ĐIỀU KIỆN NÀO xóa raw evidence.** Bản cũ (`2d3ce38`) xóa `DELETE … WHERE workspace_id IS NULL`, tức mặc định "envelope không có lead tham chiếu = dữ liệu thử được phép bỏ". Điều đó **sai về nguyên tắc** — raw evidence chưa lead-hóa vẫn là bằng chứng (I-12: raw immutable; migration không có quyền huỷ). Bản hiện tại: hàng chưa rõ scope được **SAO NGUYÊN TRẠNG** (đủ cột, `raw_payload`, `raw_payload_hash`, `is_synthetic`) sang `commercial_envelope_quarantine` kèm `quarantine_reason` + `quarantined_at`, rồi mới rời bảng chính để `SET NOT NULL` đứng được; hàng nào **không có bản sao trong quarantine thì KHÔNG bị xóa** (DELETE có điều kiện `EXISTS (… quarantine …)`). Test chứng minh payload của hàng bị quarantine **giống hệt** sau round-trip `up → down`, và `down()` khôi nó về bảng chính thay vì `DROP TABLE` quarantine.
    - **Điều kiện xóa còn lại duy nhất là của người vận hành**, được ghi thành comment trong `004…down.sql` (`DELETE FROM commercial_envelope_quarantine; DROP TABLE …`) — chỉ sau khi đã nhìn thấy payload và chủ quyết. `is_synthetic = false` trong quarantine được báo riêng trong `RAISE NOTICE` ("not-marked-synthetic=N … need a human decision") để không lẫn dữ liệu thật với dữ liệu thử.
    - envelope có lead ở **hai** workspace cùng tham chiếu → `RAISE EXCEPTION … Refusing to guess`, migration **thất bại**, và vì Migrator chạy mỗi file trong một transaction nên **toàn bộ rolled back**: `information_schema` còn **0** cột `workspace_id`, **0** bảng quarantine, `schema_migrations` không ghi version, dữ liệu envelope nguyên vẹn.
    - envelope được lead **một** workspace tham chiếu → backfill `workspace_id='wsA'`, vẫn ở bảng chính; constraint đổi thành `commercial_envelope_workspace_connection_record_key`, cột `workspace_id` NOT NULL.
    - **Dev DB hiện tại:** 12 envelope, 12 đã có workspace, **0** hàng không có lead tham chiếu → quarantine rỗng; schema dev đã được `down 1`/`up` để tạo bảng quarantine và khớp bản migration mới (trước đó lệch vì dev DB đang apply bản 004 cũ).
- **Invariant coverage:** I-01…I-12 — **[x] mỗi cái ≥1 test** (xem matrix cuối file; `domain/invariants.spec.ts` = 25 tests). Ngoại lệ ghi rõ: I-06 và I-10 vẫn ở mức **placeholder/anti-corruption** theo `phases/PH2` (thay bằng meaningful check là việc đã ghi trong `state/progress.md` "Việc tiếp theo" #2), không phải đã chứng minh đầy đủ.
- **Canonical unchanged:** `docs/canonical/**` — **[x] Verified** (`git diff --stat b81edd9..HEAD -- docs/canonical/` = rỗng ở đợt P1-fix này)
- **Forbidden paths untouched:** — **[x] Verified** (`git diff --name-only b81edd9..HEAD` không có `src/bernstein/**`, `templates/**`, `.agents/skills/**`)
- **Open decisions respected:** — **[x] No silent resolution.** CE-1: vẫn chỉ là hypothesis ADR-001, mọi transition ngoài boundary → 422 `CE1_BOUNDARY`; CE-2: CommercialEvent vẫn inferred-only; PM-1: quyền mutation **thu hẹp** (owner-only) chứ không mở rộng, manager/admin correction từ chối 403 và audit chứng minh không có record của actor đó; MM-1/ID-1/ID-2/LG-1 không chạm. RFC-005 vẫn **Draft**, EXP-06 vẫn **proposed**, ADR-004 **Accepted** với quyền hạn framing/validation only.
- **Human Gate:** — **[ ] Not recorded.** Đợt này là code-fix theo review của user trên GitHub (`b81edd9`); user dừng lại để review trước khi làm tiếp (optimistic locking là vòng sau).
- **Issues found:** 5 P1 do user review phát hiện tại `b81edd9` — đã có một vòng sửa ban đầu (`2d3ce38..e93e82d`), **tuy nhiên kiểm định HTTP độc lập tại `1b72b61` (2026-10-27) xác nhận chỉ P1-3, P1-5 và migrator race là đã đóng triệt để; P1-1, P1-2, P1-4 vẫn còn cạnh hở tái hiện được qua HTTP** (chi tiết tái hiện tại `docs/reports/project-status-and-handover.md` §4.3):
  1. `2d3ce38` **P1-1 (mới đóng một phần — còn lỗ hổng dấu `:`):** Đã thêm `workspaceId` vào khoá chống trùng và tạo migration `004` (quarantine bản ghi thiếu scope thay vì xóa; từ chối đoán khi nhiều workspace cùng tham chiếu). **Cạnh còn mở tại `1b72b61`:** `idempotencyKey` trong `product/src/domain/envelope/envelope.ts:81` nối chuỗi bằng dấu `:` không tách cấu trúc (`${workspaceId}:${connection}:${externalRecordId}`), khiến `(review-tenant, b:inbox, msg-1)` và `(review-tenant:b, inbox, msg-1)` đụng cùng một khoá trên `InMemoryPilotStore`.
  2. `948851b` **P1-2 (mới đóng một phần — còn 3 cạnh quyền theo từng work item):** Đã chặn recipient chưa accept sửa hồ sơ. **Cạnh còn mở tại `1b72b61`:** (a) owner hiện tại (`A`) vẫn gọi được `salesAccept` và `completeWork` trên work item giao đích danh cho `B`; (b) khi có handoff thứ hai sang `C`, `C` accept được work item giao cho `B`; (c) `state.handoffRecipient` là biến đơn nên handoff thứ hai sang `C` ghi đè `B`, làm `B` mất quyền `GET` (`403`) dù work item của `B` còn mở.
  3. `406ca8e` **P1-3 (ĐÃ ĐÓNG):** complete trên item đã superseded trả 409 `WORK_SUPERSEDED` + `details.replacementId`; smoke đã sửa.
  4. `e62a0b2` **P1-4 (mới đóng phần cấu trúc — còn hở ngữ nghĩa bằng chứng hoàn tất):** Đã thêm boundary validation 400 `INPUT_INVALID`, kiểm tra pointer tồn tại trong storage cùng workspace, và sandbox `x-demo-workspace` thành `demo:<name>` khi `DEMO_WORKSPACES=true`. **Cạnh còn mở tại `1b72b61`:** (a) `resolveEvidence` (`pilot-loop.service.ts:158-164`) chấp nhận chính `state.sourceEnvelopeId` (tin nhắn khách hỏi thông tin ban đầu) làm bằng chứng `observed` rằng nhân viên đã hoàn tất hành động; (b) `completeWork` (`pilot-loop.service.ts:375-398`) vẫn cho phép `evidence: 'absent'` và `evidence: 'conflicted'` đóng work item sang `completed` rồi `advance` sang `Won`; (c) 3 file kiểm thử/smoke (`pilot-smoke.sh:152-153`, `pilot-loop.evidence.spec.ts:88-107`, `pilot-loop.integration.spec.ts:239-241`) đang viết kỳ vọng theo chính hành vi sai này.
  5. `a04f162` **P1-5 (ĐÃ ĐÓNG):** `InMemoryPilotStore.history()` đã lọc theo tập thực thể thuộc đúng lead đó; unknown lead → rỗng.
  - **Bonus (tìm thấy khi verify, ĐÃ ĐÓNG):** `e93e82d` migrator race — hai integration spec file boot song song trên cùng dev DB cùng `migrate up`; đã sửa bằng `pg_advisory_xact_lock` + re-check trong transaction; 3/3 run sạch.
  - Ghi chú trung thực: **không có E2E/contract test suite** (`vitest.config.e2e.ts` được tham chiếu trong `package.json` nhưng file không tồn tại; không có `test/*.e2e-spec.ts`); bằng chứng end-to-end hiện chỉ là `scripts/pilot-smoke.sh` + PG integration specs. Pancake contract tests thuộc PH4 (flag OFF, blocked Q-03/Q-04). **Test xanh không có nghĩa là product đã sẵn sàng pilot nhiều người**: ngoài 3 cạnh P1-1/P1-2/P1-4 còn mở nêu trên, còn thiếu credential model thật (PM-1), optimistic locking (nhiều người cùng sửa một version), Won/Lost open-action gate (outcome vẫn ghi được khi work item còn mở — PH5), telemetry/feedback wiring, và mọi bằng chứng về người dùng thật (EXP-06 mới tới mức synthetic preparation).

### Checkpoint (pushed)

| Mục | Giá trị |
|---|---|
| Remote | `origin/main` — checkpoint `b81edd9..0f1da07` (8 commit) đã push 2026-10-08; correction của migration 004 push tiếp sau đó (xem commit cuối bảng) |
| Bug-fix commits | `2d3ce38` P1-1 · `948851b` P1-2 · `406ca8e` P1-3 · `e62a0b2` P1-4 + demo workspace · `a04f162` P1-5 · `e93e82d` migrator race (self-found) |
| Docs commits | `00e2b2a` (3 drift) · `0f1da07` (coverage + 004 proof) |
| Correction sau review | `35c18b5` — migration 004 quarantine thay vì delete + integration spec chứng minh; `e04d555` sửa SHA tự tham chiếu. **Đã push lên `origin/main`.** |
| Tạm dừng theo chỉ đạo | optimistic locking (vòng sau khi bạn review checkpoint) |



---

### Gate Review Record (per LEAN_VALIDATION_PHASE.md)

| Gate | Date | Version | Participants | Observed Events | Missing Telemetry | Usability Blockers | Evidence (supporting/contradicting) | Limitations | Decision |
|------|------|---------|-------------|----------------|------------------|-------------------|-------------------------------------|-------------|----------|
| L0 | 2026-10-07 | `e93e82d` | assistant (dev-only smoke) — **chưa** có người dùng thật | Loop P0 chạy qua HTTP thật trên PG: intake → handoff A→B → accept → reschedule → complete → outcome Won, sống qua restart tiến trình app (53 assertions) | Telemetry/feedback chưa wire endpoint (T3-06/07); chưa có `releaseVersion` exposure trong luồng | Credential model chỉ là stub dev (`AUTH_DEV_UNSIGNED_TOKENS`); chưa có guard toàn cục | Supporting: smoke + 8 PG integration tests. Contradicting: 5 P1 từng bị chính smoke che giấu (`b81edd9` 31/31 encode bug) — bài học: assertion phải kiểm chiều đúng của hành vi | Single-tenant dev DB, synthetic data, 1 người thao tác (không phải user thật) | **Chưa đóng** — chờ user review đợt P1-fix |
| L1 | — | — | — | — | — | — | — | — | Not run |
| L2 | — (code đạt, chờ human review ADR-001 + sweep I-06/I-09) | `b81edd9`/PH2 | assistant + user review | Invariant sweep 25 tests; CE-1 boundary abort 422 | — | — | `state/progress.md` Gate L2 | I-06/I-09 còn placeholder | **Chờ human review** |
| L2→L3 | — | — | — | — | — | — | PG durability + atomic mutation/audit đã verify | PM-1, optimistic locking, telemetry wiring | **Chưa đóng** |
| L3 | — | — | — | — | — | — | — | — | Not run |
| L4/L5 | — | — | — | — | — | — | — | — | Not run |

---

### Invariant Coverage Matrix (per phase)

| Invariant | PH0 | PH1 | PH2 | PH3 | PH4 | PH5 | PH6 |
|-----------|-----|-----|-----|-----|-----|-----|-----|
| I-01 |  | ≥1 test | Customer/Lead separate IDs + `customerId` ≠ ownership (`invariants.spec` 1–2, `customer.spec`, `lead.spec`) | Lead ≠ Customer trên PG (`lead`/`customer` riêng bảng, `001_domain`) |  |  |  |
| I-02 |  | ≥1 test | three chain concepts never collapse (`invariants.spec` 47) + attribution default UNKNOWN (312) | `attribution` column giữ UNKNOWN_SENTINEL qua restart |  |  |  |
| I-03 |  | ≥1 test | CE draft/pending, không auto-execute (62) | inferred completion → 422 `INFERRED_CANNOT_CLOSE` (service + smoke) |  |  |  |
| I-04 |  | ≥1 test | CE requires evidenceRef/confidence+producer (79, 94) | P0 flow đi Interaction→work item→audit; CE-2 vẫn inferred-only |  |  |  |
| I-05 |  | ≥1 test | AuditStore no update/delete (112), correction appends (119, 149) | audit MỘT transaction với mutation (QA-35) + lead-scoped history (P1-5) |  |  |  |
| I-06 | deferred | deferred | ≥1 test: merge rejected w/o evidence — **placeholder, cần meaningful check** |  |  |  |  |
| I-07 |  | ≥1 test | Lead ID generated once (166), sameLead by ID (160) | `003_pilot_loop` không đổi PK; upsert theo id, id immutable |  |  |  |
| I-08 |  | ≥1 test | UNKNOWN never null/empty (175), valid from any state (181), 5 states (188) | `occurred_at TEXT DEFAULT 'unknown'` — không backfill (Q4), smoke assert `occurredAt=unknown` |  |  |  |
| I-09 |  | ≥1 test | cross-workspace invisible (198), lead-scoped visibility (205), reassignment revokes (215) | RBAC + owner-only mutation (P1-2), envelope workspace-scoped (P1-1), audit lead-scoped (P1-5), demo sandboxed (P1-4) |  |  |  |
| I-10 | deferred | deferred | ≥1 test: adapter anti-corruption |  |  |  |  |
| I-11 |  | ≥1 test | adapter tạo envelope, không quyết state/outcome (232); provider không collapse CE/Assertion (285) | Manual adapter vẫn boundary duy nhất cho pilot |  |  |  |
| I-12 |  | ≥1 test | raw payload preserved behind envelope (268), provenance carries rawEvidencePointer (317) | raw hash bất biến qua restart + **pointer phải resolve tới evidence thật, đúng workspace, đúng quan hệ** (P1-4); `004` refusal-to-guess bảo vệ scope |  |  |  |

> Cách đọc: ô PH2/PH3 trỏ **test cụ thể đã chạy**, không phải mô tả chung. Ô trống = chưa có bằng chứng ở phase đó. `invariants.spec` line refs theo file hiện tại (`product/src/domain/invariants.spec.ts`).
