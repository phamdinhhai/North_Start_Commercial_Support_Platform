# Git ancestry and consolidation

Audit snapshot: 2026-11-22, release-candidate base `7cb21ce9a2b361cb417fd520705d6b7cdd68e5cf`. The audit reads Git refs and source; it does not merge, rewrite, reset, push or alter an Owner worktree.

`origin/main` is `5d6c20673218f02c0972263126e8654eadee18c9`. R4.14 remote is `164ebc17bff39f5d7604cc6bc5f6d37e7d188c9d`. `git rev-list --left-right --count origin/main...origin/feat/r414-hybrid-third-party-integration` returned `0 320`: R4.14 includes main and is 320 commits ahead. The R4.14 hosted workflow [44966931141](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/44966931141) was rechecked: exact SHA `164ebc1`, Product SUCCESS and Browser Operator Workflow SUCCESS. This is baseline evidence, not R4.15 hosted acceptance.

| Milestone ref | Audited tip | Classification |
|---|---|---|
| feat/decision-demand-execution | 12aabd1d645e30d6b7fa0acc03758c66b4de3453 | ALREADY_IN_ANCESTRY |
| feat/adaptive-integration-pancake-research | c9c2de814d0bc7bec9e74a918a51d6a7a16067b2 | ALREADY_IN_ANCESTRY |
| feat/unified-adaptive-foundation | bcbbc095dd029c1aceac8b9e428bfadd05507fe4 | ALREADY_IN_ANCESTRY |
| feat/r4-lvp-closure | 9ffae600447950c9edcec2d823153aa6fe202684 | ALREADY_IN_ANCESTRY |
| feat/multi-source-integration-foundation | 5181aba2b325fb12fdb4a54b04783f23b4133d69 | ALREADY_IN_ANCESTRY |
| feat/integration-trust-and-sync-readiness | 4503e80d54853b15da405f7c36df298aa0852eb0 | ALREADY_IN_ANCESTRY |
| feat/r412-provider-sync-foundation | 197d6ec4c766d4528d1cbc9e024d6e2454d22bd3 | ALREADY_IN_ANCESTRY |
| feat/r413-pancake-deep-admission | d990437bd5b8003f1068788538edde69fb3471b6 | ALREADY_IN_ANCESTRY |
| feat/r4131-pancake-identity-interaction | 70b058c6d07b2cf235d6487ad3aed9c653ac3bae | ALREADY_IN_ANCESTRY |
| feat/r4132-pancake-full-source-validation | 2b990357b8dddd4ef8f6905cd413ba707c01d4e7 | ALREADY_IN_ANCESTRY |
| feat/r4133-pancake-send-forensics | f531fc740fb83f7284410dbc1b9720d52fa835be | ALREADY_IN_ANCESTRY |
| feat/r414-hybrid-third-party-integration | 164ebc17bff39f5d7604cc6bc5f6d37e7d188c9d | ALREADY_IN_ANCESTRY |
| feat/r4141-hybrid-integration-closure | 7cb21ce9a2b361cb417fd520705d6b7cdd68e5cf | ALREADY_IN_ANCESTRY / selected RC base |

Each classification was established by `git merge-base --is-ancestor <tip> 7cb21ce`, exit 0. No listed milestone contains missing source that requires a second merge. Parallel specialist branches may retain historical independent commits; their branch names are not evidence that those changes are absent from the integrated product. No unrelated specialist worktree is reset or folded into this candidate.

R4.14.1 is compatible newer local work: its source `580e499cd55771896b88ffb47adca7689b12c99f`, product tree `0467316f0ccfb9396af948b252dc21f5b1cb66c8`, and documentation HEAD `7cb21ce` retain the R4.14 ancestry. Its committed manifest records 33 local lanes, 1,637 coverage tests and independent review; those are previous-round evidence only. R4.15 must rerun its final exact source after preview/startup changes. The selected base is 346 commits ahead of main at this snapshot, with no missing main commits.

PR [#1](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/pull/1) remains draft from Decision Demand toward main. PR [#2](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/pull/2) remains draft from Unified Adaptive Foundation toward Adaptive Integration. Their tips are included in the selected candidate ancestry. They are administratively superseded by the consolidated main-target candidate; no automatic closure, retarget or merge is performed. Owner may close them separately after reviewing the consolidated PR.

Merge impact is cumulative, not a small R4.15-only patch: main has migrations 001–007; candidate includes 001–023. Three canonical files differ from main through preexisting owner-approved ADR supersession commit `bd4ee87`; R4.15 introduces no new canonical decision. See `migration-and-schema-integrity.md`. Final RC HEAD, exact hosted workflow, PR and merge-impact totals belong to `release-candidate-manifest.json` / `verification.json`, which must be refreshed after final commits. Main merge remains reserved for Owner hands-on acceptance.
