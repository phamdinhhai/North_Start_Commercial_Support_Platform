# Manager exceptions API

`GET /v1/pilot/manager-exceptions` requires authenticated manager/admin, non-demo. Workspace is resolved on the server. Sales/viewer return 403; missing authentication returns 401. Response is `Cache-Control: no-store`. Memory mode returns 503 `DURABLE_STORAGE_REQUIRED` through the explicit unavailable reader.

Query fields: `classification=real|synthetic|unknown|all` (default real), `limit=1..100` (default 50), optional `after` UUID. Other fields, malformed UUID, invalid classification and bounds return 400. Continuation is an exclusive lead UUID filtered again by current workspace/classification. It confers no authority and contains no identity information. Changing filters should reset continuation.

Response fields: `asOf` (server time), `classification`, `scope:"bounded_page"`, `scannedLeads`, `hasMore`, optional `nextAfter`, and `items`. The count is for scanned leads in this page only; item count is the number with at least one observation. Continue on hasMore even when items is empty. Concurrent writes can change later pages; refresh restarts the scan. No global counts are supplied.

Each item: `leadId`, authorized `displayName`, current `version`, `classification` (`real|synthetic|unknown`), `observations` array, optional `awaitingSince` and nonnegative `awaitingAgeSeconds`. Codes:

| Code | Recorded observation |
|---|---|
| owner_unassigned | No owner recorded |
| awaiting_acceptance | Current handoff recipient still has current proposed work; age only |
| recipient_inactive | Workspace membership known revoked/ineligible (viewer) or known user disabled, without an active eligible membership |
| recipient_unknown | Pending recipient has no known workspace membership |
| overdue_open_work | Unsuperseded proposed/accepted/open/awaiting-external work has past due date |
| claimed_outcome_with_open_work | Unsuperseded claimed outcome coexists with current open work |
| source_evidence_missing | Referenced intake envelope unavailable |
| context_unknown | Current context revision or latest handoff context unavailable/unknown |
| source_unknown | Conversation source unavailable/unknown |

Integration: register `ManagerExceptionsController`; provide `ManagerExceptionsService` with `new ManagerExceptionsService(new PgManagerExceptionsReader(postgresService))`. Memory reader implements `scan` by throwing `ManagerExceptionsUnavailable`. Service authorizes before invoking reader. All files are additive; no migration. `OPERATOR_MANAGER_SCRIPT` defines `window.mountManagerExceptions({container,request,openLead})` and returns cleanup; call only for manager/admin, clean up on session/workspace change, concatenate asset into operator script. `request` returns parsed JSON and throws errors with status; `openLead` accepts a lead ID. UI labels explain page counts, unknown values, claim limits and no SLA judgment.
