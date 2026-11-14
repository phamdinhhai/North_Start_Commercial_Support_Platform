# W2c — CRM and domain-integration research

**Decision date:** 2026-11-14
**Status:** non-canonical source-level research (`SOURCE_VERIFIED` metadata via GitHub API, see `wp4-p1-02-shortlist-source-matrix.md`) plus an executable synthetic spike. No credentials, tenant login, customer data, private endpoints, live calls, or production approval.

CRM systems are adapters and projections. They do not own canonical Lead identity, Commercial Event scope, evidence policy, ownership, or revenue meaning. A CRM external ID must never rewrite the immutable internal Lead ID or imply Customer = Lead.

## Candidate review

| Candidate | Canonical source pointers & verified commit | Safe disposition |
|---|---|---|
| Twenty | https://github.com/twentyhq/twenty (`twenty/v2.58.0`, `1dd1c249ad213de6883be5296deb3bbba8420a22`, AGPLv3 + Section 7 exception) | `SOURCE_VERIFIED` / `REFERENCE`; conditional external projection only |
| erxes | https://github.com/erxes/erxes (`3.4.22`, `65713f856df421ddd40cde68300d5407b396d853`, AGPLv3 + SaaS clause) | `SOURCE_VERIFIED` / `REJECT`; SaaS anti-compete license restriction |
| OneChat | https://github.com/OneBook-ERP/OneChat (`v1.0.3`, `7c68fdf1e2115c434377897f1015c4b1117f8e14`, AGPL-3.0) | `SOURCE_VERIFIED` / `REJECT code reuse`; Frappe inbox `REFERENCE` only |
| Chatwoot | https://github.com/chatwoot/chatwoot (`v4.19.1`, `1ef1d2b45ae0a17a35c5f1bd055e4ddf04dadabf`, MIT outside `enterprise/`) | `SOURCE_VERIFIED` / `REFERENCE` for inbox/conversation projection |
| Frappe CRM | https://github.com/frappe/crm (`v16.0.3`, `73ec05a1712909ea2ad0e631e088baa5fa3ea4a5`, **AGPL-3.0**) | `SOURCE_VERIFIED` / `REJECT embedding` (`frappe/crm` is AGPL-3.0, distinct from MIT `frappe/frappe`) |
| HubSpot SDK/API | https://developers.hubspot.com/docs/api/overview and https://github.com/HubSpot/hubspot-api-nodejs (`568703577905e19a0c2708e1beb06bdc016feb9e`, Apache-2.0) | `SOURCE_VERIFIED` / conditional first **ADAPT** read/projection target |
| JSforce | https://github.com/jsforce/jsforce (`d0837cb343ddd44bcf59d8b0cee02175e2ba8c63`, MIT) | `SOURCE_VERIFIED` / conditional **ADAPT** Salesforce read adapter behind a narrow port |

Source-level verification establishes exact licenses, files and tests without executing external code or authenticating a tenant.

## Mapping rules

- Keep the internal immutable Lead ID. Store CRM object IDs as external mappings with provider, workspace, composite `externalIdentity`, field, source evidence ID, observed-at and confidence.
- `fieldAuthority` defaults to `unknown` when ID-2 has not been approved; `provider` authority means an observed provider value, not canonical truth.
- External object merges (`mergedIntoExternalId`) and reparenting (`parentExternalId` / `previousParentExternalId`) are surfaced as diagnostics (`EXTERNAL_OBJECT_MERGED`, `EXTERNAL_OBJECT_REPARENTED`) with `canonicalMergeApplied: false` (preserving I-01, I-06, ID-1, ID-2).
- Conversation/timeline text is a projection reference, not replacement for raw immutable envelope/evidence.
- Assignment/team/queue is not proof of canonical handoff recipient or ownership.
- Closed deal and amount are provider claims; canonical outcome/revenue attribution requires internal evidence and policy.
- CRM deletes/retention are observations and do not erase append-only internal audit history.

## Executable synthetic spike

`product/src/adapters/decision-demand/crm-external-id-mapper.ts` implements a read-only mapper covering all 7 providers (`twenty`, `erxes`, `onechat`, `chatwoot`, `frappe`, `hubspot`, `salesforce`), composite external identities with injective JSON-tuple keys, `fieldAuthority = 'unknown'` defaults, `contactLeadEquivalent: false`, external merge/reparenting diagnostics with `canonicalMergeApplied: false`, and malformed/duplicate/conflicting/cross-workspace diagnostics.

## Verdict

HubSpot is a conditional first **ADAPT** target for a read/projection adapter; JSforce is conditional when Salesforce is required. Twenty is an external projection reference only; Frappe CRM (`AGPL-3.0`), erxes (`AGPLv3`) and OneChat (`AGPL-3.0`) are rejected for embedding. No CRM candidate is a canonical source of Lead, Customer, Commercial Event, ownership, outcome or revenue semantics. ID-2 and ID-1 remain open.
