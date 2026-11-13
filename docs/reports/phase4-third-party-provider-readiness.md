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
| **Pancake Chat / Public API** | KB snapshot has a relatively deep Pancake endpoint catalog; PH0/PH4 spike documents describe read-only conversations, messages, customers, paging, raw envelope and checkpoint concerns. | **PARTIAL** | No current production credential, endpoint contract, stable schema/version, replay/idempotency proof, or complete webhook contract is established. | Keep PH4 feature flag **OFF**. Continue manual/synthetic loop and polling as a bounded fallback only after a new approved verification pass. |
| **Meta** | Audited KB v2 inventories Meta families and gives deeper coverage for Messenger, Instagram, Marketing/Ads, WhatsApp, Threads, Lead Ads, and related surfaces. | **INCOMPLETE for this product / partial catalog evidence** | Catalog depth is not a live app/account permission result. No provider-specific production adapter, current credential, account eligibility, join coverage, or end-to-end contract is established here. | Treat the KB as a research index. Verify exact surface, version, permission, review and account scope before any adapter work. |
| **TikTok** | Audited KB v2 inventories TikTok for Developers, API for Business, Business Messaging, Events/Measurement, Shop and related families; exact endpoints are retained only where the snapshot says they were explicit. | **INCOMPLETE for this product / partial catalog evidence** | Market/partner/app eligibility, current version, permissions, webhook behavior, identity joins and live payloads are not established. | Keep family-level findings as candidates only. Require endpoint-level and eligibility evidence for any implementation. |
| **Anthropic / Data Manager** | No provider contract, adapter, fixture, permission map, or readiness test was found in the repository for this requested surface. One archived conversation reference mentions Anthropic only as model/provider context, not as an implemented integration. | **INCOMPLETE / UNKNOWN** | No data-access model, tenancy boundary, retention behavior, API/schema, credential handling, event semantics, or product requirement is established. | Do not create a connector or infer “Data Manager” semantics. Open a separately scoped research request with an approved source and evidence owner. |
| **Zalo OA** | Zalo is mentioned as a possible Sales/channel context in product framing and service-model material. | **INCOMPLETE / UNKNOWN** | No Zalo OA endpoint catalog, auth/permission model, message schema, webhook contract, identity mapping, or live/test evidence is present. | Keep Zalo as a channel hypothesis. Use operator-confirmed/manual evidence; do not infer an adapter contract from the mention. |
| **Sapo** | Sapo appears in problem framing as a possible place where order, payment or revenue may be recorded. | **INCOMPLETE / UNKNOWN** | No Sapo API, credential, order schema, webhook, reconciliation, revenue semantics, or adapter test evidence is present. | Treat Sapo as a possible downstream system only. Do not map Sapo fields to canonical revenue or outcome semantics. |
| **HubSpot** | Canonical architecture and research material name HubSpot as an optional CRM integration boundary, not as the domain owner. | **INCOMPLETE / UNKNOWN** | No current API/version, object mapping, permission, write policy, fixture, adapter, or live verification is present. | Preserve the anti-corruption boundary. Require a provider mapping decision before any CRM work. |
| **Salesforce** | Canonical architecture and research material name Salesforce as an optional CRM integration boundary. | **INCOMPLETE / UNKNOWN** | No current API/version, object mapping, permission, write policy, fixture, adapter, or live verification is present. | Preserve the anti-corruption boundary. No CRM semantics or ownership may be inherited from the name alone. |
| **Zoho** | No Zoho-specific contract, adapter, fixture, or readiness evidence was found in the repository. | **INCOMPLETE / UNKNOWN** | No API/version, auth, object model, mapping, permissions, or live evidence is established. | Keep out of implementation scope until a separate evidence-backed provider assessment exists. |

### Status interpretation

The rows for Anthropic/Data Manager, Zalo OA, Sapo, HubSpot, Salesforce and Zoho are intentionally not scored as “not supported.” Their status is **unknown because provider-specific evidence is absent or insufficient**. This preserves I-08 (visible unknowns) and avoids turning product framing or a provider name into a contract.

## 3. Cross-provider findings

1. **No provider owns canonical commercial meaning.** The integration boundary remains an anti-corruption boundary. Provider IDs, tags, stages, assignments, CRM objects and channel labels must not be silently promoted to Lead identity, Commercial Event truth, Sales ownership, outcome, revenue or attribution.
2. **Pancake is the only provider with a dedicated PH4 gate and spike verdict in the repository.** That evidence still says `PARTIAL`; it does not make the other providers ready by analogy.
3. **Meta and TikTok KB breadth is useful for discovery, not proof of access.** The KB distinguishes endpoint-level evidence from family-level evidence and warns that restricted capabilities and version changes require a new check.
4. **No CRM or order-system readiness is demonstrated.** Mentions of Sapo, HubSpot or Salesforce describe possible system roles, not verified integrations. Zoho has no provider-specific evidence in the repository.
5. **Manual/synthetic operation remains the safe continuity path.** It must stay available when a provider is unavailable, unverified, or deliberately disabled; synthetic data must remain visibly segregated from real pilot evidence.

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

## 7. Explicit non-claims

This artifact does not claim current access to any provider, successful authentication, endpoint availability, webhook delivery, schema stability, permission approval, rate-limit behavior, CRM/order linkage, attribution accuracy, revenue reconciliation, or customer-data correctness. It does not authorize PH4, production deployment, private-endpoint use, credential use, or edits to canonical documents.
