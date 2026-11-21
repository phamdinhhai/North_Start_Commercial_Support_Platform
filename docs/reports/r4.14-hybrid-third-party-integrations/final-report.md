# R4.14 hybrid third-party integrations

R4.14 converts the prior integration research into runnable read-only slices:
an installable MV3 browser runtime, fabricated Pancake/Meta Ads/HubSpot context
adapters, official SDK-backed local-emulator connectors, and a durable
workspace-scoped observation receipt path that reuses R4.12 PostgreSQL
enrollment/checkpoint machinery.

The strongest verified result is local synthetic integration. Chromium smoke
passed the Pancake path with one minimized observation and a stored ACK. The
PostgreSQL gate passed 31 suites and 162 tests without skips, including replay,
conflict, sequence, cross-workspace, enrollment and membership-revocation
cases. No provider request or mutation was made.

Gate E is PASS for the fixture extension. Gate S is PASS for the scoped durable
receipt path. Gate I remains PARTIAL until the combined Chromium→North Start
Nest application→PostgreSQL harness is run. Gate H is NOT RUN for R4.14. P3
remains `SEND_UNRESOLVED`; P4 is NOT TESTED; P5 is NOT VERIFIED. Gate B is
CONDITIONAL and Gate C is NOT READY.

R4.13.3's ambiguous Pancake send is preserved unchanged. The browser runtime
cannot send Pancake messages, bypass Meta policy windows or admit real customer
data. This branch is local only; no push, merge or deployment is authorized by
this execution.
