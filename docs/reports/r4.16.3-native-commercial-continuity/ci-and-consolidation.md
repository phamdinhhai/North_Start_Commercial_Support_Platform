# CI and consolidation

`.github/workflows/ci.yml` now provisions `qa_browser_commercial_continuity_ci` and runs `playwright.commercial-continuity.config.ts` as a separate browser gate after Native Inbox. Existing OIDC, Native Inbox, source, continuity and sync lanes remain.

No PR was created or modified. No push or merge was performed. Recommended consolidation is one PR from this branch to the verified R4.16.2 lineage after Owner review; do not merge automatically.
