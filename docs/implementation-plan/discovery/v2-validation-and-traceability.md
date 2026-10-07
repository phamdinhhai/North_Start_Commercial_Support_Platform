# V2 Problem Definition — Traceability & Validation Plan

**Status:** Working research/validation aid; not a frozen product, domain, or data specification.
**Source:** [`../../Dinh_nghia_bai_toan_V2.md`](../../Dinh_nghia_bai_toan_V2.md), dated 2026-10-06.
**Authority:** Subordinate to `docs/canonical/**`; any canonical or architecture change requires an RFC/ADR and human approval. Numeric thresholds below remain proposed until registered before an evaluation round.

## 1. Interpretation

V2 is the current problem-framing and validation source. It does not establish market prevalence, customer willingness to pay, production API availability, legal compliance, or final model semantics. It keeps the long-term North Star separate from the proposed first validation package.

The framing has six layers:

1. Business pain across customer, Sales, Marketing, manager, and buyer.
2. Root causes: fragmented systems, identity, demand episodes, commercial meaning, observation, ownership, and definitions.
3. Measurement: source concepts, evidence provenance, observation coverage, linkage quality, and outcome boundaries.
4. Organizational constraints: buyer/user incentives, operating definitions, and non-punitive handling of missing evidence.
5. Product behavior: evidence-backed handoff, actionable follow-up, quick capture, auditable state, human-approved AI proposals, and exception handling.
6. External constraints: provider access, data-use policy, privacy, connectivity, and delivery capacity.

Three principles to carry into every validation artifact:

- **Observation is incomplete:** not observed does not mean it did not happen; a message observed in a connected source does not independently prove the external action described in that message.
- **Facts differ in origin and reliability:** keep evidence origin, evidence quality, interpretation, and event time/recording time distinguishable.
- **User value precedes data-entry burden:** measure value and repeated usage for the operator separately from buyer interest.

These principles are proposed product-learning guardrails, not amendments to frozen I-01…I-12.

## 2. Proposed first validation package (not proven product-market fit)

Role A: a lightweight operational layer for a selected organization that lacks an effective full CRM. Initial package: evidence-backed handoff context plus follow-up/commitment tracking; Pancake is a candidate first conversation source, subject to current access and feasibility verification.

Candidate minimum behaviors from V2 §12.2:

- Handoff context with source evidence, freshness, and explicit unknowns.
- Sender/recipient, acceptance, ownership, and timestamps.
- Suggested action with owner, due date, evidence, and user accept/edit path.
- Reminders and actionable exceptions for the selected workflow.
- Quick capture for off-system interactions, clearly marked as declared unless independently observed.
- Measurement of use, time, coverage, and error; correction history; identity-link correction/split path.

This is a validation scope, not an approved expansion of implementation phases. Existing human gates and open decisions still apply. Do not infer that Pancake is required for every later customer or that API capability is verified.

### Explicitly outside this validation package

- Replacing CRM, ERP/POS, accounting, or specialist systems; two-way CRM sync.
- Observing every phone, Zalo, or in-person interaction.
- Unsupported identity auto-merge or AI-triggered business mutation.
- Complete cross-channel revenue attribution, causal claims, ad-budget optimization, or sending outcomes back to ad platforms.
- Graph database, full process mining, or event-sourced architecture solely for unvalidated hypotheses.
- Full renewal/refund/customer lifetime value lifecycle.
- Service control-plane, licensing, installer, fleet upgrade, or deployment-mode commitments unless separately approved.

## 3. Model questions — hypotheses, not decisions

| Topic | V2 position | Validation / promotion rule |
|---|---|---|
| Commercial journey / `Journey` entity | Journey is a business concept; no separate entity decision. | H6: show consequential errors in source attribution, ownership, or result representation with existing Lead/Opportunity; test simpler alternatives first. |
| Contact / Organization / buying group | Keep Contact and Organization distinct; need for per-demand roles is unknown. | H7: test whether multiple participants in one organizational decision occur often enough and cause handoff/action errors. No new `Person` abstraction implied. |
| Results and revenue | Won, order/enrollment, payment, refund, renewal, and recognized revenue are distinct. | Keep module-specific result semantics; do not create a universal shared `Outcome` or direct cross-module foreign key by assumption. Raise model RFC if validated cases need shared lineage. |
| Source and attribution | Acquisition source, interaction channel, and crediting rule are distinct; attribution model remains open. | Keep MM-1 boundary. Report deterministic linkage per segment and with explicit eligible denominator; linkage is not causal impact. |
| Evidence provenance | V2 labels observed / declared / inferred; `unobserved` describes absence of evidence, not a fact origin. | Map to canonical acquisition/assertion vocabulary only through review; do not treat terms as synonyms without mapping. Separate evidence quality from provenance. |
| Time | Distinguish when an event occurred from when it was recorded; unclear event time stays unknown or interval-valued. | Compare with canonical `occurred_at` / capture/ingest fields before changing data contracts. No false precision. |
| Work / obligation | Responsibility (internal/external) and origin (explicit request/commitment, policy/SLA, implicit/inferred) are independent axes. Execution status differs from evidence of completion. | Test usefulness and observability; keep policy-created or AI-inferred proposals distinct from committed work. First pilot AI proposals require user confirmation. |

