# AI Working Instructions

**Owner:** Product Operations  
**Maturity:** Active  
**Evidence status:** Operating rules  
**Last updated:** 2026-09-10

## Required reading order

1. `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md`.
2. `00_EXECUTIVE/CURRENT_THESIS.md`, `DECISION_LOG.md`, `OPEN_QUESTIONS.md`.
3. `10_LEARNING/HYPOTHESIS_REGISTER.md`, `EXPERIMENT_REGISTER.md`, `EVIDENCE_REGISTER.md`.
4. `03_PRODUCT/LVP_PRODUCT_SPEC.md` and relevant engineering/data docs.
5. Audited API `AI_README.md` when platform facts affect work.

## Rules

1. Do not turn a hypothesis, scenario, repeated document or decision into evidence.
2. Every capability links to a hypothesis/experiment, observable signal and decision status.
3. Prefer a vertical usable loop and uncertainty reduction over feature breadth.
4. Do not code an endpoint from `family_verified`; reverify official version, contract, permission, region/review eligibility and live behavior.
5. Do not infer API capability from vendor UI or access from endpoint existence.
6. Keep `Customer != Lead`; keep conversation source, acquisition lineage and attribution independent.
7. Preserve raw evidence/provenance and explicit unknown; important mutations are audited/reversible.
8. AI remains optional/feature-flagged and must expose evidence/model versions and manual fallback.
9. Use adapter seams, versioned schemas, migrations and feature flags for safe change; do not pre-build generic platforms.
10. Update canonical source, decision/open question and learning registers after material work.
11. Never rewrite history silently. Append or mark `superseded` with rationale/date.
12. External customer evidence updates learning/customer docs before changing vision/category claims.

## Implementation stop conditions

Stop and register a blocker when real-data consent, credential authority, endpoint contract, access control or required telemetry is missing. Use manual/synthetic fallback only within its declared evidence limits.
