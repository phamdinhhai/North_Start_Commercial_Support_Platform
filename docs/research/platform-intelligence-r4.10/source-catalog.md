# R4.10 verified research source catalog

Checked2026-11-20. Research candidates were supplied in the owner catalog (read-only original path and SHA256 in baseline-assessment.md); they are not automatically working endpoints, licensed components, provider-authorized accounts or product connectors. No private provider accounts/tokens/cookies were used.

| Group | Verified evidence | Exact details and limitations |
|---|---|---|
| Pancake conversations/API/webhook/POS | Anonymous HTTP bodies downloaded, SHA256 pinned, YAML parsed/local refs resolved; full OpenAPI validators FAIL documented defects | pancake-deep-research.md; pancake-capability-matrix.md. REST180475bytes, webhook38933bytes, versions1.0.0/OAS3.0.0. No authenticated API conformance. |
| Meta Page and Instagram account types | Official docs extracts plus exact pinned first-party messenger sample source and license | social-platform-research.md. Synthetic decoder implements restricted incoming text subset; no live webhook authenticity/rights claim. |
| TikTok/Zalo/WhatsApp/LINE/Telegram | Official capability/permission/portability references, source-specific access limits | provider-capability-matrix.md and personal-account-feasibility.md. Creator/personal/business grants not interchangeable. TikTok inaccessible rendered bodies in Ads research are discovery only. |
| Personal Zalo community libraries | Four repository revisions/source/license inspection, no execution/account sessions | personal-account-feasibility.md. Missing or conflicting license/terms remains unresolved; no dependency adopted. |
| Ads/acquisition/commerce |13official surfaces with retrieval/access/version notes | ads-revenue-research.md. Currency/scale/timezone/attribution/reporting-adjustment semantics kept distinct. Fabricated money tests do not validate official payloads. |
| Chatwoot/Activepieces/Nango/AirbyteCDK | P0 exact upstream pins, actual implementation+tests+license/dependency inspection | source-inspections.md lists13pins/80successfulfileGETs and hashes across P0/P1. Upstream tests read, not run. No source copied. |
| Twenty/Frappe/ERPNext/erxes/n8n/Svix | Bounded selected source/package/license inspection | open-source-reuse-matrix.md and license-review.md; not an exhaustive tree/dependency audit or legal permission. |
| CloudEvents/AsyncAPI/StandardWebhooks | Pinned spec/library-specific licenses and selected contract source | source-inspections.md. Vocabulary selectively adapted, no conformance or signature-support claim for providers. |
| Salesforce | First-party replay documentation fetched/hash recorded | Opaque noncontiguous replay token and documented retention; no Salesforce integration. |
| HubSpot | Two official URL bodies HTTP403 | Claims about journal availability, retention and snapshots DEFERRED. |
| OneChat | Ambiguous product/upstream identity | NOT VERIFIED; exact upstream URL required before source/license/reuse conclusion. |
| GitHub Actions | Official releases/ref SHAs/action.yml/runner requirements | integration-inventory.md P2 table; runtime Node24 vs applicationNode22 separated. Upgrade DEFERRED, no workflow runtime changed. |

Maturity vocabulary: DOCUMENTED -> SOURCE INSPECTED -> CONTRACT VALIDATED (only tested subset, not whole failing spec) -> SYNTHETIC IMPLEMENTED -> SYNTHETIC E2E VERIFIED (exact-revision durable/browser evidence required). PROVIDER AUTHORIZED, AUTHORIZED SANDBOX VERIFIED, LIVE VERIFIED and PRODUCTION APPROVED are all NO for new R4.10 paths. A successful anonymous docsGET is research, never provider integration verification.

Public documentation hashes are provenance for research bytes, not customer-body digests. Accepted synthetic content uses existing workspace-keyed HMAC, never copied upstream unkeyed-body hashing. Research downloads remain in OS-temp, outside source and pilot resources. No AGPL/GPL/ELv2/SUL/ambiguous source has been incorporated.

Additional first-partySDKpins: Meta facebook-nodejs-business-sdk andTikTok tiktok-business-api-sdk actualauth/requestsource,license/package/testsinspected in social-platform-research.md. Marketing/BusinessSDKscope nevergrants personalinboxpermissions. Meta customrestricted grant andTikTokroot/package licenseconflict prohibit a permissive reuse assumption.
