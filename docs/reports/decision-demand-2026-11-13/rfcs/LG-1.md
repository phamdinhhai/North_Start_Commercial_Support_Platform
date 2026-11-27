# RFC Proposal LG-1 — North Star Scope and Phase Conflict

**Status:** Proposal only — sequencing review; not accepted.
**Owner:** Founder / Product; Architecture and Engineering provide phase impact; Security/Privacy review expansion risks.

## Question
How should the long-term five-engine North Star be governed alongside the narrow LVP so aspiration is not mistaken for current scope or release approval?

## Canonical constraints
- The North Star is a long-term direction; current LVP is a minimal manual/synthetic continuity loop.
- Current product must preserve commercial meaning, evidence, ownership, next action, and outcome without claiming full attribution/revenue completeness.
- Frozen invariants I-01…I-12 remain binding regardless of phase.
- P0 must work with manual/synthetic adapters; external providers are boundaries; unknown remains visible.
- LG-1 is explicitly a sequencing/scope decision, not permission to expand implementation.

## Alternatives
1. Preserve two layers: North Star as long-term reference and phase documents/gates as the only current delivery authority.
2. Re-baseline the roadmap around a selected engine only after a documented learning gate and evidence.
3. Create a staged expansion contract with explicit entry/exit criteria, dependencies, owner, and release gate for each engine.
4. Pause scope expansion until user/commercial validation demonstrates the current loop's value.

## Evidence references
- `docs/canonical/OPEN_DECISIONS.md` — LG-1 row.
- `docs/canonical/PRODUCT_CONSTITUTION.md` and `docs/canonical/ARCHITECTURE_CONSTITUTION.md` — promise, boundaries, and no premature abstraction.
- `docs/implementation-plan/01-scope-and-principles.md` §§1–5 — P0/P1/out-of-scope and gates.
- `docs/implementation-plan/05-phase-map.md` and `docs/implementation-plan/08-verification.md` — phase gates and unclosed L2→L3/L3/L4/L5.
- `docs/reports/rebuild-baseline-2026-11-12/acceptance-status.md` — technical baseline accepted with commercial/release approval not accepted.

## Recommendation (proposal, not a decision)
Keep the North Star and LVP as separate governed layers. Require a phase-gate record before adding an engine or broadening claims, with evidence, scope, security/privacy review, migration plan, and rollback/no-go criteria. Treat the current technical baseline as development evidence only, not commercial readiness.

## Migration, security, and privacy impact
Scope expansion can introduce new data classes, connectors, identities, permissions, retention/export/delete obligations, operational dependencies, and release claims. Each expansion must preserve manual fallback, tenant/lead scope, raw evidence, audit, UNKNOWN, and adapter boundaries. No phase, product promise, or deployment is expanded by this proposal.

## Required approval
Founder/Product phase decision with Architecture/Engineering review; Security/Privacy, Data, and legal/operations gates where the proposed scope adds real data, integrations, or customer claims. Record accepted scope in the appropriate governance record without rewriting canonical history.

## Expiry / review
Review at each L2/L3/L4/L5 gate and no later than 2026-12-13. This proposal expires without a recorded phase decision.

## Unresolved questions
- Which user evidence and business outcome are sufficient to open the next engine?
- What exact capabilities, dependencies, and security controls enter each phase?
- Which existing requirements are hypotheses versus release commitments?
- How are deferred R-29+ and service/control-plane ambitions kept out of current scope?

## No-decision / no-go conditions
- **No decision:** missing phase evidence, gate participants, acceptance criteria, or commercial/user validation.
- **No-go:** implementing North Star aspirations as current requirements, claiming revenue uplift/readiness from technical tests, bypassing human gates, expanding permissions/data access without approval, or weakening frozen invariants.
