# OIDC regression root cause and correction

## Reproduction

On a fresh disposable PostgreSQL database, the unisolated OIDC configuration produced 5 passed / 2 failed:

- `journey.browser.spec.ts:43` expected synthetic intake to be excluded from the default real queue, but one item was visible.
- `journey.browser.spec.ts:170` expected a real classification fixture, but the operator forced the fixture to synthetic.

The Native Inbox test passed in the same run.

## Root cause

The OIDC server was globally setting `SOURCE_INTEGRATION_SYNTHETIC_ENABLED=true` to support the new Native Inbox intake. That changed the legacy operator fixture environment: the operator auto-selected synthetic mode and the queue classification assumptions no longer matched the test's intended real/synthetic setup. This was an E2E harness environment leak, not a Native Conversation SQL authorization defect.

## Correction

- `product/e2e/oidc/server.mjs` now enables the synthetic source integration flag only when `NATIVE_INBOX_E2E=true`.
- `product/playwright.oidc.config.ts` explicitly excludes the Native Inbox spec.
- `product/playwright.native-inbox.config.ts` runs the Native Inbox spec with `NATIVE_INBOX_E2E=true`.
- Existing legacy operator assertions remain unchanged.

## Verification

- Complete legacy OIDC suite: **6 passed / 0 skipped**.
- Dedicated Native Inbox suite: **1 passed / 0 skipped**.
- Source/operator suite: **1 passed / 0 skipped**.

No assertions were weakened or removed.