# QA-02 independent browser execution checkpoint

2026-11-19. QA branch work/r4-qa, tested dependency HEAD ebe1cc6 (cherry-picks baseline + cb3dea0, c8dcdde, 5eee6c8, 612fc1e, 7e6ca1f, f075a3f, 1bbdecd, 1030d8a), with test-only changes committed alongside this report. No production source edits by QA. Matrix QA-01 remains historical proposal status; results here supersede only explicitly covered cases.

## Actual results

| Check | Actual result |
|---|---|
| Locked npm ci | PASS, 421 installed; five moderate dependency advisories reported, no automated fixes |
| Typecheck | PASS |
| Lint including e2e | PASS |
| Legacy browser lane, four preserved scenarios | PASS 4/4, no skips/retries, 16.9 seconds |
| Separate actual OIDC + PostgreSQL browser lane | PASS 2/2, no skips/retries, 18.6 seconds |

Commands: npm run typecheck; npm run lint; npx playwright test --config playwright.config.ts; QA_DATABASE_URL=postgres://postgres@127.0.0.1:54401/qa_browser_r4 npx playwright test --config playwright.oidc.config.ts. Environment assignment shown conceptually; PowerShell uses $env:QA_DATABASE_URL. PostgreSQL 17 private cluster was freshly initialized in OS temporary directory, bound 127.0.0.1:54401. No shared/customer database, identity provider or provider contacted. Database freshly recreated before each complete OIDC run. No dependency, migration, canonical, CI or package script edits by QA.

## Verified journeys

New OIDC lane uses runtime-generated RS256 issuer keys and an actual browser account chooser, authorization redirect, single-use code exchange and PKCE check. Memberships map to internal users server-side. No unsigned token mode, token paste, response stubs or API business-data seeding occurs in the acceptance journey. Setup asserts no existing leads, inserts only workspaces and identity memberships, and installs configured workspace digest keys once per fixture.

Actual owner/recipient UI sequence: login; create lead from fabricated original conversation; observe default real filter hiding synthetic; select synthetic filter and rediscover unassigned lead; append context; handoff through directory to recipient; recipient separately logs in; opens evidence containing original utterance; confirms script text does not execute; accepts work; creates independent action; reschedules; completes with explicit human declaration; reopens completed item as successor; advances through existing Contacting/Follow-up interim transitions; declares Won claim; corrects to Unknown with reason; inspects detailed audit and original/corrected outcomes; application restart; reauthentication; verifies same lead ID and persisted correction.

Restart scope is closing and recreating the Nest application and all DI services in the fixture process against the same PG database. This proves session-service reset, reauthentication and durable business-state reload. It is not an OS-process crash, database restart, backup restore or deployment recovery test. Digest keys remain stable in runner environment; ephemeral-on-each-restart keys are deliberately avoided.

Second actual OIDC test UI-creates two fabricated records classified real and synthetic; verifies default real and explicit all filters; viewer bystander receives403 for lead read/intake mutation; foreign-workspace user receives404; cookie-auth mutation without CSRF receives403. Fabricated data with isSynthetic=false exercises classification only and is not customer data.

All four legacy regression scenarios remain represented against actual backend: delayed selection cannot overwrite current lead or misbind acceptance; evidence guards reject missing system proof/customer intake as action proof and inferred close, human declaration must be confirmed, claimed outcome/audit inspectable; two tabs create genuine stale conflict and only successor can complete; unauthenticated401/same-workspace403/cross-workspace404. Legacy lane deliberately retains API setup and development tokens and does not count as UI intake acceptance.

## Failed attempts and corrections

Initial OIDC attempts before closure composition were not passing acceptance. Once closure API was composed, journey reached outcome and correctly rejected Accepted-to-Won with CE1_BOUNDARY; test was corrected to use existing Contacting/Follow-up transitions. Initial regression expected409 for inferred close, while actual contract correctly returns422 INFERRED_CANNOT_CLOSE; test assertion corrected. No production transition or policy was relaxed.

A proposed assigned-viewer browser extension attempted selecting a viewer in assignee directory; the directory correctly excludes viewer from assignable Sales recipients. That extension was abandoned before final test run, not skipped or reported passed. Existing signed OIDC/PG HTTP viewer-demotion regression remains the evidence for assigned-viewer read-only enforcement. QA initially inspected cookieValue alone and raised ambiguity concern; full prepare() guard in cb3dea0 already rejects malformed/duplicate cookies. No current auth bypass is claimed. Main startup failure before cherry-picking1030d8a was a missing dependency in QA branch; existing root binding resolves it.

## Remaining acceptance and release limits

New two-test lane covers Q-A1, portions of Q-A3/A4, Q-U1..U4, parts of Q-N1/N2, Q-S1 and XSS aspect of Q-P1. Legacy scenarios cover Q-N3 and stale-work portions of Q-N2. It does not independently execute the complete early matrix: all browser mutation routes as assigned viewer, full token-negative protocol cases, cryptographic rotation/legacy retry, simultaneous PG idempotent command replay, synthetic exclusion in aggregates/export, learning payload inspection, data lifecycle holds/erasure, durable assertion delivery failure injection, full security-critical coverage, capacity, real IdP deployment and external usability remain separate evidence requirements. Root owns full integration/security/PG validation and final scope assessment.

The controlled issuer is a protocol fixture, not a real deployment identity provider. Automated synthetic task success does not establish usability with external participants, multi-day adoption, commercial value, provider authorization or release approval.
