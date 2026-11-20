# R4.12 final report

R4.12 implements an offline-verified synchronization foundation with PostgreSQL page/checkpoint atomicity, fenced leases, explicit credential/principal boundaries, durable fabricated delivery replay and operator health. It does not activate provider network transport, access a provider account, store real customer data, approve production credential custody or run human Sales validation.

## Exact baseline, Git and chronology

Base: `4503e80d54853b15da405f7c36df298aa0852eb0`, verified R4.11 branch/remote and hosted CI #78 (`44675872672`) SUCCESS on that SHA, both product/browser jobs. The earlier R4.11 pre-push reports are preserved; [hosted addendum](hosted-acceptance-addendum.md) records subsequent acceptance without rewriting history.

Final source/test/config revision: `41948f37a72d75e024ea115818e2834914232e92`. Branch/worktree: `feat/r412-provider-sync-foundation`, `D:/AI-for-Enterprise/ns-r412-sync`. Documentation HEAD is the documentation-only commit containing this report; exact final SHA/clean status are provided at handover. R4.11 remains at4503e80 unchanged. R4.12 has not been pushed; hosted R4.12 CI is NOT RUN. Existing PR#1/#2 remain older open drafts; no merge/retarget/closure performed.

A read-only119worktree scan is retained at `%TEMP%/north-r412-worktree-audit.json`, SHA256 `62750cce3c0b53f285995708fdb627982e846fce78bbd42d3a7d68a9178c1cd1`. Seventeen dirty worktrees were preserved; the untracked Owner research catalog in ns-r4-gaps remains untouched. Canonical files, migrations001–021, package-lock, application Node 22 and Owner pilot settings/resources are unchanged.

## Six real specialists and integration

| Specialist | Delivered output |
|---|---|
| Provider/admission | Fresh Pancake/Meta documentation retrieval hashes, contract/permission/unsupported matrix, cumulative admission port and tests; always networkActivation NOT_ENABLED |
| Security | Admin-only TEST_ONLY custody, opaque version-bound principal, scoped metadata copies, rotation/revoke/mode/redaction tests and threat design |
| Durable sync | Additive022, stream/checkpoint/page ledger, leases/fencing, same-tx source receipt/evidence/checkpoint/audit, bounded offline polling and PG tests |
| Identity/continuity | Incremental edit/delete/replay regression preserving links/raw/owners/customer/outcome; no automatic merge/episode attachment |
| Operator health | Bounded API/query/reader/UI helper, manager/admin read, admin controls, UNKNOWN lag/completeness and operational runbook |
| Independent QA | Failure/custody/PG health tests, signed OIDC Chromium operator journey, actual code review and source-specific limitations |

Root integrated shared composition, built unregistered signed fabricated delivery+023, required current fetch authorization, added scope negatives, process-crash/restore/benchmark scripts and CI registration. Specialists ran in waves due three child slots; interrupted model turns were resumed from isolated worktrees. Later model usage errors did not fabricate additional sign-off. [Task matrix](multi-agent-task-matrix.md) records original/integrated commits and reviews.

## Implementation and confirmed corrections

- Migration022 adds `sync_stream` and append-only `sync_page_commit`;023 adds immutable `fabricated_delivery` and `fabricated_delivery_attempt`. Down refuses nonempty history. Historical migrations are not edited.
- `PgSyncCheckpointStore.commitPage` locks connection then stream, validates current credential binding/lease/cursor/version/page key, calls existing source intake on the same SQL executor, and commits receipt/evidence/seed/page/checkpoint/audit atomically. No PostgreSQL transaction surrounds fetch.
- Page replay uses server HMAC and current checkpoint; content collision/loop/revisited cursor fails. Initial null and terminal null are distinguished by completed. Stream/page/item/request limits remain bounded; delivery is at-least-once, not exactly-once.
- `TestOnlyProviderCredentialStore` is admin-only and workspace+connection keyed, returns no enumerable secret, invalidates old principals on rotation and refuses terminal revoke revival. Production/pilot environments are blocked. No improvised encryption, master key, vault or production token backend is introduced.
- QA found that commit-only authorization still allowed a request before revoked credentials were checked. `DurableSyncOptions.authorizeFetch` is now mandatory before each request, plus current in-transaction `bindSyncCredential`; unit tests assert zero request calls when revoked.
- Provider review found signed fixtures did not require the message-read capability. Both admission and persistence now reject profile-only principals. The local fixture scope is not a claim about official Pancake/Meta permission names.
- Metadata scope aliasing was corrected with defensive copies; independent tests prove returned object mutations do not change stored authority. Guard defaults and verifier exception redaction were hardened. Layer imports were replaced with injected ports/callbacks; strict architecture passes.
- Existing source identity, raw evidence, HMAC, RBAC and link history remain protected. Workers use service audit actors with viewer semantics and claimResponsibility=false; no owner, Customer merge, Won/Lost/payment or attribution is inferred.

Decisions, authority and remaining trust limits are in [architecture decisions](architecture-decisions.md). CE-1, ID-1 and ID-2 remain open. Existing per-message Lead seeds persist; automated conversation segmentation/intake attach is deferred.

## Acceptance scenarios A–J

