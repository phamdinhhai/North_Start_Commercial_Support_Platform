# RFC Proposal CE-2 — Commercial Event Scope

**Status:** Proposal only — pending Product + Architecture review; not accepted.
**Authority:** Non-canonical report. No canonical file, schema, or implementation is changed.
**Owner:** Product / Architecture; Data and Engineering review evidence/provenance implications.

## Question
Is `CommercialEvent` restricted to inferred/AI-derived commercial meaning, or is it a generalized event/assertion primitive for observed, claimed, imported, and inferred facts?

## Canonical constraints
- Inferred meaning must pass through `Interaction → AI → Commercial Event → Evidence → Policy → Action`; AI never writes opaque canonical truth (I-03/I-04).
- Raw evidence is immutable, provenance is required, and corrections are append-only/reversible (I-05/I-12).
- Observed, claimed, imported, inferred, acquisition mode, and assertion status are distinct dimensions; confidence decorates inference only.
- Commercial Event scope is explicitly unresolved in `COMMERCIAL_EVENT_MODEL.md` and `OPEN_DECISIONS.md`.
- External providers and CRM adapters cannot own canonical semantics (I-10/I-11).

## Alternatives
1. Keep an inferred-only CommercialEvent and a separate assertion envelope for observed/claimed/imported facts.
2. Generalize CommercialEvent with typed acquisition/assertion dimensions while preserving separate raw evidence and policy/action stages.
3. Use a shared append-only assertion store with CommercialEvent as an inferred projection/type, not a universal primitive.
4. Defer unification and retain the current two-path interim model until real workflows demonstrate a need.

## Evidence references
- `docs/canonical/OPEN_DECISIONS.md` — CE-2 row.
- `docs/canonical/COMMERCIAL_EVENT_MODEL.md` — scope ambiguity, required fields, policy-before-action.
- `docs/canonical/TRUST_AND_EVIDENCE.md` — acquisition/assertion dimensions and provenance envelope.
- `docs/implementation-plan/decisions/ADR-001-ce1-ce2.md` and `docs/implementation-plan/spike/RFC-CE1-CE2-draft.md` — inferred-only interim.
- `product/src/domain/commercial-event/commercial-event.ts` — current separate factories and OPEN marker.

## Recommendation (proposal, not a decision)
Retain the two-path interim model until Product/Architecture compare representative observed, claimed, imported, and inferred cases. If unification is proposed, make acquisition mode, assertion status, confidence, evidence pointer/reason, policy outcome, and correction lineage explicit rather than using one overloaded event label. Keep manual fallback operational and feature flag any AI path.

## Migration, security, and privacy impact
Unification would affect event/assertion tables, serializers, consumers, migrations, audit projections, and API compatibility. Raw payloads and evidence pointers need retention/privacy classification, workspace scoping, redaction, and least-privilege access. AI output must remain draft-only and invalid output must fail closed. No schema migration or autonomous action is approved here.

## Required approval
Product + Architecture; Data/Engineering must sign provenance and migration details. Security/Privacy approval is required before exposing raw evidence or enabling new actors/actions.

## Expiry / review
Review before any generalized event schema or AI action path, and no later than 2026-12-13. Without approval this proposal has no operational effect.

## Unresolved questions
- Which facts need one shared lifecycle versus separate projections?
- Does a generalized primitive create ambiguity between evidence and inferred meaning?
- What source-of-authority and conflict rules apply to imported facts?
- Which event types are business operations rather than assertions?

## No-decision / no-go conditions
- **No decision:** unresolved scope boundary, incomplete provenance examples, or missing Product/Architecture approval.
- **No-go:** opaque AI mutation, collapse of evidence into truth, loss of acquisition/assertion distinctions, raw PII in logs, or adapter-owned semantics.
