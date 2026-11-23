# ADR-006 pilot viewer permission correction

Base: `a386da9`. Date: 2026-11-19. Finding: final architecture review A-01.

The pilot controller previously authenticated a caller and checked lead read access, then passed only the actor ID into mutation services. A viewer could create an owned scenario and mutate it, or accept a work item addressed to that viewer. Owner/recipient checks alone cannot distinguish a viewer from a sales operator.

All eight pilot mutation handlers now resolve a mutation context that admits only non-demo admin, manager or sales identities. Viewer, demo and unknown roles receive HTTP 403 before validation, lookup or mutation. Existing owner/recipient domain checks remain in place; administrative roles do not gain an ownership override. Read endpoints remain unchanged. Demo users retain isolated read access but can no longer create synthetic leads through the API; two old demo-write tests were updated to assert this deliberate ADR-006 behavior and retained cross-workspace invisibility.

## Verification

- New 93-case controller suite initially produced **48 failed / 45 passed** against the unguarded implementation, then passed after the guard.
- First full run exposed two obsolete demo-write expectations; these were changed to assert read-only behavior, not skipped.
- Typecheck exposed an invalid test-double interface (`canExport`/`canDelete` were not members of `LeadAccessPolicy`); the double was corrected.
- `npm run typecheck`, `npm run lint`: pass after corrections.
- `npm test -- --exclude '**/*.integration.spec.ts'`: **77 suites / 968 tests passed**. PostgreSQL tests are deliberately excluded here and separately owned by QA; no database verification is inferred from this count.
- Independent HTTP regression written by QA uses signed OIDC tokens, server membership and PostgreSQL. Root reproduced the baseline bypass, including state/audit changes after sales-to-viewer demotion. Final HTTP results are recorded in the QA report.

Implementation began with `/root/r3_viewer_fix_recovery` using `gpt-6.1-sol`. The agent stopped at its usage limit before finishing typecheck and demo-fixture reconciliation. Root completed those corrections, verified the code and committed the scoped result. Architecture reviewer `/root/r3_architecture_recovery` independently inspected the guard; final review acceptance and exact integration SHA are recorded in its report and the final summary.

No dependencies, schema, canonical documents, feature flags or live provider actions were changed. This correction closes an active API authorization defect; it does not approve pilot or production release.
