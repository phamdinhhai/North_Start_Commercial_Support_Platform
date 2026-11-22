# R4.6 multi-agent execution and ownership

Base: cd842c4. Initial plan states below are preserved; the final status table supersedes them. Three-child runtime concurrency limit: six actual specialist agents run in waves. Each writer uses a dedicated worktree/branch; root is sole writer of integration. A later review may be read-only against integration. All tasks require implementation reference, actual test commands/revision, review result and explicit remaining issues. No push, merge main, production deploy or real data operations.

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

## Final implementation / cross-review checkpoint

| Task | Status | Implementation reference | Test reference | Review result / remaining issues |
|---|---|---|---|---|
| CI-01 | IMPLEMENTED / locally TESTED |351241a ->0e9b1ca; fixture/workflow + staging runbook | Old adapter red/fixed2PASS; MV3/migrations/restore; full integrated lanes | Root reviewed actual hosted logs; user authorized push; hosted73SUCCESS at6e6cd79 after both CI corrections |
| SEC-01 | IMPLEMENTED / TESTED |1095906 ->6793aa8; root0a17bd1 absolute age;02239ce ->ee7b9e5 cross-review | Focused192pass/2PGnotrun worker; integrated PG required; root47auth tests | DATA/commercial review found TRUNCATE bypass fixed by root; matrix deliberately finite, no production IdP or100%coverage claim |
| DATA-01 | IMPLEMENTED planning / TESTED |f276715 ->b1841d0, wiringffee29b;015 guards e1dd9ab |27focused incl4PG, independent DATA8PG/vault and signed HTTP; final95PG includes new negatives | Security/QA/Reliability cross-review; accepted-evidence erasure/anonymization/retention/holds NOT IMPLEMENTED |
| REL-01 | IMPLEMENTED / TESTED |b4688a7 ->cbf49ad; b5639c3 ->756ff33 lifecycle review;017 |20focused incl8PG, actual private PG restart; failure/lease/replay suite | QA/Security source review; root fixed API-to-infra import via port, production env guard; local/test only, no exactly-once |
| COM-01 | IMPLEMENTED / TESTED / UI VERIFIED in fixture |59d803c ->7855999, composition62a3db5, root immutable/cursor/concurrency e1dd9ab |13focused incl4PG; expanded PG7, UI contact/source/feedback/restart | Security/QA independent review; no implicit outcomes; manager exceptions/contact correction deferred |
| QA-01 | TESTED / VERIFIED in fixture |ed487c8 ->a36a3fb; root659ca46 config-worker credential fix |3OIDC/4legacy/1memory/3component lanes +21focused independent | No API business seed for full UI journey; no human Sales pilot/experiment exposure claim |
| INT-01 | IMPLEMENTED / local TESTED and hosted VERIFIED at6e6cd79 | Module/readiness001-017,20suite CI registry, port boundaries, review fixes | test-verification.json: all17lanes PASS,1178tests/96PG/local91.95%lines | Root reviewed each changed module; original migrations001-014/canonical unchanged; hosted73passes exact6e6cd79; GateBdeployment acceptance remains separate |

No worker changed another worker's worktree. Read-only review reports and original worker evidence are retained; passing earlier checks does not transfer automatically to later revisions. No push authorization is inferred from the previous R4 push.

Hosted follow-up CI-02: actual run70 revealed membership010 rollback collision with017 FK. Agent CI corrected test isolation (4a506ad ->ce01a59); QA independently reviewed without source edits. Red old7pass1fail, fixed8pass; root full17localPASS and hosted71SUCCESS. No production constraints/migrations weakened.

CI-03 stability follow-up: hosted72 migration lifecycle5s/cleanup10s timeout, exact blockedSQL unknown. Agent aab331d ->6e6cd79 adds bounded connection SQL/lock waits, suite-specific budgets/phase diagnostics and actual cancellation+recovery test; QA read-only review found no blocker and documented cleanup/client-leak limitation. Root17local lanes PASS; hosted73SUCCESS at6e6cd79. Final totals1178tests/96PG; Gate B environment acceptance remains open.
