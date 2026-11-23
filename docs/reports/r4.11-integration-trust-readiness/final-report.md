# R4.11 integration trust and sync readiness

R4.11 delivers a verified local synthetic hardening slice. It keeps provider origin declarations unverified, adds explicit audited evidence-context association without merging historical Leads, bounds evidence reads with scoped keyset pagination, improves measured database lookups, and prepares isolated offline provider contracts. It does not establish live connectivity, provider authorization, production readiness or human Sales validation.

## Git and scope

- Base: `5181aba2b325fb12fdb4a54b04783f23b4133d69`, verified R4.10 remote/local and hosted #77 success on that exact SHA.
- Final source/test/config revision: `4fe69e396f1db665e41c3ec4b8ad324e9dd2f92b`.
- Branch/worktree: `feat/integration-trust-and-sync-readiness`, `D:/AI-for-Enterprise/ns-r411-trust`.
- Documentation HEAD is the documentation-only commit containing this report (`git log -1 --format=%H -- docs/reports/r4.11-integration-trust-readiness`). Exact final HEAD and clean status are reported at handover. No product/workflow difference from the tested source is allowed.
- R4.10 branch remains at5181aba. R4.11 has no origin branch and has not been pushed. Hosted R4.11 CI: NOT RUN. User authorization for earlier R4.10 push does not authorize R4.11.
- `main`/merge-base: `5d6c20673218f02c0972263126e8654eadee18c9`. PR #1/#2 remain older open drafts; no merge, retarget or closure performed. See [branch strategy](branch-and-pr-strategy.md).

The source delta comprises 52 paths under product/.github, including tests and three new additive migration pairs019–021. Complete changed paths and log hashes are recorded in verification.json. Canonical documents, historical migrations001–018, package-lock, application Node 22 and Owner pilot configuration/resources remain unchanged.

## Six actual specialist outputs and review

| Specialist | Delivered result |
|---|---|
| Architecture | Exact Git/CI ancestry, PR topology and modular-monolith boundary review |
| Identity | Bounded conversation/episode decision, append-only receipt-context link/unlink/reject, owner/read authority, HMAC replay/version and single-client concurrency tests |
| Security | Server-scoped synthetic admission, unverified/candidate projection, adversarial provenance tests, future principal/credential/PII threat assessment |
| PostgreSQL/performance | Bounded baseline/optimized benchmark and query plans, additive019 indexes, scoped lookup and microsecond keyset cursor, revoke ordering and migration checks |
| Provider | Unchanged Pancake spec hash/full diagnostic inventory, Meta batch/raw-signature helpers and bounded offline retry/checkpoint emulator;021 independent-review correction |
| Independent QA | New HTTP/query/actualPG tests, two signed Chromium journeys with106-record paging/stale UI, source authorization/replay/revoke/restart, CI action pinning and sandbox separation |

Task IDs, ownership, commits, dependencies and acceptance are in [task matrix](multi-agent-task-matrix.md). Root integrated shared API/UI/runtime/projections, registered every PG suite, expanded restore replay, and froze final source for verification. Identity independently reviewed provider code; provider reviewed root/QA code; QA reviewed root changes. [Independent acceptance](independent-acceptance-review.md) records scope and limitations. No remaining material blocker was identified for local synthetic acceptance; all 23 final lanes passed.

## Confirmed corrections and decisions

1. Connection IDs beyond the first100 list entries previously could not be resolved by fixture import. Direct scoped lookup now resolves them; list itself stays bounded.
2. Native evidence had a hard100 cap without continuation. Index-supported keyset paging preserves PostgreSQL timestamp microseconds, reauthorizes each page and prevents stale Lead responses overwriting the UI.
3. During cross-review, new continuity authorization could reacquire a pool client while its transaction held a client. Runtime now checks actual sorted locked Lead rows using the existing owner policy. Actual max1/ten concurrent commands and changed-owner replay denial pass.
4. Independent foreign keys on the new association table did not prove receipt-envelope-origin equality. Additive021 refuses inconsistent old rows without repairs, and guards new inserts.018–020 history was not rewritten. Downgrade021 is explicitly weaker and requires paused writers;020 refuses nonempty rollback.
5. Offline authorization could consume elapsed budget before a stale request deadline was used. Budget is recalculated after awaits before request/persistence; tests verify no new request/processing after exhaustion. Only request callbacks have enforced timeout/abort; trusted callbacks must terminate.
6. Fixture-native IDs now have explicit candidate/unverified interpretation and impossible Meta-route identity combinations are rejected. This hardens a future trust seam; no reachable live-provider exploit or P0 defect was fabricated.

[Bounded architecture decisions](architecture-decisions.md) answers all15 requested questions. A native message, provider conversation, Customer and Lead remain different. `object_aligned` proves declared synthetic object-key alignment only. Different messages still keep historical Lead seeds; an owner/admin may explicitly add evidence context, with source and prior target authority checked. Human-confirmed context never becomes provider-verified identity, ownership transfer, Won/Lost, revenue or attribution. Automatic conversation segmentation and intake attach remain deferred under open ID-1/CE-1/ID-2.

