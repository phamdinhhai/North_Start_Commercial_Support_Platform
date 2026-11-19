# R2 Independent QA, CI and Reliability Review (Subagent I)

- **Integration SHA under review:** `f2221d3` (round-2 range `8673ca8..f2221d3`, 12 commits)
- **Reviewer branch:** `work/r2-review-i` (worktree `ns-r2-review-i`)
- **Date:** 2026-11-18
- **Environment:** Windows 11, Node 22, PostgreSQL 17 sandbox on 127.0.0.1:55439

This review re-ran every gate independently and then probed the round-2 changes adversarially. It changes no production code. Defects are reproduced by new spec files. Each reproduction uses `it.fails`: the test asserts the *expected* behaviour, so it stays green while the defect exists. Once the defect is fixed, vitest reports an unexpected pass, and the test should then be flipped to `it`. Paired "evidence of current behaviour" tests pin the actual behaviour.

**This is not a production-readiness statement.**

## 1. Gate re-execution (at `f2221d3`, before adding review specs)

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Lint | `eslint "src/**/*.ts" "e2e/**/*.ts"` | exit 0, 0 findings |
| Architecture tests | `npm run test:architecture` | 10/10 pass |
| Architecture strict | `npm run architecture:check:strict` | PASS (0 findings) |
| Unit | `npm test -- --exclude '**/*.integration.spec.ts'` | 59 files, **703 passed**, 0 skipped |
| PG integration (CI gate) | `CI=true TEST_DATABASE_URL=…/north_start_ci DEPLOYMENT_MODE=test npm run test:integration:ci` (empty DB) | **11 suites, 47 passed, 0 skipped** |
| Coverage | `npm run test:cov -- --no-file-parallelism` (TEST_DATABASE_URL=disposable_r2_review_i) | 70 files, 750 passed; **lines 89.92%** (threshold 80%); stmts 86.27, branches 84.5, funcs 89.93 |
| Build | `npm run build` | exit 0 |
| E2E | `npm run test:e2e` (TEST_DATABASE_URL=disposable_r2_review_i) | 2 files, **16 passed**, 0 skipped |
| Audit-policy tests | `npm run test:security-audit` | 6/6 pass |
| Dependency audit | `npm run security:audit` | PASS. Production is clean. One dev-only waiver applies: `GHSA-fc5q-39xc-vjpf` (picomatch, high), expiring 2026-12-18. |
| Companion packaging tests | `node --test scripts/companion-package.test.mjs` | 5/5 pass |
| Companion smoke | `npm run test:companion` | PASS. Real Chromium MV3; worker restarted; providerContacted=false. |
| Migration chain | `migrate.js up` → `down 11` → `up` → `down 1` → `up` (fresh DB) | All succeed. After a full down, the remaining objects are `schema_migrations`, the `commercial_envelope_quarantine` and `workspace_consistency_quarantine` tables (004/005 retain them deliberately) and the `pgcrypto` extension. All of these predate round 2. |

**After adding the review specs:** unit is 64 files, 714 passed plus 8 expected-fail (722). Typecheck and lint stay at exit 0.

## 2. Regression vs round-1 baseline (`8673ca8`: 426 unit / 30 PG / 13 e2e)

| Suite | Baseline | `f2221d3` | Delta |
|---|---|---|---|
| Unit | 426 | 703 | +277 |
| PG integration (CI gate) | 30 | 47 | +17, plus 3 new required suites (connector-health, membership, governed-action) |
| E2E | 13 | 16 | +3 |

- No spec was deleted and no `.skip`/`.only`/`.todo` was introduced in the range.
- One existing assertion was intentionally strengthened: `intake.spec.ts` "revocation requires issuer" now also checks the audit actor argument.
- All 11 `*.integration.spec.ts` files are listed in `scripts/ci-integration.mjs`.

## 3. Test matrix

