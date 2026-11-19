# R4.7 reliability and recovery — 2026-11-19

Scope: REL-01 P0/P1 bounded fabricated-data validation. ADR-005/006/007/009 apply; no new commercial transitions, outbound enablement, raw rewrite or retention promise. User acts as self-operator; organization approval and human-participant validation remain pending. No participants invited, deployment, shared database or real data used.

## New failure evidence

`product/src/infra/postgres/pilot-resilience.integration.spec.ts` adds five independent PostgreSQL tests. The private pool has maximum two connections, 300ms acquisition deadline, 1s statement limit and 2s idle-transaction limit; existing test timeouts are unchanged.

- Saturate both connections: a queued transaction rejects on acquisition timeout, no waiter remains, then health and a fresh transaction succeed. Observed acquisition was about333ms. This proves the explicitly configured pool deadline, not a throughput/SLO result. Runtime default remains5s.
- Terminate only the checked-out transaction backend after an uncommitted workspace insert. The transaction rejects, its insert is absent, and fresh health/query/mutation succeeds. This is an actual server-session interruption, not an OS worker or database restart.
- Throw an original business error: preserve its identity, rollback its write, reuse healthy connections.
- Inject failing migration SQL after CREATE TABLE: both DDL and migration bookkeeping rollback. Corrected retry/up/down succeeds. Operator must stop startup, correct the reviewed migration/cause and retry; never mark a failed version applied manually.
- Persist a bare fabricated legacy lead with missing evidence: response has empty items, UNKNOWN classification (`null`) and audited access. A separate new fabricated immutable envelope includes private marker fields; evidence output omits them while the database retains the accepted raw fixture. No immutable evidence is edited to manufacture the test. This is response field filtering, not canonical erasure.

REL-F01 (confirmed and fixed): active PoolClient connection errors emitted during backend termination escaped the query promise as uncaught ECONNRESET. `PostgresService.withTransaction` now listens while it owns the client, preserves the operation error if rollback fails, destroys unsafe clients and removes its listener after release. Healthy business-error rollbacks preserve normal reuse. No SQL, payload, credentials or raw error text is added to logs.

## Independent ENV lifecycle review

Reviewed ENV5acbb9f (local dependency cherry-pick7a76c0e), launcher/runtime/safety/verify scripts and R4.6 reliability/data-lifecycle reports. Actual owned cluster created by `node scripts/pilot/local.mjs init`, PostgreSQL17 tools under `C:/Program Files/PostgreSQL/17/bin`, loopback only. Private home: `C:/Users/admin/AppData/Local/Temp/north-synthetic-pilot-0e3b72ac457f141575bec60f44b73f88`; no secrets copied here.

Actual `verify.mjs` browser run passed: one fabricated synthetic lead, six memberships/four roles, restricted application database role, separate foreign workspace. Its `/restart` closes/recreates Nest in the same Node process; this is application-instance restart, not process restart.

Actual `backup`, `stop`, `start`, `restore`, `status` passed. Restore selected a fresh generated database and retained previous database; SQL readback found exactly one restored lead. Readiness was HTTP200. Subsequent full stop/start changed `ready.json` process PID, proving actual Node process replacement. Application and PostgreSQL were both stopped at completion (`pg_ctl status`: no server running).

Separate temporary PG outage drill: actual `pg_ctl -m fast -w stop` beneath the running owned launcher. `status` failed with `fetch failed`; application.log records unhandled PostgreSQL57P01 on the persistent advisory-lock client, terminating Node. Reported to root as ENV runtime defect; not misrepresented as successful503/reconnection. Recovery by explicit launcher stop/start succeeded with new process PID and readiness200. ENV owns the persistent lock-client correction; retest its final commit before closing the launcher outage gap.

Operator procedure: use only the generated manifest, inspect private application/postgres logs on failed startup or readiness, stop owned processes, correct configuration/migration cause, start and verify readiness plus synthetic readback. Never point these drills at shared DBs. On database loss, treat application as unavailable until explicit recovery verifies durable state; liveness alone is insufficient. On migration failure, preserve evidence and repair/retry the migration rather than downgrade nonempty immutable history. Backup/restore is a synthetic recovery rehearsal, not PITR, power-loss, backup expiry or production disaster-recovery certification.

R4.6 outbox failure/restart tests were reviewed and not duplicated. Existing at-least-once/deduplication, late sink effects and labeled crash-state simulations remain their documented limits. Data lifecycle remains count-only planning; immutable accepted evidence/audit erasure and backup expiry are not implemented.

## Commands and evidence

From product: `npm ci --ignore-scripts`; `npm run typecheck`; `npm run build`; targeted ESLint for postgres.service.ts and pilot-resilience.integration.spec.ts; all passed. Focused `npx vitest run src/infra/postgres/pilot-resilience.integration.spec.ts src/infra/postgres/postgres.service.spec.ts --no-file-parallelism --reporter=default --reporter=json --outputFile.json=C:/Users/admin/AppData/Local/Temp/north-r47-reliability-tests.json`: two files/nine tests PASS, zero skips/unhandled errors. TEST_DATABASE_URL was constructed in memory from the owned manifest for a separate `north_rel_r47` database on that cluster, never printed. Root owns CI registry addition for the new suite and full integrated gate. Existing install reports five moderate dependency advisories; no dependency changes made.

Local logs: JSON report above; private `application.log`/`postgres.log` in owned home. Early failing runs exposed REL-F01 and corrected fixture construction; final green report is authoritative. This local evidence does not establish user validation, organizational approval, hosted reliability or a production SLO.