## Mandatory scenario traceability

| Scenario | Execution evidence | Meaning |
|---|---|---|
| Multiple messages, same conversation | continuity PG and signed R4.11 browser | Distinct stable seeds; explicit reversible context association only |
| Same message via Pancake/Meta | existing source-intake PG + source-ui browser | Same synthetic mapping, separate immutable route provenance |
| Forged cross-provider identity | trust/admission unit, HTTP/browser negatives | Candidate only; forged assurance/impossible Meta origin refused |
| Revocation during intake | deterministic observed PG lock wait + revoke | Accepted transaction orders before revoke; all subsequent intake denied |
| Historical replay/conflict | source-intake, continuity replay, restore and browser | No duplicate effect for unchanged command; changed meaning conflicts |
| Large history | actualPG cursor tests +106receipt HTTP/UI traversal; benchmark | Scoped bounded reads; no full-history/completeness or SLO claim |
| Edit/delete/out-of-order | retained source-intake lifecycle tests and offline unsupported inventory | Append history, never overwrite provider truth or invent commercial state |
| Provider unavailable | offline deadline/429/backoff/poison/gap/ack tests | Bounded fixture recovery contract; actual checkpoint store not implemented |
| Sales interpretation | signed browser and safe projection tests | Synthetic, unverified, candidate/human context, unknown completeness distinguished |
| Legacy pilot | all original regression lanes plus new owned launcher/outage/restore | Owner resources untouched; exact-source local rehearsal only |

## Verification

Machine-readable commands, environment, exact SHA, exit codes, counts, coverage, benchmark artifacts and log SHA256 are in [verification.json](verification.json). All23/23 lanes PASS on the frozen source: no regression observed in required checks. Automated totals count the Vitest suite once: PostgreSQL 137 is included in 1,354; reruns/browser/Node script tests are separate checks, not inflated into that total. Coverage lines92.40%, statements88.39%, branches85.96%, functions90.74%; zero Vitest skips. New trust helper, signature verifier, continuity controller/service/store and linked reader reach100% executable line coverage; this does not assert100% branch coverage or full-system security certification.

No dependency upgrade was made. Existing five moderate development advisories remain visible; production/high-critical audit gate must pass. GitHub actions are SHA-pinned checkout5/setup-node5/upload-artifact6, Node 24 action runtime verified from exact upstream action.yml. Minimum runner2.327.1 is below observed hosted baseline2.338.2. Application staysNode 22; retention 7 days and persist-credentials:false. Local checks cannot prove hosted runner compatibility; an authorized R4.11 push is still required.

## Performance and operations

Before/after tuning used bounded synthetic data,8workers and64samples per main workload. Same-connection distinct-message p50/p95 improved45.13/54.46→22.10/30.70ms, while p99 regressed57.59→85.10ms. Native lookup shared hits29→3 and event lookup156→3. Different dataset accumulation/cache warmth confound causality; no universal throughput claim. The exact-source rerun recorded23.21/29.75/32.90ms p50/p95/p99 for distinct messages on one connection,0deadlocks and0unexpected errors; current health aggregation measured 1.886 ms/1,218 buffer hits versus the old 0.930 ms/154 hits on the small fixture, so no broad improvement is claimed. Full rerun and plan metrics are in [performance report](postgres-performance-report.md) and verification.json. Exclusive connection locking remains intentionally serialized; health exact counts still grow with history.

A new agent-owned launcher fixture independently verified synthetic UI creation, restricted DB role, distinct workspace sessions, application restart, backup/restore, actual PostgreSQL fast-stop and manual recovery, refusal of a deliberately false-classified invented record, reset to a new database and stop. Restore snapshots12tables including link history and verifies idempotent link replay. All generated resources stay outside Git; owned clusters are stopped at handover. No Owner manifest/database/IdP/session settings were changed and no local recovery SLA is claimed.

## Honest readiness and next actions

Gate A: PASS for completed local regression at `4fe69e3`; baseline hosted PASS, R4.11 hosted NOT RUN. Gate B: CONDITIONAL, Project Owner operator confirmed; Sales session approval/participant/observer/observation decisions pending. Human Sales validation NOT RUN; business validation NOT ESTABLISHED. Gate C remains NOT READY FOR REAL CUSTOMER DATA.

Pancake/Meta account/app/page rights, live authorization and provider-approved sandbox are BLOCKED — PROVIDER AUTHORIZATION. Fresh Pancake specs preserve their source hashes and remain invalid:21REST/2webhook diagnostics. No silent overlay, full live decoder, OAuth broker, public receiver, real conversation, outbound operation or conversion writeback was enabled.

Next round should prioritize: separately approved push and exact hosted CI; organizer-approved synthetic Sales study; owner-approved first provider sandbox with entitlement evidence; authenticated transport principal/credential custody and transactional checkpoint implementation; product decision for conversation-to-episode segmentation; request/response revocation semantics and link-history continuation if pilot evidence requires them. Retention/deletion/legal-hold, real IdP/key custody and backup/downstream erasure remain separate Gate C work.
