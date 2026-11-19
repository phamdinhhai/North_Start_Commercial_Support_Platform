# R4.6 independent QA assessment

Reviewer: r46_qa, 2026-11-19. Worktree `ns-r46-qa`, baseline `0e9b1ca1b264c12ffb39628b502a25ee73ff7ca9`. Applied e2e-testing-patterns skill. Reviewed frozen invariants, open decisions, ADR-005/006/007/009, R4 early QA matrix, R4.6 security/CI reports and DATA implementation. No canonical or production changes by QA. No human Sales pilot, real customer data, push, deployment or provider enablement occurred.

## Early matrix gaps and corrected interpretation

- Q-U3 previously treated action completion as a proxy for contact attempt. They are separate claims: contact needs actor/time/channel/result, evidence or UNKNOWN reason, follow-up implication and append audit, without implicit state/action changes.
- Q-U2 must assert three separate source concepts in the actual detail UI. Merely displaying a generic attribution UNKNOWN sentence is insufficient.
- Q-L1 listed feedback but the existing OIDC journey did not submit it. Added UI feedback and separate persisted-feedback assertion. Product telemetry remains content-free; feedback intentionally accepts user text and must not be represented as telemetry.
- Q-L1 release/flag metadata does not demonstrate per-session experiment exposure. This remains unverified; no auth identifier should become an analytics identifier.
- Synthetic exclusion means automated rehearsal completion/time/error evidence must live outside business learning. A fabricated non-synthetic-classified fixture only verifies a disposable contract. It cannot establish adoption or real task completion.
- Parent-reported baseline coverage had one outbox starvation failure from shared global batches. It is a test isolation defect, not a passing gate; reliability correction and full integrated rerun are required.
- A loopback fixture IdP proves the redirect/token/cookie protocol against a real signed test issuer. It does not prove acceptance by a deployed enterprise IdP or human usability.

## Independently executed evidence

Installed using `npm ci --ignore-scripts` (five moderate dependency advisories reported). Dedicated PostgreSQL 17 cluster bound to `127.0.0.1:55466`; disposable `qa_browser_r46_baseline`, no imported business data. Startup is test-only and provisions identity/membership; full commercial journey creates business fixtures through UI only.

| Dependency state | Command (from product) | Result |
|---|---|---|
| `0e9b1ca` | `QA_DATABASE_URL=<disposable> npx playwright test --config playwright.oidc.config.ts --reporter=line` | 2 passed, 20.9s automation wall time; includes requestless TCP restart regression |
| `0e9b1ca` + DATA `b1841d0` (same patch as `f276715`) + composition `ffee29b` | `TEST_DATABASE_URL=<disposable> npx vitest run src/infra/data-lifecycle/data-lifecycle.integration.spec.ts src/infra/data-lifecycle/synthetic-research-vault.spec.ts --no-file-parallelism` | 8 passed, 1.19s; no skips |
| Same DATA/composition state, new QA spec | `QA_DATABASE_URL=<fresh qa_browser_r46_lifecycle> npx playwright test --config playwright.oidc.config.ts --grep 'signed admin' --reporter=line` | 1 passed, 15.0s including build/start; actual signed admin absent-policy409, configure/preview201 no-store, client-clock400, sales403 |
| Composition `62a3db5`, commercial `59d803c` (root equivalent `7855999`), auth `0a17bd1`, QA spec | `QA_DATABASE_URL=<fresh qa_browser_r46_integrated> npx playwright test --config playwright.oidc.config.ts --reporter=line` | 3 passed, 18.6s including build/start; UI-only full journey, contact claim, truth, feedback, reload, requestless TCP restart, denials, actual HTTP lifecycle |
| Same integrated state, fresh `qa_browser_r46_components` | `TEST_DATABASE_URL=<disposable> npx vitest run src/infra/postgres/contact-attempt.integration.spec.ts src/infra/data-lifecycle/data-lifecycle.integration.spec.ts src/infra/data-lifecycle/synthetic-research-vault.spec.ts src/api/contact-attempt.controller.spec.ts src/application/pilot/contact-attempt.service.spec.ts src/infra/auth/jwks-staleness.spec.ts --no-file-parallelism` | 6 files, 21 passed, 5.03s, no skips |
| DATA/composition state + commercial patch | `npx playwright test --config playwright.lifecycle.config.ts --reporter=line` | 1 passed, 10.9s; actual memory HTTP configure/preview503 DURABLE_STORAGE_REQUIRED using local-only ephemeral bootstrap |
| Same integrated state | `BROWSER_PORT=3117 npx playwright test --config playwright.config.ts --reporter=line` | Legacy four browsers passed, 15.4s |
| Same integrated state | `npx playwright test --config playwright.lifecycle.config.ts --reporter=line` | Rechecked new memory lane, 1 passed, 11.9s |

`npm run typecheck`, `npm run lint` and `git diff --check` passed with the QA changes. The new memory lane uses `playwright.lifecycle.config.ts`; run it separately from legacy browsers. The first draft unsigned-admin fixture correctly received401 and was replaced by explicit local-only bootstrap. Config reuse also collided with an existing3100 server; standalone3116 config resolved it. These were test harness corrections, not production defects. No broad coverage percentage or release approval asserted.

## Independent cross-review

DATA: policy changes append under workspace/data-class advisory lock; preview uses repeatable-read server time and ingestion age; audit failure rolls back; immutable accepted evidence/audit is never deleted. Eight independent tests pass. The synthetic in-memory vault proves a fixture lifecycle only, not an approved production research retention service. Global fault trigger tests require an isolated database and serial file execution.

Security: bounded streaming readers and prior-session retirement are incorporated in baseline. Follow-up `0a17bd1` adds an absolute stale signing-key cutoff and its independent test passed. Sessions remain process-local; browser recovery validates intentional reauthentication after restart. Existing unit suites, not this browser test, cover all detailed protocol negatives.

Commercial `59d803c`: current-owner/lead authorization, evidence relation/classification check, locked expected version, append-only claimed record plus audit, no status or action mutation, and textContent rendering agree with ADR-005/I-05/I-09. UI/PG tests independently pass. Pagination is bounded but UUID-ordered, not chronological; root reports a follow-up improvement pending, so final chronological pagination is not verified here.

Reliability `b4688a7` read-only cross-review: random private test schema isolates worker batches and failure triggers, removing the shared backlog starvation mechanism. Admin ops resolves workspace from verified context, requires OIDC/local-test enablement and internal UUID, locks row and appends audit atomically, refuses poison replay and live-lease stop. Existing at-least-once limitation remains explicit: timeout cannot cancel a sink's late effect. This is source review, not an independent run of that later patch. Root must run full checks at the final integrated SHA; earlier passing results do not transfer automatically to later commits.

## Final integration evidence supplied by root

At659ca46 all17 local lanes PASS,1177tests/95PG/22HTTP/browser4/component3/OIDC3/memory1/MV3; exact commands/hashes in test-verification.json. Root also verified final chronological cursors, reverse/concurrent command-key collisions and TRUNCATE/nonempty rollback refusal in PG. These are root-run results, distinct from independent QA runs above. Playwright worker credential regeneration was corrected in659ca46 without changing runtime authorization or weakening503 assertions. The source under test differs from earlier worker checkpoints, and hosted CI is still required for Gate A/B.
