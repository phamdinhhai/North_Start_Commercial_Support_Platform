# R4.16.3 final engineering report

The primary React commercial journey and focused cross-Lead source association lifecycle both pass locally. The association scenario creates distinct origin and target Leads, selects the target through React, executes Link, Unlink and Reject, and verifies HTTP responses, versions 1–3, origin/effective IDs, audit history and origin evidence. The Link command now reads the authoritative target receipt history before deriving `expectedVersion`.

The full commercial continuity suite (both browser tests) passed three consecutive clean disposable PostgreSQL runs with zero retries. The focused association test passed independently on a fresh database. Viewer and foreign-workspace browser denial checks passed; backend contracts cover manager/sales/revoked membership, origin/effective scope, conflicts and idempotency. Product, frontend, PostgreSQL, HTTP, architecture and security checks pass. The broad unit suite passed 150 files / 1,491 tests with 31 skipped; its initial run hit host `ENOSPC` in unrelated send-forensics fixtures and passed on the rerun with one worker after disposable temp cleanup.

Current release status is `LOCAL_COMMERCIAL_JOURNEY_VERIFIED_CI_PENDING`. Hosted CI for the current candidate and Owner acceptance remain pending. The dedicated CI config discovers both commercial browser tests; there is no separate association-only CI lane. No provider calls or mutations were made.

Candidate implementation SHA: `1a723e1`. Published candidate SHA: `9d6e548ce9fb277db92d81fd34477d83fee5a29d`. Hosted CI run `45580433911` passed for that exact SHA across Product, React frontend build/contract, and Browser operator workflow jobs.

Final release verdict: `COMMERCIAL_JOURNEY_CI_VERIFIED_OWNER_ACCEPTANCE_PENDING`.
