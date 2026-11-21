# R4.13.1 release integration plan — domain/release lane

## Current baseline and dependencies

The worktree is based on `d990437`; its first-parent ancestry reaches `main` at `5d6c206` (commercial-support baseline), then the R4.10–R4.12 source/continuity and synthetic-sync foundations, and R4.13 Pancake admission commits (`2b05449`, `f1a3a0d`, `b3713b4`, `bea002a`, `4c3e167`, `5c43735`, `6aa1533`, `0ebf0f3`, `fc5907e`, `d990437`). This is a documentation/rehearsal lane and must not merge or retarget draft PRs.

Domain dependencies are: canonical invariants and ADR-003 adapter boundary; Lead/pilot-loop access and audit; source integration migrations 018–023; prior envelope/workspace migrations 003–005; and the existing migration lifecycle tests. PR #1 and PR #2 are read-only reference points: both were draft and mergeable in the snapshot, but have different bases and must not be treated as release approval. GitHub reports `main` unprotected (404) and no repository rulesets; branch policy therefore comes from repository gates and human review.

## Safe rehearsal sequence

1. Freeze a clean commit and record `git diff`, ancestry, migration list and canonical-file hash.
2. Run product install/typecheck/build and focused adapter/source/pilot tests. Run migration lifecycle plus 001?023 up/down rehearsal on an isolated PostgreSQL database; capture exit codes and schema checks.
3. Seed only fabricated records. Exercise page read, duplicate replay, changed-payload conflict, malformed/out-of-order quarantine, cursor/checkpoint restart, source link/unlink/reject and cross-workspace RBAC. Assert raw evidence remains append-only.
4. Run an explicit domain assertion scan: no Customer merge, owner assignment, commercial-state transition, outcome, revenue or attribution inference may be emitted by the Pancake read path. Unknown remains explicit.
5. Have Sync and QA independently inspect the manifest, migration rollback, quarantine counts, access failures and evidence hashes. Record provider observations only in the root sanitized journal; this lane makes no provider call.
6. Release decision: accept the domain/release documentation only if all local lanes pass and the root confirms authenticated admission, retention/erasure and human pilot gates separately. Otherwise retain synthetic-only mode and stop.

## Conflict and rollback handling

If a migration fails, stop at the failing version, preserve the isolated database, run the matching down migration only after capturing diagnostics, then restore from the prior snapshot and re-run. Never edit historical migrations or canonical files. If a branch conflict touches domain invariants, Lead/pilot-loop authorization, source receipts, or migrations, the owning domain author resolves it with source evidence; this agent does not force-resolve. If a provider read disagrees with a fixture, quarantine the raw item and leave the canonical projection unchanged. If duplicate or changed payloads disagree, retain the first immutable envelope and record an idempotency conflict.

## Release gates and ownership

- **Engineering gate:** typecheck/build/test and migration up/down pass with clean diff.
- **Domain gate:** I-01/I-02/I-05/I-07/I-08/I-09/I-10/I-11/I-12 assertions pass; CE-1 and ID-1 remain open seams.
- **Security gate:** authenticated account/Page/contact binding, credential custody and retention/erasure are independently evidenced; synthetic mode cannot be relabeled live.
- **Pilot gate:** human Sales validates scoped context and action behavior; no automated outcome or revenue inference.
- **Provider gate:** only root-owned sanitized journal may claim provider capability; this document is not provider evidence.

Recommended branch strategy is one writer per worktree: merge domain documentation only after Sync+QA review, then rebase onto the selected release tip and rerun the exact-source suite. Keep PR #1/#2 untouched; a release branch should cherry-pick only reviewed commits and preserve migration order. No merge, push, PR edit or protection change is performed here.
