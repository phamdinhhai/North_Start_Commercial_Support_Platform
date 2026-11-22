# R4.13.2 Pancake full validation — final report

R4.13.2 completed the local Pancake source extraction, official contract reconciliation and a bounded authorized provider run. It verified the official account/Page metadata and conversation history target, then attempted one controlled text send. The POST result was ambiguous and recovery could not find the unique marker. No second POST, retry or conversation mutation occurred. North Start remains synthetic-only.

## Baseline and source

- R4.13.1 documentation HEAD: `70b058c6d07b2cf235d6487ad3aed9c653ac3bae`.
- R4.13.2 branch: `feat/r4132-pancake-full-source-validation`; final local documentation HEAD is recorded by `git log -1` at handover.
- Exact source used for regression: `eecd87764bb9631c361c9eaa7f578dc5db0f79f2`; product tree unchanged from R4.13.1 (`47d01594b3d9cae7f93459d97a087c951355250f`). No product or `.github` files changed.
- Accidental agent documentation commit on primary `main` was reverted by restoring `main` to `5d6c206`; Owner dirty/untracked bytes and status were preserved, and the accidental commit remains on a local recovery ref.
- No push, merge or deployment occurred.

## Local package extraction

Fresh recursive inventory found **171 files**: 166 Markdown, 2 YAML, 1 JSON, 1 DevTools capture and 1 extensionless environment file. The machine catalog contains 153 detailed functional records, 13 functional groups, 32 parsed REST operations, 5 webhook definitions and 233 normalized route observations from 395 HAR entries. Full Markdown text was processed locally. Credentials/cookies were structurally inspected in memory; sensitive values and hashes are withheld from Git.

Current official REST/Webhook hashes match the earlier public snapshots. Local REST bytes differ from the public snapshot; their parsed structures were previously found equal, and both still have the same 21 validation diagnostics. The webhook snapshot has 2 diagnostics. No upstream source was modified. The REST contract documents account `access_token`, Page `page_access_token`, conversation-scoped `reply_inbox` with `action` + `message`, and positional `current_count`. Private UI routes remain separate from official Public API claims.

## Authorized provider evidence

The successful read run used a reviewed Python transport bridge and durable WAL:

- Metadata GET: HTTP 200/business success; allowlisted alias mapped to native Page.
- History GET offset 0: HTTP 200/business success; 30 messages, exact Page/conversation scope, contact matched.
- History GET offset 30: HTTP 200/business success; 13 messages, exact scope, contact matched, zero boundary overlap.
- Completeness remains UNKNOWN; ordering under concurrent changes and terminal empty-page semantics were not established.

The first Node transport attempt failed with `UND_ERR_CONNECT_TIMEOUT` and was terminalized. An earlier inline-loader deviation discarded tool metadata; its exact count remains UNKNOWN and is not used as acceptance evidence. These incidents are documented without inventing provider results.

## Controlled send outcome

Security and QA approved one fixed-conversation send after the successful read proof and five offline recovery tests. The send run reserved the WAL, performed one POST attempt, then stopped with `TRANSPORT_OR_PARSE_STOP`. Recovery made history-only GETs, verified scope/contact, but found no unique marker. Final state: `SEND_UNRESOLVED`; one POST attempted, zero confirmed provider writes, no second POST, no retry. Delivery and read status are UNKNOWN. Tags, assignment, status, notes and all other mutations were not tested.

The local send guard and recovery path enforce one POST maximum, durable reservation, ambiguous-state recovery by GET only, stable native identity checks and no blind retry. This is a correctness control, not provider idempotency.

## Engineering verification

Exact local runner on `eecd877`:

- 26/26 lanes PASS.
- 1,520 Vitest tests across 163 files; 157 PostgreSQL tests in 30 suites; zero skipped.
- Coverage: 92.91% lines, 88.78% statements, 86.61% branches, 91.30% functions.
- Typecheck, lint, build, architecture, registry, HTTP/browser/OIDC, PostgreSQL, backup/restore, crash/restart, MV3, pilot and dependency audit PASS.
- Independent focused QA: 139 tests PASS; executor offline recovery suite: 5/5 PASS.
- Secret scans covered changed/untracked/staged files, new history and 637 generated artifacts; no credential values or raw provider content found.

These are new R4.13.2 regression results; previous R4.13.1 counts are not reused as this run's evidence.

## Readiness gates

| Gate | Status |
|---|---|
| Gate A engineering | **PASS local**; hosted R4.13.2 CI NOT RUN |
| P1 account/Page/target read | **PASS for bounded operation**: alias/Page metadata, conversation and contact matched |
| P2 history | **PASS bounded**: offsets 0/30 verified; completeness UNKNOWN |
| P3 controlled send | **SEND_UNRESOLVED / MANUAL REVIEW**; no confirmed write |
| P4 conversation functions | NOT TESTED after unresolved send |
| P5 North Start provider E2E | NOT VERIFIED; no real provider data entered North Start |
| Gate B human Sales | CONDITIONAL / NOT RUN |
| Gate C real customer data | NOT READY |

The next action requires Owner/manual provider review of the ambiguous send state before any further provider interaction. Do not send another message using the same or a new marker until that state is resolved. Production credential custody, live synchronization, retention/erasure and human Sales validation remain separate approvals.
