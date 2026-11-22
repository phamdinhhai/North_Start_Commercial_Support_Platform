# Privileged browser diagnostics

Ordinary MV3 operation retains activeTab, scripting and storage. Debugger remains optional and requires an explicit popup action during an active capture, permission and exact tab/origin/native target binding. Browser diagnostics never authorize a provider mutation or export a credential.

Diagnostic events retain only allowlisted GraphQL operation names, realtime event categories and status/auth categories. They omit variables, request/response bodies, URL strings, cookie/storage values and message text. Evidence remains private/client-observed with completeness `UNKNOWN`; it is never promoted to API-authenticated evidence.

The worker now checks current URL native account/object candidates before accepting diagnostic events, including same-origin SPA account switching. On worker initialization it detaches a persisted debugger target before clearing state. Stop, tab close, permission revocation, disconnect and browser restart stop privileged capture. DOM-only identities without URL confirmation can fail closed; supported diagnostic scope is narrower than ordinary DOM context recognition.

Tests include actual worker module execution with fabricated Chrome APIs: detach ordering on restart, native/account URL changes, revoked permission, explicit activation, wrong tab/origin, approved operation minimization and malformed/partial observations. No actual provider debugger session was performed.

```text
node --test scripts/hybrid-browser/runtime.test.mjs scripts/hybrid-browser/security.qa.test.mjs scripts/hybrid-browser/diagnostic-worker.test.mjs
```

The disposable Chromium acceptance separately proves installable packaging and worker/browser restart behavior. Exact-source totals are in `verification.json`.
