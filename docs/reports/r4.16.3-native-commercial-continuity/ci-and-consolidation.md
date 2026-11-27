# CI and consolidation

`.github/workflows/ci.yml` now provisions `qa_browser_commercial_continuity_ci` and runs `playwright.commercial-continuity.config.ts` as a separate browser gate after Native Inbox. Existing OIDC, Native Inbox, source, continuity and sync lanes remain.

Hosted CI run `45581298745` passed for published SHA `49fe6ba347513376076500e886b0267878dc7f59`; Product, React frontend build/contract and Browser operator workflow all passed. The candidate was published with a normal non-force push to the existing feature branch. No PR was created or modified, main was not changed, and no deployment occurred. Recommended consolidation is one PR from this branch to the verified R4.16.2 lineage after Owner review; do not merge automatically.
