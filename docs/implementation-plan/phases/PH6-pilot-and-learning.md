# PH6 — Pilot & Learning

**Phase:** PH6 · **Gate trước:** L4 (usable, instrumented, durable) · **Gate sau:** L5 (direction decision)
**Trạng thái:** Draft — chưa bắt đầu
**Thời lượng:** 2–3 tuần

## Mục tiêu
- Pilot workspace fully isolated: pilot vs demo segregation enforced end-to-end (R-01, R-19, I-08, I-12).
- Release version + experiment exposure wired into telemetry (R-22, C-07, C-08).
- Learning signals map theo `LVP_ACCEPTANCE_AND_LEARNING_CRITERIA.md` (handoff consumed? context trusted? queue supports action? minimal truth sustainable? manager value emerging?).
- Gate review template: version, participants, context, observed events, missing telemetry, blockers, evidence, limitations, Continue/Narrow/Pivot/Stop.
- Direction decision documented in `ROADMAP.md` loop gates.

## In scope
- Pilot workspace: fully persistent, fully scoped, isolated from demo.
- Synthetic/demo segregation enforced in queries + views + export.
- Experiment exposure: release version + feature flags per session logged.
- Learning signal instrumentation: handoff opens, context edits, action create/complete, outcome capture.
- Gate review template: standardized per `LEAN_VALIDATION_PHASE.md` gates L4/L5.
- Structured feedback collection wired to pilot.

## Out of scope
- Revenue attribution (MM-1 — UNKNOWN).
- AI autonomous mutation (I-03).
- Public SaaS, billing, enterprise multi-tenancy (deferred).

## Tasks
| ID | Task | R coverage | C coverage | Output |
|----|------|-----------|-----------|--------|
| T6-01 | Pilot workspace hardening + demo isolation end-to-end test | R-01, R-19 | C-12, C-06 | integration test |
| T6-02 | Experiment exposure logging (release + flag + session) | R-22 | C-07, C-08 | telemetry wiring |
| T6-03 | Learning signal instrumentation (handoff opens, context edits, action lifecycle) | R-21, R-28 | C-08, C-06 | telemetry events |
| T6-04 | Gate review template + first gate record | — | — | `docs/implementation-plan/state/gate-reviews/` |
| T6-05 | Continue/Narrow/Pivot/Stop decision document | — | — | `docs/implementation-plan/state/direction-decision.md` |

## Risks
| Risk | Mitigation |
|------|-----------|
| Pilot data leak to demo | End-to-end segregation test; audit trail |
| Learning signals insufficient | Gate review template exposes gaps explicitly |
| False positive on hypothesis | Honest unknown > precision (I-08); qualitative signals alongside product signals |

## DoD
- [ ] T6-01…T6-05 complete
- [ ] End-to-end segregation test pass
- [ ] Experiment exposure logged with release + flags
- [ ] Gate review template populated with first gate record
- [ ] Direction decision documented (Continue/Narrow/Pivot/Stop)
- [ ] Canonical + forbidden paths untouched
