# R3 independent final QA — 2026-11-19

Reviewed baseline `a386da9` and viewer fix `d1e99d3656559fda985499a5abbf162e6cb48595` (local cherry-pick `e584245`). QA changed only its independent HTTP regression and this report; production repair was made by a separate writer. Canonical documents were not edited. ADR-006 supplies the approved viewer read-only capability boundary.

## Finding and fail-first verification

Baseline permitted viewer pilot intake and lead mutation when the viewer retained owner/active recipient read access. This contradicts ADR-006. The independent signed-OIDC HTTP regression failed before the repair: viewer intake returned 201; mutation requests were not consistently refused with 403 and commercial audit changed. The complete baseline HTTP run had three failing viewer tests; the other 19 HTTP tests passed. Initial draft QA SQL used the incorrect singular `audit_entry` name; it was corrected to workspace-scoped `audit_record` before the recorded regression runs.

After the repair, `npm run test:e2e -- --reporter=default --reporter=json --outputFile.json=../docs/reports/r3-2026-11-18/final-qa-http-results.json`, with `CI=true` and the explicit dedicated `TEST_DATABASE_URL`, passed **3 files / 22 tests, no skips**. Three independent regressions cover:

- Viewer intake returns 403 with no workspace commercial audit delta.
- Sales owner demotion to viewer takes effect on the next request: lead read remains 200, all seven mutation routes return 403, audit remains unchanged.
- Viewer who is an active handoff recipient but not owner retains read access; accept/outcome return 403 with unchanged audit.

Tests use real loopback HTTP, cryptographically signed test JWTs, real verifier/authenticator, real PostgreSQL membership and application persistence. Only the JWKS source is an in-memory local test key fixture. No identity provider or commercial provider was contacted.

## Executed gates

Commands below run from `product/` on Windows with installed dependencies. Earlier daemon interruption did not constitute a completed run; the recovery independently verified the dedicated server and absence of stale test processes before resuming. Local logs/JSON are retained as working evidence, not committed artifacts.

| Command / lane | Actual result |
|---|---|
| `npm run typecheck`; `npm run lint`; `npm run build` | PASS after fix and independent HTTP additions |
| `npm run test:integration:ci` with `CI=true`, explicit local URL, no `DATABASE_URL` | PASS 14 PostgreSQL suites / 64 tests, no skips; per-suite fresh databases |
| `npm run test:cov -- --no-file-parallelism` after fix, `CI=true`, explicit local `TEST_DATABASE_URL`, no `DATABASE_URL` | PASS **91 files / 1,032 tests, zero skips**, including all 64 PostgreSQL tests; fresh dedicated `north_start_ci` database |
| `npm run test:browser` | PASS 4 Chromium operator workflow tests |
| `npm run test:companion` | PASS real Chromium MV3 packaged extension, synthetic WebSocket capture, restart persistence, worker restart/lost-debugger detection, explicit restart, sequence reservation, metadata-only drift, popup accessibility, tab-close stop; providerContacted=false |
| `npm run companion:package` | PASS v0.3.0, nine files, ZIP 48,421 bytes, SHA-256 `b8c4b27f3cc1ed369c4eb9129d7ce2bad8bdb09c8778c1df5e7cd64af531511b` |
| `npm run test:backup` | PASS 6 safeguards |
| `npm run test:registry` | PASS 22 tests |
| `npm run test:security-audit` | PASS 6 tests |
| `npm run architecture:check:strict` | PASS, zero findings |
| `npm run test:architecture` | PASS 10 tests |
| `npm run security:audit` | PASS, production clean, zero dev-only waivers applied |

The isolated PostgreSQL integration gate ran before the controller-only repair; full coverage including all PostgreSQL suites and final HTTP persistence/authentication ran after it. The recipient-only HTTP test was then made self-contained with its own explicitly granted viewer principal; a targeted rerun passed all three viewer tests. The preserved pre-repair unit JSON reports 875 passing tests. An intermediate database-free coverage run passed 968 tests with 64 skips and 84.67% lines; both are superseded by the complete final 1,032-test coverage run above.

Final coverage: **91.08% lines** (3720/4084), 87.38% statements, 85.17% branches, 91.45% functions. The configured global 80% line threshold passes. The AGENTS.md requirement for **100% security-critical coverage is not satisfied or claimed**: `infra/auth` lines are 96.09%, JWKS key store 92.06%, OIDC verifier 95.23%, OIDC module 91.17%. Passing targeted authorization regressions does not establish full security coverage.

## Native PostgreSQL 17 restore evidence

Only dedicated local PostgreSQL port **55441**, user `north_review`, was used; ports 55439/5432 were untouched. Recovery recreated the previously populated dedicated `north_start_ci` database to satisfy the integration gate's empty-database precondition. No application/provider data was used.

Executed `node scripts/restore-rehearsal.mjs` with `TEST_DATABASE_URL=postgresql://north_review@127.0.0.1:55441/north_start_ci`, no `DATABASE_URL`, and `PG_DUMP` / `PG_RESTORE` pointing to `C:/Program Files/PostgreSQL/17/bin/pg_dump.exe` and `pg_restore.exe`. **PASS**: source/restore count and SHA-256 matched for `schema_migrations` (11), `workspace` (1), `integration_enrollment` (1), `integration_receipt` (1), `integration_audit` (1). Restored uniqueness rejected duplicate receipt identity with SQLSTATE 23505. Restore took 362 ms, rehearsal 792 ms; SLA remains **NOT_ESTABLISHED**. Script created and cleaned only its uniquely named disposable databases. Archive SHA-256: `60ebe6f553f353f16a37419b450d433c42dfd58ce908b9e5815b9d2d22671e3d`.

Additionally executed native `pg_dump --format=custom --no-owner --no-privileges`, then `node scripts/backup-verify.mjs verify --backup ... --execute --json` and `restore-verify --backup ... --restore-target postgresql://north_review@127.0.0.1:55441/disposable_r3_restore_20261119 --execute --json`, with `BACKUP_VERIFY_ACK=I_CREATED_THIS_DISPOSABLE_DATABASE`. Both helper operations returned external status 0. The restored application-test archive contained 11 migrations, 60 commercial audit rows and 40 membership audit rows; this supplementary check is not a complete table-by-table equality claim. Archive size 115,051 bytes, SHA-256 `488ee5fdc12a8dfc7f1b87be72706092f667b7624e75fd3ffd26ecbda44cd9c0`. A first manual count query incorrectly used `schema_migration`; the corrected `schema_migrations` query produced those counts. The existing rehearsal above provides the stronger deterministic equality/constraint check.

## Review limits

The confirmed viewer authorization defect is repaired and independently regressed. These results validate synthetic local behavior and do not establish live-provider fidelity, production release approval, restore SLA, or the unmet 100% security-critical coverage requirement. MV3/package validation uses the shipped synthetic artifact and does not claim private/live capture independently audited. No additional production changes were made by QA.
