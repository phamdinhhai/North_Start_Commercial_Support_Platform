# Release and branch plan

Keep `feat/r414-hybrid-third-party-integration` isolated from `main` and draft
PRs #1/#2. Review package license discrepancies and the SDK dependency audit
before any merge. Required checks are typecheck, lint, build, architecture,
registry, security audit, browser package/smoke, focused adapter tests and the
31-suite PostgreSQL gate. Hosted R4.14 CI must run on the final SHA separately.

No external credentials, provider mutations, real-data admission or deployment
is part of this branch.
