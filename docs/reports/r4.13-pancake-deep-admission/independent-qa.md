# R4.13 independent QA checkpoint

Agent 6 reviewed source and executed offline tests in isolated `work/r413-qa`, based on `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3`. Reviewed specialist inputs: security `35f9fa651542d39d47d8f4179a42c3e524abd14c`, sync `515edb9`, documentation `5d82293`, API research `d69bf47`, and the domain mapping report in its isolated worktree. This report is a bounded checkpoint, not final integrated acceptance. No credentials, cookies, raw capture, raw provider response or provider network operation was accessed by this agent.

## Confirmed defect and correction

**VERIFIED DEFECT, Medium:** `PancakeRequestPolicy.observe` originally stopped redirects only when the caller supplied `redirected: true`. Manual redirect clients normally return a 3xx response without following it, so that flag can be false. The policy then admitted another request despite the terminal redirect rule. `pancake-request-policy.qa.spec.ts` reproduced seven failures for statuses 300/301/302/303/307/308/399 with `redirected: false`; four invalid-status cases already passed. Root authorized Agent 6 to add categorical 300–399 terminal handling. The same eleven tests then passed unchanged. This is an offline safety-policy defect, not evidence of an exploited provider vulnerability.

## Independent code review

| Boundary | Source evidence | Assessment / limitation |
|---|---|---|
| Exact request admission | `application/pancake-admission/pancake-request-policy.ts` | Copies trusted target/routes, matches exact capability/method/URL, bounds count/delay, requires mutation recovery and recipient consent references. No routes enabled by default. Reference strings are not authentication proof; trusted executor must bind actual request body and returned scope. |
| Redirect / failure stop | Same, `observe` | Raw 3xx now terminal, as are 401/403/429, scope mismatch and invalid status. Network failure must be reported or executor must stop; the helper is not an HTTP interceptor. |
| Positional history | `adapters/pancake/pancake-history-readback.ts` from `515edb9` | Bounded, immutable state; rejects target/count mismatch; preserves completeness/lifecycle UNKNOWN and `durableResumeSafe: false`. Empty/short page is not complete sync. No network, checkpoint or observation wiring added. |
| Durable admission | `application/durable-sync/admission.ts`, `ports/durable-sync.ts`, `application/source-trust/source-trust.ts` | Remains synthetic-only. Do not relabel actual customer observations as fabricated data or feed positional offsets as durable cursors. |
| Domain continuity | Agent 4 `native-identity-mapping.md`, reviewed source-trust and sync contracts | Page/account/contact/message/Lead authority remains separate. No automatic identity merge, ownership/outcome change or thread-wide episode link is justified by provider response. Existing PG cases were inspected by Agent 4; final integrated PG rerun is still required. |
| Research claims | Documentation and API reports above | Correctly distinguish local syntax/schema inventory, historical private capture and unverified runtime behavior. Local REST hash difference is not silently assigned old validation results. No unsupported live PASS found in those reports. |

## Root harness source review

Read-only source review of `%TEMP%/north-r413-private/account-read.py` and `token-account-read.py` found exact private `/api/v1/me` requests, no automatic redirects, 20-second timeout, bounded 1MiB-plus-one read, memory-only credential loading, categorical errors/journal and no raw response/header logging. The second script checks JSON content type and reserves an aggregate counter before I/O. It remains a private observed authentication probe, not an official stable API contract. No credential or runtime journal file was opened by QA.

Root reported one cookie probe returned HTTP 200 with provider success false and no verified identities. This report does not independently attest that runtime result. The token probe had not executed when reviewed. Presence of two identity fields is not proof of Owner-account equality, Page rights or conversation/contact binding. Future execution must persist terminal/in-flight state before I/O, stop unknown outcomes, retain the total ceiling across scripts/restarts, and validate exact returned scope before any mutation. No mutation is accepted by this checkpoint.

## Executed verification

Environment: Windows, Node `v22.21.0`, npm `10.9.0`, Vitest `5.1.0`. Dependencies installed with `npm ci --no-audit --no-fund`. Test source is cherry-picked security/sync inputs above plus the one-line redirect correction and new independent eleven-case spec in this QA commit.

From `product/`:

```text
npx vitest run src/application/pancake-admission/pancake-request-policy.spec.ts src/application/pancake-admission/pancake-request-policy.qa.spec.ts src/adapters/pancake/pancake-history-readback.spec.ts src/application/durable-sync/offline-sync.spec.ts src/application/durable-sync/independent-failure.qa.spec.ts src/application/source-trust/source-trust.adversarial.spec.ts
npm run typecheck
npm run lint
npm run architecture:check:strict
```

