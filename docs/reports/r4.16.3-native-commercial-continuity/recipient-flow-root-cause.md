# Recipient flow root cause

## Reproduction

The recovered full React test was `React commercial continuity opens persisted Conversation and authorized Lead evidence` in `product/e2e/oidc/commercial-continuity.browser.spec.ts`. The timeout occurred after the recipient opened the Lead and clicked **Nh?n b?n giao**. The test treated that click as a completed mutation, but the existing React command contract opens a dialog requiring `reason` and a second **Ghi nh?n** submit. No backend accept request was emitted, so the test waited on UI state until timeout.

## Classification

- **CC-08 COMMERCIAL_ENTRY_GAP + FRONTEND_CONTRACT_DEFECT:** synthetic intake is Admin-only and `claimResponsibility=true` persists the Admin as owner. Lead Detail previously enabled owner mutations only for Sales, hiding valid owner-only commands.
- **CC-09 SELECTOR_OR_TEST_HARNESS_DEFECT:** the test did not submit the acceptance dialog and originally guessed a recipient option by position.
- **CC-10 NOT CONFIRMED as a backend defect:** after resolving the signed recipient identity and submitting the dialog, the recipient Lead became readable and acceptance returned HTTP 201 with owner transfer.
- **CC-11 NOT CONFIRMED:** no 403/session-generation redirect was observed in the minimal scenario.

## Minimal correction

Lead Detail now enables commands when the current actor is the persisted owner and has an existing admin, manager or sales role. This does not broaden backend policy: `PilotClosureService` and `requireOwner` still enforce owner-only mutation. The browser test resolves the recipient UUID from `/v1/auth/session`, submits the handoff and acceptance dialogs, and asserts the actual accept response.

The minimal React scenario passed three consecutive times on clean disposable PostgreSQL databases.

The later Stage B?E extension exposed additional UI selector/state issues and was not accepted as passing. The complete browser journey remains a release blocker.
