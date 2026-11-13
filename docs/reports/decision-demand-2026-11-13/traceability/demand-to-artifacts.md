# Decision and deep-research demand traceability

**Date:** 2026-11-13  
**Status:** working, non-canonical  
**Scope:** Phase 0 research and Phase 4 integration readiness  
**Canonical boundary:** `docs/canonical/**` was not edited. This package records traceability; it does not approve a decision, connector, or release.

## Traceability matrix

| Demand area | Existing documented basis | Artifact in this package | Current disposition |
|---|---|---|---|
| Repository truth and baseline | `docs/reports/rebuild-baseline-2026-11-12/`; `docs/reports/project-status-and-handover.md` | `baseline/repository-baseline.md` | Technical baseline only; runtime and hosted CI limits remain explicit |
| Seven open decisions | `docs/canonical/OPEN_DECISIONS.md`; `docs/implementation-plan/08-verification.md` | `decision-gates/open-decisions-gate.md`; `docs/research/registries/decision-register.json` | All seven remain `OPEN`; human approval required |
| Phase 0 / Gate #A | `docs/implementation-plan/phases/PH0-spike-and-research.md`; `spike/RFC-CE1-CE2-draft.md` | `decision-gates/phase-0-gate.md` | Not recorded as passed |
| Phase 4 Pancake readiness | `docs/implementation-plan/phases/PH4-pancake-sync.md`; `spike/pancake-verdict.md` | `decision-gates/phase-4-gate.md`; `docs/research/registries/evidence-capability-register.json` | `PARTIAL`, feature flag `FLAG_OFF`, manual fallback retained |
| Evidence and capability coverage | API KB `SCOPE_AND_COMPLETENESS.md`, `REMAINING_GAPS.md`, `machine_readable/integrity_report.json` | `docs/research/registries/evidence-capability-register.json` | Catalog/documentation facts preserved; live claims not manufactured |
| Reusable engineering assets | `docs/decision_and_deepresearch_demand.md` sections XVIII–XIX | `docs/research/registries/reusable-engineering-assets.json` | Candidates remain `REFERENCE`; no adoption implied |
| Research demand and unknowns | `docs/research/.../OPEN_QUESTIONS.md`, `HYPOTHESIS_REGISTER.md`, `EXPERIMENT_REGISTER.md` | `baseline/research-demand-status.md` | Unknown, untested and proposed states preserved |

## Interpretation rules

1. Canonical documents outrank this package.
2. `family_verified` or `endpoint_verified` in the API inventory describes source coverage, not live availability, permission, runtime compatibility or release approval.
3. Dashboard/internal read observations do not establish a Public API contract.
4. Synthetic/manual tests do not establish customer evidence, adoption, prevalence, revenue uplift or commercial readiness.
5. No live verification is claimed where credentials, fixture, receiver, or complete capture is absent.
6. Any change to a canonical decision requires the named human gate and an evidence-linked RFC/ADR.