| Scenario | Evidence / result |
|---|---|
| A durable polling | `sync-recovery-rehearsal.mjs`: actual child exits73 after two durable pages, independent child resumes page3; three receipts and three unassigned Leads. No network call. |
| B signed delivery replay | Concurrent identical fabricated deliveries create one source effect and three append-only attempts; changed payload conflicts. ACK/result only after durable commit. |
| C invalid signature | Invalid MAC, content type, oversized bytes, malformed JSON, forged principal/account/route/timestamp/media are refused before accepted evidence. |
| D checkpoint atomicity | Source collision/processing failure rolls back page and checkpoint; delivery-attempt audit injection rolls back source/ledger; retry succeeds. |
| E credential revoke | Version-bound principal rotation/revoke and mandatory pre-fetch/current commit auth refuse later operations; source revoke is database-lock ordered. |
| F workspace isolation | Equal selectors remain separate custody; source/stream/ledger/health queries use server workspace; browser foreign workspace isolation passes. |
| G coexistence | Pancake/Meta share provider-independent intake/health; original dual-path provenance regression retained. No live connector claim. |
| H continuity | Edit/delete/replay/new-message tests preserve explicit links/raw/owners/customer/work/handoff/outcomes; browser confirms no owner/outcome minted. |
| I outage/retry | Timeout/abort, bounded Retry-After, retry exhaustion, poison/gap/auth/database failures tested; PG retry schedule gates early worker and gap blocks stream. |
| J legacy pilot | Original browser/OIDC/session/draft/handoff/manager/evidence/MV3 plus new agent-owned launcher/outage/backup/restore are full regression lanes. Owner resources untouched. |

The signed protocol is explicitly `north-start-fabricated-delivery/v1`, unregistered and test-only. It is not Pancake webhook authentication and not an approved Meta app/account. Provider authenticity cannot be inferred from HMAC compatibility. Provider webhook/polling production admission remains blocked.

## Verification and operational results

All26/26 final lanes PASS; no regression observed in the required tested scope. The engineering delta is47 product/workflow files, including 2 new additive migration pairs. All final commands, exact SHA, environment, counts, coverage, failure/retry history and log SHA256 are in [verification.json](verification.json). A first complete26lane run passed at`0e6f971`; focused unit/PG tests then filled direct credential-binding and persisted retry/input coverage. Final acceptance is from the rerun at `41948f3` only. The final suite passes1,413 tests in 155 files, including 157 PostgreSQL tests across30required suites, zero skipped; coverage lines92.77%, statements88.65%, branches86.22%, functions91.14%. Source remains frozen during that rerun; subsequent changes are documentation only.

Environment: Windows, Node 22.21.0/npm 10.9.0, PostgreSQL 17.11, Playwright Chromium. Every PG/browser database is new or expressly agent-owned on loopback. Tests do not reuse R4.11 counts as proof. Separate browser/Node/rehearsal reruns are not inflated into the single Vitest count.

Restore rehearsal snapshots16-tables, including both new ledgers and checkpoint state. It verifies identical restored HMAC snapshots, source/link replay, current checkpoint/page replay, immutable source/page/delivery history, and one additional auditable delivery attempt. Actual PG fast-stop/manual restart is exercised only through a newly generated launcher; no production SLA is established. Final benchmark (32/64 samples): sequential same-stream lease+commit p50/p95 6.46/8.60ms; parallel 8 streams 31.68/72.59ms; same-page replay 2.30/2.94ms. It accepted96 receipts, observed 0 deadlocks and 0 pool queue at sampled completion points. No production p99/throughput claim.

CI workflow registers the new PG suites and adds worker recovery, bounded benchmark and a separate signed health browser database/lane. Actions pins/runtime/artifact policy from R4.11 remain unchanged. Dependency audit and secret-pattern checks remain required. R4.12 hosted execution cannot be marked PASS without separately approved push.

## Readiness, limits and next decisions

Gate A: PASS for completed 26/26local lanes at `41948f3`; R4.12 hosted CI NOT RUN. Gate B remains CONDITIONAL: Project Owner is operator, but approved Sales session/participants/observers/observation policy and human validation are NOT RUN. Business usefulness is not established by automation. Gate C remains NOT READY FOR REAL CUSTOMER DATA.

Provider Admission: tested fabricated subsets can be OFFLINE VERIFIED; actual account rights/custody/network operation remain AUTHORIZATION PENDING. Fresh Pancake spec hashes are unchanged; original REST/webhook full validation remains21/2diagnostics. No overlay or SDK generation hides these defects. Meta Direct remains independently prepared, with no app approval or real token.

Operational limits: trusted authorization/persistence callbacks must terminate; only requests have enforced timeout/abort. In-memory credential revocation after the observed authorization cannot retroactively cancel in-flight acceptance; next-request refusal is tested. Exact local receipt/quarantine counts can grow with history even though stream selection is bounded. Historical failed-page/event counts are UNKNOWN/NOT_PERSISTED. No public raw replay, destructive reset, provider daemon, generalized OAuth broker or production vault is enabled. Synthetic labels do not mechanically prevent a human typing real PII; Owner policy forbids it.

Next: separately approve R4.12 push/hosted CI if desired; select owned Pancake read-only synthetic sandbox app/account/Page; supply account/scopes/asset entitlement evidence and approve custody via a secure channel; accept TLS/ingress/egress, retention/cleanup/revoke/stop conditions; then review authenticated transport and real provider schema subset. Meta sandbox admission is independent. Production lifecycle/IdP/keys/erasure/privacy work and human Sales study remain separately gated.

All agent-owned engineering/final-run PostgreSQL clusters and generated launcher/app/IdP/browser fixtures are stopped. No Owner resource was stopped or reset. Logs and artifacts remain outside Git, with hashes in verification.json.
