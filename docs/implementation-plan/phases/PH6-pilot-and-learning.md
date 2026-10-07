# PH6 — Pilot & Learning

**Phase:** PH6 · **Gate trước:** L4 (usable, instrumented, durable — PH5 done) · **Gate sau:** L5 (direction decision)
**Trạng thái:** Planned chi tiết — chưa bắt đầu code
**Thời lượng:** 2–3 tuần
**Phạm vi:** R-01, R-18, R-21, R-22, R-23, R-28 · C-03, C-06, C-07, C-08, C-12

## Mục tiêu

- Pilot workspace fully isolated: pilot vs demo segregation end-to-end (QA-58: 1 customer → 1 deployment → 1 workspace, branch/team bên trong), Manager không mặc định workspace-wide (PM-1).
- Release version + experiment exposure wired (R-22, C-07, C-08).
- Learning signals theo `LVP_ACCEPTANCE_AND_LEARNING_CRITERIA.md` + QA-55 (external user completes synthetic L0 không facilitator blocking).
- Gate review + direction decision Continue/Narrow/Pivot/Stop.

## In scope

- Pilot workspace: fully persistent, fully scoped, isolated from demo (R-01, R-28, I-12, I-08).
- Synthetic/demo segregation enforced in queries + views + export (QA-58, C-12).
- Experiment exposure: release version + feature flags per session logged (R-22, C-07/C-08).
- Learning signal instrumentation: handoff opens, context edits, action create/complete, outcome capture (R-21, C-08).
- Gate review template + direction decision (L4/L5).

## Out of scope

- Revenue attribution (MM-1 — UNKNOWN).
- AI autonomous mutation (I-03).
- Public SaaS, billing, enterprise multi-tenancy (deferred — R-29…R-41).
- Ops SLA cam kết (RPO/RTO) trước khi drill đạt — chỉ target.

## Tasks

| ID | Task | R | C | AC / Output | Lưu ý |
|---|---|---|---|---|---|
| T6-01 | Pilot workspace hardening + demo isolation E2E test | R-01, R-28 | C-12, C-06 | E2E segregation test — pilot không lẫn demo/synthetic, scoped queries + export | QA-58: 1 customer→1 deployment→1 workspace; PM-1: Manager branch/team scoped |
| T6-02 | Experiment exposure logging (release + flag + session) | R-22 | C-07, C-08 | telemetry wiring — release version + flag per session | — |
| T6-03 | Learning signal instrumentation (handoff opens, context edits, action lifecycle) — external user completes synthetic L0 không facilitator blocking, không critical error (QA-55) | R-21, R-23 | C-08, C-06 | telemetry events + gate checklist | Qualitative + product signals; không suy ra PMF khi chưa baseline/exposure |
| T6-04 | Gate review template + first gate record (participants, context, events, missing telemetry, blockers, limitations) | — | — | `docs/implementation-plan/state/gate-reviews/` | Theo `LEAN_VALIDATION_PHASE.md` gates L4/L5 |
| T6-05 | Direction decision document (Continue/Narrow/Pivot/Stop) | — | — | `docs/implementation-plan/state/direction-decision.md` | Documented trong `ROADMAP.md` loop gates |
| T6-06 | Ops targets (chưa là SLA tới khi drill đạt): load 5–20 users/≤10 concurrent/10k Leads/1k interactions/day (QA-51), p95≤1s API + main screen ≤3s (QA-52), managed RPO≤15m/RTO≤1h 24/7 (QA-53) — ghi là target + drill plan | — | C-03, C-08 | `docs/implementation-plan/state/perf-targets.md` + restore drill runbook | Daily backup không đủ cho RPO≤15m — cần WAL/point-in-time; note `Gate: 24/7 on-call + drill đạt mới thành SLA` |

## DoD

- [ ] T6-01…T6-06 complete
- [ ] End-to-end segregation test pass
- [ ] Experiment exposure logged với release + flags
- [ ] Synthetic L0 external tester completes không blocking (QA-55)
- [ ] Gate review template + first gate record + direction decision documented (Continue/Narrow/Pivot/Stop)
- [ ] Canonical + forbidden paths untouched

## Rủi ro

| Rủi ro | Mitigation |
|---|---|
| Pilot data leak to demo | E2E segregation test; audit trail (I-12) |
| Learning signals insufficient | Gate review template exposes gaps explicitly |
| False positive on hypothesis | Honest unknown > precision (I-08); qualitative signals alongside product signals |
| Ops targets nhầm thành SLA | Ghi rõ target + drill plan; chỉ thành SLA sau drill đạt + on-call |

## Liên kết

- Plan chi tiết: `C:\Users\admin\.claude\plans\shimmering-whistling-cupcake.md`
- QA: QA-05, QA-28, QA-51…55, QA-58 · Invariants: I-08, I-12 · Open: LG-1, PM-1
