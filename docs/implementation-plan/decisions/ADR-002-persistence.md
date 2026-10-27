# ADR-002 — Persistence Strategy (BOOT-001 vs LVP)

**Ngày:** 2026-09-21
**Trạng thái:** Accepted — PH3 đã build và kiểm chứng trên PostgreSQL 16 thật (migrations 001–004; `product/src/infra/postgres/`; `state/progress.md`)
**Liên quan:** `03-requirements.md` R-01/R-18; `04-architecture.md` C-03; BOOT-001; `ARCHITECTURE_CONSTITUTION.md` §2 seam 5

## Context

- **A-01 (updated):** BOOT-001 deferred persistence **chỉ trong phạm vi story bootstrap**. LVP ("usable pilot workspace with persistence" — `LEAN_VALIDATION_PHASE.md` Build now) yêu cầu durable persistence trước Gate L2/L3.
- Risk: nếu nhầm "deferred BOOT" = "deferred LVP" sẽ làm LVP không có durable state.

## Decision

1. **PH1 (Walking Skeleton):** In-memory repository cho domain shell; health + domain placeholder; `npm ci/typecheck/test/build` pass. **No DB, no migrations** — tuân BOOT-001 non-goals.
2. **PH2 (Domain & Events) → PH3 (Persistence):** Giới thiệu **PostgreSQL** + forward migrations + tested rollback plan (change seam #5 `EVOLUTION_ARCHITECTURE.md`). Repo pattern giữ domain không import ORM. Release ID + migration version recorded với experiment exposure.
3. **Guard:** Mọi PR chạm persistence phải có migration file + rollback verified. `state/progress.md` track PH1 → PH3 dependency.

## Consequences

- PH1 có thể demo L0/L1 mà không cần DB.
- Gate L2/L3 không mở nếu durability chưa verify (restart → data preserved).

## Revisit trigger

DB choice hoặc migration strategy thay đổi khi có evidence mới.

## Related

- `03-requirements.md` R-01, R-18
- `04-architecture.md` C-03
- `05-phase-map.md` PH1 → PH2 → PH3
