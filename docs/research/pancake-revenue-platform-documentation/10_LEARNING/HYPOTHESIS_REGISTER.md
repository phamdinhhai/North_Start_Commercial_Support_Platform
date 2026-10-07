# Hypothesis Register

**Owner:** Product / Research  
**Maturity:** Living source of truth  
**Evidence status:** Hypotheses; no primary customer validation yet  
**Last updated:** 2026-10-07 (namespace split added; H0–H8 v1 preserved unchanged)

## Status vocabulary

`untested` · `testing` · `supported-in-scope` · `weakened` · `contradicted` · `retired`

“Supported” always names the tested participants, context, product version and date. Confidence is a prioritization judgment with rationale, not a statistical probability.

## Namespace rule (2026-10-07)

Two hypothesis series coexist and MUST NOT be joined by bare ID:

- **H0–H8 (v1, 2026-09-10)** — the original problem hypotheses below, unchanged, still `untested`.
- **VH1–VH8 (v2, 2026-10-06)** — the validation-screen hypotheses from `docs/Dinh_nghia_bai_toan_V2.md` §18.1. V2 reused the labels “H1–H8” with different statements, denominators and thresholds; to prevent double-counting “H1 supported”, this register versions them as `VH1…VH8`. Any document citing a bare `H1`–`H8` must state which series it means.

## Problem hypotheses (v1 — preserved history)

| ID | Statement | Status | Risk if false | First test | Evidence |
|---|---|---|---|---|---|
| H0 | A meaningful relationship-continuity discontinuity exists across Pancake → Marketing → Sales → outcome | untested | Product category may be wrong | External workflow exposure | None |
| H1 | Missing conversation context causes material Sales friction or mistakes | untested | Handoff wedge weak | Observe use/correction of context handoff | None |
| H2 | Losing original channel reduces contact success or continuity | untested | Channel-access concept unnecessary | Compare recent real handoffs/channels | None |
| H3 | Follow-up is missed often enough to create meaningful pain | untested | Queue lacks repeat value | Multi-day queue usage + real cases | None |
| H4 | Managers lack decision-useful handoff visibility | untested | Buyer layer weak | Observe exception review | None |
| H5 | Marketing lacks actionable downstream quality feedback | untested | Closed-loop layer weak | Observe current decisions and desired feedback | None |
| H6 | Existing Pancake/tag/note/Sheet/CRM workarounds are insufficient | untested | Switching cost may dominate | Compare LVP with current workflow | None |
| H7 | Team will adopt minimum process/data behavior required | untested | Trustworthy state impossible | Completion/return behavior | None |
| H8 | A repeatable workflow exists across enough customers | untested | Cannot productize horizontally | Compare cases only after ≥2 real cases | None |

## Validation-screen hypotheses (VH1–VH8 — from V2 §18.1; thresholds proposed, not locked)

These are **internal screening thresholds for the first validation round**, not industry benchmarks and not evidence results. Pre-register threshold, sample and denominators before scoring (V2 §16–18; EXP-06 draft in `EXPERIMENT_REGISTER.md`).

| ID | Statement (V2 wording, versioned) | Proposed screen | Relation to v1 (NOT equivalence) | Status |
|---|---|---|---|---|
| VH1 | Handoff context loss is frequent and valuable to fix | ≥30% assessed handoffs miss ≥1 critical item; pilot −≥30% median prep time, context quality not reduced | Tests the consequence side of v1 H1 | untested — awaiting EXP-06 + sample |
| VH2 | Useful internal follow-up work appears often enough | ≥30% commercial files have ≥1 internal work item operators confirm useful | Overlaps v1 H3 (missed follow-up pain) with a frequency+usefulness screen | untested |
| VH3 | AI extracts work accurately enough to assist | P ≥95%, R ≥80% on locked set (≥40 gold + ≥40 predictions); ≥90% owner/action match; ≥90% due match where resolvable | Refines v1 S5 (AI assist) into a measurable extraction screen | untested — blocked: locked set + consented data |
| VH4 | Execution status knowable without excessive entry | ≥70% due internal work has qualifying completion evidence; quick-capture median ≤20s used for ≥80% independently-checked off-system interactions | Extends v1 H7 (minimum process behavior) with independent denominator | untested |
| VH5 | Package creates operating and buyer value | ≥25% relative overdue reduction vs suitable comparison; ≥2/3 validated buyers accept paid pilot at pre-set price (needs ≥3 validated buyers) | Tests v1 H4/H6/H8 buyer/adopterside commercially | untested |
| VH6 | `Journey` needed beyond Lead/Opportunity | Unrepresentable-with-consequence cases ≥10% of representative sample OR ≥20% verified revenue, plus distinct invariant and no simpler representation | RFC-005 Q5; Lead/AcquisitionEpisode is the baseline model | untested — research question |
| VH7 | Multi-person buying roles need representation | ≥15% files with multiple decision participants and missing roles cause handoff/next-step error | RFC-005 Q2 (Contact/Organization/roles); segment-dependent | untested — research question |
| VH8 | Ad-result feedback loop worth investigating | ≥70% ad-origin files with assessable outcome deterministically chained end-to-end; plus V2 §19 prerequisites | Related to v1 H5 (marketing feedback) but measures linkage coverage only — NOT causal value | untested — explicitly not an LVP gate |


## Solution hypotheses

| ID | Statement | Depends on | Status | Observable signal |
|---|---|---|---|---|
| S1 | Evidence-backed context handoff improves Sales comprehension | H1, H6 | testing | Context opened; evidence inspected; low correction/friction |
| S2 | A due-action queue helps Sales remember and execute follow-up | H3, H7 | testing | Next actions created/completed; repeated multi-day use |
| S3 | Minimal outcome assertions are acceptable to Sales | H7 | testing | Outcome captured without heavy prompting; unknown used honestly |
| S4 | Exception visibility is useful to managers | H4, S2, S3 | untested | Manager returns and acts on exceptions |
| S5 | AI extraction saves effort without reducing trust | S1 | untested | Accepted/edited/rejected fields and task time |
| S6 | Pancake read sync creates enough leverage to justify integration cost | S1, technical access | untested | Lower input friction; stable verified sync |

## Update protocol

1. Register experiment before exposure.
2. Link evidence IDs, including contradictory evidence.
3. Record scope and alternatives.
4. Change status only with a dated rationale and decision owner.
5. Never infer H8 from multiple roles inside one company.
