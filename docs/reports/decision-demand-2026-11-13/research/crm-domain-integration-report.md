# W2c — CRM and domain-integration research report

**Decision date:** 2026-11-13
**Status:** non-canonical research; source-level desk review only. No live verification, tenant login, credential test, or private endpoint was performed.

## Decision frame

CRM systems are adapters and projections. They do not own canonical Lead identity, Commercial Event scope, evidence policy, ownership, or revenue meaning. Any integration must retain provider IDs and raw observations while making mapping gaps explicit, especially where a CRM's contact/deal model cannot represent Customer ≠ Lead or chain identity.

## Candidate review

| Candidate | Exact public source URLs | Source type / version or date | License | Maintenance / security / tests | Tenant and credential suitability | Useful capabilities | Limitations | Verdict |
|---|---|---|---|---|---|---|---|---|
| Twenty | https://github.com/twentyhq/twenty  /  https://twenty.com/developers | GitHub and official developer docs; release/date must be pinned | AGPL-3.0 (repository metadata; confirm selected release and hosted terms) | Active-looking open-source CRM with public tests/docs; current maintenance/security posture not live-verified | Workspace concepts exist, but AGPL, hosted/self-hosted deployment, secrets and isolation require legal/ops review | Objects, relationships, pipelines, API and extensibility; useful for controlled projection | Its object semantics are not canonical Revenue Continuity semantics; license and migration risk | **ADAPT** as a projection target or **REFERENCE** for object/API design |
| HubSpot | https://developers.hubspot.com/docs/api/overview  /  https://developers.hubspot.com/docs/api/crm/understanding-the-crm | Official API/docs; API version/date must be pinned | Proprietary SaaS terms; SDK licenses vary by language | Mature public docs and SDK ecosystem; current endpoint behavior, quotas and security terms not live-verified | Portals/scopes/oauth are useful but require server-side secret handling, tenant binding, consent and revocation controls | Contacts, companies, deals, associations, timelines and webhooks | Provider IDs/objects and lifecycle fields do not replace canonical Lead/Event; rate limits and field ownership need mapping | **ADAPT** as an outbound/read projection adapter, never canonical |
| JSforce | https://github.com/jsforce/jsforce  /  https://jsforce.github.io/ | Public GitHub/docs; release must be pinned | MIT (repository metadata; confirm selected release) | Established Node.js Salesforce client with public tests/docs in source-level review; current posture not live-verified | OAuth/session handling is available, but credentials must remain server-side and org scope must be bound to workspace | Salesforce REST/Bulk/Streaming patterns, query and object CRUD | SDK convenience can encourage mutation outside policy; Salesforce object model and sharing rules remain external | **ADAPT** behind explicit command/query ports; default read-only |
| Frappe / ERPNext CRM | https://github.com/frappe/frappe  /  https://github.com/frappe/erpnext  /  https://frappeframework.com/docs | Official repositories/docs; release must be pinned | MIT in upstream repositories (confirm selected release) | Mature public project with test/docs conventions; current security state not live-verified | Site/user/role model is useful, but site isolation and API credentials require deployment verification | Customer, lead, opportunity, assignment, workflow and custom fields | Broad ERP semantics and mutable records conflict with raw immutable evidence unless treated as projection | **ADAPT** for a bounded projection or **REFERENCE** |

## Mapping implications

| Canonical concept | CRM projection rule | Unknown/limitation to preserve |
|---|---|---|
| Lead ID | Keep an internal immutable Lead ID; store CRM object ID as an external mapping with source and observed-at | CRM object merge/reparenting must not rewrite the internal ID |
| Customer vs Lead | Never infer equivalence from a CRM Contact/Customer row; represent the mapping as explicit evidence or UNKNOWN | Provider deduplication and merged contacts are not proof of canonical identity |
| Conversation / interaction | Project a reference to the source envelope and evidence hash; do not treat CRM timeline text as the raw source | CRM truncation, ordering and retention can lose provenance |
| Work item / handoff | Project status or task as a derived view only; canonical actor, recipient and audit remain internal | CRM assignment may represent a team, queue or owner rather than the actual recipient |
| Outcome / revenue | Store provider outcome fields as claims/observations with source and confidence; require internal evidence/policy for canonical outcome | A closed deal or amount is not automatically verified revenue attribution |
| Deletion / retention | Record provider-side deletion/retention observations and preserve internal audit rules | SaaS retention and export completeness are provider-dependent |

## Synthesis for W2c

- **HubSpot** is the best first **ADAPT** target for a controlled read/projection adapter because its public API concepts cover contacts, deals, associations and webhooks. This does not authorize mutation or canonical ownership.
- **JSforce** is a useful **ADAPT** client where Salesforce is a named customer dependency; enforce a narrow port and prohibit direct domain mutation.
- **Twenty** and **Frappe** are **ADAPT/REFERENCE** candidates, with license and deployment choices made before any embedding.
- No candidate should be adopted as the system of record for canonical commercial semantics. CRM mapping remains an open decision (ID-2) and must not be resolved by this report.

## Evidence and honesty boundary

URLs are public source pointers, not live verification. Version/date, current license terms, security advisories, tenant isolation and tests need rechecking against a pinned release and a disposable tenant. No credentials, PII, customer data or private endpoint appears here.
