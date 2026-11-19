# R4.7?R4.9 task graph and ownership

Base08bdefa. Three children concurrent; six real specialist roles run in overlapping waves. Each writer owns an isolated worktree; root only writer in integration. Root composes shared modules/API/UI seams after contracts/review. No push/deploy/cloud/participant invitations without corresponding authorization. R4.8 human observations remain NOTRUN.

| ID | Owner / priority | Dependency | Files/modules | Acceptance / required tests | Review owner | Status / evidence |
|---|---|---|---|---|---|---|
| ENV-01 |r47_env P0|Baseline, synthetic guard|NEWscripts/pilot/* +environment runbook|Loopback PG/app/IdP, role membership, durable restart, safe newDBreset, backuprestore with actual isolated tests|Security/Reliability/QA/root|ACTIVE ns-r47-env|
| UX-01 |r47_ux P0/P1|Baseline, auth identity rules|operator-script/client/style +new UXhelpers/component tests|401/403sensitive field lifecycle, draft protection,409recovery/a11y; actual browser checks, no rawdraft storage|Security/QA/root|ACTIVE ns-r47-ux|
| COM-01 |r47_domain P0/P1|Baseline, agreed taxonomy|NEWmanager exception port/service/PG/API/asset|Manager/admin-only read, serverworkspace, boundedobservedcodes/classification, no raw content; unit/HTTP/PG|Security/QA/root|ACTIVE ns-r47-domain|
| SEC-01 |r47_security P0|Wave1design/checkpoint|Security review +NEWnegative tests/data governance proposal|Cross-workspace/export/session/HMAC/synthetic checks, threat model and immutablemetadata/content split decision gates|QA/root|QUEUED wave2|
| REL-01 |r47_reliability P0/P1|Baseline+ENV/DATA proposals|NEWbounded failure/recovery tests+runbook|Outage/pool bounds/rollback/restart/evidence/outbox; stop own resources, exact failure-simulation limits|Security/QA/root|QUEUED wave2|
| QA-01 |r47_qa P0|Early audit then integratedcontracts|NEW E2E/research protocol/observation tooling|UI-only manager/recovery/fulljourney; independent regressions, anonymous3?5participant proposal, no invented humanresults|root|QUEUED wave2|
| INT-01 |root P0|Allcontract+review checkpoints|Sharedmodule/CIregistration, synthetic runtimeguard, research observation boundary, verification/reports|Full source-revision gates; safe synthetic mode; findings?correction traces; truthful GateA/B/C|Allspecialists|ACTIVE|

Graph: baseline?ENV/UX/COM parallel; confirmed contracts?SEC/REL/QA parallel; reviewed tested commits?rootcomposition?independent cross-review?fullverification?release assessment. Security schema reviewed before migrations; no new migrations planned for exception read projection. QA never treats worker summaries as independent execution.

R4.9 corrections require finding IDs and tests. Subjective dashboard polish, attribution, AIexecution, identitymerge, productionintegration and speculative retention/legal policy remain deferred. Human pilot approval and accountable operator are pending; elapsed time does not grant approval.
