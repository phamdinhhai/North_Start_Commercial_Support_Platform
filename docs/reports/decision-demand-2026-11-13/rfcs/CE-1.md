# RFC Proposal CE-1 — Commercial State Transitions

**Status:** Proposal only — pending Human Gate #A; not accepted.
**Authority:** Non-canonical report. This RFC does not amend `docs/canonical/**`, authorize implementation, or close CE-1.
**Owner:** Product / Data; Architecture is a required reviewer.

## Question
What state enum and Commercial Event → Commercial State transition table should govern one Lead, including valid/invalid transitions, authorized actors, terminal-state guards, correction/reopen behavior, and error contracts?

## Canonical constraints
- Customer and Lead remain separate (I-01); Lead ID remains stable (I-07).
- State changes must be evidence-backed, append-audited, reversible, and explicit about UNKNOWN (I-05, I-08, I-12).
- Inferred meaning must use `Interaction → AI → Commercial Event → Evidence → Policy → Action`; AI cannot mutate state directly (I-03, I-04).
- The canonical state enumeration and transition semantics are explicitly open in `docs/canonical/OPEN_DECISIONS.md`.
- No richer state vocabulary or terminal policy may be inferred from the current pilot.

## Alternatives
1. Keep the current LVP hypothesis (`New → Accepted → Contacting → Follow-up → Won/Lost/Unknown`) as a narrowly scoped proposal and reject all other transitions.
2. Adopt a separately versioned transition matrix whose states, guards, actors, evidence, and corrections are explicit.
3. Replace state mutation with append-only assertions and derive a projection only after policy review.
4. Defer a canonical state machine and retain only audited workflow observations.

## Evidence references
- `docs/canonical/OPEN_DECISIONS.md` — CE-1 row.
- `docs/canonical/DOMAIN_MODEL.md` — CommercialState is not enumerated.
- `docs/canonical/COMMERCIAL_EVENT_MODEL.md` — event examples and open transition table.
- `docs/implementation-plan/decisions/ADR-001-ce1-ce2.md` — interim hypothesis and Gate #A.
- `product/src/domain/lead/lead-state.ts` — current hypothesis implementation and boundary rejection.
- `docs/reports/rebuild-baseline-2026-11-12/acceptance-status.md` — technical baseline is not commercial approval.

## Recommendation (proposal, not a decision)
Run a Product/Data/Architecture review using a finite transition matrix. Require each row to name actor, evidence, policy gate, previous/new values, correction path, and refusal code. Until approved, retain the current interim boundary and fail closed outside it; do not expand the enum or treat pilot tests as domain approval.

## Migration, security, and privacy impact
A future approval would require versioned state/assertion records, append-only audit and replay/correction handling, data migration of any existing pilot statuses, and compatibility/error-contract tests. Authorization must be checked at the application boundary, not inferred from upstream roles. Evidence pointers and audit must be lead/workspace scoped, with raw PII excluded from telemetry and logs. No migration or state expansion is authorized by this proposal.

## Required approval
Product + Data + Architecture at Human Gate #A, with Security review if actor privileges or evidence access change. Record the outcome in a superseding decision record; do not silently edit this RFC or the canonical row.

## Expiry / review
Review before PH2/domain-state expansion and no later than 2026-12-13. This proposal expires without effect if Gate #A is not recorded.

## Unresolved questions
- Are terminal states business claims, corroborated facts, or projections of separate assertions?
- Which actors may correct or reopen a state, and what evidence is sufficient?
- Does one Lead permit parallel state assertions, or exactly one active projection?
- How are late, conflicting, and unknown event times ordered?

## No-decision / no-go conditions
- **No decision:** missing Product/Data/Architecture approval, incomplete evidence, unresolved actor/evidence semantics, or disagreement about UNKNOWN handling.
- **No-go:** any proposal that collapses Customer/Lead, bypasses Commercial Event policy, overwrites history, grants unscoped access, fabricates state from missing evidence, or treats the current implementation as canonical.
