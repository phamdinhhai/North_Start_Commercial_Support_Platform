# Local end-to-end execution

Completed fixture path: fabricated Pancake page → Chromium MV3 runtime →
metadata-only outbox → bounded backend ACK emulator → scope/native assertions.
The PostgreSQL gate separately demonstrated durable receipt, duplicate replay,
conflict and revocation behavior for Pancake, Meta Ads and HubSpot envelopes.

The final combined harness passed on exact source
`0162e524cda1a4b8ce886417e80330f950fed37b`: installed MV3, three fabricated
provider pages, real OIDC login and CSRF-protected admin enrollment, actual
North Start Nest AppModule, PostgreSQL metadata receipts and authorized Data
Health. It recorded 7 receipts, 0 Leads and UNKNOWN completeness.

The 15 asserted steps include service-worker termination, invalid/truncated
ACK replay, full browser restart, actual backend process SIGKILL/restart,
duplicate/payload conflict/foreign workspace/native target denial, account
switch, missing DOM identity, expired browser session and issuing-membership
revocation. The label `LOST_ACK` injects a truncated response; it is not evidence
of a separate connection-loss test. The unused connection-drop branch remains
unverified.

Combined log SHA-256:
`4880a0d73154160fb39722c9f95681458e0d2f4d08debe9191e62ccf0a2c713f`.
Gate I/S pass for this local browser-to-durable-receipt scope. SDK/API fixtures
and pure native reconciliation are separately tested; combined SDK/API-browser
receipt reconciliation and real-provider E2E remain unverified.
