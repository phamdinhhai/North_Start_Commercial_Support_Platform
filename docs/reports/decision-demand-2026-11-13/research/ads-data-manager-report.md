# W2b — Ads, Google Data Manager, and read-only connector research

**Decision date:** 2026-11-14
**Status:** non-canonical source-level research plus an executable synthetic spike. No credentials, customer data, private endpoints, live provider calls, or production approval.

## Evidence boundary

Exact public source pointers are recorded below. Repository names and URLs are discovery inputs, not proof that a particular commit, release, license, permission set, endpoint, or security posture is current. The synthetic spike is read-only and provider-neutral; it does not establish provider behavior or revenue correctness.

## Google Ads Data Manager taxonomy and supplied evidence

The integration surface belongs exclusively to **Google Data Manager API** in the **Google Ads** ecosystem. It must not be collapsed into campaign/insight reporting or confused with legacy offline-upload surfaces. Independent retrieval via `curl` and `gh api` on **2026-11-14T05:49:51Z** directly verified the following **DOCUMENTED** facts from Google's official pages and repository:

- **Release v1.9 (2026-11-04):** `https://developers.google.com/data-manager/api/reference` (HTTP 200 OK) states: *"Added support for sending Google Ads call conversions. Added the `call_info` field to `Event`. Use the `start_timestamp` field of `CallInfo` to specify when the phone call that led to the conversion started... Added the `record_indices` field to `ErrorCount` and `WarningCount` to identify the records in the ingestion request that had each processing error or warning... Added the `lead_id` field to `AdIdentifiers` to support sending the Google-generated ID issued when a user submits a lead form."*
- **REST v1 schema (`events/ingest.md.txt` & `requestStatus/retrieve.md.txt`, HTTP 200 OK):**
  - `Event.callInfo` (`CallInfo { "startTimestamp": string }`, RFC 3339 required when present)
  - `AdIdentifiers.leadId` (`string` optional, Google-generated ID issued when user submits a lead form — must remain a provider identifier, never the North Star immutable Lead ID)
  - `ErrorCount.recordIndices[]` and `WarningCount.recordIndices[]` (`integer` 0-based indices of records in the original request — diagnostics only, not proof of validity or attribution)
- **Official `google/skills` repository (`HTTP 200`, Apache-2.0, `main` HEAD `67c4dbc8ff6313ef117d938e53bb21315fc281ae`):** verified presence and file blobs for:
  - `skills/ads/data-manager-api-setup/SKILL.md` (sha `bc390439db829fbd383420ad9c97947a6738a831`)
  - `skills/ads/data-manager-api-event-ingestion/SKILL.md` (sha `f440dc32525d4187ed5864aa549c42cca8ed9912`)
  - `skills/ads/data-manager-api-audience-ingestion/SKILL.md` (sha `ad7e9bc76a99abf9b3bb062de8fe6591813cddb8`)
  - No skill was installed or executed.

### Official URL retrieval and maturity boundary

| Field/claim | Official Source URL | Retrieved at (UTC) | Access status | Maturity (`DOCUMENTED` / `CONTRACT_TESTED` / `LIVE_VERIFIED`) |
|---|---|---|---|---|
| Release v1.9, date 2026-11-04, call conversions | https://developers.google.com/data-manager/api/reference | 2026-11-14T05:49:51Z | HTTP 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |
| `Event.callInfo` (`CallInfo.startTimestamp`) & `AdIdentifiers.leadId` | https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest.md.txt | 2026-11-14T05:49:51Z | HTTP 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |
| `recordIndices` (`ErrorCount` & `WarningCount`) | https://developers.google.com/data-manager/api/reference/rest/v1/requestStatus/retrieve.md.txt | 2026-11-14T05:49:51Z | HTTP 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |
| `google/skills` repo (Apache-2.0, `67c4dbc8ff6313ef117d938e53bb21315fc281ae`) | https://github.com/google/skills | 2026-11-14T05:49:51Z | GitHub API 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |
| Setup skill (`SKILL.md` `bc390439`) | https://github.com/google/skills/tree/main/skills/ads/data-manager-api-setup | 2026-11-14T05:49:51Z | GitHub API 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |
| Event-ingestion skill (`SKILL.md` `f440dc32`) | https://github.com/google/skills/tree/main/skills/ads/data-manager-api-event-ingestion | 2026-11-14T05:49:51Z | GitHub API 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |
| Audience-ingestion skill (`SKILL.md` `ad7e9bc7`) | https://github.com/google/skills/tree/main/skills/ads/data-manager-api-audience-ingestion | 2026-11-14T05:49:51Z | GitHub API 200 OK | `DOCUMENTED` / `UNKNOWN` / `UNKNOWN` |

**Superseded historical note:** earlier drafts misattributed the Data Manager surface to a wrong vendor due to a malformed fetch response. That misattribution is permanently retired and explicitly prevented from recurring by `registry-validation.mjs`; all Data Manager concepts remain `DOCUMENTED` only until contract fixtures and credential-bound tests are performed (`CONTRACT_TESTED = UNKNOWN`, `LIVE_VERIFIED = UNKNOWN`).

## Candidate source review

