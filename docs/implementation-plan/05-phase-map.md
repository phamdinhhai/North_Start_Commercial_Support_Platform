# 05 — Phase Map (R→C→P)

**Phiên:** 2026-10-27 (cập nhật từ 2026-10-02)
**Nguồn:** `03-requirements.md` (R-01…R-28 active + R-29…R-41 deferred §10), `04-architecture.md` (C-01…C-12; C-13/C-14 dự kiến cho deferred), `OPEN_DECISIONS.md` (CE-1/CE-2/PM-1/MM-1/ID-1/ID-2/LG-1), `discovery/2026-10-01-qa.md` (QA-01…59), `discovery/2026-10-01-specification-draft.md`, `SERVICE_MODEL.md`
**Trạng thái code:** PH1+PH2 done, PH3 đang build (PostgreSQL migrations 001–004, 228 automated tests + 10 PostgreSQL integration tests, smoke 53/53 assertions) — xem `state/progress.md`, `state/features.json`, `docs/reports/project-status-and-handover.md`
**Problem framing:** `docs/Dinh_nghia_bai_toan_V2.md` là framing/validation hypotheses, chưa freeze; trace và `VH1–VH8` ở `discovery/v2-validation-and-traceability.md` (ADR-004 **Accepted** 2026-10-07 — quyền hạn: framing/validation only, không sửa canonical; RFC-005 vẫn **Draft**).

---

## 1. Tổng quan

