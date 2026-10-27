# PH0 — Spike & Research

**Phase:** PH0 · **Gate trước:** — · **Gate sau:** L0 (Ready)
**Trạng thái:** T0-01…T0-05 đã có tài liệu spike (`spike/`); T0-06 (Human Gate #A cho CE-1/CE-2) vẫn chờ người duyệt, và Q-03/Q-04 vẫn cần kiểm chứng live trước PH4
**Thời lượng:** 1–2 tuần
**BLOCKED-BY:** Q-03 (Pancake API accessible?), Q-04 (webhook semantics?) — chỉ cho R-26/R-27; manual/synthetic không block.

## Mục tiêu
- Xác định live feasibility Pancake read (P1) qua spike; giữ manual/synthetic là P0 fallback.
- Thiết kế versioned inbound envelope + anti-corruption mapping contract (C-05, C-11).
- Interim handling CE-1/CE-2 qua ADR-001; không tự resolve open decisions.

## In scope
- Q-03/Q-04 spike: Pancake API docs verify, auth model, paging/cursor, payload shape.
- Envelope + idempotency design (R-05, R-06).
- Synthetic/manual adapter spec (R-04, R-23).
- RFC draft cho CE-1 (state machine) + CE-2 (event scope) — **Human Gate #A**.
- Nếu Pancake API không accessible hoặc webhook không xác định: giữ flagged OFF, manual fallback.

## Out of scope (PH0)
- Code persistence, queue, queue abstraction.
- Pancake sending (deferred).
- AI autonomous mutation (I-03).

## Tasks
| ID | Task | Output | BLOCKED-BY |
|----|------|--------|------------|
| T0-01 | Q-03 spike: Pancake API docs + auth + paging/cursor verify | Spike notes + feasibility verdict | Q-03 |
| T0-02 | Q-04 spike: webhook semantics + payload delivery + security | Spike notes | Q-04 |
| T0-03 | Envelope schema v1 + idempotency key design | `COMMERCIAL_ENVELOPE_SCHEMA_v1.md` draft | — |
| T0-04 | RFC CE-1 + CE-2 draft | RFC draft (human review) | CE-1, CE-2 |
| T0-05 | Synthetic/manual adapter spec (P0) | Adapter contract spec | — |
| T0-06 | Human Gate #A: chốt spike verdict + RFC scope | Gate record | Human |

## Risks
| Risk | Mitigation |
|------|-----------|
| Pancake API không accessible | Flag OFF; manual/synthetic P0 fallback (I-11, I-12) |
| Webhook semantics undefined | Defer webhook; dùng polling spike; manual loop KHÔNG block (I-12) |
| Spike scope creep thành connector framework | Giới hạn PH0: chỉ Pancake read feasibility, không generic framework (seam #9) |

## DoD (Definition of Done)
- [x] T0-01 → T0-05 hoàn thành: spike notes + envelope draft + RFC draft + manual adapter spec
- [x] Envelope schema v1 drafted (`spike/COMMERCIAL_ENVELOPE_SCHEMA_v1.md`), chưa freeze
- [ ] T0-06 Human Gate #A recorded trong `08-verification.md` (hiện ADR-001 vẫn ở trạng thái interim hypothesis)
