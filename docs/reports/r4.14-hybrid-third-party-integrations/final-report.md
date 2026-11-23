# R4.14 hybrid third-party integrations

R4.14 converts the prior integration research into runnable read-only slices:
an installable MV3 browser runtime, fabricated Pancake/Meta Ads/HubSpot context
adapters, official SDK-backed local-emulator connectors, and a durable
workspace-scoped observation receipt path that reuses R4.12 PostgreSQL
enrollment/checkpoint machinery.

The verified baseline is R4.13.3 `f531fc740fb83f7284410dbc1b9720d52fa835be`;
hosted run `44921698030` passed both jobs on that SHA. The tested R4.14 source
is `0162e524cda1a4b8ce886417e80330f950fed37b`, product tree
`808858b340473d1e74c0c4e2a07703a3673ad4b9`. Later delivery commits update reports
only.

The combined Chromium/MV3 -> actual OIDC/CSRF -> Nest AppModule -> PostgreSQL
test passed all 15 steps for Pancake, Meta Ads and HubSpot fixtures: 7 receipts,
0 Leads and UNKNOWN completeness. Restart/replay, account/scope/schema mismatch,
expired session and membership revocation were asserted. No provider request or
mutation was made.

Exact-source regression passed **31/31 lanes**, **1,611 coverage tests across
175 files, zero skipped**, and **90.82% line coverage**. PostgreSQL contributed
162 tests across 31 suites; counts are not added twice. QA independently ran
55 focused Vitest and 20 Node tests, independently checked PostgreSQL boundaries,
and reviewed the final source/manifest/combined log hashes.

Gate E is PASS for the fixture extension. Gate S is PASS for the scoped durable
receipt path. Gate I is PASS for the three local browser-fixture-to-receipt
vertical slices. Gate A is PASS local; Gate R covers actual SDK package reuse
with distribution/license review pending. Gate H is NOT RUN for R4.14. P3
remains `SEND_UNRESOLVED`; P4 is NOT TESTED; P5 is NOT VERIFIED. Gate B is
CONDITIONAL and Gate C is NOT READY.

R4.13.3's ambiguous Pancake send is preserved unchanged. The browser runtime
cannot send Pancake messages, bypass Meta policy windows or admit real customer
data. This branch is local only; no push, merge or deployment is authorized by
this execution.

Limits remain explicit: official SDK transports follow redirects and accept
fabricated tokens only; HubSpot package/license metadata differ; Meta timezone
is caller-labelled; optional CDP exact-native scope/completeness is UNKNOWN;
and SDK/API-browser native reconciliation is tested separately rather than as
one combined pipeline. The first ACK-loss label represents truncated/invalid
ACK recovery. These results do not establish production ingestion, complete
provider history, external exactly-once delivery or a commercial outcome.

Use `reproducible-local-setup.md` for the local package and test commands.