| Area | Test type | Result | Evidence |
|---|---|---|---|
| OIDC verifier: alg `none`/HS key confusion, nbf/exp/iss/aud, tamper, unpublished key reusing kid | unit (existing) | PASS | `oidc-token-verifier.spec.ts` |
| OIDC: concurrent random-kid flood on a cold cache | unit (new) | PASS (1 JWKS fetch for 20 tokens) | `oidc-adversarial.r2-review.spec.ts` |
| OIDC: ES256 token reusing the kid of a published RSA key | unit (new) | PASS (rejected) | same |
| OIDC: enrollment `typ` variants as login | unit (new) + HTTP (existing) | PASS (refused before key lookup) | same; `oidc-http.spec.ts` |
| OIDC: `x-workspace-id` spoof / revoked / demo / CRLF; claim-based workspace | unit (new) | PASS | same |
| OIDC: flag off leaves legacy unchanged | HTTP (existing) | PASS | `oidc-http.spec.ts` "flag off" |
| OIDC: WeakMap-on-headers assumption across controllers | HTTP (new) | **DEFECT R2-I-02** | `src/api/integration.oidc.r2-review.spec.ts` |
| Enrollment issuance: duplicate JSON keys, alt alg, retired kid, cross-workspace selector, audit content | code review + existing unit | PASS | `token.ts:38` exact header keys + HS256 + typ; `intake.ts:75` workspace filter |
| Connector health: flag-off 404 before auth, tenant scope, completeness `UNKNOWN` | code review + existing unit/PG | PASS | `connector-health.controller.ts:28`; `pg-connector-health.reader.ts` binds `$1` |
| Logging redaction | unit (new) | **DEFECT R2-I-05** (defence in depth) | `json-logger.r2-review.spec.ts` |
| Governed actions: concurrent execute (simultaneous load) | unit + PG (existing) | PASS (executor called once) | `governed-action.execution.spec.ts`, `governed-action.integration.spec.ts` |
| Governed actions: refused command during EXECUTING | unit (new) | **DEFECT R2-I-01** | `governed-action.r2-review.spec.ts` |
| Governed actions: UNKNOWN never re-executed; AI cannot authorize/execute/verify; kill switch before dispatch; digest binding | unit (existing) + review | PASS | `action-lifecycle.ts:162,216-233,269`; service `execute` last look |
| Governed actions: append-only triggers; migration 011 down/up | PG (existing) + CLI chain | PASS | integration spec; §1 migration chain |
| Pancake: gap window bounded only by a real rejoin | unit (new) | **DEFECT R2-I-03** | `lifecycle.r2-review.spec.ts` |
| Pancake: ledger arrival-order determinism | unit (new) | **DEFECT R2-I-04** | same |
| Companion: OUTBOX_FULL, reset, worker-restart sequence reuse | code review + smoke | PASS, with minors (§4) | `npm run test:companion`; `lifecycle.mjs`, `upload.mjs`, `worker.mjs` |

## 4. Independent review findings

### R2-I-01 — MAJOR — A refused command during EXECUTING loses the in-flight outcome (governed actions)

- **Where:**
  - `product/src/application/governed-action/governed-action.service.ts:246-252` (`audited` → `recordRefusal`)
  - `product/src/domain/governed-action/action-lifecycle.ts:290-294` (a refusal is a version+1 transition)
  - `governed-action.service.ts:175` (outcome CAS on `running.version`)
- **Mechanism:** every refused in-workspace command appends `COMMAND_REFUSED` *and bumps the proposal version*. Suppose any actor's command is refused while an execution is in flight. Examples:
  - a duplicate `execute` → `EXECUTION_IN_FLIGHT`
  - an AI or human `verify` → `INVALID_TRANSITION`
  - `recoverStaleExecution` inside the lease

  Then the executor's final `store.transition(running.version, done)` fails with `CONCURRENT_MODIFICATION`.
