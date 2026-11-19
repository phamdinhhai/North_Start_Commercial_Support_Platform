# R4.7?R4.9 task graph and ownership

Base08bdefa. Three children concurrent; six real specialist roles run in overlapping waves. Each writer owns an isolated worktree; root only writer in integration. Root composes shared modules/API/UI seams after contracts/review. No push/deploy/cloud/participant invitations without corresponding authorization. R4.8 human observations remain NOTRUN.

| ID | Owner / priority | Dependency | Files/modules | Acceptance / required tests | Review owner | Status / evidence |
|---|---|---|---|---|---|---|
| ENV-01 |r47_env P0|Baseline, synthetic guard|NEWscripts/pilot/* +environment runbook|Loopback PG/app/IdP, role membership, durable restart, safe newDBreset, backuprestore with actual isolated tests|Security/Reliability/QA/root|IMPLEMENTED / TESTED; final evidence below|
| UX-01 |r47_ux P0/P1|Baseline, auth identity rules|operator-script/client/style +new UXhelpers/component tests|401/403sensitive field lifecycle, draft protection,409recovery/a11y; actual browser checks, no rawdraft storage|Security/QA/root|IMPLEMENTED / TESTED; human study pending|
| COM-01 |r47_domain P0/P1|Baseline, agreed taxonomy|NEWmanager exception port/service/PG/API/asset|Manager/admin-only read, serverworkspace, boundedobservedcodes/classification, no raw content; unit/HTTP/PG|Security/QA/root|IMPLEMENTED / TESTED; integrated signed UI|
| SEC-01 |r47_security P0|Wave1design/checkpoint|Security review +NEWnegative tests/data governance proposal|Cross-workspace/export/session/HMAC/synthetic checks, threat model and immutablemetadata/content split decision gates|QA/root|EXECUTED / reviewed; evidence below|
| REL-01 |r47_reliability P0/P1|Baseline+ENV/DATA proposals|NEWbounded failure/recovery tests+runbook|Outage/pool bounds/rollback/restart/evidence/outbox; stop own resources, exact failure-simulation limits|Security/QA/root|EXECUTED / reviewed; evidence below|
| QA-01 |r47_qa P0|Early audit then integratedcontracts|NEW E2E/research protocol/observation tooling|UI-only manager/recovery/fulljourney; independent regressions, anonymous3?5participant proposal, no invented humanresults|root|EXECUTED / reviewed; evidence below|
| INT-01 |root P0|Allcontract+review checkpoints|Sharedmodule/CIregistration, synthetic runtimeguard, research observation boundary, verification/reports|Full source-revision gates; safe synthetic mode; findings?correction traces; truthful GateA/B/C|Allspecialists|Integrated; final verification below|

Graph: baseline?ENV/UX/COM parallel; confirmed contracts?SEC/REL/QA parallel; reviewed tested commits?rootcomposition?independent cross-review?fullverification?release assessment. Security schema reviewed before migrations; no new migrations planned for exception read projection. QA never treats worker summaries as independent execution.

R4.9 corrections require finding IDs and tests. Subjective dashboard polish, attribution, AIexecution, identitymerge, productionintegration and speculative retention/legal policy remain deferred. Human pilot organizational approval is pending; the requesting user confirmed acting as operator; elapsed time does not grant approval.

## Integration checkpoint

Six specialist roles actually executed, each in its own worktree (three child slots, two overlapping waves). Root reviewed diffs, integration boundaries and test evidence; security independently reran five launcher safety tests on the final follow-up.

| Task | Implementation / integrated references | Tests / review | Remaining status |
|---|---|---|---|
| ENV-01 | 1de35d2, a5ebe65; scripts/pilot/* | Five safety tests, real loopback restart/backup/restore/reset, actual PG outage/manual recovery and unsafe-history refusal; security cross-review approved local scope | IMPLEMENTED / worker TESTED; root final rehearsal recorded in verification.json |
| UX-01 | 0a1180e, cdcf15e; operator script + recovery specs | Ten Chromium component/recovery tests; real signed OIDC expiry/conflict/CSRF; security identity/workspace/role review | IMPLEMENTED / TESTED; human usability PENDING |
| COM-01 | 1a7db37, b7a5f25 + root composition29d61e0 | Unit/PG/HTTP authorization and signed manager UI; external-expectation false overdue corrected | IMPLEMENTED / TESTED; no global dashboard or invented SLA |
| SEC-01 | 210f455, ef43407; adversarial privacy tests and governance proposal | Workspace/export/synthetic/auth review; final ENV/UX no local-scope blocker | Local controls TESTED; data-lifecycle redesign PROPOSED only |
| REL-01 | 54b7fd3; postgres transaction error ownership and bounded PG tests | Actual own backend termination/pool exhaustion/rollback/failed migration; ENV lock-loss follow-up a5ebe65 | IMPLEMENTED / TESTED; no production resilience certification |
| QA-01 | 2f5ec6e; signed acceptance, protocol/scenarios/schema/validator | Six signed OIDC tests; local practice guard; independent failure provenance retained | Automated evidence TESTED; human study NOT RUN |
| INT-01 | 29d61e0, e93db4c | Synthetic admission before side effects, manager composition, PG registry, CI recovery/format checks, full integrated validation | Final results in verification.json; new hosted revision PENDING authorization to push |

Dependency closure: baseline ? ENV/UX/COM ? reviewed contracts ? SEC/REL/QA ? root composition ? final security review ? exact-source validation. No migrations added and original migration history retained. Original research/uncommitted files are outside this worktree and remain untouched.

## Risk and closure

ENV: local account selector is not human identity; fixture ports must remain loopback. UX: original-tab close loses memory-only drafts after warning; no plaintext draft persistence. COM: paged current-state observations cannot be interpreted as global counts or SLA decisions. SEC: governance is a proposal, not approved erasure. REL: manual recovery is required after singleton-lock loss; no exactly-once or HA promise. QA: browser success does not validate human usability. Integration: hosted acceptance awaits authorized push; no main merge/deployment performed.

Final integration checkpoint: exact73840fe passed18/18 lanes, zero skips. All six outputs reviewed/integrated; root independent local rehearsal passed. Source/test/CI complete for this local scope; hosted verification and organization/human gates remain explicitly pending.
