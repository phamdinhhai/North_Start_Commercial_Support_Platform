# Experiment Register

**Owner:** Product / Research  
**Maturity:** Living  
**Evidence status:** Experiments are tests, not evidence until executed  
**Last updated:** 2026-09-10

## Rules

- Pre-register before exposing a build.
- A threshold is a **decision rule for this test**, not an industry benchmark.
- Name product version, exposure, participant/context and sample limitations.
- Record behavior separately from comments and inferred consequences.
- One experiment should resolve one primary uncertainty.

## Planned experiments

| ID | Primary hypothesis | Exposure | Expected behavior | Instrumentation | Decision rule | Status |
|---|---|---|---|---|---|---|
| EXP-00 | Usability prerequisite | Clickable/core-flow prototype | Complete create/assign/accept/action/outcome tasks | Task observation | Fix blockers; does not validate demand | planned |
| EXP-01 | S1 context handoff | Instrumented manual-input LVP | Sales opens context/evidence before first action | `lead_opened`, `evidence_viewed`, edits | Continue only if use is voluntary and comprehension friction falls | planned |
| EXP-02 | S2 follow-up queue | Multi-day queue | Create, revisit and complete real next actions | action lifecycle events | Continue only with repeated unprompted use in scope | planned |
| EXP-03 | S3 outcome capture | Minimal outcome control | Record outcome/unknown after work | outcome events + debrief | Continue if burden is acceptable and assertions are interpretable | planned |
| EXP-04 | S5 AI assist | Feature-flagged A/B or sequential exposure | Accept/edit/reject evidence-linked draft | inference and correction events | Default-on only if useful and trusted | blocked by L3/data |
| EXP-05 | S6 Pancake sync | Read-only verified adapter | Less input work without data loss | sync/error/completeness metrics | Continue only if live contract and operational value pass | feasibility |

## Result entry format

- **Run/version/date:**
- **Participants and context:**
- **Observed behavior:**
- **Self-report:**
- **Operational consequence:**
- **Supporting evidence IDs:**
- **Contradicting evidence IDs:**
- **Limitations/alternatives:**
- **Decision:** Continue / Narrow / Pivot / Stop / Inconclusive
- **Owner and follow-up:**
