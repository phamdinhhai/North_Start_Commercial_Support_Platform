# Independent R4 Product / Architecture Review

Reviewer: r4_review, gpt-6.1-sol. Read-only inspection of the integrated R4 worktree; this report records the review delivered to root. No release gate is closed by this document.

No additional authentication or tenant-scope blocker was found in the inspected code. Two findings required remediation:

1. Medium: admin export omitted work_created/work_reopened audit rows because work items use the historical commercial-event entity type with work-item IDs. Root extended the workspace/lead-scoped predicate to include work-item IDs regardless of entity type and added a PostgreSQL regression. Root's final integrated PG gate passed with this regression; see verification.json.
2. Minor: unknown synthetic classification appeared like real in the All list. Detail already displayed UNKNOWN. Root changed list labels to explicit SYNTHETIC / REAL / CLASSIFICATION UNKNOWN. Root's final component/browser gates passed, including the new UNKNOWN-label component check; see verification.json.

| Requirement | Inspected implementation |
|---|---|
| Manual authenticated workflow | Browser session/controller, operator UI, closure command surfaces |
| PKCE/state/nonce/CSRF | Single-use bound transaction, S256 verifier, fixed callback, global cookie preparation, Origin plus CSRF |
| Revocation | Existing authenticator resolves internal identity/membership every request |
| Keyed immutable evidence | Workspace/purpose HMAC, retained kid, immutable content comparison and legacy reading |
| Audited corrections | Context revisions, successor work, outcome supersession, CAS and command receipt transaction |
| Honest classification | Backend null retained; unknown excluded from real/synthetic filters and learning |
| Durable delivery | Atomic action/outbox append, lease recovery, bounded retry and deduplicated inbox |
| Scoped export | Admin policy, workspace predicates, repeatable-read snapshot, audit-before-return |

Independent focused validation: six test files, 33 tests passed (browser-session service/protocol/HTTP, pilot closure service, digest configuration and delivery-runner tests). No external provider or shared database touched. PostgreSQL and browser evidence from other lanes was inspected but not independently rerun by this reviewer.

Conditional assessment: useful foundation for an internal/synthetic LVP acceptance exercise. Physical deletion, anonymization, retention expiry, legal hold enforcement and encrypted raw research capture remain NOT IMPLEMENTED. Outbound integrations remain gated; assertion delivery defaults off and is local/test only. Real IdP deployment, external Sales usability, all security-critical coverage and commercial readiness require separate evidence. Full R4 completion and production readiness are not established by this review.
