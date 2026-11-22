# R4.14.1 final report

The combined sandbox flow is implemented and verified: installed MV3 browser observation plus independently authenticated local API/SDK observation, exact scoped native identity correlation, durable PostgreSQL receipts and read-only reconciliation. Meta and HubSpot use the locked official SDKs; Pancake uses a bounded local API emulator. No live provider integration or production data admission is claimed.

Implementation source: `580e499cd55771896b88ffb47adca7689b12c99f`; product tree: `0467316f0ccfb9396af948b252dc21f5b1cb66c8`. Branch: `feat/r4141-hybrid-integration-closure`, based on verified remote R4.14 `164ebc17bff39f5d7604cc6bc5f6d37e7d188c9d`. The R4.14 workflow `44966931141` was rechecked: Product and Browser Operator both SUCCESS. R4.14.1 hosted CI has not run; this branch remains local.

The final local verification has 33 distinct passing lanes, assembled from 32 successful lanes in the full runner and a separate successful coverage rerun at the same source SHA/tree. Coverage: 1,637 tests across 178 files, zero skipped, 90.26% lines. PostgreSQL: 166 tests across 31 suites, zero skipped. Independent clean-worktree install/typecheck/build, 77 focused Vitest tests and 25 Node tests passed. Another independent reviewer reproduced all 9 PostgreSQL receipt tests. Focused and PostgreSQL counts overlap the coverage run and are not added to it. No blanket 100% security coverage claim is made.

The final real Chromium/OIDC/Nest/PostgreSQL E2E passed 18 steps and persisted 13 technical receipts with zero Leads. All three native objects have browser/API pairs. Shared fabricated label v1 is retained alongside conflicting later browser v2/deleted facts. Browser evidence stays UNVERIFIED; API emulator transport authority is retained separately. Identity and completeness do not become commercial truth or full-history claims. Scope-level reconciliation is append-only and includes old/late evidence; it does not silently select a current value.

SDK transports now reject redirects before SDK handling, pin numeric loopback destinations, apply total/inactivity timeouts and response/page limits, and use scoped fabricated credential selection with expiry/revocation and request budgets. Production HTTPS dispatch and a production DNS/IP policy remain disabled. The prospective HTTPS allowlist validator is not a credential-bearing production transport. Revocation during a read prevents persistence; it cannot recall an already-dispatched request.

True ACK loss is tested by committing a receipt then destroying its downstream socket. The worker is terminated/restarted and explicitly replays the retained operation to obtain duplicate acknowledgement and one logical receipt. Chromium's possible automatic HTTP replay is accounted for by keeping the capture's ACK dropped until explicit recovery. A distinct test pauses a real INSERT transaction, kills backend/database sessions, verifies rollback, restarts and replays. These observation-upload controls do not authorize retries of provider mutations or claim exactly-once delivery.

Diagnostics require explicit activation, optional permission and exact tab/origin/native URL scope. Worker startup detaches a persisted debugger; account switching and permission revocation stop capture. Actual worker-module tests prove these behaviors with fabricated Chrome APIs. Diagnostic event categories omit credentials, bodies, variables and raw URLs, remain client/private-observed, and keep completeness UNKNOWN.

The MV3 package contains ten files and no SDK/node_modules/credential material. SHA-256: `856464a638708f252ad69db0aed37ddbf34a5ae40be1b9a8d1d7f0c29ac946df`. No extension was published. Official package LICENSE digests and registry integrity remain recorded. HubSpot metadata ISC versus shipped Apache-2.0 and the Meta Platform License remain distribution review conditions. Backend redistribution is not approved. Production audit is clean; five moderate development advisories remain without an uncontrolled upgrade. A production CycloneDX SBOM and sanitized evidence hashes are recorded in the manifest.

Failures were preserved: C-drive disk exhaustion during preliminary cluster setup, harness sequence coupling and variable shadowing, transparent HTTP replay after socket drop, JSONB fingerprint replay conflict, a stale coverage-directory lock and one migration test exceeding its five-second timeout. The final coverage rerun used an isolated report directory/database and a 20-second per-test timeout without changing tests or skipping suites. Earlier environment-filtered Vitest results are not acceptance proof. All final runner-owned databases/processes were stopped; sanitized project evidence and local packages remain outside any publication flow.

| Gate | Conclusion |
|---|---|
| A | PASS local exact-source regression |
| H | NOT RUN for R4.14.1; R4.14 hosted result remains separate |
| E | PASS tested local MV3 runtime and scoped diagnostic behavior |
| I | PASS three combined fabricated browser/API/backend paths |
| S | PASS post-commit ACK loss, pre-commit rollback and replay |
| R | CONDITIONAL for SDK distribution/license review |
| P1 / P2 | Prior bounded read/pagination preserved; completeness UNKNOWN |
| P3 | SEND_UNRESOLVED |
| P4 / P5 | NOT_TESTED / NOT_VERIFIED |
| B / C | CONDITIONAL / NOT_READY |

The original Pancake incident remains unchanged: Owner NOT_OBSERVED, one attempted POST, zero confirmed writes, no automatic retry, no new mutation, delivery/read UNKNOWN. Zero confirmed writes is not evidence of no write. R4.14.1 performed zero external provider requests, mutations or real-customer-data ingestion. Customer/Lead identities, merge policy, ownership and commercial outcomes are unchanged.

Pending Owner decisions are separate authorization for pushing/hosted CI, SDK distribution review, any production transport/real-data admission and any future provider test. No push, merge, deployment or publication was performed. The Owner's dirty primary worktree was only inspected, not modified. Exact commands, logs, hashes, failure history and independent verification are in `verification.json` and the adjacent focused reports.
