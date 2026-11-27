# Browser permission and security review

Required permissions are `activeTab`, `scripting` and `storage`. Backend host
access is optional and requested for one explicit HTTPS origin (loopback HTTP
is available only in the fixture package). `debugger` is optional and requires
a separate diagnostic action. The observer allowlist projects only native ID
candidates, account/page/campaign/contact identifiers, currency and timezone.

Enrollment is server-issued and binds workspace, connection, provider, account
and a non-empty native target. The browser cannot select a workspace or elevate
`CLIENT_OBSERVED` to provider trust. Outbox records survive lost ACKs without
allocating a new sequence; duplicate or conflicting ACKs are handled locally.

Security tests cover foreign workspace, target mismatch, token expiry, revocation
responses, lost ACK, restart gaps, DOM minimization, diagnostic URL/variable
redaction and permission abuse. Same-origin SPA target changes remain a visible
`UNKNOWN` completeness limitation for optional diagnostics.

Final exact-value and pattern scans passed across changed/staged/untracked
files, generated outputs, validation logs, extension package and new commits.
All reachable history was compared against the existing local provider secret
values without printing them. A preexisting fabricated JWT negative fixture
was identified explicitly. No provider credentials, raw HAR, customer content
or authenticated provider URL was committed.

The SDK transport tests demonstrate redirect following, so real tokens are
refused by those emulator-only constructors. This is a deliberate release
boundary, not a claim of network egress confinement. Membership revocation is
checked against the issuing admin under the durable receipt transaction.
