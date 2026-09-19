# Pancake Revenue Platform — Product Knowledge Repository

**Owner:** Founder / Product Lead  
**Maturity:** Working source of truth  
**Evidence status:** Mixed; classify claims locally  
**Last updated:** 2026-09-10

This repository converts one long Pancake/CRM brainstorming lineage into an evidence-aware product-development system. Repeated ideas across documents are not independent evidence.

## Read first

1. `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` — active phase and working bet.
2. `00_EXECUTIVE/CURRENT_THESIS.md` — vision, problem and solution hypotheses.
3. `00_EXECUTIVE/DECISION_LOG.md` — retained/superseded decisions.
4. `00_EXECUTIVE/OPEN_QUESTIONS.md` — unresolved risks.
5. `10_LEARNING/HYPOTHESIS_REGISTER.md` and `EVIDENCE_REGISTER.md`.
6. `03_PRODUCT/LVP_PRODUCT_SPEC.md` before implementation.

For API implementation, also follow the separate audited API knowledge base `AI_README.md`; re-open current official documentation and live-test before production use.

## Claim taxonomy

- **VERIFIED FACT:** supported by a named source and verification date; time-sensitive facts must be reverified.
- **OBSERVATION:** a directly observed event/behavior in a scoped real case.
- **INFERENCE:** a reasoned, falsifiable interpretation of facts/observations.
- **HYPOTHESIS:** an unproven problem, solution, adoption, viability or feasibility assertion.
- **DECISION:** a choice with owner/date/rationale/consequence/revisit trigger; a decision is not proof.

Synthetic scenarios, mock data and AI-generated examples can test functionality/usability but are not customer evidence.

## Canonical boundaries

- Executive baseline/phase: `00_EXECUTIVE`.
- Customer evidence and experiments: `10_LEARNING` (with research details in `02_MARKET_CUSTOMER`).
- Current LVP scope: `03_PRODUCT/LVP_PRODUCT_SPEC.md`.
- Product truth/provenance: `08_DATA_MEASUREMENT`.
- Implementation guardrails: `05_ENGINEERING`.
- Original conversation/context remains archived under `99_SOURCE_ARCHIVE`.

## Strategic guardrail

Do not rebuild Pancake, a full CRM, generic BI or generic automation. The current bet tests a small handoff/action/follow-up loop; the larger Revenue Continuity vision remains a candidate.
