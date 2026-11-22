# R4 Implementation & LVP Readiness Report

Date: 19/11/2026. Branch: feat/r4-lvp-closure. Integration worktree: D:/AI-for-Enterprise/ns-r4-gaps. Baseline: bcbbc095dd029c1aceac8b9e428bfadd05507fe4. Technical checkpoint only; no production release or main merge.

## 1. Executive summary

R4 now has an automated, UI-only manual commercial journey backed by PostgreSQL and a loopback OIDC issuer: sign in, create lead, revise context, handoff, inspect original accepted evidence, accept responsibility, create/reschedule/complete/reopen work, advance within the interim state boundary, record a Won claim, correct it to Unknown, inspect audit, restart the Nest application, reauthenticate and recover durable history.

Business records in that acceptance journey are created exclusively through UI. Setup provisions only test identities and memberships. All conversation content is fabricated, including fixtures classified non-synthetic to test segregation. This is functional acceptance evidence; it is not observation of a real employee using the product or proof of business value.

**Overall R4 status: PARTIAL, not fully complete.** Functional LVP closure has advanced materially, while physical deletion/anonymization, retention enforcement, legal-hold enforcement, encrypted research capture, real IdP deployment acceptance and the required security-critical coverage remain open. The implementation is suitable for a controlled synthetic/internal exercise, subject to the documented configuration. Real customer-data pilot and commercial release are not approved.

The requirement-by-requirement assessment is in [traceability.md](traceability.md). Additional product gaps remain: complete source/lineage/attribution-reason presentation, a dedicated contact-attempt history and full per-session experiment-exposure acceptance. Manager exceptions and Data Health views remain deferred P1. Passing the core journey does not mean all R-01 through R-28 acceptance clauses have passed.

## 2. Repository and integration

- main remains 5d6c206; R3 remote remains bcbbc09. Existing main-worktree research and user changes were preserved.
- R4 reuses the previously clean ns-r4-gaps worktree on a new feat/r4-lvp-closure branch. The old work/r4-capability-gaps branch is retained.
- Dedicated worker worktrees: ns-r4-security, ns-r4-workflow, ns-r4-ux, ns-r4-reliability, ns-r4-qa. One writer per worktree; root is the integration writer.
- Initial inherited cx/gpt-6.1-sol model name failed. The user explicitly selected gpt-6.1-sol; actual agents were then launched successfully. At most three children ran concurrently.
- Integrated reviewed worker commits in focused checkpoints. Migration-list conflicts were resolved by retaining both new migration entries. No canonical files, original migrations001–011, production flags or provider credentials were changed.
- New migrations012–014 are additive. Existing raw evidence was not rewritten. Keyed rows prevent destructive digest downgrade. New schema rollback scripts are for disposable tests or separately reviewed rollback, not lossless production downgrade.
- Validated source commit: ce4ee13ae73b123fb67c349aee7249812a7f85b8. Final evidence is recorded in verification.json. Later report-only commits do not change the tested production/test/CI source.

## 3. Work delivered by owner

| Owner | Implementation | Worker commits / evidence |
|---|---|---|
| r4_security | Workspace/purpose HMAC, algorithm_version/kid, active/retired keys, manual/Pancake/action arguments/preview/readback, legacy retry compatibility, migration012 | c8dcdde, 5eee6c8; security.md |
| r4_workflow | Context history, discoverable lead list, original evidence read/access audit, directory, independent work/reopen, outcome correction, CAS/idempotency wrappers, synthetic/unknown projections, migration013 | f075a3f, 4ffb5fc, aff667e; backend.md and API contract |
| r4_ux | Session-first accessible forms, intake/context/handoff/evidence/action/outcome/audit/feedback, errors/loading/stale recovery, explicit classification | 612fc1e, 7e6ca1f; frontend.md |
| r4_reliability | Atomic action transition/event/outbox, leased retries/replay, durable deduplicated inbox, scoped audited admin export, migration014 | 13c22fa, e007e6c, b56da66; reliability.md / lifecycle-runbook.md |
| r4_qa | Independent acceptance matrix, actual loopback IdP, UI-only PG journey/restart, privacy learning assertions, four redesigned regression scenarios | f47ad3f, e0991dd, f5add3e; qa-matrix.md / qa-execution.md |
| r4_review | Independent product/architecture/security source review and 33 focused tests; two concrete findings | independent-review.md; root integrated export-audit and UNKNOWN-list fixes |
| root | Baseline revalidation, plan/contracts, auth-code/PKCE/cookie/CSRF composition, privacy-safe learning, worker review/integration, preview integrity fix, assignee/export/runner composition, current-schema readiness, CI lanes and final verification | Integration branch history; auth-learning-checkpoint.md |

