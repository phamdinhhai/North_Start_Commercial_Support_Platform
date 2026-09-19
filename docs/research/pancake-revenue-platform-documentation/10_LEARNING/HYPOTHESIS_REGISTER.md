# Hypothesis Register

**Owner:** Product / Research  
**Maturity:** Living source of truth  
**Evidence status:** Hypotheses; no primary customer validation yet  
**Last updated:** 2026-09-10

## Status vocabulary

`untested` · `testing` · `supported-in-scope` · `weakened` · `contradicted` · `retired`

“Supported” always names the tested participants, context, product version and date. Confidence is a prioritization judgment with rationale, not a statistical probability.

## Problem hypotheses

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
