# RFC-005 — Review questions surfaced by V2 problem validation

**Date:** 2026-10-07 (revised after canonical cross-check)
**Status:** Draft — for Product / Data / Architecture review; no domain decision approved
**Authority:** Proposal under accepted ADR-004. This RFC does not amend `docs/canonical/**`, close/supersede existing decisions, authorize implementation, or promote validation hypotheses to requirements.
**Source of problem framing:** `docs/Dinh_nghia_bai_toan_V2.md` §§6–9, 15–18. The original V2 wording in §6.1 was corrected on 2026-10-07; it no longer presumes that Contact and Organization are established core entities.
**Canonical sources cross-checked:** `DOMAIN_MODEL.md` §§2–6; `IDENTITY_MODEL.md` §§1–6; `COMMERCIAL_EVENT_MODEL.md` §§1–7; `TRUST_AND_EVIDENCE.md` §§2–7; `MEASUREMENT_MODEL.md`; `ARCHITECTURE_CONSTITUTION.md` §§3–5; `OPEN_DECISIONS.md` (CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, LG-1).
**Related:** ADR-004 (accepted framing/validation boundaries); ADR-001 (interim CE-1/CE-2); V2 traceability/validation plan.

## 1. Purpose and authority boundary

V2 is accepted as problem framing and a source of validation hypotheses, not as an approved domain model or expanded implementation scope. This RFC identifies the actual unresolved semantics after checking them against canonical material. It distinguishes:

1. Long-term direction (North Star).
2. Candidate validation scope (V2 role-A package; not proven demand).
3. Approved implementation scope (canonical and gated phase decisions; not automatically changed by this RFC).

The purpose here is to improve the questions and identify owners, relevant existing decisions, and evidence needed. It does not select a schema or settle the questions.

## 2. Guardrails

- I-01…I-12 remain authoritative. In particular: Customer ≠ Lead; Lead/AcquisitionEpisode has stable identity; channel, acquisition lineage, and revenue attribution remain distinct; unknown remains visible; identity merges require evidence and reversibility; AI cannot silently mutate commercial truth; changes remain auditable.
- CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, and LG-1 remain open and unchanged.
- V2 H1–H8 thresholds are proposed internal screening thresholds, not empirical results, industry standards, or authorization for automation.
- The validation schema is disposable. Hypothesis IDs, sample IDs, and test-only labels must not become production model/API/database/telemetry dependencies.
- This RFC approves no new `Journey`, `Contact`, `Organization`, `Person`, universal `Outcome`, or `Obligation` entity.
- V2 is not evidence that Pancake is available or required for all validation. Canonical P0 supports manual/synthetic operation; Pancake read is a feasibility-gated P1 experiment and sending is deferred.

## 3. Review questions

### Q1 — Linking demand episodes to results in other business modules

**Relevant canonical baseline.** `DOMAIN_MODEL.md` §2 names `Outcome / Revenue` as commercial outcome facts asserted with provenance; §§3–4 show Lead concluding in an outcome and revenue “if asserted.” `TRUST_AND_EVIDENCE.md` §4 says a user-entered Won remains a claim unless corroborated and is not automatically revenue or attribution evidence. `MEASUREMENT_MODEL.md` and `OPEN_DECISIONS.md` MM-1 keep the crediting model open and full attribution outside LVP.

**Question still open.** What relationship/reference and provenance should connect a Lead/demand episode to module-owned records such as an order, enrollment, payment, refund, or renewal—especially when one demand has multiple results, one result relates to multiple demands, a result is corrected, or the source system is authoritative?

**Correction to prior framing.** V2 §7.6 rejects assuming a universal shared `Outcome` and cautions against ungoverned cross-module coupling. Neither V2 nor the canonical material establishes a blanket prohibition on direct foreign keys. Modular boundaries and ownership are constraints to evaluate; direct references are not pre-rejected.

**Options to compare (none selected).**
1. Direct typed reference from a module-owned result to a Lead/demand, with explicit ownership, cardinality, correction, and provenance rules.
2. A separately governed association/lineage record that references both module-owned records without moving result semantics into a shared Outcome.
3. Adapter/evidence references where the platform records only a claim or pointer until a business module is integrated.
4. A shared result abstraction only if validated workflows show stable common semantics across modules.