No H-number, sample ID, validation label, or Validation Schema field may become a production entity, enum, database column, telemetry key, or behavior dependency merely because it appears here.

## 4. Proposed validation hypotheses and thresholds

The following are V2 §18.1’s **proposed internal screening thresholds**, not industry benchmarks, empirical findings, or permission for unsupervised automation. Product owner must pre-register threshold, sample, denominator, exclusions, and analysis before opening the locked evaluation set. Every result is `proceed`, `fail`, or `insufficient data`.

| ID | Question | Proposed screen (V2 §18.1) | Main caveat |
|---|---|---|---|
| H1 | Is handoff context loss frequent and valuable to fix? | ≥30% of assessable handoffs miss a critical item; pilot reduces median preparation/acceptance time ≥30% without lowering context quality. | Define critical fields and assessability before sampling. |
| H2 | Are useful internal actions frequent enough? | ≥30% of commercial files have a concrete follow-up task operators confirm useful. | Do not count AI-generated tasks as demand evidence. |
| H3 | Can AI extract work accurately enough to assist? | Precision ≥95%, recall ≥80%; action/owner match ≥90%; due-date match ≥90% among cases with resolvable due dates. | At least 40 gold tasks and 40 predictions on locked set; small samples do not justify unsupervised action. |
| H4 | Can execution be known without excessive input? | ≥70% of due important work has evidence-backed status (completion, confirmed incomplete, or valid cancellation); quick capture median ≤20s and used for ≥80% of independently checked off-system interactions requiring capture. | Independent observation/log is necessary to form the off-system denominator. Report declared completion separately. |
| H5 | Does the package create operating and buyer value? | ≥25% relative reduction in overdue/unresolved internal work vs suitable comparison; ≥2/3 validated buyers accept paid pilot at pre-set price. | Require ≥3 validated buyers for 2/3 rule; control workload/case mix; interest is not payment acceptance. |
| H6 | Is `Journey` needed beyond Lead/Opportunity? | Consequential unrepresentable cases ≥10% of representative sample or ≥20% of verified revenue, plus a distinct invariant and no simpler representation. | Do not use estimated opportunity value for verified revenue; avoid duplicate counting; test across ≥2 businesses for a shared core. |
| H7 | Are buying-group roles needed per demand episode? | ≥15% of files have multiple participants in one decision and missing role causes a handoff/next-step error. | Frequency alone does not justify a new core model. |
| H8 | Is an ad-result feedback loop worth investigating? | ≥70% of ad-origin files with assessable outcomes have a deterministic full-chain linkage. | Internal screen only; not a platform requirement or launch authorization. Also satisfy V2 §19 prerequisites. |

### Decision hygiene

- Report numerator, denominator, eligible cohort, exclusions, rule/model version, missingness, uncertainty, disagreement, and business clustering.
- Preserve underrepresented / adverse / low-signal cases; stratification is descriptive unless weighted to a justified population.
- Retrospective analysis cannot establish adoption, reduced loss, causation, or willingness to pay.
- Lock the evaluation set and freeze model/prompt/rules/thresholds before scoring. Changes after inspection require a new round/set.
- H8/full attribution is not a prerequisite for the handoff/follow-up MVP. Do not report an ad chain as causal lift.

## 5. Metrics to define before collection

Use V2 §13 metric definitions only after fixing scope, timeframe, rule version, numerator, denominator, and treatment of insufficient data:

- Context Continuity Rate.
- Handoff Context Coverage (evidence-qualified required items / applicable required items).
- Obligation Completion Rate (internal due work, valid cancellations excluded; declared completion separated).
- Observation Coverage (predefined stage requirements with qualifying evidence / applicable requirements).
- Deterministic Attribution Coverage (eligible ad-origin cases with assessable result and deterministic end-to-end chain / explicitly defined eligible cases).
- Unknown Attribution Rate (in-scope revenue with no policy-qualifying source linkage / in-scope revenue).
- Customer Repetition Rate (handoffs requiring repetition of previously supplied important information / follow-on handoffs assessed).

Coverage is not the fraction of all real-world interactions observed. Unknown is not complete evidence. Late-arriving evidence must preserve event time, record time, and report cutoff.

## 6. Sampling and evaluation protocol

