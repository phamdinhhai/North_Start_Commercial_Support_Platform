# Phase 4 third-party provider readiness

**Document class:** Non-canonical research artifact
**Prepared:** 2026-11-13
**Decision scope:** Readiness evidence for PH4 planning only; this is not a production approval, a provider contract, or a resolution of any canonical open decision.

## 1. Evidence boundary

This report is a repository-only consolidation. It uses the existing planning documents, the Pancake/Meta/TikTok knowledge-base snapshot, and the repository's recorded spike notes. It does **not** browse private endpoints, use credentials, run a provider request, or claim live verification. A statement marked `recorded historical observation` is a claim about what a repository document says was observed at that time; it is not a new observation by this report.

The following rules govern the status labels:

- **Documented** means an existing repository document records a provider or API-family fact.
- **Partially ready** means useful planning evidence exists, but a production adapter contract or required gate evidence is missing.
- **Incomplete / unknown** means the repository does not contain enough provider-specific evidence to make a readiness claim.
- **No evidence** is not evidence of provider absence.
- `family_verified` and catalog coverage do not authorize an endpoint implementation. Exact method, path, version, permission, schema, and eligibility still require verification.

## 2. Consolidated status

| Provider / surface | Repository evidence | Readiness status | What is explicitly not established | Safe next posture |
|---|---|---|---|---|
| **Pancake Chat / Public API** | KB snapshot plus official docs `https://developer.pancake.biz/`, `https://docs.pancake.biz/pancake/st-f12/st-p1?lang=en` and POS/webhook docs. Contract-first mock adapter is now implemented and tested; no credential is used. | **CONTRACT_TESTED / PH4 PARTIAL** | Complete OpenAPI schema fetch returned 403; no current production credential, live endpoint, stable version, or live webhook verification. | Keep PH4 feature flag **OFF**. Use the adapter only with mock transport/fixtures until credential-bound review passes. |
| **Meta** | Audited KB plus documented repository evidence for `facebook/facebook-nodejs-business-sdk` v26.0.3, Meta Platform License, tests/Node CI/CodeQL/Dependabot signals. | **REFERENCE / CONTRACT NOT TESTED** | SDK/repository evidence is not app permission, account eligibility, API contract execution or live behavior. No production adapter is established. | Keep as REFERENCE; verify exact surface, version, permission, review and account scope before adapter work. |
| **TikTok** | Audited KB v2 inventories TikTok families; requested official SDK/Airbyte paths remain to be verified. | **INCOMPLETE / UNKNOWN** | No verified official SDK version, market/app eligibility, permissions, webhook behavior, identity joins or live payloads. Airbyte TikTok connector presence was not established by source review. | Keep family-level findings as candidates only; require endpoint-level and eligibility evidence. |
| **Google Ads Data Manager (not Anthropic)** | The demand identifies Google Ads/Data Manager as the intended ecosystem; exact requested v1.9/2026-11-04 source could not be re-verified. No adapter, fixture or live call exists. | **INCOMPLETE / UNKNOWN** | Official v1.9 specification/date, conversion/lead identifiers, row-level diagnostics and Agent Skills source remain unverified; no credentials/live behavior. | Keep taxonomy corrected to Google Ads. Do not infer Data Manager behavior from Anthropic or legacy offline-upload material. |
| **Zalo OA** | Official docs `https://docs.zaloplatforms.com/docs/OA` and webhook docs document OA messaging, followers, tags, OAuth2 PKCE and webhook capabilities; build `b3485d26` observed 2026-11-09. | **DOCUMENTED / CONTRACT NOT TESTED** | Webhook signature/retry/complete schema, credentials, tenant/live behavior and integration tests remain unknown. Unofficial personal-account libraries are not OA contracts. | Keep as documented research; require OA-specific contract fixtures and credential-bound verification. |
| **Sapo** | `Sapo-MCP` source review: MIT, v0.7.1, documented 105 tools, test/typecheck/lint/build/probe/canary signals and Private App single-shop mode. | **REFERENCE / CONTRACT NOT TESTED** | README signals were not executed here; single-shop Private App assumptions are not SaaS OAuth architecture; no live tenant/adapter/revenue mapping. | Keep REFERENCE; do not map Sapo fields to canonical revenue/outcome without ID-2/Q1 evidence. |
| **HubSpot** | `hubspot-api-nodejs` source review: Apache-2.0, v14.1.3, active test/lint/docs workflow signals. | **REFERENCE / CONTRACT NOT TESTED** | No tenant credential, object mapping, permission, write policy, fixture or live verification. | Preserve anti-corruption boundary; require ID-2 mapping decision before CRM work. |
| **Salesforce** | `jsforce` source review: MIT, v3.13.1, active tests/release/dependabot signals. | **REFERENCE / CONTRACT NOT TESTED** | No Salesforce tenant credential, API contract execution, object mapping, permission, fixture or live verification. | Preserve anti-corruption boundary; no CRM semantics or ownership inherited from the library. |
| **Zoho** | No provider-specific contract or source-level SDK assessment was completed in this checkpoint. | **INCOMPLETE / UNKNOWN** | No API/version, auth, object model, mapping, permissions, fixture or live evidence. | Keep out of implementation scope until evidence-backed assessment exists. |