- **Reproduction:** `product/src/application/governed-action/governed-action.r2-review.spec.ts`, using a gated executor (in-memory store; the root cause is in the service, so the PG store behaves the same way).
- **Expected:** the winner records `SUCCEEDED_VERIFIED` with its readback evidence and `providerReference`.
- **Actual:**
  - the provider effect is applied (`ledger.appliedCount() === 1`)
  - `execute()` rejects with `CONCURRENT_MODIFICATION`
  - no `OUTCOME_RECORDED` event is written and `providerReference` is lost
  - the proposal stays `EXECUTING` until the lease expires (default 5 min), then `UNKNOWN`, then readback
- **Safety:** this is not a double execution; the UNKNOWN/readback path still recovers. It is an audit and evidence loss plus a false error to the caller who dispatched. Any workspace actor, including an AI, can trigger it.
- **Existing coverage:** the "concurrent execute" tests miss it because all callers load the same version at the same time.
- **Fix direction (for the owner):** do not version-bump for refusals that race an in-flight execution. For example, record refusals in a separate append stream, or exempt `EXECUTING` from refusal recording. Alternatively, make the outcome write re-read and apply on top of refusal-only versions.

### R2-I-02 — MAJOR — OIDC principal never reaches `/integration/enrollments[/revoke]`

- **Where:**
  - `product/src/api/integration.controller.ts:60`: `this.auth.resolve({ headers: { ...headers } })`
  - registry keyed by object identity: `product/src/infra/auth/verified-context-registry.ts:11-21`
- **Mechanism:** the controller copies the headers object, so the WeakMap lookup misses and `AuthService.resolve` returns null.
- **Reproduction:** `product/src/api/integration.oidc.r2-review.spec.ts`.
  - The same verified manager token gets 200 on `/pilot/queue`.
  - It gets **401 UNAUTHORIZED** on `POST /integration/enrollments`, where 400 `WORKSPACE_FROM_CONTEXT` was expected.
- **Answer to the brief's question:** the WeakMap-on-headers assumption fails **closed** (silent 401), never open. No bypass was found: other controllers (`connector-health`, `feedback-telemetry`, `pilot-loop`) pass the original object. But the round-2 "principal-authenticated issuance" feature is unusable under `AUTH_MODE=oidc`, and no spec covered that path.
- **Fix direction:** pass `headers` through unchanged, and add an HTTP spec over every `auth.resolve` call site in OIDC mode.

### R2-I-03 — MAJOR — Pancake: a heartbeat reply bounds a gap window and enables false reconciliation

- **Where:**
  - `product/src/adapters/adaptive-connectivity/message-lifecycle.ts:111`: any `phx_reply{status:'ok'}` maps to `joined`, including topic `phoenix` heartbeat replies, and the reply ref is not matched to a `phx_join`
  - this sets `gap.end` and `status: 'connected'` at `continuity.ts:~93`
- **Reproduction:** `product/src/adapters/adaptive-connectivity/lifecycle.r2-review.spec.ts`. Sequence: `phx_error` → heartbeat reply. The gap then has `end = t30`, and a snapshot at t40 is `eligible: true` for `reconcileGapBySnapshot`.
- **Expected:** the gap stays open (`end: null`), status stays disconnected, and the snapshot is not eligible.
- **Effect:** this violates "gap windows never closed by rejoin alone" in spirit. A non-join reply is treated as a rejoin, and the real reconnect later opens no new window.

### R2-I-04 — MAJOR — Pancake ledger: conflicting replay of a captureId is order-dependent

- **Where:** `product/src/adapters/adaptive-connectivity/message-ledger.ts:62`. A captureId match returns `duplicate-capture` without comparing `contentHash`/`observedAt`, unlike `continuity.ts`, which returns `conflict`.
- **Reproduction:** same spec file. Applying sightings in the order a,b and in the order b,a gives different `ledgerSnapshot`s, and both orders report `duplicate-capture`.
- **Expected:** identical results in any order, with the conflict surfaced.

