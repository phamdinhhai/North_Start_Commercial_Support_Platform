# Independent QA

The work used four actual specialist agents plus the root integrator. Each writing agent used an isolated worktree; the Owner's primary worktree and its unrelated dirty files were preserved.

| Specialist | Ownership / independent review | Evidence |
|---|---|---|
| sdk_egress | SDK relay, bounds and negative tests; later read-only receipt/security review | SDK fixture/redirect/timeout/rate/credential tests; exposed browser-only identity promotion and bounded-query risks |
| cross_source | Pure correlation, provider fact helper and combined harness | Separate API/browser enrollments, shared label conflicts, actual transaction crash injection |
| ack_recovery | Initial dropped ACK, diagnostic activation, license inspection; independent clean worktree reproduction | Exact final `npm ci`, typecheck/build, 77 focused Vitest and 25 Node tests; package/SBOM evidence |
| closure_qa | Independent security/source review and exact-source PostgreSQL reproduction; diagnostic worker correction in its own worktree | 9 PostgreSQL receipt tests; 28 focused tests after replay fix; 23 Node runtime/worker tests; final manifest review |

Reviews found and corrected browser-only identity promotion, missing direct value conflict evidence, worker restart debugger attachment, same-origin account-switch diagnostics, shared-producer sequence coupling, and JSONB fingerprint replay. The last defect was reproduced by the new PostgreSQL replay test and fixed in `580e499cd55771896b88ffb47adca7689b12c99f`. Pure evidence conflicts compare retained payload values even if an envelope repeats a digest.

The final implementation product tree is `0467316f0ccfb9396af948b252dc21f5b1cb66c8`. Independent clean reproduction at that exact SHA/tree passed a sequential locked install, typecheck/build, 77 focused Vitest tests and 25 Node tests. A clean-install/build race in an earlier QA attempt was corrected by sequential execution; it is not concealed as a first-attempt pass. Package ZIP hash is `856464a638708f252ad69db0aed37ddbf34a5ae40be1b9a8d1d7f0c29ac946df`.

Independent PostgreSQL verification used its own disposable cluster and ran `vitest run src/infra/integration/hybrid-receipts.integration.spec.ts --no-file-parallelism`: 9/9 PASS, zero skipped, on exact final implementation source. The cluster was stopped. A preliminary Windows pg_ctl inherited-pipe harness problem was recorded separately. No provider calls occurred.

The exact-source combined Chromium log was independently checked: 18 steps, 13 receipts, zero Leads, completeness UNKNOWN, SEND_UNRESOLVED preserved. Its final log hash is `dddf1ea781b6ea45c0b3ff040c02cc5adca84a88b56cad404fc9307060a249de`. It demonstrates fixture-emulator authority; it does not verify a real provider integration.

Security review found no client authority escalation or stored-fingerprint leakage. Credentials are selected server-side; receipt append rechecks current authorization. In-flight read revocation prevents persistence but cannot recall an already-dispatched request. Production HTTPS/DNS dispatch, distributed credential custody and unrestricted real-data ingestion remain outside the verified boundary.

Full-lane and coverage conclusions are taken only from the final manifest. Preliminary default Vitest runs skipped PostgreSQL suites without an integration environment and are not zero-skip acceptance evidence. A coverage-directory lock and a five-second migration timeout were retained as separate failures before the isolated coverage rerun. SDK distribution remains conditional regardless of audit command exit status. No push, merge, deployment, publication or provider request is included in acceptance.
