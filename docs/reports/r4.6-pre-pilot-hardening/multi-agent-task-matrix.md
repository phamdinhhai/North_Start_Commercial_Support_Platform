# R4.6 multi-agent execution and ownership

Base: cd842c4. Three-child runtime concurrency limit: six actual specialist agents run in waves. Each writer uses a dedicated worktree/branch; root is sole writer of integration. A later review may be read-only against integration. All tasks require implementation reference, actual test commands/revision, review result and explicit remaining issues. No push, merge main, production deploy or real data operations.

| ID | Owner / priority | Scope / owned modules | Dependency | Acceptance / tests | Risk | Status / evidence |
|---|---|---|---|---|---|---|
| CI-01 | r46_ci P0 | .github/workflows/ci.yml, Playwright configs + OIDC fixture server; staging/recovery docs | baseline | exact hosted SHA/jobs/logs, fix restart failure with regression, build/migration/audit/MV3 evidence | false hosted green | ACTIVE ns-r46-ci/work/r46-ci; hosted cd842c4 failure confirmed |
| SEC-01 | r46_security P0 | infra/auth, infra/crypto, new security negative tests/matrix | baseline | bounded token/JWKS bodies, session rotation; identity/CSRF/tenant/role/HMAC negatives | credential/identity confusion | ACTIVE ns-r46-security/work/r46-security |
| DATA-01 | r46_data P0 | new lifecycle port/service/store/API; migration015 | schema review, SEC cross-review | admin-only configurable policy+dry-run/audit, no invented duration; real immutable erasure blocked; disposable lifecycle failure tests | irreversible erasure vs immutable evidence | ACTIVE ns-r46-data/work/r46-data; initial schema reviewed |
| REL-01 | r46_reliability P0/P1 | assertion delivery worker/runner, scoped ops API/tests | baseline; DATA review later | poison/retry/timeout/lease/concurrency/recovery, explicit kill/health and auth replay, guard remains local/test | duplicate effects or unsafe enablement | QUEUED wave2 |
| COM-01 | r46_commercial P0 | contact/source/exception new services/API/PG/UI; migration016 | API contract + SEC review | audited authorized contact history, honest lineage, bounded exceptions; PG/HTTP/UI tests | fabricated semantics/history | QUEUED wave2 |
| QA-01 | r46_qa P0 | independent tests/browser acceptance/telemetry + synthetic pilot scenarios | early audit then integrated contracts | no API business setup; contact/feedback/source UI, privacy event evidence; explicit blind spots and human pilot checklist | mock-only acceptance | QUEUED wave2 |
| INT-01 | root P0 | module composition, migration readiness/list registration, baseline/full verify, release reports | all tested commits/reviews | no skips in full isolated PG/HTTP/browser/MV3 gates; exact SHA evidence; Gate A/B/C separated | drift/integration regression | ACTIVE |

## Dependencies / checkpoints

1. Inspect real Git/hosted CI/reports before code. Root validates locked baseline while wave1 audits and implements isolated security/CI/data gaps.
2. DATA schema reviewed before dependent code; immutable accepted evidence remains unchanged.015 policy/preview planning only, optional isolated synthetic encrypted vault, no capture enablement or real-data erasure.
3. Wave2 commercial contract reviewed before QA finalizes UI acceptance. Root owns shared wiring/readiness/migration registration. CI owns only restart regression changes in existing journey until handover to QA.
4. Cross-review: Security reviews DATA/Commercial authorization; Reliability reviews lifecycle jobs/outbox; QA independently checks all; root reviews boundaries and integrates only tested groups.
5. Final full local verification on a committed integration SHA, technical pass is separate from unexecuted hosted CI. Gate C always NOT READY FOR REAL CUSTOMER DATA absent policy/IdP/operator approvals.

## Scope decisions

No framework rewrite, new roles, production integrations, autonomous AI, attribution engine, canonical edits or audit/raw rewrite. Legal hold semantics require confirmed business/legal policy; absence remains explicit. Approval-reference strings are planning metadata, never automatic authorization to erase real evidence. Root may add privacy-safe synthetic pilot telemetry separate from production learning; synthetic events never relabelled real.