### R2-I-05 — MINOR (defence in depth) — Multi-line Error messages can smuggle PII into `stack`

- **Where:**
  - `product/src/infra/observability/redaction.ts:27` (`STACK_FRAME` admits `@ . -`)
  - `redaction.ts:109-113`
  - `json-logger.ts:176-179`
- **Reproduction:** `product/src/infra/observability/json-logger.r2-review.spec.ts`. An `Error('x\n    at alice@example.com\n    at eyJ…')` logs those lines as frames, both directly and via the `ExceptionsHandler` (message, stack, context) shape.
- **Exposure:** no current call site is known to place attacker-controlled newlines in an Error message.
- **What was verified correct:**
  - the field allowlist; Authorization, cookie, token, email and phone are dropped regardless of key casing
  - `x-request-id` is UUID-validated
  - metric route labels are templates, with a series cap

### Minor findings (code review, not converted to tests)

| ID | Severity | Where | Finding |
|---|---|---|---|
| R2-I-06 | MINOR | `adaptive-connectivity/history-readback.ts:257` | `fetchedAt` is taken after `await fetchPage`. A snapshot requested before the rejoin but answered after it passes the "readback started after gap end" check (`readback-correlation.ts:84`). |
| R2-I-07 | MINOR | `adaptive-connectivity/continuity.ts:114` | The caller supplies the pages a reconciliation must cover. State does not record subscribed pages, so a partial `pageIds` list can reconcile a multi-page gap. |
| R2-I-08 | MINOR | `adaptive-connectivity/continuity.ts:93` | A `connected` timestamp earlier than the gap start writes `end < start`. Every later input then throws `invalid_checkpoint`, wedging the state. |
| R2-I-09 | MINOR | companion `upload.mjs:20-29`, `lifecycle.mjs:~68` | After reset, re-pasting the same grant is accepted at `nextSequence: 1`. The server refuses with 409 `CHECKPOINT_REGRESSION` (`pg-integration.store.ts:57`), so nothing is lost silently, but the user loops back to blocked. "Requires fresh enrollment" is not enforced client-side. |
| R2-I-10 | MINOR | companion `worker.mjs:8,40,190,202,217` | `gapSince` is only ever the install time. Frames already queued when OUTBOX_FULL stops capture are discarded without incrementing `dropped`. |
| R2-I-11 | MINOR | companion `lifecycle.mjs:29`; `companion-browser-smoke.mjs:113` | `captureSeq` is not written to records, uploads or the digest, so the smoke assertion "capture sequence continues without reuse" proves nothing. Reuse is actually prevented by the persisted pending upload plus `nextSequence`, which is correct. |
| R2-I-12 | MINOR | `scripts/companion-package.mjs:72` | The import regex requires `from`, so side-effect imports (`import './x.mjs'`) are not followed. No current file uses that form. |
| R2-I-13 | MINOR | `scripts/ci-integration.mjs:61` | Per-suite databases have fixed names (`north_start_ci_<n>`) and are `DROP … WITH (FORCE)`d. Two concurrent gate runs on one server destroy each other's databases. This is harmless on per-job CI servers but unsafe on a shared sandbox. |
| R2-I-14 | MINOR | `governed-action.service.ts:143-145` / `action-constraints` | Execute-time constraints are evaluated against `p.preview.beforeState`, captured at preview time. A provider-side change between preview and execute is not re-read before dispatch. The approval binds to the reviewed preview (by design), but the budget-delta check can be stale. |
| R2-I-15 | MINOR | `action-lifecycle.ts:108,237` | `idempotencyKey` (`ga-<id>`) is reused across attempts after `FAILED_VERIFIED` → re-authorize. A real provider that caches failed responses by key could replay the failure. This is synthetic-only today. |
| obs | INFO | `oidc-auth.module.ts:196-212` | In OIDC mode, the global `onRequest` hook can return 403/400 before a flag-off route's 404. It behaves the same for unknown routes, so routes are not revealed. |

