# Lead access hardening

2026-11-17; implementation against integrated baseline b0f2a8c in `work/unified-security`.

## Scope and decision boundary

Repairs architecture baseline A1 (feedback and intake replay leakage) and A2 (PostgreSQL queue divergence). Uses existing `LeadAccessPolicy` and existing base role behavior. Canonical I-09 is enforced; PM-1 remains OPEN. No domain transition, reassignment, grant, migration or canonical file changed.

Shared application helper derives the lead resource from workspace, current owner and active work recipients. Lead view, linked feedback read/write and intake replay reuse that policy. Missing/cross-workspace leads return 404; unauthorized same-workspace access returns 403. Replay authorization precedes payload comparison, including recovered idempotency winners, so unauthorized requests cannot obtain existing identity/status or conflict details.

Unlinked feedback is visible to its author or existing workspace admin/manager authority, as evaluated through the existing policy. An unrelated sales/viewer receives no cross-actor access. Linked feedback always requires current lead access, even when the caller authored the feedback. This narrow deny-by-default fallback implements I-09; it does not approve a new PM-1 capability matrix.

PostgreSQL queue now uses a lead-wide EXISTS over actionable actor assignments (`proposed`, `accepted`, `open`, `awaiting-external`), matching memory and existing lead read semantics. Closed historical actors alone cannot retain access. Active recipients retain the existing lead-wide projection, including historical rows; no new mutation authority follows.

## Verification

- `npm ci` completed.
- `npm run typecheck` passed.
- `npm run build` passed.
- Targeted Vitest run: 8 files, 88 tests passed, no skipped tests. Included both the existing PostgreSQL pilot suite and the new real PostgreSQL access suite against disposable local PostgreSQL, plus pilot application/controller and feedback controller tests.
- New controller regressions cover linked-feedback denial, own unlinked feedback, no cross-actor sales grant, current owner/active recipient access, historical recipient revocation, existing admin/manager workspace authority, missing/cross-workspace denial and matching/conflicting unauthorized replay.
- New PostgreSQL/memory contract matrix covers all seven work statuses across sales/viewer/admin/manager, active-recipient lead-wide results, pagination, historical-recipient revocation, owner reassignment and foreign workspace invisibility.
- Unauthorized real PostgreSQL intake replay, including a forced initial lookup miss that exercises the durable idempotency winner, leaves lead/envelope/ingest-command/audit counts unchanged and owner intact.
- `git diff --check` passed. Files remain below 500 lines.

## Limits and review request

Synthetic local fixtures verify application and persistence behavior, not production authorization acceptance. Existing broader admin/manager hypotheses remain unresolved under PM-1. Feedback listing still loads a workspace set before filtering; pagination/optimization is outside this repair. Authorization uses a read snapshot like existing lead routes; atomic permission changes concurrent with feedback writes remain a broader transaction-policy concern.

Request independent review of application policy reuse, every intake winner/recovery path, the conservative unlinked-feedback fallback, and the PostgreSQL/memory visibility contract before integration. Root owns independent review and final integrated verification.
