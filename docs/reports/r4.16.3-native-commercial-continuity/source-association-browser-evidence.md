# Source association browser evidence

The focused React scenario now passes against clean disposable PostgreSQL. It creates distinct origin and target synthetic Leads, selects the target Lead in the Admin Source Association Panel, executes Link, navigates to the target, executes Unlink and Reject, and verifies each HTTP 201 response plus persisted source-link history:

- Link: origin A, effective B, version 1, human_confirmed, UNVERIFIED.
- Unlink: effective null, version 2, unknown linkage.
- Reject: effective null, version 3, rejected linkage.

The primary commercial journey and this focused association scenario are both discovered by `playwright.commercial-continuity.config.ts` and therefore run in the dedicated CI lane.
