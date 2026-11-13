# W2b — Ads and data-manager research report

**Decision date:** 2026-11-13
**Status:** non-canonical research; source-level desk review only. No live verification, API call, credential test, or private endpoint was performed.

## Decision frame

Ads integrations may provide acquisition evidence, but they must not become the source of truth for Lead identity, commercial state, or revenue attribution. The adapter must retain raw provider payloads, provider IDs and timestamps, expose UNKNOWN when fields are unavailable, and map into the product's anti-corruption boundary.

## Candidate review

| Candidate | Exact public source URLs | Source type / version or date | License | Maintenance / security / tests | Tenant and credential suitability | Useful capabilities | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|
| Meta Marketing API / Meta Business SDK | https://developers.facebook.com/docs/marketing-api/  /  https://github.com/facebook/facebook-python-business-sdk  /  https://github.com/facebook/facebook-nodejs-business-sdk | Official API docs and Meta-maintained SDK repositories; API/SDK version must be pinned at implementation time | SDK repository license is Apache-2.0 (confirm selected release); platform terms are separate | Official ecosystem and SDK tests are visible in source-level materials; current API version, permissions and advisories not live-verified | Business Manager/ad-account scoping and app credentials are available conceptually; server-side token storage, least privilege, rotation and webhook verification are mandatory | Campaign/ad-set/ad/insight reads, account identifiers, creative and delivery metadata | Permission review, rate limits, attribution windows, API version churn and incomplete conversion evidence; does not prove downstream revenue | **ADAPT** — narrow read-only acquisition adapter |
| TikTok Business API / SDK | https://business-api.tiktok.com/portal/docs  /  https://github.com/tiktok/tiktok-business-api-sdk  /  https://www.npmjs.com/search?q=tiktok%20business%20api | Official portal and public SDK source; selected API/SDK release must be pinned | **UNKNOWN** for each selected SDK until its repository/package metadata is checked | Public docs/SDK material exists; current maintenance, security and tests not live-verified | Advertiser/account scoping is plausible; credential handling and tenant isolation require a provider-specific review | Campaign and ad reporting, advertiser metadata, conversion-related endpoints depending on permission | Endpoint/version instability, permission approval, incomplete identity and conversion joins; no revenue semantics | **ADAPT** only as a later, read-only adapter |
| Airbyte TikTok connector | https://github.com/airbytehq/airbyte  /  https://docs.airbyte.com/integrations/sources/tiktok-marketing | GitHub and official connector docs; connector version/date must be pinned | Airbyte core/connectors use Apache-2.0 in upstream materials (confirm selected connector release) | Airbyte has public CI/test conventions; exact connector health and security posture not live-verified | Secret storage, workspace isolation and sync destination controls are deployment responsibilities; raw credentials must not enter this report or fixtures | Scheduled extraction and normalization into a warehouse | Batch sync latency, schema drift, connector-specific gaps and operational overhead; not an event/audit authority | **REFERENCE** for extraction patterns; **ADAPT** only if governed |
| dbt | https://github.com/dbt-labs/dbt-core  /  https://docs.getdbt.com/ | Official repository/docs; version/date must be pinned | Apache-2.0 for dbt-core (confirm selected release) | Mature public project with tests/docs patterns; current release/security state not live-verified | Credentials belong in the warehouse/orchestrator secret store; dbt itself is not a tenant boundary | Repeatable transformations, tests, lineage and metric models | Transformations can accidentally fabricate certainty or overwrite semantics; cannot replace immutable raw evidence | **ADAPT** for warehouse projections/tests, not ingestion or canonical state |
| Requested ads MCP repositories | https://github.com/topics/mcp-server  /  https://github.com/topics/marketing-api | Public topic/search pointers; individual repositories and versions are not fixed | **UNKNOWN** until each exact repository/release is selected | No live verification; maintenance/security/tests vary by repository | Credential and prompt/tool boundary suitability **UNKNOWN**; treat all tool servers as untrusted until reviewed | Could expose controlled read-only query tools to operators/agents | Topic listings are not evidence; MCP tools can create hidden authority, leak credentials, or blur draft-only boundaries | **REJECT** as an adoption basis; **REFERENCE** for discovery only |
| Google Data Manager | https://developers.google.com/data-manager  /  https://developers.google.com/data-manager/reference/rest | Intended official Google documentation and REST reference; **exact official evidence remains UNKNOWN because the supplied Google pages were malformed** | Google API terms apply; client-library license depends on selected library | Official page content could not be authenticated from the supplied malformed-page evidence; API version, tests and security posture therefore remain UNKNOWN | Do not provision or test credentials based on this report; tenant/scoping and consent semantics remain UNKNOWN | Potential first-party data activation/measurement workflows | Exact endpoint/schema/permission claims are deliberately not made; no equivalence to ads reporting is inferred | **REFERENCE / UNKNOWN** — defer decision until valid official evidence is captured |

## Safe integration shape

1. **Raw intake:** store provider payload bytes or a redacted hash plus provider/account/object IDs and provider timestamps; never fabricate missing campaign, identity or revenue fields.
2. **Normalization:** emit a typed acquisition observation with `sourceSystem`, `providerObjectId`, `capturedAt`, `occurredAt` (or explicit UNKNOWN), and `isSynthetic` where applicable.
3. **Policy boundary:** no ad connector can mutate Lead state, assign ownership, merge identity, close work, or claim revenue. Those actions require the existing Commercial Event and evidence/policy path.
4. **Warehouse projections:** dbt/Airbyte may build derived reporting tables, but transformations must preserve source lineage and UNKNOWN values.

## Synthesis for W2b

- **ADAPT:** Meta SDK/API is the first candidate for a narrow read-only pilot after permission and rate-limit review. TikTok remains conditional and should follow only after Meta's shape is proven.
- **REFERENCE/ADAPT:** Airbyte and dbt are infrastructure patterns, not domain authorities.
- **REJECT:** unpinned MCP repositories as a credential-bearing production dependency.
- **UNKNOWN:** Google Data Manager until a valid official page/reference capture is available. This is not a negative finding.

## Evidence and honesty boundary

The URLs are source pointers only. No live requests, authentication, provider-side tests, or production claims were made. The Google Data Manager row intentionally records UNKNOWN rather than filling malformed evidence with assumptions.
