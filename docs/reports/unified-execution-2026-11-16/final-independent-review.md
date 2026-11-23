# Final independent review — 2026-11-17

Reviewed integration SHA `2224fde0672c3ad028dc5da61d753a0fd779f5c9` from isolated worktree `north-star-unified-review`, branch `work/unified-review`. Read-only implementation review; only this report is authored here. Applied code-review-excellence review guidance.

## Verdict

No blocking defect reproduced in the reviewed changes. This is a scoped engineering review, not approval of unresolved canonical decisions or a production release. PM-1 remains OPEN; existing manager/admin workspace authority is reused, without introducing mutation authority. No canonical files changed by this review.

## Independent verification

All executions below used this exact reviewed SHA and synthetic local fixtures. PostgreSQL 17 at `127.0.0.1:55439`, user `north_test`; dedicated caller-created `disposable_final_review` database prevented shared fixture races.

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | Success; npm reported 5 moderate vulnerabilities |
| `npm run build` | Success |
| Feedback controller, lead-access hardening, PostgreSQL lead access and completion provenance | 4 files, 14 tests passed, 0 skipped |
| Pilot service, evidence guardrails, migrator and pilot controller | 4 files, 66 tests passed, 0 skipped |
| Real HTTP/AppModule/Fastify + PostgreSQL integration upload | 1 file, 6 tests passed, 0 skipped |
| Chromium operator browser suite, dedicated port 3197 | 4 tests passed |
| `node scripts/restore-rehearsal.mjs` after build | PASS; 9 migration records and four seeded tables matched counts and SHA-256 hashes; restored delivery uniqueness rejected duplicate with SQLSTATE 23505 |

Total: **86 Vitest tests and 4 browser tests passed**, plus build and restore rehearsal. Restore archive SHA-256: `ed1bb7843bd00a6e7effc8bb92d250c1a1d3b7e628399e653a4357e8a9a537d0`; restore phase 433 ms, whole backup/restore measurement 792 ms. These local measurements establish no SLA.

The restore harness was invoked with explicit local `/north_start_ci` configuration only as its required guard; code creates unique `disposable_restore_source_<uuid>` and `disposable_restore_target_<uuid>` databases. It backs up/restores those names and cleans only names successfully created by that invocation. It does not restore into the shared CI database. Native PostgreSQL 17 dump/restore binaries were explicitly selected.

## Negative-case review

- Security `3fe3e0a`: linked feedback submission checks current lead policy before service submission. Missing/cross-workspace leads return 404; unassigned same-workspace access returns 403. Listing excludes inaccessible linked feedback even if caller authored it, excludes foreign rows, retains own unlinked rows and existing privileged workspace reads. Tests verify denied submission never invokes the write port.
- Intake replay: initial lookup, adapter conflict recovery, persistence conflict recovery and persisted winner return all apply authorization before returning identity or mismatch details. PostgreSQL test forces an initial lookup miss and verifies unauthorized durable winner handling leaves lead/envelope/reservation/audit counts unchanged. New intake assigns caller as owner at controller boundary, so the post-persistence authorization check does not refuse an ordinary newly created lead under the current policy.
- Queue: PostgreSQL EXISTS uses the same active status set as memory policy, granting lead-wide visibility through active recipient work. Historical cancelled work and transferred former ownership do not retain visibility; workspace scope remains constrained. Read visibility does not grant owner-only mutation capability.
- Persistence `6d0430a`: migration 009 adds nullable declaration/confirmation fields. Legacy missing values remain absent on hydration; no declaration, human confirmation or occurrence time is fabricated. Fresh pools preserve declared text/confirmation and observed reference/hash. Migration down/up loses only the added projection columns while completion audit history remains identical.
- Operator `c647631`: delayed prior selection responses cannot replace current displayed context; action handlers bind to their rendered item. Browser checks reproduce overlapping selection and genuine stale WORK_SUPERSEDED conflict. Credential edits invalidate pending context/queue responses.
- Fastify hook `78ef2f8`: six real HTTP cases passed using AppModule rather than an isolated fake controller; upload denial/replay/restart behavior remains covered.

## Limits

Root agent owns full-suite/CI validation. This review independently ran the targeted suites above, not the entire product suite or production deployment. Browser tests use synthetic memory mode; durable behavior was separately exercised against local PostgreSQL. Restore fixture hashes cover migration/workspace/integration enrollment/receipt/audit tables, not every populated business table. No throughput, production-sized restore, real Pancake credentials or production IAM capability matrix was assessed. No regression test or implementation edit was necessary because no new bug was reproduced.
