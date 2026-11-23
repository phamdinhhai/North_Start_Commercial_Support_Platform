# R4.10 risks and decisions

| Risk | Severity / status | Control / next decision |
|---|---|---|
| Real data admitted to prototype | P0 gated | FeatureOFF; explicitlocal/test+OIDC+PG only; synthetic=true andUNVERIFIED; no provider credential/transport. Operator must enter invented content; flags cannot prove text is fictitious. GateC NOTREADY. |
| Crosssource ID ambiguity | P0 controlled in testedcases | Native system+page+message underworkspace; Pancake IDs never presumed Meta; optional explicit fabricatedlinkage; unknown IDs metadataquarantine. No personmerge. |
| False event dedupe/completeness | P0 controlled/later gap | EventID distinct from messageID; receipt and sourceoriginals retained, UNKNOWN completeness. Sameobject alignment is not proof sameevent. No fullsync claim. |
| Provider schema defects | P1 confirmed | Both PancakeOpenAPI originals failfullvalidator; chosen subset explicit/tests. Repair providercontract with firstparty before live. |
| Credentials and logs | P0 live path deferred | No secrets in decoderfields, categorical errors, server HMAC; sourcewire strips digests/raworiginal. Future vault/rotation,URLquerytoken redaction,webhookauth/rate policies NOTIMPLEMENTED here. |
| Pilot regression | P0 tested | Frozen existing pilot scripts/resources untouched; regression suite plus NEWowned launcher verifies existingUI/restart/isolation. Do not reuse Owner private manifest. |
| New schema rollback | P0 controlled |018down refuses anynonempty sourceconnection/native/receipt history; preserveaudit. Old001-017 unchanged; upgrade/emptyrollback and refusal tests. |
| First100 connections | P2 limitation | All list/fixturelookup bounded100; later connection cannot be selected byID. Before scaling add scopedget/paging, never clientworkspace bypass. |
| Aggregate/read growth | P2 limitation | Healthresponse100/evidence100 but SQLaggregate scans tenant history and sameobject history lockread grows. Indexes help, no load/SLO claim. Bound pilot volume before scaling. |
| Restart and key custody | P1 externalgate | Replay tested with retained testkey config/app/pool restart and dump/restore. FullOSloss/KMS/rotation/backup custody not certified. |
| Human validation | P1 pendingexternal | Useroperator confirmed, organization/participants/observer/observationhandling pending. Browserautomation is not Salesusability/businessvalidation. |
| Lifecycle/privacy | P0 GateCblocker | Retention/deletion/anonymization/legalhold/backup/downstreamerasure/realIdP remain unaccepted. No destructive migration or legalpolicy invented. |
| OSS license/supply chain | P1 reviewedbounded | No sourcecopied/dependencyadded; NangoELv2,erxesconflict,n8nSUL,TwentyAGPL/customexceptions,MetaSDKrestricted,TikToklicenseconflict. Check modulelicense+actual intendeduse before incorporation. |
| Personal account protocols | P0 researchonly | No accounts/sessions/cookies/liveSDK; OA/professional rights separate. Providerpermission/appapproval required before any futurelivecapability. |
| P2 Actions runtime | P2 deferred | Exact releaseSHA/node24runner research done; keep applicationNode22. Dedicated maintenance/hostedrun needed before upgrade, not coreblocker. |
| Unavailable sources | P2 deferred | HubSpot2x403, OneChatambiguous, TikTokportalunreadable in some research. Do not infer SDK/endpoint rights from searchsnippets. |

No unresolved P0 source defect is accepted by this report; actual failing regressions must be fixed before localPASS. New hostedCI pending explicitR4.10pushapproval; CI75 only proves baseline9ffae60. No outbound/provider writes, livecustomeringestion, customeridentity merge, realdata,mainmerge or productiondeployment.