**Evidence / test.** Collect permissioned real cases for zero/one/multiple results; partial payments and allocations; refunds/cancellations/renewals; duplicate or late evidence; correction and source-of-authority conflicts. Test whether Lead-level Won/Lost/Unknown plus evidence references produce material ambiguity. Keep estimated opportunity value, Won status, payment, and recognized revenue distinct. Report V2 H6/H8 only against defined eligible cases; do not infer causal ad impact.

**Owner / related decisions.** Product + Data; Architecture for reference/persistence boundary; Security/Privacy before real data. Related: MM-1 (attribution credit), ID-2 (external mapping), CE-2 (event/assertion scope). Q1 is about relationship and provenance, not selecting credit allocation.

**Proposed priority.** Research as relevant result data becomes available; no LVP blocker absent a validated requirement.

### Q2 — Customer, Contact, Organization, and buying-party roles

**Relevant canonical baseline.** `DOMAIN_MODEL.md` §2 defines `Customer` as a person/entity and `Identity`/`CustomerRef`; `IDENTITY_MODEL.md` §§1–2 similarly defines CustomerRef as a reference to a person/entity. Customer and Lead are distinct (I-01), and identity graph/automated merge is deferred. The canonical files reviewed do **not** establish Contact and Organization as two separate core entities. `Account`/`Contact` may occur at external CRM boundaries but that does not make them core entities.

**Question still open.** Does the current Customer/CustomerRef + Lead model represent the relevant person(s), organization(s), and per-demand roles well enough for the chosen segment? If not, what smallest relationship or structure avoids consequential identity, handoff, or result-linkage errors?

**Options to compare (none selected).**
1. Keep current Customer/CustomerRef and Lead model; retain participant/role statements as evidence-backed context.
2. Add Contact and/or Organization concepts only if validated use cases require distinct identity, lifecycle, or access semantics.
3. Add participant-role relationships scoped to a demand/Lead only if roles vary by buying episode and change the next action or outcome.
4. Keep organization structures in an external adapter where the platform does not need to own them.

**Evidence / test.** V2 H7: examine multiple participants in one decision; role changes across demands; shared phone/email; parent/subsidiary/branch; duplicate/uncertain organization records; and concrete errors caused by current representation. H7’s proposed 15% screen is not alone sufficient to add an entity. Compare against simpler evidence/context or configuration approaches.

**Owner / related decisions.** Product + Data; Architecture if core identity/relationship changes. Related: ID-1 (identity matching/merge and undo), ID-2 (external schema mapping), I-01/I-06/I-07. Do not resolve merge thresholds or CRM mapping in this question.

**Proposed priority.** Segment-dependent; run when the pilot cohort contains organizational purchases or multi-party cases. No model change before evidence.

### Q3 — Work, commitment, responsibility, and unobserved external outcomes

**Relevant canonical baseline.** `DOMAIN_MODEL.md` §2 already names `Activity / NextAction / Commitment`; `COMMERCIAL_EVENT_MODEL.md` §4 describes two classes, Buyer commitment and Seller commitment, with lifecycle `Detected → Assigned → Due → Completed / Overdue`. However, the semantics for internal work versus external expectations and the relationship to Commercial State are not yet fully specified. This RFC asks to clarify those points without downgrading the existing description. V2 §§9.2–9.3 distinguishes responsible party, origin, execution state, and evidence of completion.

**Concrete semantic conflict to review.** The canonical example “call me Friday after I speak with my boss” is labeled a **Buyer commitment**. It contains at least two propositions: (a) the buyer expects/intends to speak with their boss; (b) the buyer asks the business to call on Friday. The business is responsible for the call. Classifying the whole utterance by speaker or “buyer commitment” can misassign the actor responsible for the next action. Separately, a customer’s expected external action may remain unobserved after its expected time; treating it as `Overdue`/`Completed` with the same semantics as internal work could imply a verified failure or duty that the platform cannot establish.

**Questions to decide.**
1. Are commitment classes categorized by who uttered the statement, the party expected to act, or both as separate dimensions?
2. How are internal work items distinguished from external expectations, and what establishes acceptance/assignment of inferred or policy-created work?
3. What does `Overdue` mean for an internal action with a valid due time, versus “outcome not observed after expected time” for an external party?
4. How is completion state separated from completion evidence (observed, declared/claimed, inferred, absent/conflicted), without interpreting an observed message as proof of the external action it describes?

