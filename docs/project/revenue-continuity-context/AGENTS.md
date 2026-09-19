# AGENTS.md — Revenue Continuity / Lean Validation Product

## Required reading

1. `docs/project/CURRENT_STATE.md`.
2. `docs/project/LEAN_EXECUTION_PLAN.md`.
3. Product repo `00_EXECUTIVE/LEAN_VALIDATION_PHASE.md` and `CURRENT_THESIS.md`.
4. `10_LEARNING/HYPOTHESIS_REGISTER.md`, `EXPERIMENT_REGISTER.md`, `EVIDENCE_REGISTER.md`.
5. `03_PRODUCT/LVP_PRODUCT_SPEC.md` and relevant data/engineering docs.
6. Audited API `AI_README.md` before platform integration work.

`PROJECT_PLAN_AI.md` and `project_plan.yaml` are historical/long-range baselines. Their sequencing is superseded for the current phase unless a new decision restores it.

## Current loop under test

`Conversation input → Evidence-backed handoff → Sales action → Follow-up → Minimal outcome assertion`

This is a solution bet, not a validated customer problem or paid wedge.

## Mandatory rules

- Build and recruitment/discovery run in parallel; do not skip learning instrumentation.
- Do not turn hypotheses, synthetic scenarios, repeated documents or decisions into evidence.
- Do not expand into full CRM, social inbox, ERP/POS, generic workflow or BI.
- `Customer != Lead`; keep conversation source, acquisition lineage and attribution separate.
- Preserve provenance and explicit unknown; important mutations must be audited/reversible.
- Do not build dashboards before behavior and data integrity exist.
- AI and Pancake sync are optional feature-gated adapters; manual path must remain usable.
- Never code `family_verified` as an endpoint. Reverify exact current contract, version, access and live behavior.
- Do not expose real data without consent/authority, retention, access control and deletion path.
- Prefer Vietnamese internal docs/UI by default; keep standard code/API terminology.

## How to select work

1. Read the active plan and current gate.
2. Select the smallest task needed to pass that gate or resolve its riskiest uncertainty.
3. Confirm hypothesis/experiment, instrumentation, fallback and owner.
4. Record release/result/evidence and decision before expanding scope.
5. Stop expansion at L3 if no external tester exists.

## Change discipline

Use neutral domain adapters, versioned schemas/migrations, feature flags and append-only history. Do not pre-build a generic platform. Update current state, changelog and canonical product/learning docs after material changes.
