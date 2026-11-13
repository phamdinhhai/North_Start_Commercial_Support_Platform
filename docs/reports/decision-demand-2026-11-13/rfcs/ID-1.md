# RFC Proposal ID-1 — Identity Merge Thresholds and Undo

**Status:** Proposal only — open decision; not accepted.
**Owner:** Product + Data + Trust; Security/Privacy reviews access and sensitive evidence.

## Question
What evidence/confidence thresholds distinguish same identity from UNKNOWN, what merge/review policy applies, how are merges and unmerges represented, and who may invoke undo?

## Canonical constraints
- Customer and Lead remain separate; one Customer may have many Leads (I-01/I-07).
- Similar identifiers must not be merged automatically; links require evidence, confidence, provenance, manual correction, reversible undo, and audit (I-06).
- External identities are provider-scoped and display names are not join keys.
- UNKNOWN and conflicting sources remain visible; raw evidence is immutable (I-08/I-12).
- Automated identity merge is outside current LVP and ID-1 is explicitly open.

## Alternatives
1. Manual review for every merge/unmerge with evidence bundle and explicit rationale.
2. Risk-tiered candidate matching: deterministic evidence may suggest a candidate, but human approval is required above all thresholds.
3. No merge; maintain explicit links/aliases and leave identity unresolved where evidence is insufficient.
4. A policy service with versioned thresholds, reversible transactions, and a quarantine/review queue.

## Evidence references
- `docs/canonical/OPEN_DECISIONS.md` — ID-1 row.
- `docs/canonical/IDENTITY_MODEL.md` §§1–4 — identity primitives, deferred graph, reversible links.
- `docs/canonical/DOMAIN_INVARIANTS.md` I-01, I-06, I-08, I-12.
- `docs/reports/rebuild-baseline-2026-11-12/handoff.md` §§67–73, 114–117 — current no-merge boundary.
- `product/src/domain/customer/`, `product/src/domain/lead/`, and invariant tests — current separation and stable IDs.

## Recommendation (proposal, not a decision)
Keep automated merge disabled. Define an evidence taxonomy and manual review/undo contract first; use candidate suggestions only as non-authoritative, auditable drafts. Test false-positive/false-negative cases, shared identifiers, multiple Leads per Customer, corrections, and cross-workspace attempts before selecting thresholds.

## Migration, security, and privacy impact
Merging affects identity keys, Lead/Customer references, access scopes, evidence lineage, audit, exports, retention, deletion, and downstream adapters; migration must be reversible and preserve original IDs/history. Identity evidence is sensitive PII: minimize, encrypt, restrict by workspace/lead, redact logs, and record reviewer access. No merge or threshold migration is authorized.

## Required approval
Product + Data + Trust, with Security/Privacy review and Architecture sign-off for key/reference changes. Human approval is required before any automation.

## Expiry / review
Review before any automated identity graph/merge, and by 2027-01-13. Until then leave uncertain links UNKNOWN and preserve separate entities.

## Unresolved questions
- What combinations of evidence are sufficiently independent and reliable?
- Does confidence apply to identity inference only, and how is it calibrated?
- What is the minimal undo guarantee after downstream references exist?
- Which roles may propose, approve, undo, or inspect a merge?

## No-decision / no-go conditions
- **No decision:** no evidence taxonomy, reviewer/undo authority, or reversible migration plan.
- **No-go:** automatic merge from similarity alone, collapsing Customer and Lead, deleting raw evidence/history, cross-workspace linking, or hiding uncertainty.
