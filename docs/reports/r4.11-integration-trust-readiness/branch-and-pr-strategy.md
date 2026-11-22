# R4.11 branch and PR strategy

Observed 2026-11-20 by independent architecture reviewer. Read-only Git/GitHub inspection; no fetch, push, PR mutation, merge, deployment, or pilot resource operation. Working baseline: `5181aba2b325fb12fdb4a54b04783f23b4133d69`.

## Verified ancestry and hosted acceptance

| Comparison | Evidence |
|---|---|
| main -> baseline | merge-base `5d6c20673218f02c0972263126e8654eadee18c9`; GitHub compare ahead 194, behind 0 |
| R4.6 `08bdefaca792e34a2142a575db198e0ee5c8f45f` -> baseline | local rev-list left/right 0/40; ancestor |
| R4.7 `9ffae600447950c9edcec2d823153aa6fe202684` -> baseline | local and GitHub compare left/right 0/25; ancestor |
| PR1 head `12aabd1d645e30d6b7fa0acc03758c66b4de3453` -> baseline | local left/right 0/153; ancestor |
| PR2 head `bcbbc095dd029c1aceac8b9e428bfadd05507fe4` -> baseline | local left/right 0/78; ancestor |

`gh run view 44665518491 --json headSha,status,conclusion,jobs` returned exact baseline SHA, completed/success, with both `product` and `Browser operator workflow` successful. This is actual hosted evidence, not a rerun by this reviewer. The hosted product steps include PostgreSQL integration, coverage threshold, build, restore rehearsal and HTTP smoke; browser steps include signed synthetic source reconciliation and OIDC/PostgreSQL journey. Run: https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/44665518491 . It establishes tested synthetic behavior only.

## Actual PR topology

* PR1 is OPEN: `feat/decision-demand-execution` -> `main`, head `12aabd1`; GitHub compare ahead 41/behind 0, merge-base main `5d6c206`. Local three-dot file count: 81.
* PR2 is OPEN: `feat/unified-adaptive-foundation` -> `feat/adaptive-integration-pancake-research`, head `bcbbc09`; compare ahead 74/behind 0, merge-base `c9c2de814d0bc7bec9e74a918a51d6a7a16067b2`. Local three-dot file count: 241.
* PR2 is stacked on the research branch, not targeted to main or PR1. Both older PR heads are already ancestors of R4.10. Their scopes overlap the later foundation by ancestry; they do not represent independent changes ready to merge alongside it. R4.10 vs main spans 560 paths. No new R4.10 PR was returned by the all-state PR listing.

Calling the old PRs stale means their heads omit later integrated work; this does not imply their historical code was rejected or their GitHub review state is invalid.

## Recommended baseline and integration sequence

Use exact `5181aba` as R4.11 starting baseline, preserving the full integrated ancestry and its exact hosted checkpoint. Keep one writer per isolated `work/r411-*` worktree. Integrate reviewed task commits into `feat/integration-trust-and-sync-readiness` and rerun acceptance at the final exact SHA; do not replace the baseline with main, PR1, or PR2.

For eventual review, prepare a new concrete PR from the integrated branch to main with an explicit cumulative scope and exact validation SHA. Its description must disclose the 194-commit/560-path baseline gap plus the R4.11 delta, and link PR1/PR2 as historical overlapping work. Do not merge PR1 and PR2 first merely to clean topology. Closing, retargeting, replacing or merging existing PRs is a separate owner decision; no such operation was performed here. After the cumulative baseline is approved and merged, subsequent work should branch from updated main to keep reviews bounded.

## Local ownership snapshot

`git status --short` was empty for registered `ns-r410-*` and `ns-r411-*` worktrees at inspection, including foundation, baseline, core, provider, QA and current architecture worktree. No registered `ns-r4gaps*` path matched the scoped inventory. This is a point-in-time snapshot and grants no permission to clean or reuse other worktrees. No secret files were opened or printed.
