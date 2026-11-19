# R4.6 pre-pilot hardening and business validation

2026-11-19. Target branch: feat/r4-lvp-closure. Worktree: D:/AI-for-Enterprise/ns-r4-gaps. Starting revision: cd842c4851c7ec10792f9d05c39d62392b871f8c. Validated source revision:659ca46b13a2950b7ccc3e5fdebc8e9700646770; all17 local validation lanes PASS. Report-only follow-up commits will be distinguished from tested source.

## Executive assessment

The manual Sales journey has been extended with a separate audited contact-claim history and explicit conversation source, acquisition lineage and UNKNOWN attribution reasons. Security and recovery boundaries are stronger and implemented. This remains a synthetic pilot candidate, not a real-customer release. No employee has participated in a Sales pilot during this execution.

Gate A/B cannot be declared passed from local tests alone. Hosted run69 at R4 cd842c4 completed FAILURE (product success, browser failure at restart); its failure was diagnosed and locally reproduced/fixed, but R4.6 needs its own hosted result. R4.6 has not been pushed or deployed. Gate C: **NOT READY FOR REAL CUSTOMER DATA**.

## Six actual specialists and integration

Three children can run concurrently. Six specialists executed in two overlapping waves, each writer in its own worktree, then read-only cross-reviews. User-selected modelgpt-6.1-sol used. No simulated delegation.

| Owner / task | IMPLEMENTED | TESTED / review evidence | Remaining limit |
|---|---|---|---|
| r46_ci / CI-01 | Close requestless TCP sockets in OIDC restart fixture; deterministic regression; independent MV3 CI step; staging/rollback checklist |351241a; old fixture fails/fixed2PASS; migration/restore/MV3 checks; ci-assessment.md | No hosted R4.6 result without authorized push |
| r46_security / SEC-01 | Streamed byte bounds/cancel JWKS and token responses; retired prior browser session on successful relogin; production ephemeral-HMAC refusal; token shape checks |1095906; behavior matrix, focused tests;02239ce independent DATA/commercial/root review | Actual deployed issuer and complete security-critical coverage not established |
| r46_data / DATA-01 | Migration015; admin-only retention policy revisions and metadata preview; audit atomicity/CAS; isolated synthetic encrypted-expiry fixture |f276715;27tests incl4PG; independent Security/QA/Reliability review | Planning is not erasure enforcement; no real schedules/holds/durable raw store |
| r46_reliability / REL-01 | Poison/tenant validation, bounded retry/timeout/conflict states, consumer collision detection, OIDC-admin audited replay/stop,017, test schema isolation |b4688a7+b5639c3;20tests incl8PG and actual private PG restart; QA/Security source review | Default-off local/test runner; no exactly-once or OS-worker crash claim |
| r46_commercial / COM-01 | Migration016; owner-scoped append-only contact claim/API/UI/export; three separate source truth fields; no automatic business effects |59d803c;13focused tests incl4PG; independent UI/PG review | Dedicated contact supersession and manager exceptions deferred |
| r46_qa / QA-01 | Extended UI-only journey/contact/source/feedback/restart; signed lifecycle HTTP; memory503 fixture; anonymous pilot scenarios/worksheet |ed487c8;3OIDC/4legacy/1memory and21focused checks; qa-assessment.md | Human pilot/experiment exposure NOT RUN/UNVERIFIED |
| root / INT-01 | Composition/readiness001-017; reviewed event vocabulary; absolute stale-JWKS cutoff; immutable TRUNCATE/nonempty-down guards; chronological cursor; cross-op concurrency tests; port boundary for delivery ops | Integration history; focused PG gate20suites95tests; exact-revision final record in test-verification.json | No main merge, production deployment or real-data admission |

Worker SHAs identify original commits; integration uses reviewed cherry-picks with its own SHAs in git history. Worktree files/research owned by other sessions remain untouched.

## Security findings and scope

Closed findings: unbounded response consumption, prior session survival after replacement login, conflicting production ephemeral-key fallback, unbounded cached-key trust during IdP outage, new015/016 TRUNCATE bypass, destructive016 downgrade, unaudited delivery replay, unvalidated poison delivery and silent inbox collision. Known-key trust expires after the configured absolute successful-fetch age, even during refetch cooldown; successful refresh is needed for recovery. Existing roles and lead ownership are retained; no privilege expansion or new role.

Root also corrected a new API-to-infra architecture violation by injecting a typed delivery-operations port; strict architecture was rerun, not weakened. Viewer/foreign/downgrade/CSRF/identity/HMAC failures are covered by named suites, not inferred from a line percentage. The security behavior matrix records finite scope, missing protocol combinations, real IdP and transport/operational limitations. No blanket100%security-critical claim.

## Data lifecycle

Retention config is class/workspace scoped, has no default business duration, and requires an opaque schedule reference plus revision CAS. Previews count metadata at server transaction time and always return executionAvailable=false/BLOCKED_IMMUTABLE_HISTORY. Writes and their audits commit or roll back together. Accepted raw evidence and audit are unchanged. New histories refuse UPDATE/DELETE/TRUNCATE and nonempty lifecycle/contact downgrade; rollback is not a substitute for backup.

The synthetic vault is unregistered test infrastructure with generated fixed text, encrypted buffer/expiry/access/purge tests. It does not implement encrypted-at-rest durable research storage, automatic retention or real-data deletion. Erasure/anonymization of accepted evidence, downstream/backup handling, approved retention schedule and applicable legal holds remain open owner decisions. No real data was erased or admitted.

