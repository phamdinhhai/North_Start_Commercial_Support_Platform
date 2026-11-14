# W2b — Ads, Google Data Manager, and read-only connector research

**Decision date:** 2026-11-14
**Status:** non-canonical source-level research plus an executable synthetic spike. No credentials, customer data, private endpoints, live provider calls, or production approval.

## Evidence boundary

Exact public source pointers are recorded below. Repository names and URLs are discovery inputs, not proof that a particular commit, release, license, permission set, endpoint, or security posture is current. The synthetic spike is read-only and provider-neutral; it does not establish provider behavior or revenue correctness.

## Google Ads Data Manager taxonomy and supplied evidence

The supplied source family identifies the **Google Data Manager API** in the Google Ads ecosystem. It must not be collapsed into campaign/insight reporting or confused with legacy offline-upload surfaces. The supplied source anchors identify **Data Manager API v1.9**, dated **2026-11-04**, with the following documented-only concepts:

- **Google Ads call conversions** are a Data Manager event/conversion category; they are not treated as ordinary ad metrics.
- `Event.call_info` is a documented event field/structure for call-conversion information.
- `AdIdentifiers.lead_id` is a documented Google Ads provider identifier and must remain distinct from the North Star immutable Lead ID.
- `record_indices` diagnostics identify record positions/indices associated with diagnostics. They are diagnostics, not evidence that a record is valid or successfully attributed.
- The official `google/skills` repository and its Data Manager setup, event-ingestion and audience-ingestion skill paths are documented source inputs only. No skill was installed or executed.

### Official URL check and evidence boundary

The supplied Google sources were checked without credentials in this environment on **2026-11-14**. Retrieval status is **UNAVAILABLE**: the developer reference and skill URLs could not be independently authenticated into a usable exact revision in this environment. The version/date and field taxonomy above are therefore retained as **documented claims supplied by the demand**, not live-verified or contract-tested claims. Do not provision credentials or implement against these fields until a valid official capture and exact source revision are obtained.

**Retrieval evidence (field-level, documented only):**

| Field/claim | Source URL | Retrieved at | Access status | Evidence status |
|---|---|---|---|---|
| API family, v1.9, date 2026-11-04 | https://developers.google.com/data-manager/api/reference | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |
| `Event.call_info` | https://developers.google.com/data-manager/api/reference | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |
| `AdIdentifiers.lead_id` | https://developers.google.com/data-manager/api/reference | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |
| `record_indices` | https://developers.google.com/data-manager/api/reference | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |
| setup skill | https://github.com/google/skills/tree/main/skills/ads/data-manager-api-setup | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |
| event-ingestion skill | https://github.com/google/skills/tree/main/skills/ads/data-manager-api-event-ingestion | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |
| audience-ingestion skill | https://github.com/google/skills/tree/main/skills/ads/data-manager-api-audience-ingestion | 2026-11-14 | UNAVAILABLE | DOCUMENTED / UNKNOWN |

**Superseded historical contradiction:** an earlier checkpoint incorrectly labeled this source family Anthropic Data Manager / Anthropic Ads. That statement is retained only as a superseded historical note in the checkpoint history; current taxonomy and registry identity are Google Ads / Google Data Manager. It is not evidence for the current contract.

## Candidate source review

| Candidate | Exact source pointers | Source-level disposition |
|---|---|---|
| Meta Marketing API | https://developers.facebook.com/docs/marketing-api/ | DOCUMENTED/REFERENCE; narrow read-only adapter candidate |
| Meta Node SDK | https://github.com/facebook/facebook-nodejs-business-sdk | DOCUMENTED/REFERENCE; pin release before use |
| Meta Python SDK | https://github.com/facebook/facebook-python-business-sdk | DOCUMENTED/REFERENCE; pin release before use |
| TikTok Business API | https://business-api.tiktok.com/portal/docs | DOCUMENTED/REFERENCE; permission/version review required |
| TikTok Business SDK | https://github.com/tiktok/tiktok-business-api-sdk | DOCUMENTED/REFERENCE; selected release/license/tests not live verified |
| RoyAzran/mcp-ads | https://github.com/RoyAzran/mcp-ads | DOCUMENTED discovery pointer only; do not adopt unreviewed credential-bearing MCP |
| get-mcp-ads Meta | https://github.com/get-mcp-ads/meta-ads-mcp-server | Canonical repository pointer; exact revision/license/dependencies unresolved |
| get-mcp-ads Google | https://github.com/get-mcp-ads/google-ads-mcp-server | Canonical repository pointer; exact revision/license/dependencies unresolved |
| get-mcp-ads TikTok | https://github.com/get-mcp-ads/tiktok-ads-mcp-server | Canonical repository pointer; exact revision/license/dependencies unresolved |
| adport | https://github.com/ynnickw/adport | Canonical repository pointer; exact revision/license/dependencies unresolved |
| nalarin | https://github.com/masgant99/nalarin-agentic-ads-studio | Canonical repository pointer; exact revision/license/dependencies unresolved |
| amekala | https://github.com/amekala/paid-media-mcp | Canonical repository pointer; exact revision/license/dependencies unresolved |
| Paid-Media-MCP | https://github.com/amekala/paid-media-mcp | Canonical repository pointer; exact revision/license/dependencies unresolved |
| Airbyte | https://github.com/airbytehq/airbyte and https://docs.airbyte.com/integrations/sources/tiktok-marketing | REFERENCE for cursors/schema drift/contract fixtures; not domain authority |
| dbt-ad-reporting | https://github.com/fivetran/dbt_ad_reporting | Canonical repository pointer; exact revision/license/dependencies unresolved; transformations only |

For every discovery-pointer row, the exact owner, commit, license, dependency tree, security policy, tenant behavior, tests, and maintenance state are **UNKNOWN**. Topic/search pages cannot support adoption. Any MCP server is untrusted code and must not receive raw provider credentials or canonical mutation authority.

## Safe normalized observation shape

The executable spike at `product/src/adapters/decision-demand/ads-metrics-normalizer.ts` preserves:

- workspace, provider, provider account/object IDs, native metric name and value;
- currency, timezone, attribution window, occurred/captured timestamps;
- explicit `unknown` values rather than null-to-fact fabrication;
- synthetic/provenance markers and diagnostics for malformed, duplicate, conflict, and cross-workspace records.

It performs no network calls and cannot mutate Lead, Customer, Commercial Event, ownership, revenue, or attribution state. Raw provider payloads remain outside the normalized projection and must be retained by a future adapter boundary according to I-12.

## Verdict

Meta is the first conditional narrow read-only adapter candidate; TikTok is later and conditional. Airbyte/dbt are reference patterns only. Unpinned MCP repositories and unresolved discovery candidates are **REFERENCE/UNKNOWN**, not production dependencies. Google Ads Data Manager remains **DOCUMENTED only / UNKNOWN for live implementation** until the supplied official evidence can be independently retrieved and its exact revision captured. No canonical decision CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, or LG-1 is resolved.
