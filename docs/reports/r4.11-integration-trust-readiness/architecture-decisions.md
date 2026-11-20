# R4.11 bounded architecture decisions

This records implementation seams under accepted ADR-005–009. It does not alter frozen canonical decisions CE-1, ID-1 or ID-2. Evidence paths are relative to product/src unless specified.

| Question | R4.11 decision | Evidence / remaining limit |
|---|---|---|
| Native message identity | Workspace + native system + native page + message ID identifies a declared object namespace | source-observation.ts, PgSourceIntegrationStore; event ID/revision identifies observations separately |
| Conversation identity | Provider-scoped grouping label; not customer identity or episode policy | conversation-identity-decision.md, multi-message PG/browser cases |
| Customer identity | Canonical Customer remains separate from Lead and transport IDs | I-01, I-06; no Customer merge writer added |
| Commercial episode | Existing stable Lead is the bounded episode context; no generic identity engine | Lead domain unchanged; CE-1 remains open |
| Messages sharing a Lead | Existing exact native object alignment remains synthetic. Different messages keep original seeds; an owner/admin can explicitly associate evidence context | source-continuity service/store and append-only020; intake attach deferred |
| Cross-provider authority | Client fixture declarations are USER_ASSERTED_CANDIDATE only. No current actor can mint provider-verified linkage | source-trust helper and adversarial tests; future attestation must be separately authenticated |
| object_aligned proves | Supplied synthetic native object keys matched the same workspace mapping | source-intake PG collision/replay cases |
| object_aligned does not prove | Same event, same person, commercial episode, provider authentication, history completeness, purchase or revenue | UI categorical trust labels, UNKNOWN/UNVERIFIED |
| Pancake original Meta IDs | Retain separate transport/native provenance, but treat declared originalMeta as fabricated candidate | Pancake fixture decoder unchanged, service validates impossible Meta-route namespaces |
| Provider vs operator principals | Existing OIDC admin controls local fixtures. Future connection-bound service principal is design only, append capability and revocation/account binding required | provenance-security-review.md, provider-contract-readiness.md; no live route registered |
| Data before Gate C | Fabricated synthetic content only, HMAC and immutable accepted envelopes/audit; no real personal conversations or credentials in source/logs | existing feature gate, safety/security regression; lifecycle remains Gate C blocker |
| Revocation | Connection remains durable with revoked status; intake/replay checks status inside exclusive transaction. Historical authorized reads remain available | deterministic intake/revoke lock test, browser revoked-intake case |
| Receipt/checkpoint atomicity | Existing receipt/evidence/seed/audit is one PG transaction. Offline processAndCheckpoint port requires atomic receipts+checkpoint before ack; no actual provider checkpoint persistence is claimed | source store; offline transport unit tests and explicit port limitation |
| No reliable backfill | Keep completeness UNKNOWN, expose gaps, stop bounded offline run before accepting a gap, retain cursor for explicit recovery | offline gap/poison/replay tests; no exactly-once/full-sync claim |
| Provider-approved sandbox | Owner/app/account entitlement, approved scopes, synthetic-only assets, token custody, secure webhook, revoke/cleanup and separate explicit network approval | sandbox-admission-checklist.md; BLOCKED — PROVIDER AUTHORIZATION |

Read authority is evaluated per request/page. Linking never grants origin access; target and origin are independently authorized, and inaccessible identifiers/counts are not returned. In-flight responses use the authorization observed during that request; revocation/correction is guaranteed on subsequent requests, not instantaneous cancellation of responses already in progress. Link history is bounded to100 and reports UNKNOWN; only native evidence has cursor continuation in this slice. Original per-message Leads remain, so this is a selective context workflow, not solved production conversation segmentation.

Mutation authority is checked again from actual sorted locked Lead rows inside the receipt transaction, preserving existing owner policy without nested pool acquisition. The max1/ten-command actual runtime test protects this correction.021 validates new source link receipt/envelope/origin equality and refuses inconsistent preexisting history; it never repairs immutable records.019 is index-only;020 down refuses nonempty history;021 down is an explicitly weaker paused-writer engineering downgrade.

Provider code remains unregistered offline research tooling. Only network request callbacks have enforced timeout/abort; trusted authorization/persistence/ack callbacks must terminate. Attempt/item limits and between-operation elapsed checks are bounded, not an end-to-end SLO. Actual shared PostgreSQL checkpoint integration, OAuth broker, live webhook admission and rate-limit worker scheduling remain deferred.