### Status interpretation

The Google Ads/Data Manager, Zalo OA, Sapo, HubSpot, Salesforce and Zoho rows distinguish documented/source-level signals from contract-tested and live-verified behavior. None is production-approved. This preserves I-08 (visible unknowns) and avoids turning a provider name or repository metadata into a contract.

## 3. Cross-provider findings

1. **No provider owns canonical commercial meaning.** The integration boundary remains an anti-corruption boundary. Provider IDs, tags, stages, assignments, CRM objects and channel labels must not be silently promoted to Lead identity, Commercial Event truth, Sales ownership, outcome, revenue or attribution.
2. **Pancake now has a contract-first mock adapter, not a live connector.** It remains `CONTRACT_TESTED`/`PARTIAL`, PH4 stays `FLAG_OFF`, and the adapter has no credentials/private endpoint handling.
3. **Meta/TikTok catalog and SDK breadth is useful for discovery, not proof of access.** Repository metadata and family rows are not endpoint contract tests or live account evidence.
4. **Google Data Manager taxonomy is corrected.** It is treated as a Google Ads ecosystem surface; the requested v1.9/date, diagnostics and Agent Skills evidence remain unverified.
5. **Zalo, Sapo and CRM source reviews remain reference/documentation evidence.** None is live verified or production-approved; Sapo Private App and CRM field authority constraints remain explicit.
6. **Manual/synthetic operation remains the safe continuity path.** It must stay available when a provider is unavailable, unverified, or deliberately disabled; synthetic data must remain visibly segregated from real pilot evidence.

## 4. PH4 decision posture

- **PH4:** `OFF` by default; the pre-PH4 gate is not passed.
- **Pancake verdict:** `PARTIAL`.
- **Q-03 (read API feasibility):** remains an open/unknown contract question. The repository contains a historical KB snapshot and a later recorded spike note, but not a current independently verified public API contract.
- **Q-04 (webhook semantics):** remains `UNKNOWN`; subscription, signing, delivery ID, retries, ordering, duplicates and replay behavior are not verified.
- **Fallback:** manual/synthetic adapter and bounded polling research remain available without depending on Pancake. No sending, CRM write-through, automatic merge, attribution, or revenue inference is enabled by this report.
- **Canonical decisions:** CE-1, CE-2, MM-1, ID-1, ID-2, PM-1 and LG-1 remain open. This report does not resolve them.

## 5. Evidence/refresh protocol

This protocol is a planning control, not evidence that a refresh has occurred.

### 5.1 Before a provider can move above `INCOMPLETE / UNKNOWN`

