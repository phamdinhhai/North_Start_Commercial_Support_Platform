# PH3 — Persistence & Auth

**Phase:** PH3 · **Gate trước:** L2 (domain verified) · **Gate sau:** L2→L3 (persistence durable)
**Trạng thái:** Draft — chưa bắt đầu
**Thời lượng:** 2–3 tuần

## Mục tiêu
- PostgreSQL durable pilot workspace (R-18, ADR-002).
- Forward migrations + tested rollback (change seam #5).
- Auth + RBAC: authenticate non-demo user, authorize by workspace + role + lead scope (I-09).
- Telemetry: ProductEvent tagged release version + feature flag (R-21, R-22).
- Structured feedback (R-23).

## Tasks
| ID | Task | R coverage | C coverage | Output |
|----|------|-----------|-----------|--------|
| T3-01 | PostgreSQL setup + connection pool | R-18 | C-03 | `src/infra/postgres/` |
| T3-02 | Lead/Handoff/CommercialEvent migration v1 | R-18 | C-03 | `migrations/001_domain.sql` |
| T3-03 | Auth middleware: JWT/workspace/session | R-02, R-03 | C-12 | `src/infra/auth/` + test |
| T3-04 | RBAC guard: lead-scoped access (I-09) | R-03 | C-12 | `src/infra/rbac/` + test |
| T3-05 | Workspace isolation: query scoped by workspace_id | R-01 | C-12 | integration test |
| T3-06 | ProductEvent telemetry (C-08) | R-21, R-22 | C-08 | `src/infra/telemetry/` + test |
| T3-07 | Structured feedback (R-23) | R-23 | C-08 | `src/modules/feedback/` + test |
| T3-08 | Migration rollback plan tested | R-18 | C-03 | rollback test |

## DoD
- [ ] PostgreSQL connection hoạt động; data preserved after restart
- [ ] Forward migration + rollback verified
- [ ] Auth middleware rejects unauthenticated non-demo requests
- [ ] RBAC: Sales cannot access leads outside assigned scope
- [ ] Workspace isolation: query scoped
- [ ] Telemetry events tagged release + flags
- [ ] `npm ci && npm run typecheck && npm test && npm run build` pass