## 4. Capability status

| Capability | Implementation | Verification | Limit |
|---|---|---|---|
| Browser sign-in/session | IMPLEMENTED | TESTED + VERIFIED END-TO-END with fixture IdP | Real provider configuration acceptance pending; public PKCE client and signed JWT access token required; process-local sessions, max15min, restart signs out |
| UI create/context/handoff | IMPLEMENTED | VERIFIED END-TO-END | Assignees show internal ID+role; no CSV bulk import |
| Original accepted evidence | IMPLEMENTED | VERIFIED END-TO-END | Scoped source envelope, whitelisted speaker/utterance,16KiB bound; not arbitrary raw frame/file access |
| Action lifecycle | IMPLEMENTED | VERIFIED END-TO-END | Manual lead-scoped commands; inferred completion does not close work; unsupported CE-1 transitions still refused |
| Outcome correction/audit | IMPLEMENTED | VERIFIED END-TO-END | Outcomes are claims; no verified-revenue inference; no CE-1 decision resolved |
| Synthetic segregation | IMPLEMENTED | TESTED + UI/PG evidence | Same-workspace coexistence explicitly classified; unknown remains null/visible in All, excluded from real/synthetic filters |
| HMAC/rotation/history | IMPLEMENTED | TESTED with actual PG compatibility cases | Server keyring configuration/backup required; retired keys retained; ephemeral test keys unsuitable for durable deployments |
| Learning/feedback | IMPLEMENTED | UI learning persisted and inspected through read-only SQL; synthetic excluded | Behavioral self-reports, not business facts; no causal/revenue inference; feedback PG service exists |
| Assertion delivery | IMPLEMENTED | TESTED through PG fault/lease/dedup/rollback cases | Internal runner opt-in local/test; no live executor/provider capability enabled; at-least-once delivery requires idempotent sink |
| Admin export | IMPLEMENTED | TESTED including real PG audit-before-return failure | Single-lead, bounded snapshot; explicit exclusions; UI admin download control added |
| Physical deletion/anonymization | NOT IMPLEMENTED | NOT VERIFIED | No real data erased; append-only/raw-storage policy decision and approved implementation required |
| Automated retention/legal holds | NOT IMPLEMENTED | NOT VERIFIED | No automatic expiry/purge or legal-hold engine; no production-data readiness claim |
| Raw research encryption/expiry | NOT IMPLEMENTED | NOT VERIFIED | Research capture remains disabled; do not interpret retention flag as a storage implementation |
| External Sales pilot | NOT RUN | NOT VERIFIED | Recruitment/consent, deployed IdP/data lifecycle and task observation/multi-day usage remain necessary |

## 5. Security and integrity

