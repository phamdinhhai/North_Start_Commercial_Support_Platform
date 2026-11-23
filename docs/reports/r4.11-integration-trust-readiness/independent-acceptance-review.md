# Independent acceptance review of source 4fe69e3

Reviewers inspected actual code and tests, not only specialist reports. Final regression is separately recorded in verification.json. Six specialists worked; independent review here came from identity, provider and QA reviewers on portions they did not author, plus root integration review.

| Reviewer | Independently reviewed scope | Finding/result |
|---|---|---|
| r411_identity | Root trust/continuity API/UI/runtime, provider offline ports, migration019/020/021, new QA coverage | No remaining material blocker for synthetic/local scope at `4fe69e3`, subject to final regression. Initial missing direct tests and nested-pool concern corrected. Rechecked elapsed-budget fix. |
| r411_provider | Root trust/continuity wiring, linked reader and new independent QA HTTP/browser tests | No P0/P1 found in reviewed scope; independently reran13 HTTP/reader tests. Raised DB receipt-tuple gap;021 added and tested. Confirmed actual no-store success/error assertions. Did not independently approve own provider code. |
| r411_qa | Root changes after QA source `e0afdee`: locked authority, history audit,021, elapsed checks, restore and workflow | No material concern at `4fe69e3`. Confirmed real runtime factory test max1/ten commands, exact tuple/audit,12-table restore and action pin/runtime compatibility. Hosted execution remains pending. |
| root | All cherry-picked source/SQL/ports, strict architecture and suite registration, provider constraints, QA fixtures | Approved bounded contracts and additive migrations. New PG reader suite added to required CI discovery list. Final source frozen for full execution. |

Closed findings with executable evidence:

- Scoped connection lookup now works beyond the first100; actualPG creates102connections.
- Evidence cursor preserves microseconds, is workspace/Lead-bound, and supports106-record traversal plus stale-response browser protection.
- Mutation reauthorization uses actual sorted locked Lead authority, avoiding nested pool acquisition; ten concurrent production-factory commands finish with one pool client.
-021 refuses direct wrong/foreign envelope or wrong origin, and refuses inconsistent old rows without rewriting them. Migration tests create their own database, preserving coverage/shared parent schema.
- New controller/query/reader tests cover feature-off, anonymous/demo/role refusals, foreign pointer tuples, target-only Sales, safe projection and mandatory audit failure. Signed browser tests cover CSRF, ownership/membership changes, replay/collision/revoke/restart.
- Offline elapsed budget is recalculated after authorization and before persistence; comments retain the terminating-callback/cooperative-cancellation limit.
- Backup/restore snapshot includes source_episode_link, exact link replay and12tables; existing immutable source behavior is retained.

Remaining limits are acceptance boundaries, not silently resolved decisions: linked reads use request-time authorization across separate transactions, so no instantaneous cancellation of in-flight responses is promised. Next-request denial is tested. Link history is capped100 with UNKNOWN completeness and no continuation; native evidence alone has cursor pagination. Historical per-message seeds remain. Live transport/credential/checkpoint implementation, provider rights, production data lifecycle, human usability and performance SLO remain unverified. No canonical open decision or production gate is closed by this review.

## Completed final regression

Source4fe69e3 completed23/23 lanes:1,354Vitest tests in 144files, including 137PostgreSQL tests across27required suites; zero failures/skips, line coverage92.40%. Original OIDC/source/MV3/pilot regressions and the two new R4.11 Chromium journeys passed. Dedicated backup/restore preserved12table snapshots and link replay; new owned launcher passed actual outage/manual recovery and unsafe-history refusal. Final benchmark had no unexpected errors/deadlocks. All owned clusters stopped. Full commands/log hashes and limits are in verification.json; hosted R4.11 CI remains NOT RUN.
