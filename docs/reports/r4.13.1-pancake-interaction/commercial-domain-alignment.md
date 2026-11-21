# R4.13.1 commercial-domain alignment

**Scope.** This review is source-only and bounded to the Pancake interaction/domain seam. It uses the checked-out `d990437` baseline, canonical domain invariants, PH3 pilot services, adapter code, migrations `001`–`023`, and read-only GitHub metadata. No provider request, credential, capture, Customer merge, owner assignment, outcome or revenue inference was performed.

## Domain contract

The canonical model keeps Customer and Lead separate (I-01); Lead is one acquisition episode with an immutable ID (I-07). Conversation source, acquisition lineage and attribution are three distinct chain concepts (I-02), with attribution remaining UNKNOWN in LVP. Pancake records therefore enter as immutable raw envelopes/evidence through an anti-corruption adapter (I-10/I-11/I-12). A message or status from Pancake is evidence, never a canonical Lead, Customer, owner, state, outcome or revenue fact.

The implemented adapter is disabled by default, validates the connection surface, creates idempotent envelopes, preserves raw payloads, detects duplicates/out-of-order records, and quarantines malformed/schema/conflicting pages. `SourceIntegrationService` is explicitly synthetic-only and returns `verification: UNVERIFIED`, `completeness: UNKNOWN`; this is the correct boundary until authenticated admission and retention/privacy gates exist. `Lead` creation defaults attribution to UNKNOWN and has no merge operation. The pilot loop owns scoped handoff/action/outcome commands and append audit; it does not derive those commands from a provider read.

## Migration/domain inventory

Forward and down pairs exist for 001–023. The sequence grows the PH3 domain (`001_domain`), telemetry (`002`), pilot loop and envelope/workspace controls (`003`–`005`), ingest/evidence/receipts/provenance (`006`–`009`), membership/governed actions/content digest/closure (`010`–`013`), delivery/lifecycle/assertion/contact (`014`–`017`), source integration and lookup/link guards (`018`–`021`), sync streams (`022`) and fabricated delivery (`023`). Migration tests cover lifecycle, 004 quarantine and 005 consistency; no new migration is justified by this review. Any future live Pancake schema must be additive, preserve raw-before-projection, and have forward/rollback rehearsal.

## Alignment findings

- **Aligned:** native source identity remains distinct from commercial identity; source receipts and links are auditable and workspace-scoped; synthetic admission cannot claim authenticated provider trust.
- **Open by design:** CE-1 transition matrix, identity merge thresholds (ID-1), CRM mapping (ID-2), and detailed permissions (PM-1) remain unresolved. No release step may silently resolve them.
- **Release blocker:** authenticated account/Page/contact binding, minimized retention/erasure policy, and real-data admission are not demonstrated. Existing status is Gate B conditional and Gate C not ready for real customer data.
- **No defect requiring code change:** offline focused checks and existing source protections support the boundary. Provider capability claims must come from the root execution journal, not this report.

## Safe acceptance assertions

A compliant rehearsal must show: (1) raw envelope persisted before any projection; (2) duplicate replay is idempotent and changed-payload conflict quarantines; (3) malformed and out-of-order records stay UNKNOWN/flagged; (4) cross-workspace and unassigned Lead access is denied; (5) source link/unlink/reject is explicit and audited; (6) no read creates Customer/Lead merge, owner, outcome or revenue state; and (7) rollback leaves prior raw evidence intact. A failed assertion stops the lane and leaves evidence quarantined.
