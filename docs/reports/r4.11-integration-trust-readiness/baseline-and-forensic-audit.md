# R4.11 baseline and forensic audit

Inspected2026-11-20. R4.10localandremoteHEAD5181aba2b325fb12fdb4a54b04783f23b4133d69; worktreeclean. Hostedrun77/44665518491 completedSUCCESS on exactSHA, product andBrowseroperatorworkflowpassed. mainremote5d6c20673218f02c0972263126e8654eadee18c9 ismergebase. R4.6/R4.7ancestors08bdefa/9ffae60 retained; noreset/rebase/merge. PR1/2 areolderoverlappingancestors; detailed verifiedgraphandreviewstrategy inbranch-and-pr-strategy.md. NoPRmodified.

Isolated implementationbranch feat/integration-trust-and-sync-readiness inD:/AI-for-Enterprise/ns-r411-trust. Detachedunchangedbaselineworktree ns-r411-baseline runsfresh20lanevalidation separatelyfromallwriters. Lockednpmci installed421packages/audited422; fivemoderatedevelopmentadvisoriesobserved; nolockfilechange. Sourceinspectioncoversstore/service/validation/ports/decoders/migration018/API/UI/runtimeOIDCmembership/logging andexistingpilotrunbook. No sourcechangesbeforeGit/CI/codeaudit andownershipdefined.

## Initial findings (not automatically P0)

| Finding | Classification | Source / evidence | Action |
|---|---|---|---|
|Message-keyseedcreatesoneLeadfornewmessageevenwithsameconversation | DESIGN LIMITATION / PRODUCT DECISION |PgSourceIntegrationStore.intake; R410deliberateboundedpolicy |BoundedADR andexplicitnon-destructiveassociation, no conversation/customermerge |
|originalMeta/userfixtureidentity isunverified | SECURITY RISK BEFORE LIVE; intentional syntheticcapability |Pancakedecoder andSourceObservation.synthetic_fixture,local/testgate,adminscopedfixtureAPI |Serverderivedtrustprojection andadversarialtests; neverupgrade toproviderauth |
|FORUPDATEconnectionserializesunrelatedmessages | PERFORMANCE HYPOTHESIS untilmeasurement |PgSourceIntegrationStore.intake lockorder |Boundeddatasets/locktests/EXPLAINbeforeanyoptimization |
|Explicit event/revision lookup lacksmatchingindex; priorobject loadsallhistory | PERFORMANCE HYPOTHESIS / DESIGN LIMITATION |source_receipt_native index vsSQL |Measureplans,minimumadditive019onlyifjustified |
|first100connectionlistusedforIDlookup | DESIGN LIMITATION, source-reproducedpath |SourceFixtureIntake.listConnections.find |ScopedgetConnection andtestbeyond100 |
|evidencecap100 hasno continuation | DESIGN LIMITATION |store.evidence/service.possiblyTruncated |Keysetpaging preservingSQLtimestamp precision/auth |
|Completeness,currenttruth,provideravailability unknown | EXISTING PROTECTION / NOT VERIFIED |UIandreceiptmetadataexplicitUNKNOWN,syntheticONLY |Keepvisible;offlineboundedtransportrecoveryharness only |
|LiveOAuth/webhookauth/vault/dataerasure unaccepted | SECURITY RISK BEFORE LIVE / BLOCKED PROVIDER AUTHORIZATION |R410readiness+canonicalADR007/009 |Noaccount/networkingestion,design/checklist/offlinecontracts |

No securitydefect isdeclaredP0withoutreproduction. Existingguarantees: adminconnectorcontrol, serverworkspace/currentmembership,leadauthorizationbeforeevidence,CSRF,featureOFF/nonproductionOIDC+PGgate,workspaceHMAC,append-onlyenvelope/audit/receipts,transactionatomicity/idempotency,nativeevent/messagecollisionrejection,explicitcreationclaimonly. Unknownsourceidentitydoesnotbecomecommercialtruth.

## Ownership and resources

Sixspecialistrolesworkinseparatewriterworktrees; rootsoleintegrationwriter. Existing ns-r4-gaps retainsusersupplieduntrackedcatalog; R410branchunchanged. R411privateengineeringclustercreatedunderOS-temp north-r411-engineering-db-BzN4zs onloopback50936, withseparate north_r411_performance andnorth_r411_identity databases; these arenotOwnerpilotresources. Baselinevalidationusesanothernewprivatecluster. NoOwnerprivate manifest/secrets/session/databasewereopened ormodified. Allownedresourceswillbestoppedathandover.

Pendingbaselineexecution, actualbenchmark,securityreproductionandfinalexact-sourcevalidation are recordedlater; historical1297tests/122PG/92.14%notusedasnewimplementationevidence. GateA baselinePASS; Bconditional(operatorconfirmed,SalesstudyNOTRUN); CNOTREADYFORREALCUSTOMERDATA. R4.11pushrequiresseparateapproval.