| Phase | Tên | Mục tiêu chính | R coverage | C coverage | Gate | Trạng thái |
|-------|-----|----------------|-----------|-----------|------|-----------|
| PH0 | Spike & Research | Live verify Pancake + anti-corruption envelope design | R-05, R-06, R-26, R-27 | C-05, C-11 | Pre-PH1 | Spike docs có, cần re-verify live trước PH4 |
| PH1 | Walking Skeleton | `product/` bootstrap (Node 22/TS/NestJS/Fastify/Vitest), health + domain shell, in-memory repo | R-01…R-04, R-07 (shell) | C-01, C-04, C-12 | L1 | **Done** (code) |
| PH2 | Domain & Events | Entities + CommercialEvent provenance + UNKNOWN + audit | R-07…R-17, R-19, R-20 | C-01, C-02, C-06 | L2 | **Done** (code, sweep I-06/I-09 đã fix) |
| PH3 | Persistence & Auth | PostgreSQL durable + migrations forward/back + auth/RBAC + workspace isolation DB + telemetry/feedback | R-01, R-02, R-03, R-18, R-21, R-22, R-23 | C-03, C-04, C-06, C-07, C-08, C-12 | L2→L3 | Đang code — P0 slice verified trên PostgreSQL 16 thật (migrations 001–004, 228 tests + 10 PG integration = 238 total, smoke 53/53 qua restart); 3 P1 edge cases (P1-1 colon delimiter, P1-2 per-item recipient check, P1-4 completion evidence semantics) + optimistic locking + telemetry endpoint wiring còn mở |
| PH4 | Pancake Sync (P1 flagged) | Pancake read sync, idempotent QA-10, checkpoint tách biệt, flag OFF | R-05, R-06, R-26, R-27 | C-05, C-09, C-11 | L3 | Planned chi tiết (có thể // PH5) |
| PH5 | LVP Slice Hardening | Queues, next-action/outcome (Lost QA-57, allocation QA-59), contact/trial, Data Health, CSV/file, error contract | R-04, R-08, R-12, R-13, R-15, R-16, R-23, R-24, R-25 | C-01, C-02, C-03, C-05, C-06, C-08, C-11 | L3→L4 | Planned chi tiết |
| PH6 | Pilot & Learning | Isolated pilot workspace (QA-58), synthetic segregation, release + experiment exposure, gate review + direction | R-01, R-18, R-21, R-22, R-23, R-28 | C-03, C-06, C-07, C-08, C-12 | L4/L5 | Planned chi tiết |
| PH7+ | Productization (deferred) | Control plane, provisioning, licensing, installer, backup/restore, ops telemetry — F-025…F-037 | R-29…R-41 (proposed) | C-13, C-14 (dự kiến) + C-03/C-06/C-08/C-12 | Human gate + legal | **Deferred** — chỉ sau gate A/B + license + legal |

> **Thứ tự bắt buộc:** PH0 → PH1 → PH2 (Gate #A cho CE-1/CE-2) → PH3 → PH5; PH4 có thể song song PH5 nhưng flagged OFF (sau T3-02). PH6 sau PH5. PH7+ chỉ sau human gate productization.
> **Ranh giới:** R-29…R-41 không tự mở rộng PH3. PH3 đã duyệt vẫn là persistence/auth/RBAC/telemetry cho app/data plane.

---

## 2. R→C→P trace (mỗi phase tiêu thụ R đã map tới C)

| R | C | Phase |
|---|---|-------|
| R-01, R-18 | C-03, C-12 | PH1 (isolation shell) → PH3 (durable) → PH5 (export/delete) → PH6 (pilot) |
| R-02, R-03 | C-04, C-12 | PH1 (shell) → PH3 (auth/RBAC) |
| R-04 | C-02, C-05, C-11 | PH1 (manual) → PH5 (CSV T5-07) |
| R-05, R-06 | C-05, C-11 | PH0 → PH4 (QA-10 idempotency) |
| R-07, R-10, R-11 | C-01, C-03, C-06 | PH2 |
| R-08, R-09, R-12, R-13 | C-01, C-02, C-06 | PH2 → PH5 (queues T5-01, next-action T5-02, contact T5-03) |
| R-14 | C-01, C-06 | PH2 (BLOCKED-BY CE-1, interim hypothesis) → PH5 (outcome T5-04, CE-1 seam) |
| R-15, R-16, R-17 | C-01, C-06, C-11 | PH2 → PH5 (T5-04 outcome + T5-08 evidence) |
| R-19, R-21, R-23 | C-06, C-01, C-08 | PH2 → PH3 (telemetry T3-06) → PH5 (T5-06 governance, T5-09 errors) → PH6 |
| R-20 | C-01, C-10 | PH2 (BLOCKED-BY CE-2, draft-only) → PH5 (T5-04) |
| R-22, R-24, R-25 | C-07, C-08 | PH3 (T3-06) → PH5 (T5-05 Data Health, T5-06) → PH6 (T6-02 exposure, T6-03 signals) |
| R-26, R-27 | C-05, C-11, C-09 | PH0 → PH4 |
| R-28 | C-12, C-06 | PH1 (synthetic label) → PH6 (T6-01 segregation E2E) |
| R-29…R-41 | C-13, C-14 (dự kiến) + C-03/C-06/C-08/C-12 | **PH7+ deferred** — cần C-13/C-14 mới, human gate + legal trước khi promote |

## 3. BLOCKED-BY per phase

| Phase | BLOCKED-BY | Xử lý |
|-------|-----------|-------|
| PH0 | Q-03, Q-04 (Pancake live) | Spike + snapshot re-verify (T4-00); không block PH1 |
| PH2 | CE-1 (transition), CE-2 (scope) | ADR-001 interim hypothesis; **Human Gate #A** trước khi freeze state machine |
| PH3 | PM-1 (permission matrix chi tiết) | Chỉ enforce frozen boundary I-09 + deny-by-default; chi tiết PM-1 chờ RFC (QA-30/32/58) |
| PH4 | Q-03, Q-04 | ADR-003; flag OFF; manual fallback (QA-07, I-11) |
| PH5 | CE-1 (outcome/state) | Giữ `// OPEN: CE-1 — see ADR-001` interim; Lost QA-57 + allocation QA-59 là proposal cần RFC nếu chạm transition |
| PH3, PH5, PH6 | MM-1, ID-1, ID-2, LG-1 | Giữ boundary: attribution UNKNOWN, no auto-merge, no CRM mapping, North Star vs LVP tách lớp |
| PH7+ | PM-1, LG-1 + legal | Control plane/licensing/installer/backup chỉ sau gate A/B + license strategy + legal (QA-45/46) |

## 4. Gates

> **Phân biệt hai trục Gate:**
> - **Learning Loops (`L0…L5`)** định nghĩa trong `docs/research/pancake-revenue-platform-documentation/00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` (bảng "Cadence and gates"): `L0 Ready`, `L1 Comprehension`, `L2 Vertical slice`, `L3 Usable over time`, `L4 Optional leverage`, `L5 Direction` — đo bằng bằng chứng người dùng/tình huống thực.
> - **Engineering Phase Milestones** bên dưới: đánh dấu độ hoàn thiện kỹ thuật của từng phase (`PH1 → L1`, `PH2 → L2`, `PH3 → L2→L3`, `PH5 → L3`, `PH6 → L4/L5`). Việc code đạt milestone kỹ thuật **không** tự đóng Learning Loop tương ứng nếu chưa có bằng chứng người dùng theo `LEAN_VALIDATION_PHASE.md`.

- **Gate #A (trước PH2):** RFC Product+Architecture+Data cho CE-1/CE-2 → ADR-001 supersede nếu chốt. (Đã fix citations 51f9732; CE-1/CE-2 vẫn interim)
- **L1 (sau PH1):** L1 Comprehension — smoke health + domain shell + workspace isolation shell. **Đạt (code); Learning Loop L1 với người dùng ngoài chưa chạy.**
- **L2 (sau PH2):** Vertical slice — lead lifecycle + audit + UNKNOWN visible. **Code đạt, chờ human review ADR-001.**
- **Gate trước PH3:** persistence + migration review (human gate).
- **Gate trước PH4:** Pancake spike verdict Q-03/Q-04 (T4-00).
- **L2→L3 (sau PH3):** Persistence durable + migrations verified + auth/RBAC scoped + 3 P1 edge cases (P1-1/P1-2/P1-4) & optimistic locking closed. *(Lưu ý: full PM-1 matrix thuộc pre-pilot real-data gate và nhãn Q3/Q4 thật không chặn prototype thủ công theo `RFC-005:90`.)*
- **L3 (sau PH5):** LVP loop hoàn chỉnh (handoff → action → outcome + queues/health) manual.
- **L4/L5 (sau PH6):** Pilot exposure + telemetry/feedback — quyết định Continue/Narrow/Pivot (ROADMAP Gates; QA-55 synthetic L0).

## 5. DoD chung (mọi phase)

- Tests pass (`npm --prefix product ci && npm run typecheck && npm test && npm run build` từ `product/` khi đã có product).
- Coverage ≥80% line, 100% security-critical (auth, RBAC, redaction, secret handling).
- Canonical unchanged (`docs/canonical/**` không đổi — verify script).
- Forbidden paths untouched (`src/bernstein/**`, `templates/**`, `.agents/**`).
- Trace R→C→P cập nhật trong phase file và `state/features.json` + `state/progress.md`.
- Human Gate record trước khi merge/release.
- Không tự resolve CE-1/CE-2/PM-1/MM-1/ID-1/ID-2/LG-1; không tự phát token/login; không tự mở rộng PH3 bằng R-29…R-41.

## 6. Liên kết

- Phase chi tiết: `phases/PH3-persistence-and-auth.md`, `PH4-pancake-sync.md`, `PH5-lvp-slice-hardening.md`, `PH6-pilot-and-learning.md`
- Tổng quan kế hoạch & kiểm chứng: `00-README.md`, `08-verification.md`, `docs/reports/project-status-and-handover.md`
- QA/spec: `discovery/2026-10-01-qa.md` (QA-01…59), `discovery/2026-10-01-specification-draft.md` (J/BR/AC), `north-star/SERVICE_MODEL.md`
