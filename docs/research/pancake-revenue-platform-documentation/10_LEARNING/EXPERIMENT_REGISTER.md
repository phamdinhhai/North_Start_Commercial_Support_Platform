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
| EXP-06 | Q3/Q4 semantic usability (education B2C candidate) | Narrow manual P0 walkthrough; synthetic scenario set first, optional one-counselor prototype trial when reachable and approved | Counselor can review context/evidence, create/update a follow-up, distinguish their action from an external expectation, record completion evidence and minimal outcome; AI off path remains usable | Task completion/hesitations/corrections; Q3 independent label disagreements; Q4 time/provenance mapping ambiguities; voluntary repeat-use only if a real participant trial occurs | Fix confusing/high-consequence semantics before adding automation; synthetic results test the guide/prototype only. One real user can expose usability issues, not establish prevalence, adoption, willingness to pay, or commercial value. | proposed — synthetic preparation; organization/reviewer/data permission TBD |

## EXP-06 — Q3/Q4 semantic usability (pre-registration draft)

**Owner:** Product/Research TBD; domain review by Data/Architecture TBD
**Status:** proposed — draft only; not exposed to a real participant
**Product version/exposure:** Prototype version TBD; manual entry; AI disabled for core path. Pancake connection is not a prerequisite and remains separately feasibility-gated.
**Dates:** TBD

### Pre-registration

- **Primary uncertainty:** Can a narrow education B2C P0 flow represent handoff and follow-up in a way that does not confuse speaker with responsible party, internal work with external expectation, or an assertion with evidence?
- **Secondary mapping question:** Can reviewers apply the V2 evaluation labels and canonical provenance/time fields consistently without inventing event times or treating message observation as proof of the described external action?
- **Candidate workflow:** Consult on learning needs → hand off to responsible counselor → send course/fee information → schedule callback or trial lesson → follow up → record a minimal outcome with available evidence. “Trial lesson” is a scenario only, not a canonical entity/state decision.
- **Participant/context:** Organization TBD; one counselor candidate for an early usability walkthrough when reachable; reviewer A/B TBD and perform independent annotations before discussion. Education B2C is a selected candidate segment, not confirmed customer evidence.
- **Task/exposure:** First run a small purposive synthetic set (14 scenarios in `docs/implementation-plan/discovery/q3-q4-synthetic-scenarios-edu-b2c.md`) against annotation guide `q3-annotation-guide.md` and Q4 table `q4-provenance-time-mapping.md`. Then, if a real counselor is reachable and data/consent safeguards are approved, conduct a narrow P0 prototype walkthrough using only authorized, minimized material. Do not delay manual P0 prototype work waiting for business/reviewer recruitment.
- **Expected behavior:** Participant can inspect context/evidence, create or revise a next action and due time, identify responsible party, confirm reported completion with its evidence status, and record minimal outcome/unknown. Manual loop remains available with AI off.
- **Observable signals:** Task completion/blockers; time and interaction count as descriptive usability signals; points of confusion; corrections; stale reminder after reschedule/cancel; difference between message observation and declared action; whether participant voluntarily returns if a short follow-up is feasible. Keep observed behavior separate from self-report and interpretation.
- **Guardrails:** No real PII in synthetic set. Real-data use requires confirmed organization, authority/consent, purpose, access, retention/deletion and minimization. Do not ingest/upload real chat into this register. Do not auto-assign, auto-close, classify external silence as failure, or change canonical model from this test.
- **Decision rule for this test:** Revise prototype/guide if any high-consequence confusion causes wrong responsible party, obsolete reminder after reschedule/cancel, false verified-completion claim, or fabricated event time. Record lower-severity issues and decide next smallest test. A single participant informs usability only. Synthetic review validates scenario/codebook clarity only. No market/prevalence, H2/H4/H5 pass/fail, or automation-readiness conclusion.
- **Known limitations:** Synthetic cases are intentionally purposive and are not real customer cases. Organization, counselor, named reviewers, product build/version, data rights, date, sample criteria and outcome policy remain TBD. Broader H2/H4/H5 evidence requires appropriately scoped observation/pilot with pre-registered measures.

### Readiness

- [ ] Organization/workflow and actual tool chain confirmed
- [ ] Named product owner and two independent reviewers assigned (before real annotation)
- [x] Synthetic-only scenario pack and draft guides prepared
- [ ] Real data authority/consent, purpose, minimization, access, retention/deletion approved before any real-data use
- [ ] Prototype version and manual fallback inspected
- [ ] No canonical/model change included in this experiment

### Result (not run)

- Observed behavior: Not run
- Self-report: Not collected
- Evidence IDs: None
- Contradictions: Not assessed
- Alternative explanations: Not assessed
- Data/technical issues: Not assessed
- Decision: Pending
- Owner and follow-up: Assign named owners and confirm whether to run synthetic guide calibration only or a real counselor usability walkthrough

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
