# Independent QA review

## Scope

Independent review covered the Lead-scoped Native Conversation SQL path, cursor binding, CRM search-before-LIMIT, SPA serving, and the dedicated React browser journey.

## Findings

- Lead scope is enforced in PostgreSQL before conversation grouping and message expansion. Admin/manager workspace scope follows the current ADR-006 LVP policy; sales/viewer require Lead ownership or active actionable work recipient status.
- Cursor scope includes workspace, actor, role and filters. Reusing a cursor with a different actor or classification is rejected by the CRM path; Native Conversation cursors include role.
- CRM search predicates run before SQL LIMIT and are tested with 100+ Leads plus a Vietnamese match beyond the first page.
- React acceptance reaches the actual `/v1/app/` build, uses fixture OIDC and sends intake through the real authorized API. No final projection is seeded directly.
- The current canonical model has no page-membership relation. The implementation does not create a parallel RBAC system; page-level policy remains a residual design limitation.

## Verdict

Local implementation evidence is sufficient for the bounded technical slices listed in `verification.json`. Full commercial continuity and Owner acceptance remain open. No live provider call or mutation was performed.
## Historical regression note

The complete OIDC browser suite was rerun on a fresh disposable database. Five tests passed, including the new Native Inbox test; two legacy operator tests failed on their existing classification queue assumptions. These failures are recorded in verification.json and prevent a full regression PASS. No provider calls or mutations occurred.
