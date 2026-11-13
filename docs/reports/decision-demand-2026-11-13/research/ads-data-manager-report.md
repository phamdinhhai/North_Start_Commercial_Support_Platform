# W2b — Ads, Google Data Manager, and read-only connector research

**Decision date:** 2026-11-14
**Status:** non-canonical source-level research plus an executable synthetic spike. No credentials, customer data, private endpoints, live provider calls, or production approval.

## Evidence boundary

Exact public source pointers are recorded below. Repository names and URLs are discovery inputs, not proof that a particular commit, release, license, permission set, endpoint, or security posture is current. The synthetic spike is read-only and provider-neutral; it does not establish provider behavior or revenue correctness.

## Google Data Manager taxonomy and supplied evidence

The correct product name used by the supplied demand is **Google Data Manager API**. It is not a generic “Google Ads reporting API” and should not be collapsed into campaign/insight reporting. The supplied source anchors identify **Data Manager API v1.9**, dated **2026-11-04**, with the following documented-only concepts:

- **Call conversions** are a Data Manager event/conversion category; they are not treated as ordinary ad metrics.
- `Event.call_info` is a documented event field/structure for call-conversion information.
- `AdIdentifiers.lead_id` is a documented identifier field and must remain a provider identifier, not the North Star immutable Lead ID.
- `record_indices` diagnostics identify record positions/indices associated with diagnostics. They are diagnostics, not evidence that a record is valid or successfully attributed.
- Google skills are **DOCUMENTED only**: the demand names skills/documentation as a research surface, but no exact Google-maintained skills repository/revision was authenticated. No skill was installed or executed.

### Official URL check

The supplied Google URL family was checked without credentials. The requested pages were not accessible as authenticated, usable Google Data Manager reference material in this environment: the direct `developers.google.com/data-manager`, `/reference/rest`, `/reference/rest/v1`, and field pages returned HTTP 404 or malformed/unusable content. Therefore the version/date and field taxonomy above are retained as **documented-only claims from the supplied demand/source material**, not live-verified claims. Do not provision credentials or implement against these fields until a valid official capture is obtained.

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

The executable spike at `product/src/spikes/decision-demand/ads-metrics-normalizer.ts` preserves:

- workspace, provider, provider account/object IDs, native metric name and value;
- currency, timezone, attribution window, occurred/captured timestamps;
- explicit `unknown` values rather than null-to-fact fabrication;
- synthetic/provenance markers and diagnostics for malformed, duplicate, conflict, and cross-workspace records.

It performs no network calls and cannot mutate Lead, Customer, Commercial Event, ownership, revenue, or attribution state. Raw provider payloads remain outside the normalized projection and must be retained by a future adapter boundary according to I-12.

## Verdict

Meta is the first conditional narrow read-only adapter candidate; TikTok is later and conditional. Airbyte/dbt are reference patterns only. Unpinned MCP repositories and unresolved discovery candidates are **REFERENCE/UNKNOWN**, not production dependencies. Google Data Manager remains **DOCUMENTED only / UNKNOWN for live implementation** until valid official evidence is captured. No canonical decision CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, or LG-1 is resolved.
