# DATA-01: bounded lifecycle planning and synthetic erasure fixture

Reviewed against frozen I-05/I-09/I-12, ADR-006, ADR-009 and R4 lifecycle runbook. No canonical source changed. DATA-01 remains a real-data admission gate: implemented planning is useful but does not establish a real-data erasure promise.

## Decisions and contract

Migration 015 adds independent append-only `data_lifecycle_policy` and `data_lifecycle_preview` tables. It does not alter accepted evidence or audit history. Policy revisions are workspace/class scoped, have explicit integer retention seconds (1..2147483647, an overflow bound, not a recommended retention duration), opaque reviewed-schedule reference, actor and creation time. Allowed classes are `accepted_evidence` and `audit`. There is no default schedule. An approval reference records the caller's schedule reference; it is neither verified legal approval nor execution authority.

`POST /v1/pilot/lifecycle/policies` accepts exactly `dataClass`, `retentionSeconds`, `approvalRef`, `expectedRevision`. `POST /v1/pilot/lifecycle/previews/:dataClass` accepts no options (empty body). Existing authentication supplies workspace and actor; only non-demo admin is accepted (ADR-006). All other roles are denied before storage. Root integration composes controller/store; these files alone do not enable an endpoint.

Revision compare-and-swap under a workspace/class transaction advisory lock prevents silent concurrent overwrite. Preview uses repeatable-read and PostgreSQL transaction time; callers cannot accelerate expiry. Evidence age means server `ingested_at`, never provider `source_captured_at`; audit age means existing server audit `timestamp`. Preview counts every eligible record of that class in that workspace, including synthetic and real; it does not extract bodies, identifiers or lists. Count is checked as a safe integer. It returns policy revision, server as-of time and count, with `BLOCKED_IMMUTABLE_HISTORY` and `executionAvailable:false`. These are planning candidates, not records legally approved for deletion.

Policy and preview each append a payload-free lifecycle audit in the same transaction; audit failure rolls back the operation and no successful result is returned. Schedule references must be opaque identifiers, never personal content. Immutable triggers reject UPDATE/DELETE of lifecycle history. Migration down refuses if either table contains history; empty disposable schema only. No automatic pruning of this history is introduced.

## Actual deletion demonstrated, with strict limits

`SyntheticResearchVault` is a separate in-memory research fixture, unregistered in runtime composition and incapable of accepting captured content: creation generates only the literal synthetic fixture text. It permits admin in explicit local/test mode, uses supplied workspace-specific 256-bit keys with AES-GCM and workspace/id/expiry authenticated metadata, denies reads at expiry, and offers audited `purgeExpired`. Its 7-day maximum comes from ADR-009; callers supply shorter fixture TTLs explicitly. Concurrent operations serialize; audit failures deny reads and retain expired ciphertext for a retry; expired ciphertext remains inaccessible. Successful purge zeroes the stored buffer and removes the entry. Audit contains action/workspace/actor/opaque id only. Runtime key management is deliberately not composed.

This proves encrypted expiring access and actual deletion of an isolated synthetic ciphertext buffer. It is NOT durable encrypted-at-rest storage, automatic production expiry, capture enablement, backup erasure or cryptographic destruction of canonical evidence. Process/heap copies and backups are outside its guarantee. No timer/job is registered; fixtures call purge explicitly. Raw research capture remains OFF.

## NOT IMPLEMENTED / owner gates

- Physical deletion, anonymization or cryptographic erasure of accepted evidence, operational records or append-only audit; no canonical raw rewrite or audit rewrite.
- Universal access suppression. Suppression alone would not constitute erasure, and no suppression claim is made here.
- Production research capture/storage, durable key lifecycle, automatic research purge worker, downstream/cache/backup expiry and deletion proof.
- Legal hold management: business authority/scope is unconfirmed; no speculative hold entity or legal process was invented.
- A verified business retention schedule or legal basis. Owners must approve class-specific durations, hold scope if required, storage/backup handling and an invariant-compatible erasure design before admitting real data under a retention promise. A configured reference alone does not close this gate.

## Validation evidence

Private disposable PostgreSQL 17 cluster: this worktree `product/.pg-data-lifecycle`, loopback 55486. No shared/customer data used. Synthetic evidence fixtures only. Port 55446 was already occupied; it was not connected to or modified. SQL tests verify policy-required failure, workspace isolation, count-only response, canonical preservation, revision races, concurrent preview identity, atomic config/preview rollback on audit failure, recovery, immutable triggers and nonempty downgrade refusal.

Unit/HTTP-boundary tests verify all existing non-admin roles/demo denial, strict request key/time/integer/reference validation, trusted workspace/actor forwarding and masked internal errors. Synthetic vault tests verify ciphertext representation, workspace isolation, expiry access refusal, actual purge/retry/idempotence, wrong-key integrity failure, read-audit failure and concurrent purge serialization.

Commands (from product): `npm ci --ignore-scripts`; `npm run typecheck`; `npm run lint`; `npm run architecture:check:strict`; `npm run build`; `$env:TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55486/postgres'; npx vitest run src/application/data-lifecycle src/infra/data-lifecycle src/api/data-lifecycle.controller.spec.ts --no-file-parallelism`. All passed; focused suite 4 files / 27 tests, including 4 PostgreSQL tests, 2026-11-19. Typecheck repeated after final test additions; passed. Existing npm install reports five moderate dependency advisories; no lockfile changes or unreviewed dependency upgrades made.

Cluster shutdown: `pg_ctl -D <this-worktree>/product/.pg-data-lifecycle stop`. Never run this command against a shared database directory. Do not commit the untracked cluster. No production operation, customer deletion, deployment or push performed.

## Integrated verification

Root composes the admin policy/preview APIs in the existing pilot module; memory storage fails with typed503. Independent signed HTTP verifies admin configure/preview and sales denial. Root added statement TRUNCATE guards to015/016 and nonempty016 downgrade refusal; PG negatives pass. Final integrated659ca46 verification includes95PG tests and all17 local lanes PASS; see test-verification.json. This closes the integration/test gaps described at the worker checkpoint, without expanding erasure authority or claiming durable raw retention.
