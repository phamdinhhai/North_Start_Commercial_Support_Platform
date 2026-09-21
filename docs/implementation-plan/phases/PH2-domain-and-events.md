# PH2 — Domain & Events

**Phase:** PH2 · **Gate trước:** L1 + PH1 green · **Gate sau:** L2 Comprehension
**Trạng thái:** Draft — chưa bắt đầu
**Thời lượng:** 2–3 tuần
**BLOCKED-BY (domain):** **CE-1** (state lifecycle — BLOCKED-BY CE-1), **CE-2** (event scope — BLOCKED-BY CE-2); interim qua **ADR-001** (hypothesis states, decision NOT resolved)
**GATES:** Human Gate #B trước khi die Domain state machine mapping RFC — xem `00-README.md` GATES; `06-test-strategy.md` §Human gates

## Mục tiêu
- Domain core đầy đủ: Customer ≠ Lead (I-01), stable Lead ID (I-07), Handoff package (R-11), CommercialEvent provenance envelope (R-16), UNKNOWN states (R-17)
- Mọi mutation đi qua CommercialEvent pipeline: Interaction → AI → CE → Evidence → Policy → Action (I-03, I-04)
- Audit: append-only, reversible, actor + timestamp (I-05, R-19, R-20)

## In scope
- Domain entities + commercial event model (framework-independent) — C-01
- CommercialEvent envelope v1 (inferred-only interim theo ADR-001/CE-2) — C-06, R-16
- Lead state hypothesis (interim theo ADR-001/CE-1) — R-14, R-33
- Audit store (append-only, in-memory) — C-06, R-19, R-20
- UNKNOWN handling (I-08, R-17, R-23)
- Unit tests mỗi invariant (I-01…I-12) — tối thiểu 1 test/invariant

## Out of scope (PH2)
- Persistence (PostgreSQL) — PH3 (R-18, BLOCKED-BY ADR-002)
- Pancake/Pancake sync — PH4 (R-26, BLOCKED-BY Q-03/Q-04)
- AI inference — PH5/P1 flag (R-20, R-21, BLOCKED-BY CE-2/Q-05)

## Tasks
| ID | Task | R coverage | C coverage | Output |
|----|------|-----------|-----------|--------|
| T2-01 | Lead entity: stable ID immutable + state (hypothesis) + transitions append-audited | R-07, R-08, R-14 | C-01, C-06 | `lead.entity.ts` + test |
| T2-02 | Customer ≠ Lead: tách entity, riêng identity (I-01), lead không collapse thành customer | R-07 | C-01 | `customer.entity.ts` + test (I-01) |
| T2-03 | Handoff entity: context package + evidence ref + audit | R-11, R-12 | C-01 | `handoff.entity.ts` + test |
| T2-04 | CommercialEvent model: envelope v1 (inferred-only, confidence, evidence, provenance) | R-16, R-05, R-25 | C-02, C-06 | `commercial-event.ts` + schema test |
| T2-05 | UNKNOWN state: `unknown/not_applicable/not_observed/...` là valid states, không null/empty | R-17, R-23, R-25 | C-01 | `unknown-states.ts` + test |
| T2-06 | Outcome: Won/Lost/Unknown + correction append-audited (không overwrite) | R-15, R-20 | C-01, C-06 | `outcome.ts` + test |
| T2-07 | Lead state machine (hypothesis): New→Accepted→Contacting→Follow-up→Won/Lost/Unknown + reversible + audit | R-14, R-08 | C-01, C-06 | `lead-state.ts` + test (BLOCKED-BY CE-1) |
| T2-08 | Audit/Provenance store (in-memory, append-only) — C-06 | R-19, R-20 | C-06 | `audit-store.ts` + test |
| T2-09 | Invariant unit test sweep: mỗi I-01…I-12 ≥1 test | all | C-01, C-06 | `invariants.test.ts` |

## Risks
| Risk | Mitigation |
|------|-----------|
| CE-1/CE-2 open decisions block domain | Interim ADR-001: hypothesis states, không freeze; chờ RFC + Human Gate #B |
| State machine over-engineering | Giữ hypothesis state, không generic state machine (AD-003), chỉ interim enum |
| UNKNOWN handling sai | UNKNOWN sempre valid; test I-08/I-12 explicit |

## DoD
- [ ] T2-01…T2-09 hoàn thành
- [ ] `npm run typecheck && npm test && npm run build` pass
- [ ] Invariant sweep: mỗi I-01…I-12 có ≥1 automated test
- [ ] CommercialEvent envelope schema validated (test)
- [ ] Canonical unchanged (`docs/canonical/**` untouched)
- [ ] Forbidden paths untouched (`src/bernstein/`, `templates/`, `.agents/`)
