# Ads capabilities and integration priority

Working research, 2026-11-17. Evidence: DOCUMENTED_API and SOURCE_INSPECTED only. No authenticated provider calls, SDK installation, upstream test execution or live writes. Exact revisions, source hashes and function inventory are in `ads-source-registry.json`. The adaptive-integration source ledger was consulted for evidence discipline; it establishes no ads access.

## Recommendation

Prioritize read-only acquisition context supporting commercial handoff: campaign/ad IDs, account currency/timezone, daily delivery/spend and extraction health. Start with one approved provider/account and synthetic contracts. Defer campaign mutation and outcome exports. Customer, Lead, conversation source, acquisition lineage and revenue attribution remain distinct (I-01/I-02/I-07). Provider conversion metrics are measurement assertions, not evidence of causal revenue impact. MM-1 stays UNKNOWN with reason; token scopes do not resolve PM-1 or identity thresholds.

| Candidate | Inspected source contract | Priority and gates |
|---|---|---|
| Meta official Python Business SDK | `AdAccount.get_insights/get_insights_async`, `FacebookAdsApi.call`, integration tests including `test_get_insights` and invalid parameters | Reporting first; authorized ad account, `ads_read`, applicable app review/access tier. Mutations require separate `ads_management` approval |
| TikTok official Business SDK | `ReportingApi.report_integrated_get`, report task create/check/cancel; `AuthenticationApi.oauth2_access_token/oauth2_advertiser_get`; campaign get/create/update/status methods | Reporting after approved Business API app, advertiser consent, Reporting permission and token. Generated method presence does not establish entitlement |
| Google Ads Python | `GoogleAdsClient.load_from_dict/get_service/get_type`, get-campaigns example, `tests/client_test.py` | GAQL reporting with authorized customer hierarchy, OAuth and current project/API access setup |
| Google Data Manager API | DOCUMENTED_API only; no SDK source inspected | Future offline-outcome ingestion, gated by account rights, Cloud API setup, consent and separate write approval |
| Google official Ads MCP | `search`, `list_accessible_customers`, `propose_and_confirm`, audit middleware, checksum tests | Reference guarded action pattern; no automatic mutation-tool activation |

Python SDKs are reference contracts or isolated adapter dependencies, not justification to move the TypeScript domain core. No third-party OmniAds repository is necessary for the first slice.

## Pins, licenses and maintenance

All four repositories were non-archived at inspection. Meta `b08e5c1d36a2adad3c4ede6578654c8eaca5f225`, last push 2026-11-05: Meta-specific LICENSE limits use to connection with Meta services; GitHub NOASSERTION is not MIT/Apache. TikTok `f809c396520df2d7b201a9ccc5378d822b728ed3`, last push 2026-03-09: MIT. Google Ads Python `f253b400dc5924b731fcb42dbcd99e485200581e`, last push 2026-11-11: Apache-2.0. Google Ads MCP `b2b5d54616e4fbb410df9b4116319e1ef22f75fa`, last push 2026-11-16: Apache-2.0. A recent push is not a compatibility or security certification. Registry links identify exact source files and SHA-256 hashes.

Meta Insights parameters include attribution windows, action report time, breakdowns, date ranges and account attribution settings. TikTok reporting accepts advertiser(s), dimensions, metrics, dates, pagination and multi-advertiser UTC reporting. These do not automatically make reports comparable. Meta integration tests and Google client tests were inspected, not run. No relevant TikTok behavioral test was inspected; generated transport code is insufficient proof of report semantics.

## Current documentation findings

