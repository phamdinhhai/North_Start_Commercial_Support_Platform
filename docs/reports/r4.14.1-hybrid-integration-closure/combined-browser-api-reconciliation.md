# Combined browser/API reconciliation

The executable path is installed MV3 extension -> signed enrollment -> actual Nest AppModule -> existing PostgreSQL `integration_receipt` -> authorized connection-scoped reconciliation. A separate enrolled server read uses the official Meta/HubSpot SDKs or the bounded Pancake emulator contract with independently checked fabricated provider credentials. Each producer retains its own checkpoint. No new sync database, migration, Lead, Customer, commercial outcome or merge is created.

`POST /v1/hybrid/provider-read` accepts only enrollment ID, capture ID and sequence. The server owns endpoint configuration, credential selection, native target verification and API envelope construction. Browser submissions cannot choose API authority or trust. `GET /v1/hybrid/reconciliation` rechecks active enrollment, exact server-owned scope and current issuing-admin membership. Its view joins receipts across enrollments with the exact same workspace/connection/account/surface/page/target scope. Old and late observations remain visible; scope correlation is not a latest-value projection.

Three fabricated native objects are exercised: Pancake conversation, Meta campaign and HubSpot contact. Both paths initially report `fixture-label-v1`. A later browser observation reports `fixture-label-v2` and a deleted lifecycle. The view retains original browser/API facts and the conflicting later browser facts without overwriting. `fixture_label` is explicit Pancake-emulator metadata, not an assertion about a documented Pancake field. The CRM contact and campaign names are minimized to fabricated labels before persistence.

Browser envelopes remain `browser_dom` / `UNVERIFIED`. API emulator envelopes are `official_api` / `AUTHENTICATED_TRANSPORT`, always with `fixture:true`. `identityStatus=VERIFIED` means an exact native tuple was paired across the two authorized fixture paths; it is not verification of a real provider or a canonical customer. A browser-only view remains `UNKNOWN`. Mismatched tuples never merge, and completeness always remains `UNKNOWN`.

Receipts use existing replay/conflict/checkpoint machinery. Reusing a provider-read capture reuses its persisted fingerprint and avoids another emulator read. JSONB changes property order, so hashing decoded metadata again was incorrect; the dedicated PostgreSQL test caught and now covers that defect. Reconciliation reads fail closed above 100 receipts rather than silently truncating or silently rereading a provider.

Reproduce after a locked install and build, with a disposable loopback PostgreSQL URL named `north_start_ci` and `DATABASE_URL` unset:

```text
npm run build
node scripts/hybrid-browser/durable-e2e.mjs
npm run test:integration:ci
```

The harness creates and destroys a uniquely named child database. It runs real Chromium, OIDC login/CSRF enrollment, Nest and PostgreSQL; all platform pages/APIs are local fabrications. See `verification.json` for exact source SHA, commands, hashes, totals and actual outcomes.