**Options to compare (none selected).**
1. Keep Activity/NextAction/Commitment but explicitly separate utterance speaker, responsible party, origin, execution status, and completion evidence where needed.
2. Use separate internal work and external expectation records if shared lifecycle semantics prove misleading.
3. Preserve one task-like construct only if external expectations are not represented as enforceable obligations and lifecycle/evidence semantics remain unambiguous.

**Evidence / test.** Observe actual workflows including explicit requests, promises by each side, configured SLA-generated work, AI suggestions, reassignments, backdated/late reports, off-system completion, external outcomes not observed, cancellation/rescheduling, duplicate reminders, and evidence that only proves a message/file was sent—not read/agreed to. Evaluate four distinct validation questions: **H2**—how often operators identify a concrete follow-up as useful; **H3**—whether extraction correctly identifies action, responsible party, and due date; **H4**—whether execution status and off-system interactions can be captured with an independently established denominator and acceptable burden; **H5**—whether the follow-up workflow yields operating and buyer/commercial value. Capture user accept/edit/reject, time burden, errors from actor/status misclassification, and counterexamples where an external expectation passes with no evidence either way. Keep each hypothesis’s own pre-registered denominator and threshold; do not substitute task-generation accuracy for user or buyer value.

**Owner / related decisions.** Product + Data; Architecture for lifecycle/audit; Security/Privacy when capturing message evidence. Related: CE-1 (state-transition semantics), CE-2 (whether such facts/events are CommercialEvents), PM-1 (who may accept/assign/close), and relevant follow-up commitment definitions. These existing decisions do not, by themselves, settle the party/origin/evidence distinctions; do not silently fold a Q3 outcome into CE-1/CE-2.

**Proposed priority.** High before freezing any obligation/next-action contract or building exception logic whose meaning depends on these distinctions. Does not block manual/synthetic prototype or existing non-frozen interim work.

### Q4 — Mapping V2 evidence labels and time fields to canonical semantics

**Relevant canonical baseline.** `TRUST_AND_EVIDENCE.md` §2 already defines acquisition mode (`automatic_observation`, `user_confirmed`, `imported_record`, `inferred`, `unknown`) separately from assertion status (`recorded`, `claimed`, `inferred`, `conflicted`, `unknown`), and says confidence applies to inference. §3 requires `occurred_at`, `captured_at`, timezone, and precision; `DOMAIN_MODEL.md` and `COMMERCIAL_EVENT_MODEL.md` also preserve occurred-vs-captured semantics. Therefore the problem is not absence of all provenance or event-time fields.

**Question still open.** For V2 evaluation/reporting, what does `recorded_at` mean relative to (i) asserted event time (`occurred_at`), (ii) source observation/capture (`captured_at`), (iii) adapter ingestion/receipt, and (iv) application assertion creation? Which distinctions affect decisions, and where can a source provide only an interval or unknown time?

Also, how should V2’s concise `observed / declared / inferred` labels be represented in evaluation without assuming one-to-one mapping to canonical acquisition mode or assertion status? For example, `user_confirmed` may indicate a person confirmed an assertion; it does not make an off-system action an automatically observed event. A connected system may observe a message while the action described by that message remains claimed.

**CE-2 boundary.** These labels are evaluation/measurement vocabulary only; they do not imply every observed, declared, or imported fact is a `CommercialEvent`. CommercialEvent scope remains CE-2, unresolved.

**Options to compare (none selected).**
1. Use canonical fields/statuses in production and maintain a documented mapping only in evaluation reports.
2. Add a separately reviewed timestamp/provenance mapping contract only if real examples show the existing field semantics are insufficient.
3. Keep V2 labels research-only and report ambiguous mappings as unknown until a canonical mapping is approved.

**Evidence / test.** Exercise imported/late/backdated/conflicting assertions; observed message vs described external action; time-zone and precision loss; source timestamp absent; adapter receive and application record times; corrections/supersession. Verify no unknown `occurred_at` is filled from capture or record time and that events can be correctly ordered/reported under late arrival.

