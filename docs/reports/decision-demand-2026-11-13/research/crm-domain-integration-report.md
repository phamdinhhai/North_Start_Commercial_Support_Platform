# W2c — CRM and domain-integration research

**Decision date:** 2026-11-14
**Status:** non-canonical source-level research plus an executable synthetic spike. No credentials, tenant login, customer data, private endpoints, live calls, or production approval.

CRM systems are adapters and projections. They do not own canonical Lead identity, Commercial Event scope, evidence policy, ownership, or revenue meaning. A CRM external ID must never rewrite the immutable internal Lead ID or imply Customer = Lead.

## Candidate review

| Candidate | Exact public source pointers | Safe disposition |
|---|---|---|
| Twenty | https://github.com/twentyhq/twenty and https://twenty.com/developers | DOCUMENTED/REFERENCE; conditional projection adapter after license/deployment review |
| erxes | https://github.com/erxes/erxes and https://erxes.io/ | DOCUMENTED/REFERENCE; exact release/license/security/tenant behavior requires pinning |
| OneChat | https://github.com/search?q=OneChat+CRM&type=repositories | Discovery pointer; exact owner/revision unresolved, therefore UNKNOWN |
| Chatwoot | https://github.com/chatwoot/chatwoot and https://www.chatwoot.com/developers | DOCUMENTED/REFERENCE for inbox/conversation projection, not canonical semantics |
| Frappe CRM | https://github.com/frappe/frappe and https://github.com/frappe/erpnext | DOCUMENTED/REFERENCE; bounded projection candidate after site/role review |
| HubSpot SDK/API | https://developers.hubspot.com/docs/api/overview and https://github.com/HubSpot/hubspot-api-nodejs | DOCUMENTED/REFERENCE; best conditional first read/projection target |
| JSforce | https://github.com/jsforce/jsforce and https://jsforce.github.io/ | DOCUMENTED/REFERENCE; conditional Salesforce read adapter behind a narrow port |

For OneChat and any similarly named discovery result, no exact source can be treated as official without an owner, revision, license, security policy, and source tree. No repository was installed or executed.

## Mapping rules

- Keep the internal immutable Lead ID. Store CRM object IDs as external mappings with provider, workspace, field, source evidence ID, observed-at and confidence.
- `provider` field authority means an observed provider value, not canonical truth. `north-star` authority is reserved for internal facts. `unknown` and `conflicted` remain visible.
- Do not infer Customer/Lead equivalence from contact/customer rows, CRM merges, lifecycle stages, closed deals, or amounts.
- Conversation/timeline text is a projection reference, not replacement for raw immutable envelope/evidence.
- Assignment/team/queue is not proof of canonical handoff recipient or ownership.
- Closed deal and amount are provider claims; canonical outcome/revenue attribution requires internal evidence and policy.
- CRM deletes/retention are observations and do not erase append-only internal audit history.

## Executable synthetic spike

`product/src/spikes/decision-demand/crm-external-id-mapper.ts` implements a read-only mapper with provider/external ID/internal Lead ID, field authority, provenance, confidence and workspace scope. It diagnoses malformed, duplicate, conflicting and cross-workspace mappings while never performing network or domain mutation. Tests cover all of those cases and explicit UNKNOWN confidence/authority.

## Verdict

HubSpot is a conditional first ADAPT target for a read/projection adapter; JSforce is conditional when Salesforce is required. Twenty, erxes, Chatwoot and Frappe are bounded projection/reference candidates. OneChat remains UNKNOWN pending exact source evidence. No CRM candidate is a canonical source of Lead, Customer, Commercial Event, ownership, outcome or revenue semantics. ID-2 remains open.
