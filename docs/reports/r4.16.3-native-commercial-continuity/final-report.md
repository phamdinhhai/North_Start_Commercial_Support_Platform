# R4.16.3 final engineering report

The primary React commercial journey and focused cross-Lead source association lifecycle both pass locally. The association scenario creates distinct origin and target Leads, selects the target through React, executes Link, Unlink and Reject, and verifies HTTP responses, versions 1–3, origin/effective IDs, audit history and origin evidence. The Link command now reads the authoritative target receipt history before deriving `expectedVersion`.

The full commercial continuity suite (both browser tests) passed three consecutive clean disposable PostgreSQL runs with zero retries. The focused association test passed independently on a fresh database. Viewer and foreign-workspace browser denial checks passed; backend contracts cover manager/sales/revoked membership, origin/effective scope, conflicts and idempotency. Product, frontend, PostgreSQL, HTTP, architecture and security checks pass. The broad unit suite passed 150 files / 1,491 tests with 31 skipped; its initial run hit host `ENOSPC` in unrelated send-forensics fixtures and passed on the rerun with one worker after disposable temp cleanup.

Current release status is `LOCAL_COMMERCIAL_JOURNEY_VERIFIED_CI_PENDING`. Hosted CI for the current candidate and Owner acceptance remain pending. The dedicated CI config discovers both commercial browser tests; there is no separate association-only CI lane. No provider calls or mutations were made.

Candidate implementation SHA (feature branch): `1a723e1`. Prior feature-branch published SHA: `85b45f307f6eeab301256df9d074f07e869a664d` (Hosted CI run `45582583027`).

Consolidated acceptance candidate branch: `exec/r4163-acceptance` (PR `#5` -> `main`, state `OPEN`, no merge performed). Exact verified candidate SHA: `703cce7a4978cba8bb887da745d2532818590f9c`. Hosted CI runs `45932612513` and `45932607599` passed for that exact SHA across `product`, `React frontend build and contract`, and `Browser operator workflow`. Note: `main..exec/r4163-acceptance` includes owner-approved canonical supersession commit `bd4ee87` (ADR-005..008); no canonical files were modified in this remediation, and CE-1, ID-1, ID-2 remain OPEN.

Final release verdict: `CANDIDATE_CI_VERIFIED_OWNER_CONSOLIDATION_SIGNOFF_PENDING` (production authorization: `NO`; R3 OAR-01..OAR-12 remain `OPEN`).
