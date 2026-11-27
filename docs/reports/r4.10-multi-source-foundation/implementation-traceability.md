# Implementation and product traceability

R4.10 is a local/test, defaultOFF, synthetic foundation. Baseline9ffae60 and its hosted75 success remain separate from final source. Final execution commands/SHA/logs are in verification.json. No new live provider, human-study, production or retention approval.

| Requirement / task | Implementation | Automated evidence | Limit |
|---|---|---|---|
| Existing architecture /AUD | integration-inventory.md; registry39 runtime and approval reconciliation | registry/architecture regression; source-path inventory | Historic registry entries are not silently relabeled live |
| SharedObservation /CORE01 | ports/source-observation.ts + strict source-integration/validation.ts | schema, source authority, synthetic, calendar time, size and unknown-fields negatives | Typed two-source contract, not generic plugin framework; displayName is a synthetic user-entered value, not certified PII-free |
| Provider-neutral pipeline /CORE02 | SourceIntegrationService + PgSourceIntegrationStore reuses createEnvelope/createLead/HMAC/PostgresService/audit | source-intake.integration.spec.ts; atomic audit failure and retry | Source intake intentionally separate from metadata AIL/outbox assertions |
| Pancake vertical slice /PAN03 | adapters/pancake-synthetic decoder + root factory + fixture API/UI |20decoder cases, signed browser standalone+dualpath, PG persistence | Restricted fabricated webhook subset; upstream full OpenAPI invalid; no network receiver |
| Meta Page vertical slice /SOC03 | adapters/meta-synthetic decoder through same service/store/UI |17decoder cases, signed browser standalone+dualpath/handoff | Incoming text singleton only; no edits/deletes/media/batches/live signature implemented |
| Transport/origin distinction | SourceObservation.accountId vs native.system/page/message; connection bound server-side | PAN mapping test, PG source scope mismatch, signed tenant404 | Original Meta mapping on Pancake is explicitly fabricated; not a verified provider field |
| Idempotency /CORE03 | unique workspace+connection+receipt, workspace/native message advisory lock, HMAC receipt comparison | concurrent receipt and dualpath tests; browser replay/restart with stable counts | No exactly-once provider delivery claim |
| Explicit event reconciliation | workspace+native system+page+event+revision lock/collision, semantic comparison, retained original route payload | sameevent acrossroutes2envelopes/onelead; changed speaker/lifecycle409+unchanged counts; foreignworkspace separate | Where providers do not supply event ID, only object alignment is asserted, never same-event proof |
| Identity separation /I01/I06/I07 | Same native message seeds explicit synthetic commercial episode; other messages create distinct seeds | identical-text/different-message and crossworkspace tests | No conversation=Lead/customer merge; automated person linking remains deferred |
| Late/reordered/edit/delete | Append immutable observations; do not compute current provider truth | PG out-of-order distinct events/delete labels, original retained, collision negatives | No complete lifecycle stream/revision ordering or live deletion acceptance |
| Missing ID/schema drift | metadata-only quarantine for missing source/native page/message; decoder schema failures categorical400 | PG quarantine no raw/envelope/lead; contract malformed tokens/extra fields/unsupported types | No raw quarantine retention, no live transport backlog/repair UI |
| Responsibility | defaultNULL owner; explicit admin claim only at creation, duplicates never transfer | PG claim/replay/otheradmin; signed UI claim?handoff?Sales sourceinspection | Existing requireOwner unchanged; unassigned imports read by manager/admin until authorized human workflow |
| Source health /CORE04 | active/revoked local connection; SYNTHETIC_ONLY; local receipt/quarantine count,lastReceipt | PG scoped counts; UI alwaysUNKNOWN for sync/checkpoint/lag | No provider authorization, polling/backfill/cursor worker, quota/backoff runner or completeness claim |
| Evidence UI /CORE06 | operator-sources.ts + lead-scoped source evidence API; timestamp/source/native/verification/UNKNOWN | signed OIDC Chromium, sourceinspector2observations; escaped text rendering | Original provider wrapper accessible only accepted store, response strips raworiginal/digests and renders bounded text |
| Auth/security | admin-only configuration/intake; service invokes existing lead authorization before reader; request membership/CSRF | HTTP flags/401/403/404, foreignadmin404, viewer403, revoked source/membership403, missingCSRF403 | Fixture IdP only; production identity/privacy remain gated |
| Reliability/recovery /CORE05 | one tx envelope+lead+native mapping+receipt+audit, rowlock serializes revoke, failedcommit no ACK | source PG audit fault/retry; restart/pool replay; extended11table backuprestore + replay | Bounded synchronous durable intake, not a background provider synchronization engine |
| Migrations | additive018, original001-017 unchanged; downrefuses nonempty sourcehistory | migrator pair inventory; empty DB lifecycle upgrade/down/up; nonempty refusal/bookkeeping test | Do not run downagainst accepted history; no ownerpilot migration performed |
| Ads/revenue /ADS | fabricated-commerce pure normalizer, stringmath explicitcurrency scales/event kinds |22money cases, partialrefund/date/precision/unsafeinteger/unknown tests | No financial provider adapter,persistence,settlement,WON or revenue inference |
| Reuse /OSS |13repo pins80file hashes, SDK/community source additions; ADOPT/ADAPT/REIMPLEMENT/STUDYONLY/REJECT matrix | selected source/tests/licenses read; independent Pancake spec hash re-fetch matched | Upstream suites not executed, no source copied or dependency incorporated; deferred scopes explicit |
| Pilot protection | pilot scripts/manifest/config/database untouched; current source tested on NEWowned launcher | safety7nodecases, existingOIDC/browser/recovery/MV3 + root fresh launcherUI/restart/roles/isolation | New fixture outside owner resources; no Sales humanvalidation |

## Five engines

Acquisition Intelligence: researched explicitmetric/lineage taxonomy, no attribution inferred. Conversation Intelligence: two fabricated message paths preserve accepted source and origin evidence. Commercial Continuity: Lead/context/access/handoff and explicit responsibility remain core owned. Revenue Execution: human actions preserved; no provider writes. Revenue Intelligence: money lifecycle fixtures distinguish order/payment/refund, but verified revenue and LVP attribution remain UNKNOWN. Research depth does not promote engine scope or provider readiness.

## Readiness levels (do not collapse)

| Surface | Documented/source inspected | Contract validated | Synthetic implemented | Synthetic E2E verified | Provider authorized | Authorized sandbox/live verified | Production approved |
|---|---|---|---|---|---|---|---|
| Pancake message path | YES | Restricted fixture subsetYES; completeOASFAIL | YES | Final evidence in verification.json | NO | NO | NO |
| Meta Page message path | YES | Restricted fixture subsetYES | YES | Final evidence in verification.json | NO | NO | NO |
| Crosspath native alignment | YES | Synthetic explicitlinkage/messageID | YES | SignedUI+PG/replay in verification.json | NO | NO | NO |
| Ads/POS/other social | Bounded source research | Unverified official payloads unless explicit source document stated | Pure financial fixture only | NO | NO | NO | NO |
| OSS reuse | Bounded pinnedsource+license triage | Upstreamtests read | Selected independent patterns only | N/A | N/A | N/A | NOembeddingapproval |
