# R4.12 identity regression and continuity review

This offline review preserves R4.11's explicit receipt-to-episode link/unlink/reject stream. It does not attach provider messages during intake or reopen Customer/Lead merge decisions.

Provider account/page is a server-bound authorization namespace. Native conversation is provider-scoped grouping metadata, not Customer identity. Native message and native event/revision remain separate immutable observations. Existing Lead seeds remain stable; a later message in an existing conversation receives its own seed unless a human explicitly associates evidence context. No sync worker may assign ownership, alter handoff/work/outcome, infer payment, or promote `UNVERIFIED` data.

The added PostgreSQL case in `source-continuity.integration.spec.ts` runs incremental deletion/edit observations, replay, and a later message sharing a conversation. It proves existing explicit link history, original raw envelope, owners, Customer IDs, attribution, status, handoff/work/outcome tables stay unchanged; replay is duplicate; and the later message receives a separate Lead seed. Existing suites cover same-conversation distinct seeds, dual Pancake/Meta provenance, duplicate replay, event collisions, workspace isolation, immutable evidence, revoke ordering and explicit audited associations.

R4.12 durable sync must call the existing source intake/evidence boundary with server-bound connection context. It may advance a page checkpoint only after accepted receipt/evidence effects commit in one transaction. It must not hold that transaction while waiting for a provider request. Page replay must return duplicate receipts or an equivalent idempotent result without creating ownership or commercial effects.

Repeated/incremental policy: same receipt and fingerprint is idempotent; changed meaning conflicts/quarantines; new conversation messages preserve their own source receipt; edit/delete is append-only lifecycle history; missing IDs remain UNKNOWN/quarantined; same Pancake/Meta native IDs retain route provenance and remain unverified; cross-workspace native IDs are unrelated namespaces.

Authorization is separate from human OIDC. A worker may process only an active server-bound stream lease and admitted account scope. Revocation blocks the next fetch/commit while preserving authorized historical evidence. Linked reads use request-time authorization; no instantaneous cancellation of in-flight responses is promised. Completeness remains UNKNOWN until reconciliation/backfill is proven.

CE-1, ID-1 and ID-2 remain open; automated segmentation, Customer merge, intake attach and external CRM mapping are deferred. Status: CONTRACT PREPARED / OFFLINE VERIFIED after integrated tests; provider authorization NOT ESTABLISHED; live read-only operation NOT RUN; Gate B CONDITIONAL; Gate C NOT READY FOR REAL CUSTOMER DATA.
