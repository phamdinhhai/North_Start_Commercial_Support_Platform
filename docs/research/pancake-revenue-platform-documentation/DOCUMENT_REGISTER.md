# Document Register

**Owner:** Product Operations  
**Maturity:** Working canonical index  
**Evidence status:** Mixed; each document declares local status  
**Last updated:** 2026-09-10

## Canonical layer register

| Layer | Purpose | Primary owner | Current state | Update trigger |
|---|---|---|---|---|
| 00 Executive | Active phase, thesis, decisions, open questions | Founder/Product | Lean baseline active | Material decision or phase change |
| 01 Business Strategy | Market, business, pricing/KPI hypotheses | Founder/Strategy | Hypothesis-led | Buyer/viability evidence |
| 02 Market Customer | ICP, personas, pains, research, competition | Research/Product | No primary case yet | New customer evidence |
| 03 Product | LVP spec, acceptance, boundaries, vision/modules | Product | LVP active; broader product conceptual | Gate/experiment decision |
| 04 Design | IA, workspaces, flows and UX principles | Design/Product | Concepts need LVP reconciliation | Prototype/usability result |
| 05 Engineering | Evolution, domain/data, AI, security and integration | Engineering | Guardrails active; stack pending | Architecture/API/live test |
| 06 GTM | Positioning, packaging, pricing and sales | GTM/Founder | Hypotheses, not claims | Buyer/commitment evidence |
| 07 Implementation CS | Operating/onboarding/training methods | CS/Ops/Product | Future candidates | External pilot behavior |
| 08 Data Measurement | LVP truth/provenance; future funnel/attribution | Data/Product | Minimum truth active | Data/experiment finding |
| 09 Finance Legal Security | Economics/privacy/legal/compliance | Finance/Legal/Security | Framework only | Real-data/commercial readiness |
| 10 Learning | Hypotheses, experiments, evidence, feedback and cases | Product/Research | Active source of evidence | Every exposure/result |
| 99 Archive | Original brainstorm/source context | Product Ops | Immutable reference | Append source; never reinterpret as evidence |

## Canonical documents for current phase

- `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` — active phase manifest.
- `00_EXECUTIVE/CURRENT_THESIS.md` — epistemic/product baseline.
- `00_EXECUTIVE/DECISION_LOG.md` — append-only decisions/supersession.
- `00_EXECUTIVE/OPEN_QUESTIONS.md` — risks and blockers.
- `03_PRODUCT/LVP_PRODUCT_SPEC.md` — active product scope.
- `03_PRODUCT/LVP_ACCEPTANCE_AND_LEARNING_CRITERIA.md` — release/learning contract.
- `05_ENGINEERING/EVOLUTION_ARCHITECTURE.md` — change seams.
- `05_ENGINEERING/PANCAKE_LVP_FEASIBILITY.md` — integration test policy.
- `08_DATA_MEASUREMENT/OBSERVABILITY_AND_PROVENANCE_MODEL.md` — truth semantics.
- `10_LEARNING/HYPOTHESIS_REGISTER.md`, `EXPERIMENT_REGISTER.md`, `EVIDENCE_REGISTER.md` — learning source of truth.

## Integrity rule

A document is not done because it exists. Decision-bearing documents include owner, status, date and evidence classification. Repetition is not corroboration. History is superseded, not silently overwritten.
