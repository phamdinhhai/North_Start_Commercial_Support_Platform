# Kế hoạch thực thi Lean Validation Product

**Owner:** Founder / Product / Engineering  
**Status:** Active plan  
**Effective:** 2026-09-10  
**Evidence basis:** Strategic decision to build-first; no primary customer evidence yet  
**Supersedes for current phase:** `PROJECT_PLAN_AI.md` and `project_plan.yaml` task sequencing

## Purpose

Build the smallest usable and instrumented product loop, expose it to real target-role users, and use scoped evidence to Continue / Narrow / Pivot / Stop. The previous master plan remains historical and long-range reference; incomplete task statuses must not block this plan.

## Constraints and defaults

- Controlled single-tenant pilot; not public SaaS.
- Vietnamese-first UI unless D-010 changes it.
- Manual/synthetic input is P0; Pancake read sync and AI are optional tracks.
- No real data before consent, credential authority, retention and access controls are explicit.
- Without an external tester by Gate L3, freeze feature expansion.
- Team/capacity and stack are unresolved blockers before code implementation.

## Workstreams and gates

### Stream 0 — Reset and readiness (2–3 working days)

- Establish phase/thesis/decision/open-question sources.
- Establish hypothesis/experiment/evidence registers and feedback playbook.
- Confirm team/capacity, data policy, tester owner, UI language and stack.
- Register initial risks and experiments.

**L0:** owner, working bet, scope, data policy and tester path explicit.

### Stream 1 — Product framing and prototype (3–5 days, overlaps recruitment)

- Story-map create/import → handoff → accept → action → follow-up → outcome.
- Define state transitions, error/unknown states and permission boundary.
- Create a high-fidelity responsive prototype with clearly synthetic data.
- Run task-based comprehension testing; fix blockers, do not infer demand.

**L1:** a person outside design work completes core tasks without solution coaching.

### Stream 2 — Instrumented foundation slice (5–8 days)

- Select stack only after capacity decision and inspect project scaffold.
- App shell, authentication/roles, persistence and migrations.
- Manual/synthetic adapter; lead, assignment, evidence/timeline and audit.
- Product-event and experiment-exposure contracts from day one.

**L2:** handoff through Sales action runs end-to-end and audit/events are inspectable.

### Stream 3 — Sales value loop (5–8 days)

- New/Today/Overdue/Closed queue.
- Contact outcome; next action create/complete/reopen/reschedule.
- Minimal outcome assertion with explicit unknown and correction history.
- Structured feedback tied to release/experiment.
- Export/delete and real-data readiness controls.

**L3:** a tester can process multiple leads over multiple days without AI/Pancake dependency.

### Stream 4 — AI assist and Pancake spike (4–7 days, parallel)

- AI structured drafts behind a feature flag with evidence, version and correction telemetry.
- Reverify current Pancake official endpoints/permissions and live-test allowed account.
- If feasible, add read-only idempotent adapter; otherwise retain manual path.
- Do not send messages or lock webhook schema without separate verification.

**L4:** optional capability earns default inclusion by reducing friction without trust/integrity regression.

### Stream 5 — External learning cycles (one-week cycles)

- Onboard one tester at a time with permitted data and registered experiment.
- Observe behavior; debrief without leading.
- Synthesize supporting and contradictory evidence weekly.
- Select exactly one next learning priority.

**L5:** external usage supports a scoped Continue / Narrow / Pivot / Stop decision.

## Recruitment track — starts immediately

- Build a pipeline of 5–10 candidates to reach 1–3 testers.
- Recruit people who understand a real workflow; do not require thesis agreement.
- Record one company as one case regardless of number of roles interviewed.
- Do not instantiate Case 001 until a real reachable company/workflow exists.

## Initial capability sequence

| Capability | Priority | Hypothesis/test | Prerequisite |
|---|---|---|---|
| Manual/synthetic input | P0 | Makes EXP-01–03 possible | L0 |
| Handoff/evidence/assignment | P0 | S1 / EXP-01 | State and provenance contract |
| Action/follow-up queue | P0 | S2 / EXP-02 | Handoff slice |
| Minimal outcome | P0 | S3 / EXP-03 | Audit/unknown semantics |
| Telemetry/feedback | P0 | All | Defined before UI events ship |
| Pancake read adapter | P1 | S6 / EXP-05 | Live feasibility and security |
| AI assist | P1 | S5 / EXP-04 | L3 + allowed/evaluable data |
| Manager exceptions | P1 | S4 | S2/S3 behavior exists |

## Verification commands and evidence

Stack-specific commands are added after selection. Minimum test families:

- Domain transition, authorization and provenance/audit unit tests.
- Database migration and correction-history tests.
- Manual adapter end-to-end test.
- Connector contract/live sandbox tests only when credentials are approved.
- Telemetry schema and synthetic-data exclusion tests.
- Token/PII redaction, export/delete and secret scanning.
- Responsive task-based browser verification with recording.

## Decision protocol

Each gate records version, participant/context, observed events, contradictory evidence, missing observability, limitations, owner and one of:

- **Continue:** behavior supports the bet within tested scope.
- **Narrow:** only part of the loop/job/user creates value.
- **Pivot:** another job/user/workflow explains evidence better.
- **Stop:** adoption signal absent or constraints/cost are unreasonable.
- **Inconclusive:** test cannot discriminate explanations; design a smaller test.

Never infer positive feedback → adoption, adoption → willingness to pay, usage → revenue, or endpoint existence → production access.
