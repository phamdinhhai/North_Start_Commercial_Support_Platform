# RFC Proposal ID-2 — CRM Field and Schema Mapping

**Status:** Proposal only — provider-specific mapping review; not accepted.
**Owner:** Engineering; Product owns semantic mapping; Architecture and Security/Privacy review boundaries.

## Question
How should platform primitives (Customer/Lead, Commercial State, Outcome, and any future attribution) map to Twenty or another CRM without inheriting CRM semantics or making a bidirectional sync assumption?

## Canonical constraints
- CRM providers are integration boundaries behind anti-corruption adapters (I-10/I-11).
- Platform owns Lead, Commercial Event, evidence, provenance, continuity, and attribution semantics; CRM does not define them.
- External IDs/timestamps are preserved; joins do not use display names; ingestion is idempotent and raw envelopes immutable.
- Mutations use Commercial Events/policy, never opaque AI writes; access is workspace/lead scoped.
- ID-2 is open and no production CRM mapping is canonical.

## Alternatives
1. A versioned one-way export/import contract with explicit field authority and evidence references.
2. A per-provider anti-corruption adapter with direction and authority defined per field/object.
3. A read-only feasibility adapter that exposes external records as evidence until conflict semantics are validated.
4. Bidirectional synchronization only after conflict, retry, ordering, idempotency, deletion, and permission behavior is contract-tested and approved.

## Evidence references
- `docs/canonical/OPEN_DECISIONS.md` — ID-2 row.
- `docs/canonical/INTEGRATION_PRINCIPLES.md` §§1, 4–6 — CRM boundary and contract guardrails.
- `docs/canonical/DOMAIN_INVARIANTS.md` I-10/I-11/I-12.
- `docs/decision_and_deepresearch_demand.md` §§XV and VI — requested CRM research and authority mapping.
- `docs/reports/rebuild-baseline-2026-11-12/handoff.md` §§85–89, 115–117 — current CRM/Pancake integration deferral.

## Recommendation (proposal, not a decision)
Begin with a provider feasibility study and a versioned, evidence-preserving read-only/one-way contract. Create a field-level authority matrix before any write or two-way sync. Preserve unmapped/conflicting values as UNKNOWN/claims and keep the core operable without a CRM.

## Migration, security, and privacy impact
Mapping affects adapter schemas, external-ID storage, replay/idempotency, conflict resolution, retries, deletion/export, audit, credentials, and field-level access. Credentials must be server-side encrypted, least privilege, rotated, tenant-bound, and redacted. CRM PII must not enter logs or broaden access. No connector, mapping migration, or bidirectional write is approved.

## Required approval
Engineering + Product + Architecture; Security/Privacy and provider/legal review before credentials or real data. MM-1/CE-2 approvals remain separate where semantics or attribution are involved.

## Expiry / review
Review per provider before PH4 or any production CRM work, and by 2027-01-13. This proposal does not authorize implementation.

## Unresolved questions
- Which platform/CRM field is authoritative for each primitive and lifecycle?
- How are conflicting edits, deletions, replays, ordering, and partial failures reconciled?
- What provider scopes and tenant credential lifecycle are available?
- Does a mapped field represent a claim, observation, inference, or merely an external projection?

## No-decision / no-go conditions
- **No decision:** no official/provider evidence, authority matrix, permission model, or contract tests.
- **No-go:** CRM-owned canonical semantics, display-name joins, unscoped credentials, opaque AI writes, untested two-way sync, or fabricated fields when mapping fails.
