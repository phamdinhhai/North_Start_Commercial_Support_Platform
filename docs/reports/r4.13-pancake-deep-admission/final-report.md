# R4.13 Pancake deep admission: engineering accepted, provider validation partial

R4.13 delivers a reviewed, offline-tested request gate, bounded positional readback planner and metadata-only message-scope inspector. Six real specialists audited166 Markdown documents, two YAML specifications, the authorized local DevTools capture, identity boundaries and durable sync readiness. Root executed four bounded account/target reads: the official exact-conversation history read succeeded with30 correctly scoped messages. No provider mutation or real-data North Start ingestion occurred. Controlled interaction and end-to-end provider integration are **NOT COMPLETE** because Page alias/account/contact binding was not established before the terminal UI302 stop.

## Git and exact evidence

- Base/R4.12 remote HEAD: `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`; CI#79 [44761896200](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/44761896200) SUCCESS on that exact SHA. The [immutable hosted addendum](baseline-and-hosted-addendum.md) preserves prior report chronology.
- Final source/test revision: `6aa1533e204d29c99c3350f457210685b01397e6`; product tree `06597e388504b966cc3fd15e40fa9ca08265624b`.
- Branch/worktree: `feat/r413-pancake-deep-admission`, `D:/AI-for-Enterprise/ns-r413-pancake`. Final documentation HEAD is the commit containing this report, reported by `git log -1` at handover. R4.13 remains local/unpushed; hosted R4.13 CI NOT RUN.
- During the full run, documentation-only QA commit `0ebf0f3fcc122d9c9a708104403e563654ac6197` became HEAD. Benchmark/recovery subprocesses record it; its product tree equals the source revision above, with empty product/.github diff. No source/test/config changed during the run. verification.json records both SHA values rather than overwriting chronology.
- Twenty-three changed files: seven new product files and sixteen report/inventory files. Frozen canonical sources, existing runtime/composition/controllers/UI, historical migrations, package-lock, CI workflow and Owner pilot resources are unchanged. Existing draft PR#1/#2 were inspected but not merged/retargeted.

## Engineering and confirmed corrections

| Change | Purpose / evidence |
|---|---|
| `product/src/application/pancake-admission/pancake-request-policy.ts` + two specs | Server-owned exact route/target registry, sequential request observation, ceiling25, delay>=1second, recovery and recipient-consent references; stop401/403/429, scope mismatch and all3xx. No network route is registered. |
| `product/src/adapters/pancake/pancake-history-readback.ts` + spec | Treat documented current_count as positional index; local page/item limits, immutable target/state, UNKNOWN completeness/lifecycle, durableResumeSafe=false. Never advances R4.12 checkpoint. |
| `product/src/adapters/pancake/pancake-message-scope.ts` + spec | Validate bounded documented success/conversation/messages subset against expected native Page/conversation. Return fixed metadata without IDs/content/names; transport authentication remains a separate prerequisite. No Customer/Lead/source observation is created. |

QA reproduced seven manual3xx policy failures, then fixed categorical redirect stop. Root reproduced five malformed constructor targets where an unknown key replaced a required key; explicit own-key validation corrected this. These were defects in the new offline policy, not findings of exploited provider behavior. Final negative cases pass. All three modules have100% measured line/branch/function/statement coverage. Reference strings and JSON fields alone never establish authenticated provider origin, alias ownership or mutation authority.

The existing R4.12 pipeline remains synthetic-only. Native Page, human account, contact, message, conversation, Customer, commercial episode and Lead remain distinct. Explicit human link/unlink/reject, RBAC, HMAC, raw evidence and audit are preserved. Replays do not merge Customers, assign ownership, change outcomes or assert revenue. Meta Direct remains an independent synthetic/offline path, without new Meta account access or approval.

## Research and provider observations

The [functional catalog](functional-catalog.md) and168-entry inventory distinguish153 detailed docs,13 grouped docs and2YAML;35 short docs are stub candidates. The [capability matrix](capability-matrix.md), [DevTools reconciliation](api-devtools-reconciliation.md) and [provider discrepancies](provider-discrepancies.md) separate public contracts, private UI behavior and unknown capabilities. Local/public REST raw hashes differ but parsed YAML is structurally equal. Both still fail full OpenAPI validation with21 diagnostics; webhook has2. Original sources were not changed and no full-validation success is claimed.