## Operational reliability

Action transition/event/outbox atomicity remains; delivery validates tenant/id and non-inferred provenance before sink invocation. Poison/conflicts quarantine permanently; timeout/exhaustion retain fixed categories; late acknowledgements are lease-fenced. Consumer deduplicates identical envelopes and rejects conflicting same-ID content. Admin inspect/replay/stop is OIDC-only, workspace scoped and atomic with an immutable operations audit. Stop refuses live leases. Global stop remains flag-off plus application restart; no staging/production guard was removed.

Tests exercise transaction failure, timeout, deduplication, concurrent workers, expired lease recovery, exhausted retries, poison and audit failure/recovery. Crash after inbox commit is a state simulation; independent worker evidence includes an actual restart of its own disposable PG cluster. This is not a power-loss, worker-process-kill or production SLO proof. At-least-once plus idempotent consumer remains the guarantee.

## Commercial and learning validation

Full manual journey uses real UI/backend and fabricated records: login/intake/context/handoff/original evidence/accept/contact claim/action lifecycle/outcome correction/feedback/audit/reload/app restart. Setup provisions identities only, with no API business seeding for the claimed full UI journey. Contact claims preserve actor/recorded time, optional occurred time/evidence, channel/result and follow-up implication; missing information remains UNKNOWN and never schedules or corroborates business effects.

New events remain fixed categorical behavioral reports; synthetic/unknown excluded server-side. Release/flag metadata is not a complete per-session experiment exposure implementation. workflow_recovered is an approved vocabulary item; full recovery instrumentation/experiment exposure remains an acceptance gap. Synthetic human-pilot measurement uses the separate worksheet, not business aggregates. No synthetic automation clicks establish Sales usability, adoption, revenue or value.

## Verification and regressions

Exact commands, log paths/hashes, environment and revision are recorded in test-verification.json. Local environment: Windows, Node22.21.0, npm10.9.0, PostgreSQL17.11 private loopback cluster, fabricated data, unchanged locked dependencies. All owned validation clusters stopped.

| Final lane at659ca46 | Result |
|---|---|
| Coverage unit/integration |119files /1,177tests PASS, no skips |
| PostgreSQL isolated gate |20suites /95tests PASS, no skips; already included in1,177 |
| HTTP E2E |3files /22tests PASS |
| Legacy browser / component |4 /3tests PASS |
| OIDC/PG acceptance |3PASS: two browser scenarios, one signed HTTP lifecycle case |
| Memory lifecycle HTTP via Playwright |1PASS; typed503 without durable storage |
| Chromium MV3 |PASS, providerContacted=false |
| Node guardrails / AIL research guards |44 /14tests PASS, no skips |
| Typecheck / lint / build / architecture / registries |PASS; zero architecture findings |
| Dependency audit |PASS, zero waivers; direct production audit zero vulnerabilities; five moderate development advisories retained |
| Consecutive reproducible build |PASS,842dist files identical; build-reproducibility.json; same Windows checkout/toolchain only |
| Backup/restore rehearsal |PASS,17migrations and five synthetic table comparisons/receipt uniqueness; no SLA |

Line coverage91.93% (4367/4750), +0.36percentage points over R4 reference91.57%; +75tests. Statements87.88%, branches85.44%, functions90.40%. Focused line measurements: auth98.59% (419/425), crypto27/27, contact service21/21, data lifecycle62/62, delivery ops18/18, PG delivery23/24. A measured100%line subset does not establish all security-critical branches/behaviors; that release condition remains explicit. Fresh baseline was not assumed green:15of16lanes passed; coverage had a global outbox backlog test starvation failure (1101pass/1fail). Private-schema test isolation fixes this without filtering the production worker. Hosted fixture failure was distinct from that local baseline failure.

First integrated run at e1dd9ab:119files/1177tests PASS,20PGsuites95tests PASS, line coverage91.93%; HTTP/browser/component/OIDC/MV3/restore/audit passed. The new memory lane failed401 because config re-execution regenerated a runner credential in Playwright workers. Test assertion503 was retained; dedicated ephemeral fixture credential is now shared across runner/workers, independent of operator secrets. Direct memory rerun1PASS. Full suite at659ca46 PASS across all17 lanes; failed attempts remain recorded in test-verification.json.

## Remaining work and decisions

1. Authorize push only after reviewing the concrete tested revision; verify hosted product/browser jobs on that exact SHA before Gate A/B.
2. Provision/review isolated synthetic pilot environment and named operating/observation owners; execute representative Sales scenarios and retain unaided/assisted time/error/intervention evidence.
3. Complete approved class-specific retention/erasure/backup/hold design and implementation before any real-data trial; fixture planning is insufficient.
4. Accept actual deployment IdP/HTTPS/session/revocation and operational recovery; close remaining security behavior gaps before Gate C review.
5. Deferred: dedicated contact correction/supersession, manager exception/Data Health views, full experiment exposure/recovery telemetry. Keep AI/Pancake/Ads/CRM production and attribution/identity merge outside this iteration.

No autonomous/background work continues after final handover. No real-data Gate C approval is inferred from commits or tests.

Operational cleanup note: automatic approval review rejected the commercial agent's recursive deletion of its stopped synthetic .contact-pg directory (policy rejection, no more detailed reason supplied). The directory is retained untracked in that agent worktree; no DB artifact was committed. No further deletion attempt was made.
