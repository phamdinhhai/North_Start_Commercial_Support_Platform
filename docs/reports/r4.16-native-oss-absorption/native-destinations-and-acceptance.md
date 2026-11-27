# Native destinations and acceptance

| Upstream functionality | Native Northstar destination | Evidence |
|---|---|---|
| Atomic React admin/list/table/form | `frontend/src/components/admin`, `frontend/src/components/ui`, CRM modules | Frontend CI build and browser workflow pass on R4.15.1 |
| Atomic Search concepts | Deferred/port candidate; Northstar lead queries remain canonical | Atomic disposition report; no duplicate search API |
| Atomic Tasks | Existing lead work items and `/v1/pilot` commands | PostgreSQL and browser sales evidence |
| Chatwoot message dedupe/last-message behavior | `frontend/src/modules/inbox/chatwoot-conversation-helper.mjs`, tests | Inbox model tests in R4.15 evidence |
| Chatwoot permission/search/lifecycle ideas | Existing receipts, message ledger and RBAC; future bounded port | Chatwoot disposition; no Rails runtime |
| Ads table/chart | `frontend/src/modules/ads`, fixture tests | 3/3 fixture tests; no provider writes |
| Message sighting/reconciliation | `product/src/adapters/adaptive-connectivity/message-ledger.ts` | Existing order-independent/conflict/replay tests |

No upstream authentication, migration, database, API server or independent runtime is required.