**Owner / related decisions.** Data + Engineering; Product for interpretation; Architecture for contract impact. Related: CE-2 (event scope), I-05/I-08/I-12. Do not mutate canonical vocabulary from label similarity alone.

**Proposed priority.** Resolve the mapping for the validation/evidence protocol before scoring time-sensitive H1–H4 results; canonical/data-contract change only if required by observed cases and approved separately.

### Q5 — Does the canonical Lead episode need an additional journey structure?

**Relevant canonical baseline.** This is not an open question about whether an episode concept exists: `DOMAIN_INVARIANTS.md` I-01/I-07, `DOMAIN_MODEL.md` §2, and `IDENTITY_MODEL.md` §§1/3 already define Lead/AcquisitionEpisode as one commercial/acquisition episode with stable identity across channel transitions and handoff.

**Question still open.** Are there returning or parallel demand cases where the existing Lead/AcquisitionEpisode and its relationships cannot represent ownership, source lineage, or multiple module-owned results without consequential error? If yes, is the missing concept a distinct `Journey`, or can the case be represented by a relationship/grouping over existing Leads and module records?

**Options to compare (none selected).**
1. Keep Lead/AcquisitionEpisode as the episode; use existing relationships/configuration for grouping where sufficient.
2. Add a non-domain analytical grouping or cross-episode reference if that solves reporting without changing commercial identity.
3. Propose a distinct domain abstraction only if a specific invariant/behavior cannot be expressed with existing Lead semantics and simpler relationships.

**Evidence / test.** V2 H6 cases: repeated needs months apart; parallel needs; one or multiple results across episodes; changing ownership; source/result attribution; duplicate counting. Demonstrate the exact error under current Lead semantics, assess consequence, compare simpler alternatives, and test a shared-core proposal across at least two businesses. H6’s proposed numeric screens are not automatic model criteria; analyze rare high-impact cases separately.

**Owner / related decisions.** Product + Data; Architecture if new identity/cardinality or persistence semantics are implied. Related: I-01/I-07, ID-1 (identity linking), ID-2 (external mapping), MM-1 (credit model), LG-1 (scope). Do not change the Lead definition or create Journey as a result of vocabulary alone.

**Proposed priority.** Continue as research; no separate entity/implementation until a material unrepresentable case is evidenced and reviewed.

## 4. Review disposition requested

For each Q1–Q5, reviewers should record one outcome and rationale:

- **Keep as research question** — no canonical row or implementation change yet.
- **Register an open decision** — identify owner, scope, evidence gap, and next step; update canonical `OPEN_DECISIONS.md` only through its governance process.
- **Request a focused evidence study** — specify cohort, data permission, method, and decision-useful evidence.
- **Already settled** — cite the exact canonical rule and show why it resolves the question without changing meaning.

ADR-004 approval accepts V2 as framing and validation source only. It does not approve any Q1–Q5 outcome or implementation scope change.

## 5. Proposed review order

1. **Q3 and Q4 first:** Q3 has a concrete canonical example/lifecycle ambiguity that can misassign work or misstate an unobserved external outcome. Q4 needs a careful field/status mapping before evidence is evaluated; it is not a request to invent provenance from scratch.
2. **Q2 by pilot segment:** review if the selected sample includes organizational buying/multiple participants; correct V2’s prior overstatement without assuming Contact/Organization entities.
3. **Q1 as result data becomes available:** keep linkage/provenance separate from MM-1 attribution credit and assess references neutrally.
4. **Q5 as a model-fit study:** start from the already-defined Lead/AcquisitionEpisode and demonstrate failures before proposing another abstraction.
5. Record approved disposition, owner, evidence, and gates; only then decide whether a canonical open-decision row is needed. Preserve manual/synthetic P0 validation; do not make learning about handoff value depend wholly on Pancake integration.

## 6. Non-goals

This RFC does not:

- Amend canonical documents or frozen invariants.
- Select an attribution model, identity merge threshold, permission matrix, or state machine.
- Decide whether direct cross-module foreign keys are prohibited or required.
- Approve Contact/Organization as core entities, a separate Journey abstraction, or a universal Outcome/Obligation model.
- Approve Pancake/API capabilities, legal compliance, market prevalence, ROI, willingness to pay, or causal ad impact.
- Authorize production schema changes or expand implementation scope/phases.
