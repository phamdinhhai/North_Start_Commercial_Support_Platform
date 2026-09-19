# Lean Validation Product Phase

**Owner:** Founder / Product Lead  
**Maturity:** Active decision  
**Evidence status:** Decision over hypotheses; no primary customer validation yet  
**Last updated:** 2026-09-10

## Current baseline

```text
Product vision candidate     Có
Problem hypotheses H0–H8     Có
Scenario giả định            Có
Case khách hàng thực tế      Chưa có
Primary customer evidence    Chưa đủ
Audited API knowledge base   Có snapshot; phải reverify trước implementation
```

The repository documents are multiple expressions of one brainstorming lineage. Repetition across documents is not independent evidence.

## Phase decision

Adopt a **build-first, learn-fast** strategy. Discovery and tester recruitment run in parallel and do not block the first build.

```text
Frame hypotheses → Build smallest usable loop → Instrument → Expose
→ Observe → Update evidence → Continue / Narrow / Pivot / Stop
```

Build-first does not mean feature-first. Every capability needs a hypothesis link, observable signal, decision owner and deletion/revisit path.

## Product vision candidate

A possible end-state is a continuity layer connecting acquisition, customer conversation, Marketing/Sales handoff, Sales action, outcome and learning without rebuilding Pancake or a full CRM.

`Revenue Continuity Platform`, `Commercial Event`, `CRM-lite`, `Channel Continuity`, `Acquisition Intelligence`, `Lost Revenue Detector` and revenue attribution remain solution/category hypotheses.

## Problem hypotheses

**H0 — Relationship Continuity:** In businesses using Pancake with separate Marketing and Sales responsibilities, handoff may transfer identity/contact but not enough context, channel, commitments, ownership or downstream outcome. This may create coordination cost, lead leakage or weak Marketing-to-Sales measurement.

H0 does not imply its children are true:

- **H1:** Context loss is materially painful.
- **H2:** Channel loss reduces contact success.
- **H3:** Follow-up leakage is frequent and costly.
- **H4:** Managers lack reliable handoff visibility.
- **H5:** Marketing lacks useful downstream quality feedback.
- **H6:** Current workarounds are insufficient.
- **H7:** Businesses will change some process to gain value/measurement.
- **H8:** A repeatable workflow exists across enough customers.

## First working product bet

> When receiving a lead, Sales can quickly understand what the customer needs, inspect original evidence and know the next action without relying on memory.

```text
Conversation input → Context handoff → Sales acceptance/action
→ Next action/follow-up → Minimal outcome assertion
```

Possible value layers, not conclusions:

- Context handoff may create immediate Sales utility.
- Follow-up may create repeat usage and operational value.
- Basic process visibility may create buyer/manager value.

## Phase boundaries

### Build now

- One usable pilot workspace with persistence.
- Manual/synthetic input so learning is not blocked by integration.
- Lead handoff, Sales queue, evidence, next action and minimal outcome.
- Audit/provenance, telemetry and structured feedback from the start.
- Pancake read-only feasibility spike in parallel.

### Do not build yet

- Public self-service SaaS, billing or enterprise breadth.
- Full CRM, generic inbox/task/workflow/BI products.
- Meta/TikTok acquisition connectors.
- Revenue attribution, revenue-lift claims or lost-revenue prediction.
- Pancake sending without verified need, permission and terms.
- Opaque autonomous AI mutations.

## Operating principles

1. A usable product can generate evidence; synthetic/demo behavior cannot validate demand.
2. Positive feedback is not repeated usage; repeated usage is not willingness to pay; usage is not revenue lift.
3. Unknown is a valid product/data state.
4. Product telemetry sees product behavior, not the entire commercial journey.
5. External events can be recorded, claimed, imported or inferred; provenance stays visible.
6. Historical decisions/evidence are superseded, never silently rewritten.
7. API capability is committed only after current contract, permission and live behavior are verified.
8. Preserve change seams without speculating into a generic platform.

## Cadence and gates

- Daily build blocker/scope review; per-release instrumentation check.
- Per tester: task observation and non-leading debrief.
- Weekly evidence synthesis with one next learning priority.

| Gate | Exit rule |
|---|---|
| L0 Ready | Owner, bet, data policy, scope and tester path explicit |
| L1 Comprehension | Outsider completes prototype tasks without solution coaching |
| L2 Vertical slice | Manual path works end-to-end; audit/events inspectable |
| L3 Usable over time | Tester handles multiple leads/days without AI/integration |
| L4 Optional leverage | AI/sync improves loop without reducing trust/integrity |
| L5 Direction | External evidence supports Continue/Narrow/Pivot/Stop |

## Phase exit

- One usable, instrumented core loop.
- Traceable product versions and experiment exposure.
- At least one external feedback cycle, or a documented recruitment blocker that stops expansion.
- Updated hypothesis/evidence registers.
- Explicit direction decision with limitations.
