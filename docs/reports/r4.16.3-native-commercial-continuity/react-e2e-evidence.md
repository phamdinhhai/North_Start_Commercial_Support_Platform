# React browser evidence

Command:

```text
cd product
QA_DATABASE_URL=postgresql://<loopback>/qa_browser_r4163h
npx playwright test --config playwright.commercial-continuity.config.ts --reporter=line
```

Result: 1 passed. The test uses fixture OIDC, the actual Nest server, disposable PostgreSQL, authorized synthetic intake through the source API, Native Inbox rendering, canonical association projection, Lead deep-link, provenance/UNKNOWN disclosure and viewer denial.

The full handoff ? recipient ? work ? outcome ? audit browser journey is not yet verified; existing canonical APIs and PostgreSQL pilot-loop tests cover those operations separately.