- Existing ADR-006 roles/resource scope retained; IdP groups/roles do not grant commercial authority. Viewer mutation, bystander and foreign-workspace access remain denied in exercised cases.
- Browser credentials are server-held behind an opaque HttpOnly SameSite cookie. No production token-paste fallback or localStorage/sessionStorage credentials. PKCE, state, nonce, token issuer/audience/subject and single-use transaction binding are tested. Cookie mutations require matching Origin plus session CSRF.
- Old raw evidence and legacy hashes remain readable. New content digests use keyed domain-separated HMAC with workspace/kid/version. Changing keys does not rewrite history. Root added verification that cached preview content still matches the reviewed digest before authorize/execute.
- Closure commands require expectedVersion and actor-bound idempotency. A command retry returns the recorded effect; a changed request conflicts. Context/work/outcome corrections append history. Evidence reads append access audit without bumping lead version.
- Missing source classification is UNKNOWN, not real. Synthetic/unknown learning is excluded by server-derived classification. Fixed reviewed event names and categorical payloads are allowed; conversation/context/lead identifiers are not persisted in learning payloads.
- Independent QA found two real learning integration defects: valid membership workspace IDs were rejected and evidence_viewed was filtered as sensitive content. Root fixed both, keeping legacy arbitrary-tag restrictions; QA verified actual database events after the fix.
- Independent reviewer found omitted work-item audits in export and UNKNOWN list-label loss. Root fixed the predicate and label, with targeted regression coverage.
- Passing global line coverage is not proof of 100% security-critical behavior/branch coverage. Final measured gaps remain explicit in verification results.

## 6. Test evidence

Baseline was freshly reverified after npm ci:1,032 tests/no skips,91.08% lines,64PG,22HTTP,4browser,MV3/typecheck/lint/build/architecture/registry/audit PASS. Five moderate dependency advisories were reported; no forced dependency changes or waiver applied.

R4 independent QA: two actual OIDC/PostgreSQL browser tests pass; four legacy browser scenarios retained and pass; three component tests pass. The legacy scenarios may seed via API for narrow regressions; only the new acceptance journey is evidence of UI-only creation/handoff. Restart evidence is Nest application+DI recreation against the same PostgreSQL, not an OS-crash or power-loss drill. Chromium MV3 evidence uses only synthetic sockets and contacts no provider.

Final integrated validation at ce4ee13:

| Lane | Actual result |
|---|---|
| Vitest unit/integration with coverage | 107 files / 1,102 tests PASS, zero skips |
| PostgreSQL integration gate | 18 suites / 80 tests PASS, zero skips; included in the 1,102 above |
| HTTP E2E | 3 files / 22 tests PASS |
| Legacy browser / component / OIDC-PG UI | 4 / 3 / 2 tests PASS respectively |
| Chromium MV3 | PASS, providerContacted=false |
| Node guardrails / AIL research guards | 44 / 14 tests PASS, zero skips |
| Typecheck / lint / build | PASS |
| Strict architecture / registries / dependency audit | PASS; zero architecture findings; production dependencies clean, zero waivers |
| Bounded restore rehearsal | PASS; disposable synthetic data only |

Coverage: lines 91.57% (4,129/4,509), statements 87.57% (5,031/5,745), branches 85.30% (4,725/5,539), functions 90.59% (1,165/1,286). Focused line coverage: infra/auth 98.25% (393/400), infra/crypto 100% (27/27), application/pilot/pilot-closure 95.77% (68/71), infra/governed-action/pg-assertion 95% (19/20). These directory/prefix measurements do not establish 100% security-critical behavior coverage.

The first integrated run failed coverage, HTTP and node guardrails. Full coverage/HTTP/node guardrails were rerun after correcting runner-only LOG_LEVEL/PG_DUMP overrides and adapting two old smoke assertions to the intentional synthetic-default filter and session-first UI. All final lanes pass. Failed attempts and their reasons are retained in verification.json and local logs; no test was disabled or skipped to hide a failure. Hosted R4 CI has been configured but has not been run; local success is not a hosted-CI claim. Both owned validation PostgreSQL clusters are stopped.

The bounded restore rehearsal compares five synthetic tables/count/hash,14migrations and receipt uniqueness. It is not PITR, all-table lifecycle restoration or a production RPO/RTO SLA.

## 7. Acceptance matrix and readiness

