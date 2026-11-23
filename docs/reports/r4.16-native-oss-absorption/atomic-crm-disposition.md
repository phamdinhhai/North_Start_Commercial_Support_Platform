# Atomic CRM deep absorption disposition

## Source and execution evidence

- Repository: `marmelab/atomic-crm`
- Immutable source: `832b07a89be2d9265a66bbf879fed0299c14ebfb`
- License: MIT (`LICENSE.md`, Marmelab/Francois Zaninotto). Selected source can be copied with notice; Supabase credentials, `.env` and upstream auth are excluded.
- Checkout: `D:/AI-for-Enterprise/north-start-ui-reuse-lab/atomic-crm`
- Inventory: 288 Atomic CRM source files, 43 source tests, 34 Supabase migrations plus schemas/functions/views/RLS.
- Original demo/build was executed previously on the isolated Node 24 toolchain. Northstar does not require Atomic CRM, Supabase, its database, or its API at runtime.

## Subsystem dispositions

| Subsystem | Evidence inspected | Disposition | Native Northstar destination / reason |
|---|---|---|---|
| Contacts | `src/components/atomic-crm/contacts/**`, `contactModel.ts`, `ContactList*`, `ContactShow*`, contact tests; `supabase/schemas/01_tables.sql` contacts table and `contacts_summary` view | `DEFER_WITH_EVIDENCE` | Northstar has Lead/Customer separation and no approved canonical Contact aggregate. Porting this schema would create a parallel identity authority. Revisit after CRM relationship decision ID-2. |
| Companies | `companies/**`, company types/forms/tests; `companies` table and summary view | `DEFER_WITH_EVIDENCE` | Useful UI and validation were reused in the R4.15 shell only. Native persistence is not absorbed because Northstar has no approved Company entity/migration. |
| Deals/opportunities | `deals/**`, `dealUtils.ts`, stage/category config/tests; `deals` table, expected-date constraint, indexes, views | `REJECT_INCOMPATIBLE` | Northstar explicitly keeps CE-1 commercial state open; Deal stage must not become Northstar commercial state or revenue. `dealUtils.ts` and 34-date validation tests are reference material only. |
| Tasks | `tasks/**`, `tasksPredicate.ts` and tests; upstream `tasks` table and contact foreign key | `ADAPT_EXISTING_NORTHSTAR` | Northstar already has Lead-scoped Work Items with versioned complete/reschedule/reopen commands, audit and idempotency. Atomic date predicates (`isOverdue`, today/tomorrow/week/later, recently-done anti-flicker) are candidates for a later pure adapter test, but upstream contact FK cannot be imported. |
| Notes | `notes/**`, note model/attachments; `contact_notes`, `deal_notes`, attachment cleanup trigger/functions | `REJECT_INCOMPATIBLE` | Attachment cleanup calls Supabase Edge Functions and stores notes under upstream Contact/Deal authorities. Northstar evidence/audit is append-only and provider-safe; no parallel note store is allowed. |
| Search/filter | `providers/supabase/searchDealCategories.ts`, fakerest filter transforms and tests; `08_search.sql` FTS/index/functions | `PORT_AND_ABSORB` (algorithm reference) | The category overlap search algorithm is valuable, but native Northstar search must target authorized Lead fields and bounded cursors. Port only as a pure, backend-owned query helper after contract design; never import Supabase FTS SQL blindly. |
| Assignment/sales | `sales` model, `sales` table, policies and user functions | `REJECT_INCOMPATIBLE` | Northstar OIDC membership, workspace RBAC, Lead ownership and handoff authority are canonical. Do not create an Atomic `sales` authority. |
| Activity timeline | `activity.ts`, `activity_log` view and activity tests | `REUSE_TESTS_AND_ALGORITHMS` | Northstar already has append-only audit/timeline/evidence. Adapt ordering and projection tests only after comparing event semantics; do not import upstream view. |
| Tags | tag components, tag generators, `tags` table/RLS | `DEFER_WITH_EVIDENCE` | No approved canonical tagging model or mutation gate. Preserve as future requirement, not a second tag authority. |
| Authentication/RLS | Supabase auth provider, Supabase functions, `05_policies.sql`, `sales` auth | `REJECT_LICENSE` / `REJECT_INCOMPATIBLE` | Northstar OIDC/PKCE/CSRF and server-side RBAC remain authoritative. No Supabase auth, JWT, policy SQL or Edge Functions are absorbed. |
| Import/export | contact import, VCard export, CSV fixture | `REJECT_INCOMPATIBLE` | Real-data admission and PII governance are not ready. No bulk Contact import/export is allowed in the current product. |
| Dashboard/reporting | dashboard components, deal charts, task groups | `ADAPT_EXISTING_NORTHSTAR` | Reuse layout patterns only; Northstar metrics must derive from authorized Lead/Work/Evidence data and show UNKNOWN where incomplete. |

## Database comparison

Atomic's schema is a mature CRM database, but it is a separate authority: bigint identity keys, `sales`, `companies`, `contacts`, `deals`, contact/deal notes, tags, Supabase `auth.users`, RLS policies, triggers, HTTP extensions and Edge Function callbacks. Northstar's canonical PostgreSQL model uses workspace-scoped Lead, Customer, commercial envelope/evidence, work items, outcomes, audit and durable integration receipts. Importing Atomic migrations would violate Customer ≠ Lead, lead-scoped access and no parallel Contact/Deal authority. No upstream migration was copied into Northstar.

## Tests and algorithms

The upstream tests were reviewed as behavior evidence. Particularly useful cases are task due-date bucket boundaries and recently-completed anti-flicker behavior, deal expected-closing-date bounds, category search overlap, provider filter transforms, and Contact/Company/Deal component authorization. They are not evidence that Northstar supports those entities. Northstar tests must be written against Northstar contracts when a canonical entity is approved.

## Runtime conclusion

R4.15 absorbed compatible Atomic React admin/list/form/sidebar modules into the Northstar frontend, but that is UI absorption only. This report deliberately does not claim native Contacts, Companies, Deals, Tags, Notes or Atomic task persistence. The native product remains one codebase and one Northstar PostgreSQL authority. Upstream Atomic CRM is not required to run it.

## Remaining modifications required before future absorption

1. Resolve CRM relationship decision ID-2 and Contact/Company semantics.
2. Define whether a Contact is a canonical entity, evidence reference or Customer projection.
3. Define Deal/Opportunity semantics without closing CE-1.
4. Port only selected pure algorithms with property/negative tests.
5. Add Northstar migrations with workspace/RBAC/audit constraints after persistence review.
6. Add frontend resource routes only after native API contracts exist.