Final bounded execution: **6 files, 54 tests PASS, zero skipped**; typecheck/lint/strict architecture PASS, zero architecture findings. No coverage measurement was taken by this agent. An earlier command named a nonexistent `source-trust.spec.ts`, so Vitest executed only five files/48 tests; that result is not the final six-file result. The raw-redirect failure history above remains recorded, not hidden. No full regression, hosted CI, PG restore, live mutation, provider authentication, human Sales usability or production approval is claimed here.

## Release recommendation and hygiene

Go for integration of the offline policy correction and positional planner, followed by exact-source regression. Required final checks include unit/coverage, PostgreSQL receipt/link/checkpoint/replay/concurrency, HTTP/RBAC, browser/OIDC/draft/handoff/manager/evidence, HMAC/audit, backup/restore/process recovery, MV3, pilot launcher, architecture/registry/build/lint/typecheck and dependency/security scanning. Do not reuse R4.12 counts as R4.13 proof.

Before this local commit, owned changed/untracked files and staged diff were scanned for credential assignments, bearer/cookie headers, JWT-like strings, email/phone-like data and raw provider-content indicators; only fabricated test identifiers/reference strings are present. No `.env`, cookies, capture, runtime journal or generated provider artifact is staged. Root must scan the integrated tree, artifacts and new history again before each commit/push decision.

Gate A final R4.13: **NOT YET ATTESTED** by this bounded checkpoint. Gate B remains CONDITIONAL; human Sales testing NOT RUN. Provider live capability: NOT ATTESTED. Gate C remains NOT READY FOR REAL CUSTOMER DATA. R4.13 push/merge/deploy remains unauthorized.

## Supplemental review — 2026-11-21

Root reported another reproduced constructor validation defect: five malformed targets, each missing one required field but replacing it with an unknown key, passed the former `Object.values` plus key-count checks. Reviewed correction uses an explicit five-key list, `Object.hasOwn` and per-key string validation, while still refusing extra enumerable keys. Classification: **VERIFIED DEFECT, Medium** in the offline safety boundary; the reproduction history is root-reported, and QA independently ran all five new regression cases successfully. Caller-owned evidence references remain references, not provider authentication proof.

Reviewed `adapters/pancake/pancake-message-scope.ts` and its new spec directly from root's worktree. The pure helper requires provider-success, exact conversation, bounded message count and exact Page/conversation/message identity on each message, and emits fixed metadata only. It neither returns raw IDs/content nor modifies input, creates receipts, advances checkpoints or activates transport. Contact identity is only provider-observed when a well-formed `conv_from.id` exists; it is not cross-provider Customer identity or mutation authorization. Empty message history cannot independently prove per-message Page binding. Authentic transport and exact route binding are still required outside this helper.

QA copied only the four reviewed source/spec files into its own worktree and reran:

```text
npx vitest run src/application/pancake-admission/pancake-request-policy.spec.ts src/application/pancake-admission/pancake-request-policy.qa.spec.ts src/adapters/pancake/pancake-history-readback.spec.ts src/adapters/pancake/pancake-message-scope.spec.ts
npm run typecheck
npm run lint
npm run architecture:check:strict
```

Result: **4 files, 68 tests PASS, zero skipped**; typecheck/lint/strict architecture PASS, zero architecture findings. Source SHA-256: message-scope `cab321f6cddb79ab32dc6db24d9954691a2a585774415dde7ff3a84cde0ef0a7`; request-policy `f31c325270c88466b21b6fa05368afcc1f9179b442ec8c22f36f5c6342a2648b`. This source snapshot has no final integrated commit SHA yet. An initial copy command used an incorrect relative destination and copied no files; its three-file/40-test output is excluded from acceptance. The corrected copy and four-file run above supply the result. No new blocker found in these bounded helpers; no coverage or full-regression claim is made.

Root reports four total provider requests, terminal stop after an un-followed target UI HTML redirect, zero mutations and no real-data North Start intake. The reported official message-read success is limited to that response; Page alias/contact/current-account entitlement remain unverified. QA did not open the runtime journal, raw responses, credential files or capture and therefore does not independently attest these provider outcomes. Preserve the terminal stop and continue offline engineering only until the precise remaining identity/authorization requirements can be satisfied. Gate B/C and hosted/full-regression limits above remain unchanged.
