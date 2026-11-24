# CI and PR consolidation plan

## CI inclusion

`.github/workflows/ci.yml` now runs:

- `npx playwright test --config playwright.oidc.config.ts` against the existing disposable OIDC PostgreSQL database.
- Creates `qa_browser_native_inbox_ci` and runs `npx playwright test --config playwright.native-inbox.config.ts` against a separate disposable database.
- Builds the React frontend before the browser jobs.

The Native Inbox config sets `NATIVE_INBOX_E2E=true`; the legacy OIDC config excludes the Native Inbox spec. This prevents synthetic intake flags from changing legacy operator fixture semantics.

## PR/consolidation plan

1. Push `feat/r4162-native-conversation-hardening` only after Owner authorization.
2. Open/update a PR targeting `main` with the implementation commits after the previous R4.15.1 PR lineage is reviewed.
3. Require Product, Browser Operator, React Native Inbox and backend PostgreSQL jobs on the exact pushed SHA.
4. Do not merge `main`, deploy, or alter existing PRs automatically.

Hosted CI remains pending because this candidate has not been pushed.