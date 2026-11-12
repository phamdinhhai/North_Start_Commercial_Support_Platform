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
| Intake timestamps with equivalent timezone offsets produced false conflicts | Implemented; acceptance pending | Intake normalizes known timestamps to UTC; retry comparison accepts equal instants and retains exact non-date sentinel equality. Added same/fresh-service offset/UTC retry regression with changed-instant rejection. Tests have not run. |
| E2E environment restoration on setup/shutdown failure | Implemented; acceptance pending | Optional application close is wrapped in `try/finally` so mode/auth/demo environment values restore even when setup or close fails. Not executed. |
| Test co-location still uses former `modules/` and `health/` paths | **Accepted** | Pilot, feedback and health specs now live with their canonical owners; CI integration path was updated to the canonical PostgreSQL suite. |
| Strict architecture zero findings | **Accepted** | Eight checker fixtures pass and `architecture:check:strict` reports 0 findings after final migration and test co-location. |
| Full behavior/PostgreSQL/coverage/clean install | **Accepted for technical baseline** | `npm ci` passes; 278 unit tests pass, 5 E2E tests pass, backup tests pass, PostgreSQL CI gate passes 19/19 without skips, DB-enabled coverage is 297/297 with 91.88% lines / 81.86% branches / 92.47% functions. |
| Independent integrated review | **Accepted with findings remediated** | Opus review found four concrete P1/P2 issues; all four were fixed and regression-tested. No additional verified finding was returned. |
| Hosted CI | **Not executed** | Workflow includes checker fixtures and strict enforcement; no hosted result. No push or PR requested/performed. |
| Production credentials, full permissions, retention/export/delete and commercial validation | **Rejected for release** | PM-1 and other canonical decisions remain open. Technical dev baseline does not authorize customer data, production credentials, retention/export/delete, or commercial claims. |
| Pancake live integration | **Deferred/flag OFF** | Q-03/Q-04 and PH4 gate remain required. |

## Execution blocker

On this continuation, shell inventory, final local acceptance commands and a new Sonnet reviewer could not start because the Claude Code auto-mode classifier reported `claude-sonnet-5[1m] is temporarily unavailable (server error)`. The previous continuation also had an explicit classifier denial. No alternate interpreter, peer session or reverse-engineering tool was used to bypass that boundary. Read-only source inspection and dedicated file edits remained available.

The following gates have no final result:

- Working-tree/branch inventory and `git diff --check`.
- `npm ci` and runtime/tool version verification.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run test:architecture`, `npm run architecture:check:strict`.
- `npm test`, `npm run test:e2e`, `npm run test:backup`.
- Isolated PostgreSQL integration, fail-on-skip CI integration, migration rollback/reapply and coverage.
- Dependency audit and independent integrated review.

After the user requested main-agent-only completion, the main agent performed a static source review directly without subagents. It checked the migrated application/context/composition boundaries, persistence mappers, E2E fixtures and architecture checker; a search found no TypeScript/MJS import references to the moved production paths within product. This self-review found and corrected the timestamp false-conflict and E2E restoration issues listed above. It is not an independent review or executed verification. The main agent's full local gate attempt was again blocked before execution by the same classifier service error.

Executable gates require restored tool permission/classifier availability before acceptance can close. No user/shared database was accessed or modified, no canonical document was edited, and no commit/push was performed in this continuation.
