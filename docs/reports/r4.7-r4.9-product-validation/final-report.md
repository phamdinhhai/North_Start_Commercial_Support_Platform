# R4.7-R4.9 Implementation and Product Validation Report

## Decision

R4.7 has an implemented, locally rehearsed synthetic environment and targeted product/recovery corrections. Six real specialist roles executed in isolated worktrees, in two waves under three available child slots. R4.8 protocol, scenarios and categorical observation validation are READY FOR HUMAN VALIDATION; no Sales participant has attended and no usability or business outcome has been collected. R4.9 contains only findings confirmed by source inspection or automated failures. Organizational pilot approval remains PENDING. Gate C is NOT READY FOR REAL CUSTOMER DATA.

## Revision and environment

Repository: phamdinhhai/North_Start_Commercial_Support_Platform. Integration branch: feat/r4-lvp-closure in D:/AI-for-Enterprise/ns-r4-gaps. Baseline/remote at inspection:08bdefaca792e34a2142a575db198e0ee5c8f45f. Final implementation revision:73840fe407b891f606a1222dd0fb261d1fc9190a; documentation and verification are committed later with no source/test/config changes. The handover message identifies the documentation HEAD. No push, main merge, cloud deployment or real-data operation performed in this phase.

Hosted run74 (44503219532) is completed/success on exact08bdefa, product and browser jobs successful. It does not cover this phase. Hosted CI on73840fe/new documentation HEAD is NOT VERIFIED until an authorized push and a successful run. No open PR for this branch was returned by gh pr list. Original main/research worktree still has its pre-existing .gitignore change and untracked research/report files; none were staged or edited by this phase. Canonical files and migrations001-017 unchanged; no new migration introduced.

## Six specialist outputs and review

| Owner | Implemented / prepared | Evidence and review |
|---|---|---|
| r47_env / ENV-01 | Loopback Windows local launcher, generated private cluster/secrets, restricted DB role, safe new-DB reset/restore, runtime ownership/synthetic history refusal, singleton lifecycle | Real PG/app/browser/backup/restore/outage tests; security final cross-review and root independent rehearsal |
| r47_ux / UX-01 | Same-tab in-memory recovery, new-tab OIDC, fresh user/workspace/role/lead access/CSRF, explicit resubmit; 403 clear, 409 retained draft, unsaved warning, trust guide | Ten controlled Chromium component/recovery tests plus independent signed OIDC cases |
| r47_domain / COM-01 | Bounded manager/admin exception API/application/PG reader/operator asset; page/classification context and honest UNKNOWN | Unit/HTTP/PG tests, independent signed UI; root corrected false overdue for external expectations |
| r47_security / SEC-01 | Adversarial privacy tests, governance proposal/threat model, cross-review of shared integration and ENV/UX | Focused negatives and five independently rerun launcher safety tests; no local-scope blocker; no real-data assurance |
| r47_reliability / REL-01 | Checked-out client connection error ownership, safe release, original-error preservation; bounded pool/backend/migration tests | Actual own PG backend termination/rollback and recovery; root repeated whole-cluster outage against owned synthetic resource |
| r47_qa / QA-01 | Signed negative/recovery/manager browser acceptance, independent local guard check, human study/scenarios/format validator, corrected legacy modal test | Full UI creates business entities; no API business seed in declared full journey; no human observation generated |
| root / INT-01 | Synthetic admission/composition/session metadata, manager API/UI wiring, suite registry/CI gates, observation schemaVersion1, review/integration/verification | Full exact-source validation; commands/results/log hashes in verification.json |

Detailed ownership, dependencies, priorities, criteria, risks and references: multi-agent-task-matrix.md. R-01 through R-28 mapping and named security cases: traceability.md. Four separate capability evidence levels: product-acceptance-matrix.md.

## R4.9 confirmed findings and corrections

| Finding / priority | Before / confirmed evidence | Correction / regression |
|---|---|---|
| UX-01/02 P1 | 401 lost usable draft and retained raw DOM;403 retained inaccessible content | Clear rendered fields; memory-only draft after401, fresh authorization before recovery;403 clears draft/context; component and signed OIDC |
| UX-03 P1 | Cancel/Escape discarded entered text without warning | Dirty tracking and discard/beforeunload warning; Chromium tests |
| UX-04 P1 | Conflict reload discarded draft | Retain fields, refresh version/key, explicit human review/retry; actual signed409 and legacy stale-work browser |
| UX-F05 P1 | Initial recovery required lead ID, losing new-intake draft | Recover intake with same user/workspace/role/source record ID; reject downgrade; two new controlled browser cases |
| REL-F01 P0/P1 | Actual checked-out client connection error escaped query rejection | Own error listener, rollback with original-error retention, destroy unsafe client; actual PG session failure test |
| ENV-F01 P0/P1 local scope | Regex role/port alone could target an unbound cluster | Exact role, realpath/config/live server identity before admin operations; tamper tests |
| ENV-F02 P1 | Persistent singleton client emitted unhandled57P01 on actual PG outage | Categorical lock-loss bounded shutdown; manual full start; actual root rehearsal preserved history |
| ENV-F03 P0/P1 local scope | Existing false/unknown evidence could be loaded by synthetic-only launcher | Startup refusal before app/IdP bind, no relabel/overwrite; retained invented negative fixture |
| COM-F01 P1 | Past-due external expectations could be labeled internal overdue work | Restrict overdue to current internal responsible work; supersession and unavailable sentinel tests |
| QA-F01 test integration | Legacy test assumed Reload closes modal, causing blocked background click | Assert retained draft/current version/no automatic write, explicitly discard before selecting replacement; no retries needed in passing run |