* Meta ad-account reference currently resolves to Graph v27.0. Rate limits depend on access tier/use case and usage headers; do not freeze a universal QPS. Verify granted app access in a read-only spike. [Account reference](https://developers.facebook.com/docs/graph-api/reference/ad-account/), [limits](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/).
* TikTok current reporting documentation exposes v2.0 while inspected generated SDK source has v1.3 references. Pin endpoint/version explicitly. Async report creation documents 1 QPS per app; that is not a universal TikTok quota. [Reference](https://business-api.tiktok.com/portal/docs/api-reference/v2.0), [sync reporting](https://business-api.tiktok.com/portal/docs/run-a-synchronous-report/v2.0), [async report](https://business-api.tiktok.com/portal/docs/create-an-asynchronous-report-task/v2.0).
* Google ChangeStatus is queried/polled, not a webhook. Query dates must be within 90 days and LIMIT at most 10,000. It does not replace metrics refresh or gap reconciliation. [ChangeStatus](https://developers.google.com/google-ads/api/docs/change-status).
* Data Manager is Google's ingestion product, not a generic multi-provider data manager. Current docs direct new offline conversion/enhanced-conversions-for-leads implementations to it from June 15, 2026. Existing Google Ads API compatibility is conditional: no upload activity between December 17, 2025 and June 15, 2026 causes CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE. Legacy developer tokens sunset September 9, 2026; this is not a blanket offline-import sunset. Verify actual project eligibility. [Compatibility](https://developers.google.com/google-ads/api/docs/conversions/upload-offline), [official announcement](https://developers.google.com/ads/blog/posts/2026/05/changes-to-offline-click-conversion).
* Data Manager documents 100,000 requests/day and 300/minute per Cloud project. Access requires enabled Cloud API and authorized Google account; API keys are unsupported and user OAuth verification may apply. These are ingestion quotas, not Ads reporting quotas. [Limits](https://developers.google.com/data-manager/api/devguides/limits), [access](https://developers.google.com/data-manager/api/devguides/quickstart/set-up-access).

## Proposed read contract

Preserve immutable raw response and provider/API version, account/object IDs, fields/filters, report dimensions, account timezone/currency, interval, attribution/report-time settings, extracted_at, pagination/job state and request IDs. Never include tokens. IDs are opaque strings; money uses exact decimal/explicit scale, retaining Google micros. Cross-currency totals require approved FX policy and provenance.

Append observations keyed by provider/account/object/interval/dimensions/metric/report configuration plus observation time. Late conversions, invalid traffic and restatements create revisions, never overwrite raw evidence. Date completion does not mean metrics finality. Poll with overlaps, checkpoints, bounded retry/backoff and reconciliation; surface gaps and unknown timezone/windows. Provider conversion counts remain namespaced. A conversation ad reference supports an evidence-backed acquisition-lineage assertion, not customer merge, canonical WON or revenue credit.

## Guarded action reference, deferred

Google MCP `propose_and_confirm` optionally validates, produces readable change items and a deterministic checksum bound to customer ID and exact operations, and rejects missing/mismatched checksums before commit. Tests cover determinism, round trip, mismatches and exceptions. This prevents argument drift; an unkeyed checksum proves neither human authorization nor a prior validation call.

A future adapter additionally needs a server-owned expiring, single-use proposal bound to tenant/actor/account/operation/frozen arguments/before-state; explicit preview and human authorization; execution-time policy and provider permission checks; stale-state/replay denial; spend limits and kill switch; result readback; sanitized append-only audit and partial-failure handling. Reversal requires a separately authorized compensation when supported; spent money cannot be promised reversible. AI remains draft-only. This report authorizes no live write or privilege expansion.

## Next slice and acceptance

1. Select one provider and named test account with owner consent, app approvals, scopes and pinned endpoint. Record DENIED/UNKNOWN instead of broadening PM-1.
2. Build an isolated read-only account-metadata plus campaign/ad daily-spend adapter. No canonical migration, identity merge or commercial-state transition.
3. Synthetic contracts cover decimal/micros scaling, timezone boundaries, missing lineage, currency mismatch, pagination/task resume, quota backoff, late correction append, tenant/account mismatch, redaction and duplicates. Mark fixtures SYNTHETIC.
4. Authorized read-only spike proves actual granted fields, report settings, pagination and reconciliation, retaining sanitized request IDs/errors. Success is useful handoff context, not a cross-network ROAS promise.

No runtime spike was added: synthetic output would not remove the account-approval uncertainty. Runtime and canonical files were not modified. Source inspection and JSON validation are the checks for this documentation slice; provider behavior remains unverified live.