| Requirement | Current verdict |
|---|---|
| Sales journey through real UI/backend | VERIFIED END-TO-END on controlled IdP/PG fixture |
| Evidence original content/provenance inspectable | VERIFIED END-TO-END, permission-scoped |
| Handoff/action/correction/audit | VERIFIED END-TO-END within interim CE-1 boundary |
| No tested cross-workspace leakage/viewer commercial mutation | TESTED; finite scenario coverage, not universal proof |
| Important mutations audited; retries no duplicate effect | TESTED in unit/HTTP/PG and exercised UI commands |
| Delivery fault/recovery | TESTED in PG; default-off runner composed |
| Synthetic honesty / learning exclusion | TESTED, including actual UI learning persistence checks |
| Export policy and implementation | TESTED for admin-scoped bounded lead export |
| Complete pilot deletion/retention policy enforcement | NOT IMPLEMENTED — blocks real customer data |
| Technical validation commands | PASS at ce4ee13; hosted R4 CI not yet executed |
| 100% security-critical coverage requirement | NOT ESTABLISHED; unmet release gate despite passing overall coverage |
| Real Sales usability/repeated use/value | NOT VERIFIED |

Decision: **conditional controlled synthetic/internal pilot preparation only**. Do not describe this as full R4 completion, a real-data pilot approval or production readiness. No provider, canonical, PH4 or L5 gate was closed.

## 8. Pilot checklist

- Configure approved OIDC issuer/public PKCE client, exact callback, audience/JWKS/HTTPS origin; pregrant only the needed internal memberships and existing roles.
- Provision private PostgreSQL, apply/review migrations012–014, install workspace HMAC keys through server configuration, preserve active/retired keys and backup procedures.
- Begin with fabricated synthetic cases; verify conspicuous classification and role scope. Keep AI execution, outbound catalog and Pancake research paths off.
- Ask a representative employee to perform create/context/handoff/evidence/action/correction through UI without facilitator/API intervention; record blockers separately from comments.
- Register version, participants, consent/data authority, scope, observation duration and learning questions; collect actual use rather than treating test clicks as customer demand.
- Do not introduce real customer data until deletion/anonymization/retention/legal-hold controls and IdP deployment acceptance are complete and reviewed.

## 9. Remaining work / R5 candidates

1. P0 data lifecycle: approved policy and tested physical erasure/anonymization/retention/hold with preserved audit integrity and backup/deletion-ledger behavior. Current plaintext historical raw storage must be addressed explicitly; suppression alone is not deletion.
2. P0 deployment acceptance: actual IdP, session/expiry/revocation UX, hardened HTTPS environment, rate limiting, alerts/on-call and migration rollout review.
3. P0 security verification: enumerate untested security-critical branches/behaviors, close gaps; retain negative regression suite and key-rotation evidence.
4. P0 external usability: representative Sales walkthrough and multi-day follow-up with observed evidence and Continue/Narrow/Pivot/Stop decision.
5. P1 polish: human-friendly assignee labels, richer queue views/contact-attempt workflow, fully bounded/paginated long histories and feedback, accessibility observation with real users.
6. P1 reliability: admin audited outbox inspection/replay surface if operationally needed; broaden restore drills beyond five synthetic tables before any SLA.
7. Deferred: AI extraction/assist experiments, production Pancake/Ads/CRM integration, attribution, identity merge and public signup/billing. These require their existing product/provider gates and are not shortcuts around LVP validation.
8. Remaining requirement closure: finish R-10 source/lineage/reason presentation, R-12 dedicated contact-attempt history, R-22 per-session exposure acceptance; verify R-08 rejection/reassignment and R-23 feedback through browser. Dedicated R-24 manager exceptions and R-25 Data Health remain deferred P1.

Technical debt retained: original pilot-loop.service.spec.ts exceeds500lines; new production files stay below500. Some new compact backend code deserves readability cleanup after behavior stabilizes. Process-local session and explicit per-workspace server key configuration are documented single-instance choices, not a distributed session/KMS claim.