The [sanitized provider journal](provider-validation-journal.md) records preconditions, route templates, credential class, result, readback limitations and cleanup for each request. Cookie-only account verification failed despite HTTP200; the account-token private probe succeeded. An existing exact-Page credential from Owner's local capture was reused only in memory for the official history read; it was not generated/rotated. All30 returned messages matched the exact native target. The final alias document lookup returned302, was not followed, and terminally stopped the run. No UI browser session, pagination traversal, contact mutation, tag/assignment/status change, send/edit/delete, webhook, live retry or provider-to-North-Start E2E is claimed.

Owner authorization and recipient consent are established for the named target; they do not fill missing technical identity proof. No request addressed another conversation or enumerated Pages/accounts/customers. No token/cookie/raw capture/raw provider body entered Git, fixture database, trace or report. Mutation cleanup is NOT_APPLICABLE because zero mutations were made. No token/session setting or historical content was altered. Local journals contain categorical results only. Exact-value scans cover credentials against changed/untracked/staged/history/generated artifacts; generic security checks and manual report/fixture review complement those scans.

## Independent verification

All26 local lanes PASS at the frozen source:159 Vitest files, **1,483 tests**, including157 PostgreSQL tests across30 integration suites, zero skipped. Line coverage92.85%, statements88.71%, branches86.48%, functions91.25%. These are new R4.13 results. Independent QA reran70 focused tests and inspected actual full-run manifests, lcov, restore/recovery/browser/MV3/pilot/audit/benchmark logs. [verification.json](verification.json) contains exact commands, environment, hashes, results and failure history; [independent QA](independent-qa.md) distinguishes source/log review from root-reported live results.

Validated lanes include typecheck/lint/build/architecture/registry, HTTP and browser/OIDC/session/draft/handoff/manager/evidence, source reconciliation/security/context linkage/pagination, PostgreSQL atomicity/lease/revocation/collision, restore, worker crash/restart, MV3/package, pilot launcher/outage, dependency audit and bounded benchmarks. Dependency high/critical acceptance passed with zero dev-only waivers. Node22.21.0/npm10.9.0, PostgreSQL17.11, Vitest5.1.0, Windows/Chromium. All database/browser resources were newly generated agent-owned fabricated fixtures. Owner pilot untouched; the final owned PostgreSQL cluster was stopped.

Restore verified16 tables and source/link/checkpoint/delivery replay. An actual child process exited73 after two committed pages; restart resumed page3, yielding3 receipts and3 unassigned Leads, zero network calls. These are local rehearsals, not provider outage or production SLA proof.

Bounded local latency: source same-connection/different-message p50/p95 **19.52/111.28ms** (64samples,8workers). Durable same-stream **6.16/8.99ms** (32samples), parallel8streams **14.13/70.50ms** (64samples), same-page replay **2.15/2.88ms** (32samples). Durable benchmark accepted96 receipts, zero deadlocks and no queue at sampled completion points. Hardware/run variance and small samples prevent production throughput/p99/SLO or improvement claims. No schema/locking change was justified by this run.

## Gates and next work

| Gate / capability | Status |
|---|---|
| Gate A technical regression | PASS for26 local exact-source lanes; R4.13 hosted CI NOT RUN |
| Gate B human synthetic Sales pilot | CONDITIONAL; Owner operator confirmed; human Sales validation NOT RUN |
| Provider admission | CONTRACT/OFFLINE VERIFIED subsets; AUTHORIZED PROVIDER TESTED for one scoped history read; full identity/mutation admission BLOCKED |
| Provider integration E2E / webhook / production | NOT VERIFIED / NOT APPROVED |
| Gate C real customer data | NOT READY FOR REAL CUSTOMER DATA |

Next, resolve the exact-target alias/login redirect and establish server-observed account/Page/contact binding under the existing scoped authorization; do not bypass the completed run's terminal stop or broaden discovery. Recipient consent does not need to be requested again. Then verify bounded pagination/ordering and one fabricated outbound message with precondition, exact target, readback, ambiguous-send handling and cleanup policy. Contact-note/edit/delete tests may touch only newly created test content. Provider auth-error/revocation tests must be simulated without invalidating the real shared token.

Before actual provider observations enter North Start, separately approve minimized isolated storage/retention/cleanup and implement authenticated non-synthetic admission. Do not feed real records into synthetic-only SourceObservation/SyncStream. Establish authentic webhook and polling/backfill lifecycle semantics before adapting durable synchronization. Wider sync, production credential custody/IdP/erasure/privacy controls, human Sales validation and R4.13 push remain separately gated. The [next backlog](next-implementation-backlog.md) and [domain gaps](product-gap-analysis.md) give owners and acceptance evidence. No further credential disclosure in chat is needed.
