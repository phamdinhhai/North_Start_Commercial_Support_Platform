# Multi-agent execution

Wave 1 used three real specialist processes:

1. Authorization closure: Lead-scoped Native Conversation policy, SQL filtering before grouping/LIMIT, role-bound cursors and negative tests. Commit `10eaaac`.
2. CRM/PostgreSQL query engineering: search-before-LIMIT, scoped opaque Lead cursor, controller validation and 100+ row Vietnamese integration test. Commits `6ab8feb`, `55b2405`.
3. React browser/E2E: frontend serving in the OIDC harness, SPA fallback, real intake-to-Native-Inbox Playwright test. Commit `d1bd8a2`.

The root agent performed contract reconciliation, integration, test execution, evidence review and final commits. The environment did not permit six simultaneous specialists; no unavailable process is represented as having run.