# Rebuild acceptance disposition — 2026-11-12

## Verdict

**Final technical baseline acceptance: ACCEPTED with explicit limitations. Commercial/release approval: NOT ACCEPTED.**

The final integrated tree passed the local executable gates below, including clean install and disposable PostgreSQL. This is acceptance of the technical development baseline only; it is not approval for production customer data or commercial release.

## Delegated results

Three read-only architecture design/audit reports were returned and incorporated: canonical source ownership, neutral ports, concrete infrastructure stores, explicit composition wiring, and preservation of v1 behavior. The initial Haiku attempt failed with model-not-found; subsequent delegated work requested Sonnet. The user requires Sonnet 5.5 for subagents.

The independent Opus review returned four actionable findings. All four were remediated and covered by new tests: timestamp-omitted concurrent/retry behavior, explicit UNKNOWN event time handling, backup URI override rejection, and Windows backup CLI entry-point execution. The review also identified unsigned development tokens and legacy test locations; unsigned tokens are now refused in production/pilot, and tests were co-located with canonical owners. No new verified finding remains after the remediation pass.

## Issue disposition

| Issue | Disposition | Evidence and limit |
| --- | --- | --- |
| Legacy production ownership and application-to-concrete-adapter coupling | **Accepted** | Pilot use cases are in `application/pilot`, neutral contracts in `ports`, stores/feedback in `infra`, HTTP controllers in `api`, wiring in exact `scripts/*.module.ts` roots; legacy production implementations and tests were co-located. |
| Direct API auth/RBAC/readiness infrastructure dependencies | **Accepted** | Controller ports/tokens bind to infrastructure in composition modules; explicit `Inject` decorators cover moved Nest dependencies. E2E provider-wiring and workspace-isolation checks pass. |
| Checker false positives and missed import forms | **Accepted** | AST-based imports, aliases, relative paths, dynamic imports, require/import types, exact composition roots and eight fixtures. `test:architecture` passes and strict check reports 0 findings. |
| Readiness accepted latest migration marker alone | **Accepted** | Probe requires markers 001–007; the missing-prerequisites regression passes. |
| HTTP smoke did not exercise migrated pilot provider wiring | **Accepted for memory-mode smoke scope** | Unauthenticated intake rejection, authenticated memory intake/read and cross-workspace 404 checks pass. This is not PostgreSQL HTTP or production-auth proof. |
| Intake timestamps with equivalent timezone offsets produced false conflicts | **Implemented and verified** | Intake normalizes known timestamps to UTC; retry comparison accepts equal instants and retains exact non-date sentinel equality. The full current test run passed this regression and changed-instant rejection coverage. |
| E2E environment restoration on setup/shutdown failure | **Implemented and verified** | Optional application close is wrapped in `try/finally` so mode/auth/demo environment values restore even when setup or close fails. The current E2E suite passed. |
| Test co-location still uses former `modules/` and `health/` paths | **Accepted** | Pilot, feedback and health specs now live with their canonical owners; CI integration path was updated to the canonical PostgreSQL suite. |
| Strict architecture zero findings | **Accepted** | Eight checker fixtures pass and `architecture:check:strict` reports 0 findings after final migration and test co-location. |
| Current local executable baseline | **Accepted for technical development scope with limits** | On branch `feat/decision-demand-execution` at starting HEAD `5d6c206`, typecheck, lint, architecture fixtures, strict architecture (0 findings), build, unit/default tests (278 passed, 19 PostgreSQL tests skipped without DB), E2E (5 passed), backup tests (6 passed), coverage (83.76% lines / 71.12% branches / 83.18% functions), and `npm audit --omit=dev` (0 vulnerabilities) passed. The fail-on-skip PostgreSQL gate was invoked correctly with `CI=true` but is blocked because Docker is unavailable and no `TEST_DATABASE_URL` disposable database was supplied. |
| Independent integrated review | **Accepted with findings remediated** | Opus review found four concrete P1/P2 issues; all four were fixed and regression-tested. No additional verified finding was returned. |
| Hosted CI | **Not executed** | Workflow includes checker fixtures and strict enforcement; no hosted result. No push or PR requested/performed. |
| Production credentials, full permissions, retention/export/delete and commercial validation | **Rejected for release** | PM-1 and other canonical decisions remain open. Technical dev baseline does not authorize customer data, production credentials, retention/export/delete, or commercial claims. |
| Pancake live integration | **Deferred/flag OFF** | Q-03/Q-04 and PH4 gate remain required. |

## Fresh verification record — 2026-11-13

The current branch was created from `5d6c206`; the working tree contains only the user-provided untracked `docs/decision_and_deepresearch_demand.md` before this documentation update. `git diff --check` passed. The following commands were executed from `product/`:

- `npm run typecheck` — **PASS**.
- `npm run lint` — **PASS**.
- `npm run test:architecture` — **PASS**, 8/8 fixtures.
- `npm run architecture:check:strict` — **PASS**, 0 findings.
- `npm run build` — **PASS**.
- `npm test -- --no-file-parallelism` — **PASS**, 278 passed and 19 skipped because no PostgreSQL URL was provided.
- `npm run test:e2e` — **PASS**, 5/5.
- `npm run test:backup` — **PASS**, 6/6.
- `npm run test:cov -- --no-file-parallelism` — **PASS**, 83.76% lines, 71.12% branches, 83.18% functions.
- `npm audit --omit=dev` — **PASS**, 0 production vulnerabilities.
- `CI=true npm run test:integration:ci` — **BLOCKED**, correctly requiring `TEST_DATABASE_URL`; Docker is unavailable on this host, so no disposable PostgreSQL instance was created.

These results are current local evidence only. PostgreSQL migration/CAS/concurrency/rollback, hosted CI, production IAM, retention/export/delete, backup restore, provider live verification and commercial/user validation remain unverified or human-gated. No canonical document was edited and no shared/customer database was accessed.

## Hosted CI and release-security boundary

The non-canonical workflow at `.github/workflows/ci.yml` is a validation gate, not a production release or deployment workflow. It runs locked installation, a high/critical dependency audit, changed-line whitespace validation, a narrow added-line credential-pattern check, typecheck, lint, architecture checks, tests, coverage, build, PostgreSQL integration, and HTTP smoke checks. The credential-pattern check is a lightweight guardrail and is not a replacement for a hosted secret scanner.

The repository still has no verified hosted result for the workflow, and no configured hosted SAST/DAST, comprehensive secret-scanning provider, SBOM generation/signing/provenance or artifact-attestation gate, vulnerability exception process, production credential/permission gate, deploy/rollback environment, migration approval gate, or post-deploy health gate. No such capability is claimed by this baseline. Adding those controls requires platform/security ownership, provider selection, credentials, environment policy, and human approval; they remain explicit release blockers rather than guessed infrastructure.

A local `npm ci` completed successfully, and `npm run security:audit` passed its configured high/critical threshold while reporting seven low/moderate advisories in transitive tooling dependencies. `npm run typecheck`, `npm run lint`, and `git diff --check` passed locally. These results are not hosted CI evidence, do not waive the advisories, and do not authorize a production release. No user/shared database was accessed or modified, and no canonical document was edited by this hardening change.
