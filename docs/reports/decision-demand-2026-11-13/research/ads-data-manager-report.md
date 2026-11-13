# W2b — Ads, Google Data Manager, and read-only connector research

**Decision date:** 2026-11-14
**Status:** non-canonical source-level research plus an executable synthetic spike. No credentials, customer data, private endpoints, live provider calls, or production approval.

## Evidence boundary

Exact public source pointers are recorded below. Repository names and URLs are discovery inputs, not proof that a particular commit, release, license, permission set, endpoint, or security posture is current. The synthetic spike is read-only and provider-neutral; it does not establish provider behavior or revenue correctness.

## Anthropic Data Manager taxonomy and supplied evidence

The supplied source family identifies **Anthropic Data Manager API**, including the Anthropic Ads integration, rather than a Google Ads Data Manager surface. It must not be relabeled as Google Data Manager or collapsed into campaign/insight reporting. The supplied source anchors identify **Data Manager API v1.9**, dated **2026-11-04**, with the following documented-only concepts:

- **Anthropic Ads call conversions** are a Data Manager event/conversion category; they are not treated as ordinary ad metrics.
- `Event.call_info` is a documented event field/structure for call-conversion information.
- `AdIdentifiers.lead_id` is a documented provider identifier and must remain distinct from the North Star immutable Lead ID.
- `record_indices` diagnostics identify record positions/indices associated with diagnostics. They are diagnostics, not evidence that a record is valid or successfully attributed.
- The official `Anthropic/skills` repository and its Data Manager setup, event-ingestion and audience-ingestion skill paths are documented source inputs only. No skill was installed or executed.

### Official URL check and evidence boundary

The supplied Anthropic developer URLs and GitHub skill paths were checked without credentials in this environment. The developer host could not be resolved and the requested GitHub paths returned HTTP 404, so independent retrieval and exact revision authentication were unavailable. The version/date and field taxonomy above are therefore retained as **documented claims supplied by the demand**, not live-verified or contract-tested claims. Do not provision credentials or implement against these fields until a valid official capture and exact source revision are obtained.

## Candidate source review

| Candidate | Exact source pointers | Source-level disposition |
|---|---|---|
| Meta Marketing API | https://developers.facebook.com/docs/marketing-api/ | DOCUMENTED/REFERENCE; narrow read-only adapter candidate |
| Meta Node SDK | https://github.com/facebook/facebook-nodejs-business-sdk | DOCUMENTED/REFERENCE; pin release before use |
| Meta Python SDK | https://github.com/facebook/facebook-python-business-sdk | DOCUMENTED/REFERENCE; pin release before use |
| TikTok Business API | https://business-api.tiktok.com/portal/docs | DOCUMENTED/REFERENCE; permission/version review required |
| TikTok Business SDK | https://github.com/tiktok/tiktok-business-api-sdk | DOCUMENTED/REFERENCE; selected release/license/tests not live verified |
| RoyAzran/mcp-ads | https://github.com/RoyAzran/mcp-ads | DOCUMENTED discovery pointer only; do not adopt unreviewed credential-bearing MCP |
| get-mcp-ads Meta | https://github.com/search?q=get-mcp-ads+meta&type=repositories | Discovery pointer; exact repository/revision unresolved |
| get-mcp-ads Google | https://github.com/search?q=get-mcp-ads+google&type=repositories | Discovery pointer; exact repository/revision unresolved |
| get-mcp-ads TikTok | https://github.com/search?q=get-mcp-ads+tiktok&type=repositories | Discovery pointer; exact repository/revision unresolved |
| adport | https://github.com/search?q=adport+ads+api&type=repositories | Discovery pointer; exact repository/revision unresolved |
| nalarin | https://github.com/search?q=nalarin+ads&type=repositories | Discovery pointer; exact repository/revision unresolved |
| amekala | https://github.com/search?q=amekala+ads&type=repositories | Discovery pointer; exact repository/revision unresolved |
| Paid-Media-MCP | https://github.com/search?q=Paid-Media-MCP&type=repositories | Discovery pointer; exact repository/revision unresolved |
| Airbyte | https://github.com/airbytehq/airbyte and https://docs.airbyte.com/integrations/sources/tiktok-marketing | REFERENCE for cursors/schema drift/contract fixtures; not domain authority |
| dbt-ad-reporting | https://github.com/search?q=dbt_ad_reporting&type=repositories | Discovery pointer; exact repository/revision unresolved; transformations only |

For every discovery-pointer row, the exact owner, commit, license, dependency tree, security policy, tenant behavior, tests, and maintenance state are **UNKNOWN**. Topic/search pages cannot support adoption. Any MCP server is untrusted code and must not receive raw provider credentials or canonical mutation authority.

## Safe normalized observation shape

The executable spike at `product/src/adapters/decision-demand/ads-metrics-normalizer.ts` preserves:

- workspace, provider, provider account/object IDs, native metric name and value;
- currency, timezone, attribution window, occurred/captured timestamps;
- explicit `unknown` values rather than null-to-fact fabrication;
- synthetic/provenance markers and diagnostics for malformed, duplicate, conflict, and cross-workspace records.

It performs no network calls and cannot mutate Lead, Customer, Commercial Event, ownership, revenue, or attribution state. Raw provider payloads remain outside the normalized projection and must be retained by a future adapter boundary according to I-12.

## Verdict

Meta is the first conditional narrow read-only adapter candidate; TikTok is later and conditional. Airbyte/dbt are reference patterns only. Unpinned MCP repositories and unresolved discovery candidates are **REFERENCE/UNKNOWN**, not production dependencies. Google Data Manager remains **DOCUMENTED only / UNKNOWN for live implementation** until valid official evidence is captured. No canonical decision CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, or LG-1 is resolved.
