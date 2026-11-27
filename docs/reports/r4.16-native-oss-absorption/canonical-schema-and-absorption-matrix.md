# Canonical schema and native absorption matrix

Review base: Northstar R4.15.1 `5121f7636b310244042d084c997c421422d434496e1` (the product branch exact SHA is recorded in the parent report). External sources remain outside the repository. No upstream migration was copied into the Northstar active database.

| Upstream subsystem | Source evidence | Northstar canonical meaning | Disposition | Native destination / acceptance |
|---|---|---|---|---|
| Atomic companies | `supabase/schemas/01_tables.sql` `companies`, FK/indexes; MIT source | No approved Northstar Company aggregate; Customer and Lead are distinct | DEFER_WITH_EVIDENCE | Future CRM relationship RFC; do not add parallel table |
| Atomic contacts | same schema `contacts`, notes, tags, merge function | Contact data is not Customer and cannot replace Lead/source evidence | ADAPT_EXISTING_NORTHSTAR | Preserve Lead/Customer invariants; port merge tests only after ID-2 decision |
| Atomic deals | `deals`, `deal_notes`, expected-close constraints, summary views | Deal/Opportunity state is not approved CE-1 and must not become outcome/revenue | DEFER_WITH_EVIDENCE | R4.16 backlog; no Deal migration |
| Atomic tasks | `tasks`, due/completion fields and contact FK | Northstar `pilot_work_item` is the audited work-status construct | ADAPT_EXISTING_NORTHSTAR | Existing queue/next-action endpoints and PostgreSQL model remain authority |
| Atomic merge_contacts | `supabase/schemas/02_functions.sql` | Automatic merge conflicts with I-06 and workspace/evidence review | REJECT_INCOMPATIBLE | Manual evidence-gated merge only; function not copied |
| Atomic RLS/policies | `05_policies.sql` permits broad authenticated access | Northstar server RBAC/workspace scope is stricter | REJECT_INCOMPATIBLE | Do not port policies; reuse tests as negative-case reference |
| Chatwoot conversation/message | Community checkout sparse tree exposes JS conversation/card/message patterns; Rails models are not in the sparse checkout | Provider conversation/source observation is not a Lead or canonical commercial event | PORT_AND_ABSORB | Native evidence/receipt read model proposal; no separate Conversation DB yet |
| Chatwoot assignment | inspected community assignment UI/service references | Assignment recipient is not Sales ownership without explicit handoff | ADAPT_EXISTING_NORTHSTAR | Use existing handoff/recipient/owner semantics |
| Chatwoot labels/search/unread | community dashboard store and helper paths | Labels/read state are provider facts, not verified commercial meaning | DEFER_WITH_EVIDENCE | Add to source-backed conversation read model after scope decision |
| Ads Studio SQLAlchemy brands/products/customer_profiles | `backend/app/models.py`, MIT | Ads account/campaign metrics are bounded provider observations | ADAPT_EXISTING_NORTHSTAR | Existing SDK fixture contracts; no Python database/backend imported |
| Ads Studio campaign tables | `FacebookCampaign` and schema files | Reporting rows do not prove attribution/revenue | REUSE_TESTS_AND_ALGORITHMS | Keep read-only normalized fixture with UNKNOWN authority |

## Canonical constraints retained

Northstar migrations 001–007 already enforce workspace FKs, Lead/Customer separation, stable Lead IDs, append-only outcome/audit rows, immutable raw envelopes, work-item status constraints, and indexes for workspace/Lead/status/due date. These constraints are stronger or semantically different from upstream authenticated/RLS assumptions. A direct upstream schema import would create duplicate authorities and violate the architecture directive.

## Native implementation decision

No new migration is justified by this inventory. The highest-value next native absorption is a source-backed conversation read model built on existing `commercial_envelope`, durable receipt and evidence tables, with provider connection-scoped native IDs and no automatic Lead/Customer merge. This is deferred until the R4.16 functional workstream defines the read contract and open decisions (ID-2, CE-1, LG-1) are resolved.