Proposed first retrospective round: 80 demand-episode files across 3–5 qualified businesses (allow 50–100 depending on data permission and availability), with additional conversation threads as needed. This is not a representative market survey.

1. Define business, period, workflow, and eligibility before sampling.
2. Random or predeclared stratified sample from eligible records; retain low-signal, missing, contradictory, and no-outcome cases.
3. Keep intentionally rare edge-case set separate from prevalence estimates.
4. Keep all records from the same person/organization in one development or locked evaluation partition.
5. Use two independent annotators on core evaluation labels; record disagreements and unresolved cases.
6. AI sees only evidence available at the decision time; freeze model, prompt, rule and threshold versions before locked evaluation.
7. Follow retrospective analysis with a proposed 2–4 week workflow pilot (extend if sales cycle/volume is inadequate). It tests usage and operating value, not market-wide claims.
8. Define consent, access, retention, deletion, and allowed evidence before real-data processing; preserve permitted reports while deleting or restricting test data per policy.

## 7. Disposable Validation Schema

This is a one-off labeling/comparison aid (V2 §17), not a second domain model. It may live in a controlled spreadsheet or research-only data file and must be removable without changing application behavior.

| Group | Example evaluation fields | Why needed |
|---|---|---|
| Sample | Pseudonymous file ID, business, stratum, development/locked split | Sampling and leakage control |
| Evidence | Source ref, provenance, evidence-quality label, occurred/recorded timestamps and time precision | Traceability and temporal truth |
| Context | Required item, gold label, model output, missing/error reason | Handoff evaluation |
| Work / expectation | Responsible party, origin, action, due-date precision, importance, completion evidence | H2–H4 |
| Identity / relations | Existing Contact/Organization/Lead/Opportunity refs, unrepresentable case | H6–H7 |
| Source / result | Evidence per linkage segment, result type, evidenced value / unknown | H8 and outcome-boundary test |
| Use / value | Time, manual edits, useful alerts, quick-capture duration, repeated use, buyer evidence | H1/H4/H5 |
| Decision | Hypothesis ID, related canonical decision, result, limitation, next step | Promote learning through governance |

Use pseudonymous references and permitted data only. Do not copy unnecessary message bodies or PII into the evaluation file. Hypothesis/sample IDs are research artifacts only; application services and persistence must not depend on them.

## 8. Promotion path and gates

1. Keep H1–H8 in the learning/evidence register and this validation aid; do not edit frozen canonical semantics.
2. Map V2 terminology against canonical terms (especially provenance/status, timestamps, identity, obligations, and outcomes) before writing any mapping contract. Domain questions are collected in [`../decisions/RFC-005-v2-domain-questions.md`](../decisions/RFC-005-v2-domain-questions.md), which remains a draft and does not decide them.
3. If results imply a domain/architecture change, draft an RFC describing evidence, alternatives, impact, and unresolved assumptions; update `OPEN_DECISIONS.md` only through canonical governance.
4. Promote accepted decision by human-approved RFC/ADR; only then update canonical model, requirements, architecture, and code.
5. Distinguish the learning gate (evidence sufficient to proceed/narrow/stop) from Gate #A, persistence/migration review, and Pancake feasibility gates.

## 9. Traceability matrix (initial, pending review)

| V2 layer / hypothesis | Existing project coverage | Gap or conflict to validate | Candidate artifact / gate |
|---|---|---|---|
| Pain & causes | North Star; research thesis; R-07…R-13 | Prevalence/consequence not proven; buyer/user incentives differ | Evidence register; H1/H2/H5 pilot |
| Measurement | I-02/I-08; MEASUREMENT_MODEL; R-10/R-17/R-25 | Denominators, causal boundary, observed vs declared vs inferred mapping | Metric protocol; MM-1 boundary; H8 |
| Organization | PM-1; role/access R-01…R-03 | Buyer acceptance is not daily usage; scope of manager access remains open | H5 + external user pilot; PM-1 RFC |
| Product behavior | Lead/handoff/outcome, audit, UNKNOWN; R-08…R-20 | Obligation axes/completion evidence and context quality not modeled by current requirements | H1–H4; requirements review; CE-1/CE-2 as applicable |
| External constraints | Q-03/Q-04; adapters; privacy/security requirements | Live API, permissions, legal/data policy not established by documentation alone | Pancake spike + real-data readiness gate |
| H6 model fit | I-01/I-07 and Lead identity | `Journey`, Contact/Organization, multi-party roles and module-specific results unresolved | H6/H7 evidence then identity/domain RFC |
| H8 feedback loop | I-02; MM-1; R-25 | Full-chain deterministic coverage and outcome definitions not proven | H8 + V2 §19 prerequisites; not MVP gate |

**Owner review required:** This map points to candidate links, not approved R-ID/C-ID changes. Existing implementation-plan statuses and phase gates remain authoritative until updated by their owners.