### Areas checked and found correct

- **OIDC:**
  - alg allowlist checked before key lookup
  - `typ` filter rejects `AIL-ENROLLMENT`
  - JWKS sanitization rejects private or symmetric material
  - unknown-kid refetch is bounded and in-flight fetches are shared
  - membership is read on every request, so revocation applies to the next request
  - legacy unsigned/bootstrap paths are disabled in OIDC mode
  - an unknown `AUTH_MODE` fails closed
- **Enrollment tokens:**
  - the header must have exactly the keys `alg,kid,typ`, with `alg=HS256` and the expected `typ`
  - duplicate-key `alg` values resolve last-wins and are then rejected
  - retired or unknown kids are rejected before MAC work
  - `timingSafeEqual` is used
  - config is re-parsed per request (from `process.env`, so changes still need a restart)
  - audit rows contain no token, signature or secret
- **Connector health:**
  - the flag-off 404 precedes `auth.resolve`
  - the workspace comes only from the resolved principal and is bound as `$1`, with a second in-app filter
  - `completeness` is the literal `'UNKNOWN'`
- **Governed actions:**
  - AI is refused at authorize (`AI_CANNOT_AUTHORIZE`), execute and verify
  - self-approval is denied
  - the approval binds both the argument digest and the preview digest; re-preview clears the approval
  - `UNKNOWN` refuses execution; verify resolves only by readback
  - the kill switch is checked at the gate and again just before dispatch (fail closed on error)
  - events are append-only with UPDATE/DELETE/TRUNCATE triggers; frozen proposal fields are immutable; the version advances by exactly one
  - migration 011 down/up and the full chain 001→011 up/down/up succeed
- **Companion:**
  - the outbox bound is checked before append and persisted atomically, with no eviction
  - reset is accepted only from the popup origin and requires a digest or count
  - the pending upload is persisted before fetch, and the server rejects same-captureId/different-fingerprint uploads

## 5. Release-readiness assessment

| Dimension | Status |
|---|---|
| **Technical gates** | **All green** at `f2221d3`: typecheck, lint, architecture, 703 unit, 47 PG (0 skips), 16 e2e (0 skips), coverage 89.92% lines, build, audit, companion. |
| **Technical correctness** | **Not ready to merge as "done"** for the affected features. Four MAJOR defects are open: R2-I-01 (governed-action outcome loss), R2-I-02 (OIDC issuance unusable), and R2-I-03/R2-I-04 (Pancake continuity/determinism). None is a privilege escalation or a double execution, and all fail closed or recoverably. They are reproducible by the committed `it.fails` specs. |
| **Provider authorization** | **Not established.** Governed actions are synthetic-only. Pancake frame shapes (including auth expiry and heartbeat semantics) are synthetic assumptions awaiting an authorized account. OIDC has been tested only with runtime-generated keys and no real IdP. |
| **Product validation** | **Not established.** PM-1, CE-1/CE-2 and the other open decisions remain open. No pilot or customer validation is in scope for this review. |

No claim of production readiness is made.

## 6. Limitations

- **Not run:**
  - against a real IdP, a real Pancake account or a real ad provider
  - `npm run test:browser` (Playwright suite); only `test:companion` was run
  - load/soak tests of the JWKS cooldown under real network latency
- **Concurrency coverage:** governed-action concurrency was probed in-process and through the existing PG CAS test. The R2-I-01 reproduction uses the in-memory store; the PG store shares the same service path but has no separate PG repro.
- **Code-review-only findings:** the companion findings (R2-I-09..12) and R2-I-06..08 come from code review by a read-only sub-reviewer, with Pancake items executed in a scratch copy outside the repo. They were not converted into committed specs.
- **CI integration gate side effects:** the gate script creates and drops `north_start_ci_0..10` on the shared sandbox server (see R2-I-13).
