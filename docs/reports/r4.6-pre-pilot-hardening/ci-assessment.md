# R4.6 CI-01 assessment and staging rehearsal

Assessed 2026-11-19. Base: `cd842c4851c7ec10792f9d05c39d62392b871f8c`.
Scope: workflow and synthetic OIDC restart fixture only; ADR-002 persistence,
ADR-006 permissions, ADR-007 disabled outbound capabilities and ADR-009 privacy
boundaries remain in force. No push, deployment or shared/customer DB operation.

## Hosted evidence

[Run 44490070582](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/44490070582)
is **completed / failure**, exact head SHA above. Read using
`gh run view 44490070582 --json headSha,status,conclusion,jobs,url`,
`gh run view 44490070582 --log-failed`, and per-job `--log`.

| Job | Result | Evidence |
| --- | --- | --- |
| product / 135443151474 | success | Locked install, audit, registry, typecheck, lint, architecture, packaging, research guards, unit/domain, integration, coverage, build, restore and HTTP smoke all passed |
| Browser operator workflow / 135443150999 | failure | Operator workflow and component regressions passed; OIDC 1 passed / 1 failed; MV3 step skipped after failure |

Product integration gate: **18 suites / 80 tests without skips**. Coverage:
**1102 tests passed**, lines **91.57%**, statements 87.57%, branches 85.30%,
functions 90.59%. HTTP smoke: 22 passed. Restore rehearsal: 14 migration rows,
content comparisons and restored uniqueness passed (149ms restore; no SLA claim).
Dependency audit: production clean, zero dev waivers. These are base-SHA results,
not evidence that the new patch has run on GitHub.

OIDC failed after 90 seconds at `POST http://127.0.0.1:3412/restart`, awaiting
fixture `app.close()`. Node HTTP idle shutdown leaves requestless Chromium TCP
preconnect sockets open. A deterministic local Fastify probe confirmed default
close remained pending with one such socket; `forceCloseConnections: true`
closed it. The downloaded server artifact covered the earlier operator server,
not this OIDC fixture; it was insufficient to diagnose OIDC teardown by itself.

## Change and regression evidence

The synthetic fixture now force-closes transport connections during app restart,
which models process termination. PostgreSQL, memberships, evidence and domain
assertions remain unchanged. The browser regression deliberately opens a TCP
preconnect before restart, requires restart within 10 seconds, and destroys the
socket in `finally`. Original 90-second test limit, zero retries, real OIDC
redirect and post-restart durable-state assertions are preserved.

MV3 uses `if: ${{ !cancelled() }}` so it reports independently after an earlier
suite failure. No `continue-on-error` or failure suppression was introduced.

Local environment: Windows, Node **22.21.0**, npm locked install, PostgreSQL
**17** private cluster on loopback **55446**, fresh `qa_browser_r46_*` databases.
Docker daemon unavailable; Linux/PostgreSQL16 parity awaits a new hosted run.

| Command / experiment | Actual result |
| --- | --- |
| `npm ci --no-audit --no-fund` | 421 packages installed |
| Baseline `npx playwright test --config playwright.oidc.config.ts` | 2 passed, 19.7s; baseline intermittent failure did not reproduce without preconnect |
| New regression + fixed fixture, same command | 2 passed, 25.7s; no skips |
| New regression + temporarily restored old adapter, `--grep 'complete commercial journey'` | Expected failure: restart request timeout 10000ms, 15.1s; fix restored in finally |
| `npx vitest run src/infra/postgres/migration-lifecycle.integration.spec.ts --no-file-parallelism` | 1 passed: clean apply 14, rollback latest 2, reapply; sentinel preserved |
| `npm run typecheck`; `npm run lint` | Passed |
| `npm run security:audit` | Passed; production clean, zero dev waivers |
| `node scripts/restore-rehearsal.mjs` | Passed: 14 migrations, content hashes, receipt uniqueness; restore384ms, total887ms |
| `npm run test:companion` | PASS real Chromium MV3, synthetic websocket, browser/worker restart, sequence persistence, drift fingerprint, no body digest/raw message/provider contact |

MV3 packaged artifact SHA256:
`b8c4b27f3cc1ed369c4eb9129d7ce2bad8bdb09c8778c1df5e7cd64af531511b`.
No new dependency versions, build outputs or migration files were changed.

## Staging setup and rollback runbook

This is a prepared procedure, not a staging execution claim. Use synthetic data
until privacy/retention and pilot gates are explicitly satisfied.

1. Record the exact approved release SHA, lockfile hash, Node22 version, database
   version and applied `schema_migrations` list. Build from clean checkout using
   `npm ci`, audit, typecheck, lint, required integration runner, coverage and
   `npm run build`. Require both hosted jobs green at that exact SHA, including
   OIDC restart and MV3. Retain job links; a local pass cannot replace this gate.
2. Provision a dedicated staging PostgreSQL database and least-privilege runtime
   credentials through the deployment secret store. Keep migration credentials
   separate. Never reuse fixture credentials or a customer database. Obtain an
   engineering migration review per ADR-002 before applying to staging.
3. Configure `DEPLOYMENT_MODE=pilot`, `PILOT_STORE_MODE=postgres`, database secret,
   `AUTH_MODE=oidc`, `AUTH_DEV_UNSIGNED_TOKENS=false`, `DEMO_WORKSPACES=false`,
   `OIDC_BROWSER_ENABLED=true`, HTTPS browser origin, authorization/token
   endpoints, client ID, issuer, audience and JWKS URI. Register callback
   `<origin>/v1/auth/callback` at the IdP. Supply server-side workspace digest keys
   via `CONTENT_DIGEST_KEYS_JSON`; preserve previous keys across restarts.
   Foundation/outbound/research capture flags stay disabled. Never deploy the
   loopback test IdP/control server or unsigned-token workflow settings.
4. Before schema change, stop writers/workers, make a protected database backup
   and restore it into an isolated target. Verify row counts/content and required
   constraints; record measured recovery time. Do not treat the small synthetic
   rehearsal timing as a production RTO/RPO. Run `node dist/scripts/migrate.js up`
   once with migration credentials, then start `node dist/main` under the service
   supervisor and configured HTTPS boundary.
5. Verify readiness, IdP login, owner/recipient workflow, viewer/foreign denials,
   UNKNOWN attribution, immutable evidence/audit and restart persistence using
   synthetic records. Validate redacted operational diagnostics. Browser sessions
   are process-local: expect sign-in again after restart. Record release/migration
   versions with test evidence; do not claim restart persistence of sessions.
6. On failed rollout, stop traffic/writers/workers and preserve diagnostics.
   Prefer rolling application back only when its schema compatibility has been
   reviewed. Never automatically call `migrate:down`: migration014 destroys
   delivery/inbox records, and the clean-fixture down/reapply test is not a
   lossless business rollback. Restore the protected backup to a new isolated
   database, verify it, then perform a reviewed connection switch. Keep original
   database/evidence intact for diagnosis; reconcile writes since backup before
   reopening traffic. Record operator, release, migration versions and outcome.

CI-01 remains **pending hosted verification of the integrated R4.6 SHA**. The
base hosted failure has a locally red/green regression fix; no later hosted
success or staging readiness is claimed.
