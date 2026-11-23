# R4.12 independent QA and release review

Reviewer: `r412_qa`, worktree `D:/AI-for-Enterprise/ns-r412-qa`, baseline `4503e80d54853b15da405f7c36df298aa0852eb0`. This review is independent of the provider/security/sync implementation worktrees. It does not claim hosted or live provider acceptance.

## Baseline evidence

R4.11 hosted CI #78 (`44675872672`) is SUCCESS on exact `4503e80`. The R4.11 baseline had 23/23 local lanes, 1,354 tests, 137 PostgreSQL tests included and 92.40% line coverage. These are regression baseline facts only; they do not count as R4.12 tests.

R4.12 provider and security worktrees were inspected read-only. Provider reports show Pancake source hashes retained and no live account calls. The security worktree contains a test-only in-memory credential store guarded against pilot/production. The sync worktree contains a new durable sync port, migration022 drafts and PostgreSQL adapter under active implementation; the contract is not yet independently accepted because the migration/store APIs were still changing during this review.

## QA acceptance matrix

| Scenario | Required evidence | Current status | Independent QA result / limitation |
|---|---|---|---|
| A durable polling crash after two pages | Restart resumes committed cursor, no duplicate effects | PENDING R4.12 integration | Must run on final migration/store revision with isolated PostgreSQL and injected crash points |
| B signed webhook replay | Invalid signature rejected; duplicate delivery one durable effect; attempts audited | OFFLINE CONTRACT / PENDING | Meta helper is not a live receiver; Pancake auth remains provider-specific |
| C invalid authentication | Rejected before accepted evidence | PARTIAL | Test-only credential and signature helpers reviewed; no live transport route |
| D checkpoint atomicity | Processing rollback leaves cursor/checkpoint unchanged | PENDING | Requires actual `sync_delivery`/checkpoint transaction test and forced commit failure |
| E credential revocation | Future requests denied; operator status reflects revocation | OFFLINE IMPLEMENTATION REVIEW | Test-only store has rotation/revocation tests; no vault or provider token |
| F cross-workspace isolation | Connection, principal, stream, secret and receipt cannot cross tenants | PENDING FINAL INTEGRATION | Existing R4.11 isolation is strong; R4.12 stream FK/queries need final exact-revision tests |
| G Pancake/Meta coexistence | Native IDs/provenance remain separate | OFFLINE VERIFIED BASELINE | R4.11 synthetic evidence; no live provider provenance |
| H commercial continuity | Replay never changes owner/outcome/identity | OFFLINE VERIFIED BASELINE | R4.11 receipt/link tests; sync mapping must be checked for no Lead mutation |
| I provider outage | Bounded retry/backoff and explicit health | OFFLINE CONTRACT | Existing bounded transport; durable health projection pending integration |
| J legacy pilot | Existing 23-lane capability remains green | NOT RUN FOR R4.12 | Must rerun exact final R4.12 source; Owner resources stay untouched |

## Adversarial checklist

The final QA run must include forged workspace/connection/account, forged provider and native IDs, altered payload with same delivery ID, invalid/oversized JSON, invalid signature, replay after acknowledgement, cursor regression, cursor gap, duplicate page, out-of-order event, lease expiry, stale lease token, revoked credential, revoked stream, worker crash before/after transaction commit, PostgreSQL interruption, restore/replay, and no raw secret in errors/logs/artifacts.

Every failure must be categorical and preserve `UNKNOWN` completeness. A provider signature does not grant Lead access or establish customer identity. Sync technical records (delivery, checkpoint, lease, telemetry) are not Commercial Assertions under ADR-005.

## Architecture/release review

The proposed sync adapter must not hold a PostgreSQL transaction while waiting on provider I/O. Lease fencing must use a server-generated token, not an owner string alone. Commit must lock the stream row, verify workspace/stream/lease/cursor, insert idempotent deliveries, process evidence and advance checkpoint in one transaction. A crash before commit must leave both delivery and cursor unchanged; a crash after commit may replay but must be idempotent. A checkpoint cursor is opaque and completeness remains UNKNOWN.

Migration022 must be registered in `loadMigrations`, `migrator.spec.ts`, integration suite discovery and restore/backup rehearsal. It must not edit migrations001–021. Foreign keys and workspace predicates must prevent cross-tenant stream or delivery references. Add indexes for `(workspace_id,status,next_retry_at,id)` and delivery idempotency lookup; measure plans before claiming scalability.

The test-only credential adapter is acceptable only as `TEST_ONLY`: it must refuse `pilot`/`production`, keep secret material out of metadata/audit/logs, issue opaque server-bound read principals, enforce workspace/provider/account binding, and require optimistic rotation/revocation. It is not a production vault and cannot authorize live provider traffic.

## QA conclusion

No unsupported R4.12 PASS is issued at this checkpoint. The provider work is `CONTRACT PREPARED`/`OFFLINE VERIFIED`; credentials are `TEST_ONLY`; durable synchronization is `IMPLEMENTATION IN PROGRESS`; provider authorization is `AUTHORIZATION PENDING`; live data operation and production approval are `NOT READY`. Final QA sign-off requires exact-source tests after all six workstreams are integrated.
