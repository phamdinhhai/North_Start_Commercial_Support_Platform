# R4.13 baseline and immutable R4.12 hosted acceptance addendum

Recorded 2026-11-21 Asia/Saigon. R4.12 pre-push final-report/verification/release-gates are preserved as historical checkpoints. Their `pushed:false` and hosted-not-run statements predate the subsequent successful push; they are not current release status.

| Evidence | Verified result |
|---|---|
| R4.12 branch, local and remote | `feat/r412-provider-sync-foundation`, `197d6ec4c766d4528d1cbc9e024d6e2454d22bd3` |
| R4.12 tested source | `81f3a5dc8437830ccdb658f57ac552b18c9fd66d`; baseline evidence only |
| Hosted CI | [Run 44761896200 / #79](https://github.com/phamdinhhai/North_Start_Commercial_Support_Platform/actions/runs/44761896200), COMPLETED/SUCCESS, exact HEAD above; product and Browser operator workflow SUCCESS |
| Verification commands | `git ls-remote origin refs/heads/feat/r412-provider-sync-foundation`; `gh run view 44761896200 --json headSha,status,conclusion,number,jobs` |
| New isolated branch | `feat/r413-pancake-deep-admission`, worktree `D:/AI-for-Enterprise/ns-r413-pancake`, created from verified R4.12 HEAD |
| Ancestry | R4.11 `4503e80` is an ancestor; merge-base with origin/main `5d6c20673218f02c0972263126e8654eadee18c9` |
| Open PR topology | #1 draft `feat/decision-demand-execution` to main; #2 draft `feat/unified-adaptive-foundation` to `feat/adaptive-integration-pancake-research`; older stacked work, neither represents R4.13 |

The R4.12 worktree was clean at baseline inspection. Other existing worktrees and Owner pilot resources were preserved. No merge, retarget, push, deployment, historical migration, frozen canonical document or production credential-store change is part of R4.13. Current source/documentation revisions and new exact-source verification are in verification.json/final-report.md; baseline test numbers are not reused as new PASS evidence.

Owner's R4.13 authorization supersedes the earlier no-provider-account-use condition only for the named Page/conversation/contact and permitted operations. Contact recipient consent was explicitly confirmed in-session. It does not authorize other inboxes, broad enumeration/export, production sync, real-data storage in North Start, main merge or R4.13 push.
