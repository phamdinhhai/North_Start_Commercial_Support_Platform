# PH1 — Walking Skeleton

**Phase:** PH1 · **Gate trước:** PH0 + Gate #A (RFC CE-1/CE-2) · **Gate sau:** L1 Comprehension (engineering milestone)
**Trạng thái:** Done (code, 2026-09-22 — xem `state/progress.md`)
**Thời lượng:** 2–3 tuần
**BLOCKED-BY:** PH0 spike hoàn thành (manual/synthetic adapter spec)

## Mục tiêu
- Bootstrap `product/` monorepo: Node 22, TypeScript strict, NestJS Fastify, Vitest.
- Health endpoint hoạt động.
- Domain shell: Customer, Lead (stable ID), Handoff (không persistence, dùng in-memory).
- Manual/synthetic import adapter shell (P0, envelope v1).
- Workspace isolation shell (I-08, I-12 — pilot vs demo segregation).
- `npm ci && npm run typecheck && npm test && npm run build` pass.

## Out of scope
- Persistence (PostgreSQL) — chờ PH3.
- CommercialEvent semantics chi tiết — chờ PH2.
- Pancake read sync — chờ PH4.
- AI inference — chờ PH5.

## Tasks
| ID | Task | R coverage | C coverage | Output |
|----|------|-----------|-----------|--------|
| T1-01 | `product/package.json` (Node 22, TS 5.x, NestJS, Fastify, Vitest) | — | C-04 | package.json + tsconfig |
| T1-02 | NestJS shell + Fastify adapter | R-02 | C-04 | `src/main.ts`, `src/app.module.ts` |
| T1-03 | Health endpoint (`/health`) | — | C-04 | Health endpoint + test |
| T1-04 | Domain shell: Lead entity (stable ID immutable) | R-07 | C-01 | `src/domain/lead/lead.ts` + test |
| T1-05 | Domain shell: Handoff package (context + evidence ref) | R-11 | C-01 | `src/domain/handoff/handoff.ts` + test |
| T1-06 | Manual import adapter shell (envelope v1 draft) | R-04, R-05 | C-05, C-11 | `src/adapters/manual/manual-adapter.ts` + test |
| T1-07 | Workspace isolation shell (in-memory store scoped by workspace) | R-01 | C-12 | `src/infra/workspace/workspace-store.ts` + test |
| T1-08 | `npm ci && npm run typecheck && npm test && npm run build` pass | — | — | Green local test/build pipeline |

## Risks
| Risk | Mitigation |
|------|-----------|
| NestJS/Fastify boilerplate quá nhiều | Giữ minimal: chỉ health + shell; không premature abstraction |
| Domain shell quá phức tạp | Chỉ Lead + Handoff; không build state machine (CE-1 chưa chốt) |
| In-memory store không scale | Acceptable cho PH1; PostgreSQL trong PH3 |

## DoD
- [x] T1-01 → T1-08 hoàn thành
- [x] `npm ci && npm run typecheck && npm test && npm run build` all green
- [x] Health endpoint hoạt động (`GET /health → 200`)
- [x] Lead entity test: stable ID immutable
- [x] Manual adapter test: envelope created với required fields
- [x] Workspace isolation test: scoped query
- [x] Canonical unchanged: `docs/canonical/**` untouched
- [x] Forbidden paths untouched: `src/bernstein/**`, `templates/**`, `.agents/**`
