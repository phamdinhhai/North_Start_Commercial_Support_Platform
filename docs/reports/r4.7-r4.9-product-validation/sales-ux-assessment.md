# R4.7 Sales UX assessment

Baseline: 08bdefa. Synthetic controlled Chromium fixtures only; no human Sales usability acceptance or real-data admission. Gate B remains unverified. Scope: operator browser UI; no backend, role or transition changes. Guidance: e2e-testing-patterns; canonical I-03/I-08/I-09/I-12 and ADR-005/006/009.

| ID | Evidence / before | After / verification |
|---|---|---|
| UX-01 P1 | A command receiving 401 called clear(), closed its dialog, left sensitive fields in DOM and lost usable draft state. | Rendered context/fields cleared, draft retained only in JS memory for an authenticated lead command. Sign-in opens a new tab; explicit Recheck fetches session, checks same user/workspace and fresh lead access/version/CSRF, restores draft for human review. No auto-submit or browser storage. Chromium same identity, different user/workspace and revoked lead cases PASS. |
| UX-02 P1 | 403 left visible lead context, command fields and enabled retry. | Conservative denial clears context, DOM fields and retained recovery, hides recovery control. Chromium denied-write and denied-recovery tests PASS. Action-only denial also discards the draft deliberately because the UI cannot prove continuing authorization. |
| UX-03 P1 | Cancel/Escape silently discarded entered text. | Input dirty tracking, discard confirmation on Cancel/Escape and beforeunload guard. Dismissed discard confirmation keeps entered text; component test PASS. Closing successfully recorded form does not warn. |
| UX-04 P1 | 409 blocked retry correctly, but Reload discarded entered draft. | Explicit reload refreshes lead projection while keeping fields, replaces version and idempotency key, explains review before explicit recording. Existing component regression updated: pending/double-write guard, one write, retained text and enabled post-refresh submit PASS. |
| UX-05 P2 | Claims/outcomes and UNKNOWN labels existed but lacked an overall trust explanation. | Trust guide separates captured source records, human claims, AI inferences and UNKNOWN; no verification or revenue assertion invented. |

Verification: `npm ci --ignore-scripts`; `npm run typecheck`; `npm run lint`; `npm run build`; `npx playwright test --config playwright.operator-recovery.config.ts` (8 PASS: existing 3 plus 5 recovery boundary cases). Component fixtures intercept HTTP and exercise real DOM/dialog/fetch interactions; they do not establish deployed OIDC behavior. Earlier failing local tests exposed a missing cancel handler insertion and were corrected before final rerun.

## Limits and hypotheses

Recovery covers authenticated lead commands and new-lead intake. Existing leads require a fresh authorized read; intake requires fresh matching identity, workspace and role membership. All restored forms require explicit review and submission. Reload/closing original tab loses in-memory draft; beforeunload warns. No plaintext persistent drafts or credentials are introduced. Actual OIDC multi-tab identity/provider/browser behavior and real operator recovery speed still require QA/human pilot. No automatic session polling: expiration is detected on next API request.

Existing empty evidence explicitly says unavailable, contact claims identify missing evidence/occurred time as UNKNOWN, source/history failures are visible, outcomes remain claims and attribution UNKNOWN. These are inspected existing behaviors, not newly claimed comprehensive automated coverage. Screen-reader announcement quality, keyboard flow across all forms, empty assignee directory, mobile readability, vocabulary comprehension, and operator distinction between refresh/retry remain usability hypotheses requiring actual users; synthetic automation cannot resolve them. Existing component tests cover evidence HTML injection and CSRF/versioned manual context submission. No human Gate B PASS claim.

## Follow-up UX-F05 (confirmed P1)

The initial recovery guard required a lead id, so dirty new-lead intake was erased on 401. The follow-up captures all authenticated dirty commands, including intake, and checks unchanged user/workspace/role before restoration. Existing leads still require fresh lead authorization/version; intake restores the same external source record id and contents with fresh CSRF. A role downgrade discards the held draft. No automatic write, browser storage or backend idempotency claim is added.

Controlled Chromium regression: new-lead 401 restores fields, produces no additional request until explicit submit, and preserves the original intake payload/source id; downgraded role discards fields with only the original failed write. Full component/recovery suite: 10 PASS. Typecheck/lint/build rerun. These fixtures do not establish live OIDC behavior.
