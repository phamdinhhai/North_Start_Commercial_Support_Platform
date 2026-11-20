# R4.11 baseline and forensic audit

Observed 2026-11-20. Local and GitHub remote R4.10 HEAD are `5181aba2b325fb12fdb4a54b04783f23b4133d69`; the baseline worktree is clean. Hosted run #77 (`44665518491`) is completed/success on that exact SHA, both product and Browser operator workflow. This run proves the baseline only. R4.11 has not been pushed and has no hosted result.

`origin/main` and merge-base are `5d6c20673218f02c0972263126e8654eadee18c9`. R4.10 is ahead 194, behind zero. R4.6 `08bdefa` and R4.7–R4.9 `9ffae60` are ancestors. PR #1 and #2 are open drafts with overlapping older ancestry; neither represents the complete release. Details and a cumulative review proposal are in [branch strategy](branch-and-pr-strategy.md). No PR was changed.

Implementation is isolated in `D:/AI-for-Enterprise/ns-r411-trust`, branch `feat/integration-trust-and-sync-readiness`. A detached, unchanged `ns-r411-baseline` was independently rebuilt and verified: 20/20 lanes, 1,297 Vitest tests, 122 PostgreSQL tests included, zero skips, 92.14% line coverage. Commands and log hashes are in [baseline verification](baseline-verification.json). These results are not substituted for R4.11 results.

Before source changes, the coordinator and specialists inspected Git/CI, R4.7–R4.10 reports, canonical invariants and decisions, ADR-005–009, store/service/validation/ports, synthetic decoders, migration018, controller/UI, runtime composition, authentication/membership and logging. Frozen canonical files and migration001–018 remain unchanged. Repository canonical supersession resolves CE-2/PM-1/LG-1/MM-1; CE-1, ID-1 and ID-2 remain open.

| Finding | Classification | Source evidence | Selected response |
|---|---|---|---|
| New native messages seed separate Leads, including within one conversation | DESIGN LIMITATION / PRODUCT DECISION | PgSourceIntegrationStore.intake | Explicit receipt-context associations; no automatic customer or Lead merge, historical seeds preserved |
| Operator-declared originalMeta IDs can align synthetic objects | SECURITY RISK BEFORE LIVE | Pancake decoder, synthetic_fixture contract | Candidate trust labels, impossible-origin checks, no provider-authenticated promotion |
| Connection FOR UPDATE serializes intake | PERFORMANCE HYPOTHESIS, then locally measured | Store SQL and bounded benchmark | Keep correctness lock; tune measured lookup/index/materialization costs |
| Native history/event lookups lack matching index order and materialize history | DESIGN LIMITATION, measured query cost | EXPLAIN ANALYZE BUFFERS | Add migration019 and bounded existence/event reads |
| Connection lookup searches only first 100 list entries | VERIFIED FUNCTIONAL LIMITATION | FixtureIntake list/find; test creates 102 connections | Scoped direct lookup, preserving bounded list |
| Evidence history stops at 100 without continuation | VERIFIED FUNCTIONAL LIMITATION | Store evidence() and service response | Scoped keyset cursor preserving PostgreSQL microseconds |
| New context transaction can exhaust pool while authorization reacquires clients | VERIFIED IMPLEMENTATION DEFECT found during cross-review | Receipt transaction + callback loop.get | Use actual locked Lead authority; real runtime max1/ten-command test |
| New link table allowed mismatched receipt envelope/origin through direct SQL | VERIFIED DEFENSE-IN-DEPTH GAP found during review | Independent foreign keys in new migration020 | Add migration021 preflight/insert guard and direct SQL negatives |
| Live OAuth, transport principal, lifecycle and privacy acceptance absent | SECURITY RISK BEFORE LIVE / BLOCKED PROVIDER AUTHORIZATION | Source and Gate C baseline | Offline contracts only; explicit sandbox admission checklist |

No P0 security defect was asserted from hypothetical live behavior. Existing protections include admin-only synthetic import, server workspace/membership, Lead authorization, OIDC CSRF, default-off source feature, local/test/OIDC/PostgreSQL admission, HMAC, append-only evidence/audit, transactional intake/replay/collision rejection and explicit seed ownership claim. No provider event creates Won/Lost/revenue or resolves attribution.

Six actual specialists worked in separate writer worktrees across waves. Root alone integrates the release worktree. A read-only scan of 106 registered worktrees is retained outside Git at `%TEMP%/north-r411-worktree-status.json`, SHA256 `7ebdff3ef80222ae09ad4db6623dc95f45fc5bbf410e9a46d2bf1b3eb6dbdba0`. Old dirty research worktrees and the untracked Owner catalog in ns-r4-gaps were preserved.

Engineering PostgreSQL is a new OS-temp cluster on loopback50936, with separate fabricated databases. Baseline/final verification and launcher rehearsals use independently generated clusters. No Owner pilot manifest, secrets, session configuration, database or ownership policy was changed. Dependency lockfile/application Node22 remain unchanged; five moderate development advisories were observed and are handled by the existing audit gate.

Final integrated execution, resource shutdown and gate status are recorded in verification.json and final-report.md. Human Sales testing remains NOT RUN; operator is the Project Owner; Gate B remains CONDITIONAL and Gate C NOT READY FOR REAL CUSTOMER DATA. R4.11 push requires separate approval.
