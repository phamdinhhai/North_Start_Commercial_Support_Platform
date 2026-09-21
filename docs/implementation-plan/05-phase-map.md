# 05 — Phase Map (R→C→P)

**Phiên:** 2026-09-21
**Nguồn:** `03-requirements.md` (R-01…R-28), `04-architecture.md` (C-01…C-12), `OPEN_DECISIONS.md`, `LVP_PRODUCT_SPEC.md`

---

## 1. Tổng quan

| Phase | Tên | Mục tiêu chính | R coverage | C coverage | Gate |
|-------|-----|----------------|-----------|-----------|------|
| PH0 | Spike & Research | Live verify Pancake + anti-corruption envelope design | R-05, R-06, R-26, R-27 | C-05, C-11 | Pre-PH1 |
| PH1 | Walking Skeleton | `product/` bootstrap (Node 22/TS/NestJS/Fastify/Vitest), health + domain shell, in-memory repo | R-01…R-04, R-07 (shell) | C-01, C-04, C-12 | L1 |
| PH2 | Domain & Events | Entities + CommercialEvent provenance + UNKNOWN + audit | R-07…R-17, R-19, R-20 | C-01, C-02, C-06 | L2 |
| PH3 | Persistence & Queue | PostgreSQL + forward migrations + rollback + job abstraction | R-01, R-18, R-27 | C-03, C-09 | L2→L3 |
| PH4 | Pancake Sync (P1 flagged) | Pancake read sync, idempotent, checkpoint tách biệt, flag OFF | R-05, R-06, R-26, R-27 | C-05, C-09, C-11 | L3 |
| PH5 | LVP Slice Hardening | Queues, contact/next-action/outcome lifecycle, telemetry/feedback | R-08…R-15, R-21…R-23, R-28 | C-02, C-06, C-08 | L3→L4 |
| PH6 | Pilot & Learning | Isolated pilot workspace, synthetic segregation, release + experiment exposure | R-01, R-18, R-21, R-28 | C-03, C-06, C-07, C-08 | L4/L5 |

> **Thứ tự bắt buộc:** PH0 → PH1 → PH2 (cần Gate #A cho CE-1/CE-2 trước PH2 domain) → PH3 → PH5; PH4 có thể song song PH5 nhưng flagged OFF. PH6 sau PH5.

---

## 2. R→C→P trace (mỗi phase tiêu thụ R đã map tới C)

| R | C | Phase |
|---|---|-------|
| R-01, R-18 | C-03, C-12 | PH1 (isolation shell) → PH3 (durable) → PH6 (pilot) |
| R-02, R-03 | C-04, C-12 | PH1 → PH5 |
| R-04 | C-02, C-05 | PH1 → PH5 |
| R-05, R-06 | C-05, C-11 | PH0 → PH4 |
| R-07, R-10, R-11 | C-01 | PH2 |
| R-08, R-09, R-12, R-13 | C-01, C-02 | PH2 → PH5 |
| R-14 | C-01 | PH2 (BLOCKED-BY CE-1) |
| R-15, R-16, R-17 | C-01, C-06 | PH2 |
| R-19, R-21, R-23 | C-06, C-01, C-08 | PH2 → PH5 |
| R-20 | C-01, C-10 | PH2 (BLOCKED-BY CE-2) |
| R-22, R-24, R-25 | C-07, C-08 | PH5 → PH6 |
| R-26, R-27 | C-05, C-11, C-09 | PH0 → PH4 |
| R-28 | C-12 | PH6 |

## 3. BLOCKED-BY per phase

| Phase | BLOCKED-BY | Xử lý |
|-------|-----------|-------|
| PH0 | Q-03, Q-04 (Pancake live) | Spike + snapshot re-verify; không block PH1 |
| PH2 | CE-1 (transition), CE-2 (scope) | ADR-001 interim; **Human Gate #A** trước domain state machine |
| PH4 | Q-03, Q-04 | ADR-003; flag OFF; manual fallback |
| PH3, PH5, PH6 | — | Không block; tuân I-01…I-12 frozen |

## 4. Gates

- **Gate #A (trước PH2):** RFC Product+Architecture+Data cho CE-1/CE-2 → ADR-001 supersede nếu chốt.
- **L1 (sau PH1):** L1 Comprehension — smoke health + domain shell + workspace isolation shell.
- **L2 (sau PH2):** Vertical slice — lead lifecycle + audit + UNKNOWN visible.
- **L2→L3 (sau PH3):** Persistence durable + migrations verified.
- **L3 (sau PH5):** LVP loop hoàn chỉnh (handoff → action → outcome) manual.
- **L4/L5 (sau PH6):** Pilot exposure + telemetry/feedback — quyết định Continue/Narrow/Pivot (ROADMAP Gates).

## 5. DoD chung (mọi phase)

- Tests pass (`npm ci && npm run typecheck && npm test && npm run build` từ `product/` khi đã có product).
- Canonical unchanged (`docs/canonical/**` không đổi — verify script).
- Forbidden paths untouched (`src/bernstein/**`, `templates/**`, `.agents/**`).
- Trace R→C→P cập nhật trong phase file và `state/features.json`.
- Human Gate record trước khi merge/release.