1. Name the exact provider surface, app/account or test tenant, region/market, API version and intended read/write direction.
2. Identify the official source document and record its URL, retrieval date and relevant permission/review requirements. Do not treat a blog, generated example or UI observation as a contract.
3. Record an evidence row with: `TEST_ID`, date, provider, API/version, endpoint/method, permission, request shape, response-schema hash, observed behavior, limits, result, open questions and evidence location.
4. Keep credentials outside the repository and outside reports. Redact tokens, cookies, authorization headers, PII and customer content from retained fixtures and telemetry.
5. Mark each conclusion separately as `documented`, `recorded historical observation`, `live verified`, or `unknown`. A historical note cannot be silently upgraded to live verification.
6. Add both positive and negative/malformed/cancellation cases where the surface can mutate or deliver events. Preserve raw evidence immutably and record hash/checksum rather than rewriting it.
7. Reconcile the result with the anti-corruption envelope and idempotency requirements before proposing code. A provider-specific success does not prove canonical semantic equivalence.

### 5.2 Refresh cadence and triggers

- Refresh before each implementation slice, after a vendor version/deprecation notice, and before any credential or permission review.
- Re-open the official source when an endpoint, field, auth method, webhook event, region, app-review rule or rate limit is used in a design.
- Re-run provider checks after material schema or account changes; do not extend an old result by assumption.
- Keep a dated change log and link every production connector decision to the exact evidence rows it consumed.

### 5.3 Evidence acceptance gates

- **Pancake PH4:** public read credential and supported read endpoint; termination/order-safe paging; raw immutable envelope and conflict handling; redaction; and a separate Q-04 result for webhook semantics. Until all are recorded and reviewed, retain `PARTIAL`, `PH4 OFF`, and manual fallback.
- **Meta/TikTok:** endpoint-level method/path/version plus permission, review/eligibility, schema, pagination/limits, identity mapping and negative-case evidence. Family-level catalog rows remain candidates.
- **CRM/order/channel providers:** provider-specific mapping and ownership review must precede any write path. Canonical semantics stay in this platform; adapters translate and preserve unknowns.

## 6. Repository sources used

- `docs/implementation-plan/phases/PH4-pancake-sync.md`
- `docs/implementation-plan/spike/pancake-verdict.md`
- `docs/implementation-plan/spike/Q-03-pancake-api-feasibility.md`
- `docs/implementation-plan/spike/Q-04-webhook-semantics.md`
- `docs/implementation-plan/spike/manual-adapter-spec.md`
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/COVERAGE.md`
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/SCOPE_AND_COMPLETENESS.md`
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/REMAINING_GAPS.md`
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/AUDIT_RESULT.md`
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/VERIFICATION_LOG_v2.md`
- `docs/external-apis/pancake/api-knowledge-base-2026-09-10/04_CROSS_PLATFORM/API_FEASIBILITY_TEST_PLAN.md`
- `docs/canonical/INTEGRATION_PRINCIPLES.md` (cited normative boundary; not modified)
- `docs/canonical/DOMAIN_INVARIANTS.md` (cited normative boundary; not modified)
- `docs/canonical/ARCHITECTURE_CONSTITUTION.md` (cited provider-boundary rule; not modified)
- `docs/Dinh_nghia_bai_toan_V2.md` (product framing references to Zalo and Sapo; not a provider contract)
- `https://developer.pancake.biz/` and `https://pos.pancake.biz/developers/api/en/webhooks` (official Pancake documentation; documentation evidence only)
- `https://docs.zaloplatforms.com/docs/OA` (official Zalo OA documentation; documentation evidence only)
- `https://github.com/facebook/facebook-nodejs-business-sdk` (Meta SDK source metadata; repository evidence only)
- `https://github.com/HubSpot/hubspot-api-nodejs` and `https://github.com/jsforce/jsforce` (CRM SDK source metadata; repository evidence only)
- `https://github.com/nguyennguyenit/Sapo-MCP` (Sapo source metadata; repository evidence only)
- `https://github.com/NangoHQ/nango` and `https://github.com/chatwoot/chatwoot` (framework/application source metadata; repository evidence only)

## 7. Explicit non-claims

This artifact does not claim current access to any provider, successful authentication, endpoint availability, webhook delivery, schema stability, permission approval, rate-limit behavior, CRM/order linkage, attribution accuracy, revenue reconciliation, or customer-data correctness. It does not authorize PH4, production deployment, private-endpoint use, credential use, or edits to canonical documents.
