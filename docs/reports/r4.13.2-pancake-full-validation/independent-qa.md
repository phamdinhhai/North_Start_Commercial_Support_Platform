# R4.13.2 Independent QA

Status: **Pending candidate implementation and sanitized runner artifacts.** This report is read-only QA. No provider calls, credentials, raw package, customer payload, or mutation were used.

## Baseline

Worktree was created from commit `70b058c` on branch `work/r4132-qa`. Existing R4.13.1 evidence was reviewed for continuity. It supports offline Gate A implementation checks only; provider admission remains blocked absent authenticated alias/Page/token chain proof and durable mutation controls.

## Planned checks

- Inspect R4.13.2 source inventory, contracts, security boundaries, and LIVE executor scripts when supplied.
- Install pinned dependencies and run focused tests, typecheck, and applicable build checks.
- Reconcile catalog counts and exact source SHA against runner manifests.
- Review mutation plan and reject unsupported authentication or send attempts.
- Scan artifacts for secrets, raw responses, credentials, and customer data.

## Current disposition

No R4.13.2 implementation or live-run artifact is present at this baseline. No acceptance or provider authorization is granted.

## Executor source review (2026-11-21)

Private `bounded-executor.mjs` SHA-256 `5DBBDAEB9AF71AC17179F8643FBB2123295FBE377DEF697A8720D15FA2645DD2` was reviewed without execution or network access. The design includes exact `pages.fm` routes, redirect rejection, 20-second timeout, 2 MiB stream cap, one-second pacing, 25-operation budget, and write-ahead file locking. It is **not approved**: `send()` invokes `op('send',...)` while the allowlist only permits the conversation route for `kind === 'messages'`, so sends are rejected; failures are terminal only in process memory (`this.stopped`) and are not persisted for restart safety; the ledger schema does not validate count/timestamps/flags; and response page/conversation scope plus duplicate/readback proof are absent. No read or send is authorized.

## Local regression

After `npm ci --no-audit --no-fund`, Vitest completed 133 files (1,363 passed; 30 files skipped, 157 tests skipped). These are offline product tests and do not establish provider identity or authorization.

## Refreshed executor review

Reviewed private executor SHA-256 `26FF8470AA178FCBD6989651C84E031080014306261C54C19A3EA151723904EF`; its accompanying Node tests passed **7/7**. Persisted terminal/inflight WAL state, schema and lock validation, exact account/history routes, content-type/body/business checks, and proof/readback scope checks are present. QA conditionally approves only the bounded read-only metadata/history plan. Send remains blocked pending final UTF-8 marker, entries/result ledger, and fresh identity evidence. No network was used.

## Standalone read entrypoint review

Reviewed exact SHA-256 `10B108A9E82037BB79842B143E9B602F72398478F5B482581F87717D573A53F6`. Source review found fixed metadata/history routes, account alias mapping, history page/conversation/contact validation, atomic fsync WAL, lock, persisted inflight/terminal fail-stop, and no send absent a separate approval artifact. An offline copied fixture with mocked `fetch` (credentials stubbed, no network) executed exactly three GETs: metadata and history offsets 0 and 30. It produced `READ_VERIFIED` with three accepted non-mutating entries and `completeness: UNKNOWN`. QA approves READ mode for this exact SHA only; send remains separately blocked.

## Python transport read review

Reviewed entry `3FBB23F80E920E7D1E2EF39862651D44B67B8D40B0697B739FE9ACCC5C0A51D3`, bridge `7B7F0BE377268F35442C31F06EF15B215B84242823B467D4BDBF2E748EC95F9C`, and Python transport `E7E30B19F9D281A829760C8C3BF544F7805F876D898E4165903BBF99C2ED1BCE`. Fixed HTTPS routes, no redirects, 15-second Python timeout, 2 MiB body cap, private stdin/stdout pipes, 20-second Node abort/kill, and a separate 15-attempt WAL preserve the read boundary. A copied offline entrypoint with fabricated credentials and a fake Python helper exercised the unchanged Node child-process bridge and produced exactly three accepted GETs and `READ_VERIFIED`; no provider access occurred. QA approves READ only for these exact SHAs. The earlier terminal Node ledger remains preserved; no send approval follows.

## Final send-path QA review

Exact source SHA `89EBB3FD9ABBCB0D4D017E912363C9291E5A1CBD3981A0DA4BF6E998E6DDEE0B` passed the supplied offline Node suite **5/5**. Coverage includes one POST with two stable scoped readbacks, durable ambiguous-POST restart recovery using GET-only/no second POST, pre-send failure with no POST, duplicate-marker rejection, and corrupt/unreserved ledger rejection. With the official READ_VERIFIED WAL (alias/Page and contact matched; history counts 30 and 13; completeness UNKNOWN), QA conditionally approves one fixed-conversation send only after Security signoff and a scoped send-approval artifact. No QA network was used; delivery/read remain UNKNOWN.