Truth guide and observations support inspection, not a claim that Sales understand a lead within one minute. Keyboard/screen-reader breadth, vocabulary clarity, speed, confusion and perceived usefulness remain hypotheses until observed. No subjective redesign or feature expansion is labeled a correction from human feedback.

## Verification

Exact-revision commands, environment, exit results and SHA-256 hashes of local log artifacts are recorded in verification.json. Local log files are retained outside Git; checksums identify evidence and are not evidence-content digests. Baseline1,178 tests/96PG, lines91.93% were freshly measured. First integrated e93db4c run had one legacy browser expectation failure with retries; other17 lanes passed. QA-F01 was corrected without weakening stale/history assertions. f825fba then passed all18 lanes:1,209 tests/112PG, lines91.98%, zero skips.73840fe removes only extra blank lines flagged by git diff --check; final revision rerun is recorded separately in verification.json. Coverage delta versus freshly measured baseline is +0.05 percentage points; not a substitute for named security behavior evidence.

Root local pilot rehearsal used application/launcher source e93db4c (same behavior as final; later changes test/whitespace only). Actual signed+CSRF false intake returned400 with lead/envelope counts unchanged; backup/restore preserved two invented leads/two envelopes/six membership audits/17 migrations. PG fast-stop closed app on lock loss, full manual start preserved history, false-classified invented evidence caused startup exit1 before app bind and was not rewritten. New-database reset and final stop succeeded. This verifies local recovery, not distributed availability, PITR, production RPO/RTO or exactly-once delivery.

MV3 retains no raw content/body digest, providerContacted=false. Existing outbox at-least-once/idempotency tests and local/test runner guard remain; no production guard removal. Dependency audit result and moderate install advisories are recorded with their actual execution timestamps. No dependency/lockfile change or blanket 100% security-coverage assertion.

## Remaining limits, blockers and human decisions

Gate A baseline is PASS; new implementation requires actual hosted CI before a new PASS. Gate B remains CONDITIONAL despite a verified launchable local environment: user confirmed operator, but organizational participant-session approval, observer/consent/observation handling and access delivery format are pending. All owned pilot/verification services are stopped at handover. A private manifest remains outside git for manual restart; runbook: docs/config/local-synthetic-pilot.md. No remote staging environment exists or is claimed. Fixture IdP proves test protocol only and must never be exposed remotely.

Gate C: NOT READY FOR REAL CUSTOMER DATA. Actual retention enforcement/deletion/anonymization, legal hold applicability/authority, approved invariant-compatible metadata/payload design, key custody/legacy handling, backup/downstream erasure and restore quarantine, production IdP/session/TLS/security verification, data approval and operating responsibilities remain open. Governance design is PROPOSED; no destructive migration or legal duration invented. Backup dumps are private synthetic artifacts, not encrypted production backup certification. DB role is isolated but owns schema; production separation remains future work. Process-local sessions require login after restart. Closing original browser tab loses memory-only unsaved draft after warning.

Telemetry: existing business learning excludes synthetic/unknown server-side; the study uses separate private categorical schemaVersion1 observations, never commercial evidence. Completion/time/comprehension/usefulness thresholds and findings are not invented. Existing production event release/flag tags do not establish complete session-level experiment exposure or a separate event schema version; these remain documented gaps, not silently claimed delivered.

Next steps: obtain permission to push and verify exact hosted revision; organization approves controlled synthetic study/participants/observation handling; operator follows runbook and runs scenarios with real people; record unaided/assisted/error/comprehension baselines; prioritize R4.9 corrections only from resulting findings. Gate C remains separately blocked. Full Data Health, attribution, production Pancake/AI, commercial packaging and speculative architecture remain DEFERRED.

## Automatic approval review history

QA's compound owned launcher stop/start/browser command was rejected by automatic approval review as blocked by policy without further detail. It was not retried as a compound command; separately reviewed owned operations were accepted and completed. No denied production/destructive action or resource was used.

## Local acceptance counts

| Lane | Result scope |
|---|---|
| Coverage / all Vitest | 125 files /1,209 tests; includes112 PostgreSQL tests, not an additive total |
| Strict PostgreSQL registry | 22 suites /112 tests, zero skipped; fresh database migrations |
| HTTP | 22 tests |
| Legacy browser | 4 tests; final passing run without retries |
| Component/recovery | 10 tests, controlled responses |
| Signed OIDC/PostgreSQL | 6 tests, including full UI-only business creation and negative recovery/manager paths |
| Non-durable lifecycle refusal | 1 browser test |
| Pilot/research format | 7 Node tests |
| Architecture/registry/audit/backup guardrail tests | 44 Node tests |
| Companion packaging | 7 additional Node tests, unchanged package source |
| MV3 / build / quality / restore / dependency audit | Commands and results in verification.json |

Coverage final lines91.98%, functions90.44%; statement/branch coverage may vary slightly with exercised timing paths and is recorded from the final execution, not copied from the earlier run. No failed test is skipped or removed. The first integration's legacy browser failure is preserved in failureHistory.

Final exact73840fe execution:18/18 lanes PASS, all documented final counts confirmed, line coverage91.98%, zero skips; private validation PostgreSQL stopped. New implementation is locally VERIFIED; hosted revision remains NOT VERIFIED.
