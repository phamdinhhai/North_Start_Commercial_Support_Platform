# R4.10 task graph and ownership

All specialists read relevant canonical invariants/ADRs before edits. One writer per worktree. Root solely integrates shared app/module/API/UI. Capability maturity is separate from provider approval or human validation.

| Task | Owner | Priority | Dependencies | Files/modules | Acceptance and required tests | Review | Status/evidence |
|---|---|---|---|---|---|---|---|
| AUD-01..04 | r410_audit | P0 | Baseline; later integrated core/adapters | inventory/current maturity/product matrix/independent QA; later new E2E |39registry comparison with source/test refs; negative matrix; independently verify integrated paths without assuming worker claims | root/CORE | Wave1 running |
| PAN-01..05 | r410_pancake | P0 | Baseline+approved CORE port | NEWadapters/pancake-synthetic; Pancake research/matrix | Fetch/validate actual REST+webhook/POS sources, source hashes; native mapping/UNKNOWN fixtures and contract negatives | SOC/CORE/AUD/root | Wave1 running |
| CORE-01..06 | r410_core | P0 | Baseline?root contract review?PAN/SOC | NEWports/source-observation;application/source-integration;infra/source-integration;migration018 | Durable atomic intake+append envelopes/audit, idempotency/concurrency/rollback/dualpath/no content merge, workspace/auth; unit/PG tests | PAN/SOC/AUD/root | Wave1 running; contract checkpoint90a3f7f |
| SOC-01..04 | r410_social | P0/P1 | Approved port; slot after research audit | NEWadapters/meta-synthetic;social/personal capability research | Actual Page payload contract research, account-type/scopes separated; synthetic mapping tests, no personal sessions/live library | PAN/CORE/AUD/root | Wave2 queued |
| ADS-01..04 | r410_ads | P1 | Baseline; independent | NEWadapters/revenue-fixtures;Ads/POS taxonomy/research | Source-grounded metric meanings; integer currency scales/refund/event distinction synthetic tests; no writeback/live requests | SEC-minded AUD/root | Wave2 queued |
| OSS-01..04 | r410_oss | P1 | Baseline; independent | OSS source-pin/reuse/license reports | Pin+read actual P0Chatwoot/Activepieces/Nango/Airbyte flow/tests/license; file-specific caveats; no code copying | CORE/AUD/root | Wave2 queued |
| INT-01 | root | P0 | Shared contract?reviewed workers?QA | shared composition/controller/UI/CIregistry/reports | FlagOFF, local/test only, existing roles/CSRF; evidence UI/provenance/health; full regression exactSHA; pilot resources untouched | six specialists | Active |

Graph: baseline?AUD/PAN/CORE in parallel?contract review?SOC/ADS/OSS as slots free?worker unit/contract/PG checks?root composition?cross-review + independentQA?exact-source full regression?reports/local commits. Migrations reviewed before integrated use. Risk: unverified provider IDs/schema/license cannot be promoted to live readiness. Actual Sales pilot remains independent and must not be reset/delayed by speculative work.

## Actual execution and review closure

Six roles actually ran in waves: r410_audit, r410_core, r410_pancake, r410_social, r410_ads, r410_oss. Same specialist reused for follow-up review rather than adding fictitious roles. Integration paths always separate; no shared-file concurrent writer. Root read patches, reviewed schema before PG, reproduced targeted checks and ran full regression. Root-owned tests used fresh private clusters, not Project Owner pilot.

| Owner/task | Implemented/researched references | Tests and cross-review | Final status |
|---|---|---|---|
| AUD |00914a68 inventory+matrix;1fd1f23 signedsourcebrowser;b4e6eca independentreport | Actual signedOIDC+PG+Chromium onefullUI sourcejourney; finalread-only15de78c security/reliabilityreview no blocker | SourceAUD completewithinboundedinventory; independentautomationTESTED; humanNOTRUN |
| CORE |90a3f7f/e039781/dee0a67/e3a5496/60eb8d3;87190d9 explicitcrossrouteeventtest | Unit+actualPG; schema reviewedroot; rootfixed impossiblecalendartime; PAN/SOC/AUD crossreview | SharedsyntheticboundaryIMPLEMENTED/TESTED; newmigration018only |
| PAN |aeb013b +804bf64 transportaccountfix |17initialdecoder tests then20afterrootcalendarnegatives; rootre-fetched2specs/hashmatch; socialreview native identity no blocker | RestrictedsyntheticcontractIMPLEMENTED; fullupstreamOASFAIL explicitly |
| SOC |945c15b fixture+social/personalresearch;576be7c officialSDKsourcefollowup |17decoder tests,typecheck/build; PAN/store read-onlycrossreview; actualsignedbrowserviaAUD | RestrictedMetaPageIMPLEMENTED; personal/otherchannelsRESEARCHONLY |
| ADS |f3530ce moneyfixtures+13surfaceofficialresearch |22purefixturetests,typecheck/build; rootreviews exactinteger/lifecycle/UNKNOWN semantics | TESTEDfabricatedschema; officialfinancialadaptersNOTIMPLEMENTED |
| OSS |0df8c15 |13upstreampins/80sourcefilehashes; P0implementation+tests+licensesinspected; suitesNOTEXECUTED | BoundedresearchDELIVERED; no thirdpartysource/depscopied |
| Root |22d114e composition;023acb2 localhealth;ea90318 rollbackguard;949933a calendartime;4cdfcde restore;1df0eeb migrationinventory | Wholepipeline review,typecheck/lint/architecture/HTTP, actualPG, fullregression exactSHA inverification.json | IntegratedLOCALPASS1df0eeb20/20lanes; hostedCI NOTVERIFIED |

## Findings corrected during review/integration

Transportaccount separatefromnativeorigin; sameconversation nevercollapsedtoLead; initialdraftSQL placeholder/column mismatch corrected beforeacceptedPGtests; nativeevent identity cannotcollideacrossmessages; onlyexplicitadmincreationclaimassignsowner; acceptedhistoryblocksdownmigration; impossiblecalendardatesrefused; stale17migrationunitinventorynowrequires018. Sameeventdualroute semanticcollision rejectsatomically. These are confirmed code/test findings, not humanusability conclusions. Firstfullrun4cdfcde had19lanesPASS/coverageFAIL becausemigrationinventoryexpected17; logsretained and finalrerun follows, no testskipped.

RemainingP1/P2: providerOAuth/vault/HTTPsignature/transportbackoff/checkpointworker, fullfinancialprovidercontracts, completeupstreamsecurity/license/SBOM audits, DataHealthpaging/scalebounds, Actionsruntimeupgrade, actualSalesstudy andGateCgovernance. Ownerdecisionsneeded: approve anyfuturepush, choose/provider-authorizeeachlivecapability, settleOneChatidentity andstudyorganization. No silentbackgroundworkafterhandover.

Final execution1df0eeb:20/20lanesPASS;132files/1297Vitesttestsincluding122PG,zeroskips;linecoverage92.14%. Allloghashesverified; privateclustersstopped. No source/test/config changes aftertheacceptedrevision; remainingcommitdocumentationonly.
