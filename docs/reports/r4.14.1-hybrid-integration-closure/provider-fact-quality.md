# Provider fact quality

Meta SDK records preserve response-reported currency, its agreement with configured currency, reporting window, count/currency units and explicitly caller-supplied timezone. `metaReportingFacts` rejects invalid dates, reversed windows, currency mismatch and invalid timezone. Response windows outside the requested bounds are rejected. Revenue and attribution inference remain unsupported. The fixture reader's November 1-20 window is a fixed sandbox scenario, not a production scheduling policy or provider timezone confirmation.

Pancake history remains bounded prior read evidence. Full completeness is `UNKNOWN`; current fixture API results do not prove that 43 historical messages are a permanent complete history. Browser-observed messages do not establish successful API sends. The unchanged incident classification is:

```text
owner_manual_review = NOT_OBSERVED
post_attempts = 1
confirmed_provider_writes = 0
send_outcome = SEND_UNRESOLVED
automatic_retry_allowed = false
new_mutations_allowed = false
delivery_status = UNKNOWN
read_status = UNKNOWN
```

Zero confirmed writes is not proof that no write occurred. The independent UI observation of Meta error #10 is not assigned to the historical unparsed response.

HubSpot native records remain CRM objects with external provenance. They are not canonical North Start Customer or Lead identity. Automatic merge, writeback and commercial outcome projection remain disabled.

Tests: `src/adapters/hybrid-sdk/provider-fact-quality.spec.ts`, SDK connector tests, PostgreSQL hybrid receipt tests and the combined Chromium E2E. Fixtures contain no real customer data.