Full `SOURCE_VERIFIED` commit SHAs, licenses, source paths, test locations, and tenant risks for shortlisted omni-ads repositories are recorded in `docs/reports/decision-demand-2026-11-13/research/wp4-p1-02-shortlist-source-matrix.md`.

| Candidate | Canonical source pointer | Verified commit / tag | Source-level disposition |
|---|---|---|---|
| Meta Marketing API | https://developers.facebook.com/docs/marketing-api/ | — | `DOCUMENTED_API` / `REFERENCE`; narrow read-only adapter candidate |
| Meta Node SDK | https://github.com/meta/facebook-nodejs-business-sdk | `v26.0.3` (`246c937eb5c1272ed743db41a944900bee449be9`) | `SOURCE_VERIFIED` / `REFERENCE`; pin release before use |
| TikTok Business API | https://business-api.tiktok.com/portal/docs | — | `DOCUMENTED_API` / `REFERENCE`; permission/version review required |
| RoyAzran/mcp-ads | https://github.com/RoyAzran/mcp-ads | `v1.0.0` (`9acd8edaedef9879071e9291617f48b5f1c6d0c4`, MIT) | `SOURCE_VERIFIED` / `REFERENCE`; unreviewed credential-bearing MCP |
| get-mcp-ads Meta | https://github.com/get-mcp-ads/meta-ads-mcp-server | `v2.1.2` (`52fa3417b0695a96409e61333ab0eb0a5a6f9a13`, Apache-2.0) | `SOURCE_VERIFIED` / `REFERENCE`; read-focused MCP, needs allowlist & review |
| get-mcp-ads Google | https://github.com/get-mcp-ads/google-ads-mcp-server | `v2.1.2` (`bac137c8060fdc76dc7d5de44c715cc99c8ee8ae`, Apache-2.0) | `SOURCE_VERIFIED` / `REFERENCE`; requires MCC/account isolation review |
| get-mcp-ads TikTok | https://github.com/get-mcp-ads/tiktok-ads-mcp-server | `v2.1.2` (`1de86b0e41e2dca9a79db3abd949a7e871238bee`, Apache-2.0) | `SOURCE_VERIFIED` / `REFERENCE`; requires advertiser isolation review |
| adport | https://github.com/ynnickw/adport | `v0.9.0` (`9382eb06a3c6dfc9b25c8a2d197a2d2d8220d992`, Apache-2.0) | `SOURCE_VERIFIED` / `REFERENCE` (preview/core normalization patterns) |
| Nalarin | https://github.com/masgant99/nalarin-agentic-ads-studio | `c500cc5a132142ff3de815bf6d15c50d490ea522` (MIT) | `SOURCE_VERIFIED` / `REFERENCE`; human-approval pattern only |
| Paid-Media-MCP (amekala) | https://github.com/amekala/paid-media-mcp | unresolved in current GitHub pass | `UNKNOWN` / `REFERENCE` |
| Airbyte | https://github.com/airbytehq/airbyte and https://docs.airbyte.com/integrations/sources/tiktok-marketing | `v2.0.0` (`54fa546e7cfeb5c4124c3a5958574ce093288c15`, ELv2) | `SOURCE_VERIFIED` / `REFERENCE` for cursors/schema drift/contract fixtures |
| dbt-ad-reporting | https://github.com/fivetran/dbt_ad_reporting | `v2.8.1` (`11a70e55b81dcac0cefc8ce1e34e5cf1c95e0475`, Apache-2.0) | `SOURCE_VERIFIED` / `REFERENCE` (transformations only, not ingestion) |

Any external MCP server is untrusted code and must not receive raw provider credentials or canonical mutation authority.

## Safe normalized observation shape

The hardened spike at `product/src/adapters/decision-demand/ads-metrics-normalizer.ts` preserves:

- workspace, provider (`google` | `meta` | `tiktok`), provider account/object IDs, canonical and native metric names, and numeric value;
- currency, timezone, date granularity (`hour` | `day` | `week` | `month` | `lifetime` | `unknown`), attribution window, occurred/captured timestamps;
- provider source/version provenance (`sourceVersion`, `providerSurface`);
- injective JSON-tuple identity keys preventing delimiter collisions across distinct slices;
- explicit `unknown` values rather than null-to-fact fabrication;
- synthetic/provenance markers and diagnostics for malformed, duplicate, conflict, and cross-workspace records.

It performs no network calls and cannot mutate Lead, Customer, Commercial Event, ownership, revenue, or attribution state. Raw provider payloads remain outside the normalized projection and must be retained by a future adapter boundary according to I-12.

## Verdict

Meta is the first conditional narrow read-only adapter candidate; TikTok is later and conditional. Airbyte/dbt are reference patterns only. Unreviewed MCP repositories remain **REFERENCE**, not production dependencies. Google Data Manager API v1.9 and `google/skills` are **DOCUMENTED** (`HTTP 200` / GitHub API verified) with `CONTRACT_TESTED = UNKNOWN` and `LIVE_VERIFIED = UNKNOWN` until credential-bound tests are authorized. No canonical decision CE-1, CE-2, MM-1, ID-1, ID-2, PM-1, or LG-1 is resolved.
