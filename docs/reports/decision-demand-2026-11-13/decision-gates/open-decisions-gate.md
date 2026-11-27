# Open-decision gate register

**Date:** 2026-11-13
**Status:** NOT PASSED — working, non-canonical
**Approval rule:** every row is `OPEN`; only the named human owner(s) may approve a canonical change. This record does not resolve any decision.

| ID | Current state | Guardrail before approval | Required approval | Required evidence |
|---|---|---|---|---|
| CE-1 | OPEN | Interim state hypothesis only; reject out-of-boundary transitions. | Product + Data | Transition matrix RFC, valid/invalid transition tests, Gate #A record |
| CE-2 | OPEN | Do not generalize inferred CommercialEvent scope. | Product + Architecture | Scope RFC, observed/claimed/inferred boundary examples, Gate #A record |
| MM-1 | OPEN | Attribution remains UNKNOWN; no causality or revenue credit inference. | Data + Product | Revenue-linkage evidence, model/credit RFC, measurement review |
| ID-1 | OPEN | No automatic identity merge; Customer ≠ Lead. | Product + Data + Trust | Evidence/confidence threshold, manual approval, undo/reversal test |
| ID-2 | OPEN | CRM is an anti-corruption boundary; no inherited canonical semantics. | Engineering + Product | Provider feasibility, authority map, field/schema mapping RFC |
| PM-1 | OPEN | Enforce frozen lead-scoped boundary only; do not expand privileges. | Security + Product | Capability matrix, credential lifecycle, negative authorization tests, security review |
| LG-1 | OPEN | Keep North Star vision separate from current LVP scope. | Founder + Product | Learning-gate evidence, scope impact review, phase decision |

## Stop conditions

Stop implementation and raise an RFC when a proposed change would freeze a state transition, broaden CommercialEvent semantics, expand privilege, merge identities, inherit CRM semantics, choose attribution credit, or broaden current phase scope. A passing code test does not substitute for the required approval.

## Current result

- Gate #A: **NOT RECORDED / NOT PASSED**.
- PH4 gate: **NOT PASSED**; Pancake capability remains `PARTIAL` and `FLAG_OFF`.
- L5 direction gate: **NOT RUN**; no commercial readiness or revenue claim is made.
