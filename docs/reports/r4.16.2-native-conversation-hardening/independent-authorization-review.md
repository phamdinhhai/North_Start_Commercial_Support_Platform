# Authorization and query independent review

## Native Conversation

The controller resolves the authenticated context, the service propagates role and actor, and PostgreSQL applies the Lead predicate before canonical conversation grouping and again during message expansion. Admin/manager use approved workspace scope; sales/viewer require Lead ownership or active actionable work recipient status. Revoked connections are excluded by the active connection join. Revoked memberships fail at the AuthContext resolver.

A mixed conversation with two source receipts mapped to different Leads was tested: one Lead assigned to Sales produced one visible message; the inaccessible message and its metadata/count were not returned. Foreign workspace, unassigned Sales and revoked connection cases are covered by HTTP/PostgreSQL tests. No page-membership RBAC was introduced because no canonical relation exists.

## CRM Search

`PgPilotStore.leads()` applies workspace, classification, role and search predicates before `LIMIT`; Lead IDs are then loaded only for the bounded result page. The opaque cursor binds workspace, actor, role, classification and normalized search. Raw UUID cursors are no longer accepted as a compatibility shortcut. PostgreSQL coverage uses 100+ Leads, a Vietnamese match beyond the initial page and cursor reuse under changed actor/classification.

The current implementation still performs bounded aggregate loading for each result row (`Promise.all(load)`), an existing N+1-shaped read pattern. It is bounded by page size and was not expanded into a separate projection in this release. Query-plan optimization remains a future bounded task if measured evidence requires it.
Final review correction: raw UUID Lead cursors are now rejected; only scope-bound opaque cursors are accepted.
