# R4.12 independent integrated QA result

Revision reviewed: `eef86fb` plus QA commit `97b89bf` (tests only). No provider network call, credential, Owner pilot resource or real customer data was used.

## Executed checks

- `npm ci --ignore-scripts --no-audit --no-fund`: PASS, 421 packages, no lockfile change.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm run lint`: PASS.
- `npx vitest run src/application/durable-sync/independent-failure.qa.spec.ts src/application/provider-credentials/independent-custody.qa.spec.ts src/api/operator-sync-health.http.spec.ts`: **14 tests PASS**.
- `TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54050/r412_qa npx vitest run src/infra/observability/operator-health.qa.integration.spec.ts --no-file-parallelism`: **3 actual PostgreSQL tests PASS**, bounded tenant reads, revoked source projection and manager/sales policy.
- `QA_DATABASE_URL=postgres://postgres@127.0.0.1:54050/qa_browser_r412_qa_final npx playwright test --config playwright.r412.config.ts`: **1 signed OIDC Chromium test PASS**.

The browser fixture creates three fabricated streams in two workspaces through the production PostgreSQL store, commits one page per stream, verifies no cursor/lease/secret leakage, admin pause/resume/revoke, manager read-only access, Sales denial, foreign workspace isolation, source-connection revocation, CSRF denial, restart persistence and zero owner/outcome mutation. All databases were dropped after the test.

## Independent findings

- Test-only credential custody now passes mode guards, admin-only configuration, workspace/provider/account binding, opaque principal version fencing, rotation/revocation, metadata redaction, immutable metadata copies and terminal revoked state.
- Durable sync failure handling passes request timeout/abort, bounded Retry-After, retry exhaustion, schema poison, explicit gaps, auth revocation, persistence failure and lease binding mismatch without checkpoint advancement.
- Operator health returns `UNKNOWN` lag/completeness, bounded 100 rows, truncation, no cursor/lease/payload exposure, manager read access and admin-only controls.
- The actual provider boundary remains offline synthetic. No test establishes provider entitlement, vault custody, live webhook authentication or production checkpoint SLO.

## Limitation noted for root integration

A pre-final review found that a revoked credential could still permit the polling request callback to run before commit authorization unless the sync runner requires an explicit `authorizeFetch` callback. The integrated root revision added that requirement; the QA tests should be rerun on the final exact revision with a revoked-before-fetch mock asserting zero request calls.


Root closed the before-fetch gap with mandatory authorizeFetch and a zero-request revoked test. The provider reviewer also identified missing messages.read scope in signed fabricated admission; both application and PostgreSQL sink now check it, with profile-only negative coverage. Final full regression is run at41948f3, separately from the independent agent?s eef86fb checkpoint above. No additional independent agent sign-off is invented after runtime usage errors.


Final root execution at frozen41948f3:26/26lanes PASS,1,413tests in155files,157PostgreSQL included/zero skipped,92.77%line coverage. Signed R4.12 UI,16table restore and page/delivery replay, abrupt child exit73/resume page3, owned launcher PG outage and bounded benchmark all PASS. This is independent of the earlier workstream checkpoint above. Hosted R4.12, provider authorization and human validation remain NOT RUN/PENDING as separately scoped.
