# Release and branch plan

Keep `feat/r414-hybrid-third-party-integration` isolated from `main` and draft
PRs #1/#2. Review package license discrepancies and the SDK dependency audit
before any merge. Required checks are typecheck, lint, build, architecture,
registry, security audit, browser package/smoke, focused adapter tests and the
31-suite PostgreSQL gate. Hosted R4.14 CI must run on the final SHA separately.

No external credentials, provider mutations, real-data admission or deployment
is part of this branch.

R4.14 uses the verified R4.13.3 remote HEAD as its ancestor; no R4.13.1/R4.13.2
commits were manually re-added. Existing migrations 001-023, canonical files and
CI workflows are unchanged. Read-only GitHub review confirmed draft PR #1
(`feat/decision-demand-execution` -> main) and stacked draft PR #2
(`feat/unified-adaptive-foundation` -> `feat/adaptive-integration-pancake-research`)
remain open. Neither was retargeted, merged, closed or rewritten.

Before a future integration, rehearse in another disposable worktree, compare
ancestry and migration checksums, run the exact-SHA 31-lane suite, and require
both Product and Browser CI jobs on the proposed R4.14 revision. Recommend
protected main with required reviews and these two checks; no remote settings
were changed. Human Sales and real-data governance gates remain separate.
