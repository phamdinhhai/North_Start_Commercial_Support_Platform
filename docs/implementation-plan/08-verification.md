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

- **Date:** 2026-10-07 · **SHA:** `e93e82d` (từ `b81edd9`)
- **Author:** Claude (assistant) — tự verified, **chưa** qua human review
- **Gate:** L2→L3 **CHƯA ĐÓNG** — còn: credential model + permission matrix (`OPEN: PM-1`), optimistic locking (vòng kế tiếp), telemetry/feedback chưa wire endpoint (T3-06/07), RFC-005 Q3/Q4 chưa có kết quả gán nhãn thật
- **Environment đã dùng để verify (không phải CI host):** Node 22, PostgreSQL 16 (docker `postgres:16-alpine`, host port **55432** — 5432 đang bị container `edura-postgres` của dự án khác chiếm, không đụng tới), `TEST_DATABASE_URL=postgres://north_star:north_star@localhost:55432/north_star`
- **CI:** `npm ci && npm run typecheck && npm test && npm run build` — **[~] KHÔNG có CI host.** Repo không có `.github/workflows/` (đã kiểm tra 2026-10-07), nên "CI PASS" chỉ là **local runs**; mọi con số dưới đây là local. Cần người thật thêm workflow + báo cáo kết quả tại SHA.
  - `npm run typecheck` → exit 0
  - `npm test` (KHÔNG set DB env) → exit 0, **223 pass / 8 skipped** (2 file integration skip theo thiết kế khi thiếu `TEST_DATABASE_URL`)
  - `npm test` (CÓ set DB env) → exit 0, **231 pass / 0 skipped**, chạy 3 lần liên tiếp sạch
  - `npm run test:integration` → exit 0, **8 pass** (`--no-file-parallelism`)
  - `npm run build` → exit 0
  - `scripts/pilot-smoke.sh` → exit 0, **PASS=53 FAIL=0** (14 bước + 13b; giết và khởi động lại tiến trình app, đọc lại từ PG)
  - `migrate up/down/re-up` → exit 0; `down 4` → `up` → schema về đúng 13 bảng, 4 version
- **Invariant coverage:** I-01…I-12 — **[x] mỗi cái ≥1 test** (xem matrix cuối file; `domain/invariants.spec.ts` = 25 tests). Ngoại lệ ghi rõ: I-06 và I-10 vẫn ở mức **placeholder/anti-corruption** theo `phases/PH2` (thay bằng meaningful check là việc đã ghi trong `state/progress.md` "Việc tiếp theo" #2), không phải đã chứng minh đầy đủ.
- **Canonical unchanged:** `docs/canonical/**` — **[x] Verified** (`git diff --stat b81edd9..HEAD -- docs/canonical/` = rỗng ở đợt P1-fix này)
- **Forbidden paths untouched:** — **[x] Verified** (`git diff --name-only b81edd9..HEAD` không có `src/bernstein/**`, `templates/**`, `.agents/skills/**`)
- **Open decisions respected:** — **[x] No silent resolution.** CE-1: vẫn chỉ là hypothesis ADR-001, mọi transition ngoài boundary → 422 `CE1_BOUNDARY`; CE-2: CommercialEvent vẫn inferred-only; PM-1: quyền mutation **thu hẹp** (owner-only) chứ không mở rộng, manager/admin correction từ chối 403 và audit chứng minh không có record của actor đó; MM-1/ID-1/ID-2/LG-1 không chạm. RFC-005 vẫn **Draft**, EXP-06 vẫn **proposed**, ADR-004 **Accepted** với quyền hạn framing/validation only.
- **Human Gate:** — **[ ] Not recorded.** Đợt này là code-fix theo review của user trên GitHub (`b81edd9`); user dừng lại để review trước khi làm tiếp (optimistic locking là vòng sau).
- **Issues found:** 5 P1 do user review phát hiện tại `b81edd9`, tất cả tái hiện được trong code và đã sửa — mỗi cái một commit có regression test:
  1. `2d3ce38` **P1-1** idempotency key thiếu workspace → envelope dùng xuyên tenant (cả in-memory và `UNIQUE`/`ON CONFLICT` của PG). Sửa + migration `004` (chỉ backfill tất định, **từ chối đoán** workspace cho bản ghi mơ hồ: `RAISE EXCEPTION`).
  2. `948851b` **P1-2** recipient chưa accept vẫn complete/reschedule/advance/ghi outcome → **tách view / accept / mutation**; mutation chỉ owner hiện tại, kiểm theo từng work item.
  3. `406ca8e` **P1-3** complete trên item đã superseded trả 200, replacement vẫn mở → **409 `WORK_SUPERSEDED` + `details.replacementId`**; smoke sửa (trước đó 31/31 assertions **encode chính lỗi này**).
  4. `e62a0b2` **P1-4** không validate input tại boundary (không có global ValidationPipe), `observed` nhận mọi `evidenceRef`, handoff ghi `rawPayloadHash:'pending'` bịa đặt → boundary validation 400 `INPUT_INVALID`; pointer phải **tồn tại trong storage durable + đúng workspace + đúng quan hệ với hồ sơ**; audit lưu raw hash. **Kèm demo workspace:** `x-demo-workspace` trước cho phép caller chỉ **mọi** workspace; nay opt-in (`DEMO_WORKSPACES=true`) và luôn sandbox thành `demo:<name>`.
  5. `a04f162` **P1-5** `InMemoryPilotStore.history()` lọc "workspace khớp VÀ entityId ≠ leadId" → rò toàn bộ trail của lead khác trong cùng tenant (2 lead/tenant là trường hợp bình thường) → lead-scoped membership; unknown lead → rỗng.
  - **Bonus (tìm thấy khi verify, không nằm trong danh sách user):** `e93e82d` migrator race — hai integration spec file boot song song trên cùng dev DB cùng `migrate up`; code cũ đọc danh sách pending **ngoài** transaction nên cả hai cùng DDL → tái hiện 3/4 lỗi `duplicate key ... pg_type_typname_nsp_index` trên PG 16 thật. Đã sửa bằng `pg_advisory_xact_lock` + re-check trong transaction; **đây là nguyên nhân thất bại không ổn định (flaky) của `npm test` khi có DB env** — giờ 3/3 run sạch.
  - Ghi chú trung thực: **không có E2E/contract test suite** (`vitest.config.e2e.ts` được tham chiếu trong `package.json` nhưng file không tồn tại; không có `test/*.e2e-spec.ts`); bằng chứng end-to-end hiện chỉ là `scripts/pilot-smoke.sh` + PG integration specs. Pancake contract tests thuộc PH4 (flag OFF, blocked Q-03/Q-04).

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
