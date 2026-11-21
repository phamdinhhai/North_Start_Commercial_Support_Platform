# R4.13.3 Pancake send forensics — independent QA

Date: 2026-11-21 (Asia/Saigon)

## Verdict

**NOT_OBSERVED.** The private control artifacts show a completed read-only source/transport run and a send attempt that stopped at `TRANSPORT_OR_PARSE_STOP`, classified as `AMBIGUOUS_REQUIRES_READBACK`. Recovery was attempted with GET-only history reads but the marker was not resolved (`RECOVERY_MARKER_UNRESOLVED`). The resulting state is `SEND_UNRESOLVED`; `sendCount` remains `0` in the recorded summary. Retain `SEND_UNRESOLVED`, automatic retry **false**, and new mutations **false**.

No provider call, credential, or raw customer data was used by this QA work.

## Evidence reviewed

- `%TEMP%/north-r4132-control/execution.json`: terminal `TRANSPORT_OR_PARSE_STOP`; one metadata entry; no mutation.
- `%TEMP%/north-r4132-control/execution-python.json`: six attempts; metadata and two history pages accepted; send entry terminal with `AMBIGUOUS_REQUIRES_READBACK`; recovery history accepted but marker unresolved; `phase=SEND_UNRESOLVED`, `sendReserved=true`, `sendCount=0`.
- `%TEMP%/north-r4132-control/send-approval.json`: approval artifact is closed with `SEND_UNRESOLVED_NO_MORE_PROVIDER_ACTIONS`; it is not evidence of provider acceptance.
- `entry.test.mjs`: five offline tests passed (successful send flow fixture, ambiguous restart/no second POST, pre-send failure, duplicate marker, corrupt/unreserved recovery).
- `b3117ad` (`send-ledger`): pure append-only state reducer and tests reviewed from the WAL worktree. It models intent/outcomes and manual review, but does not itself claim durable persistence, crash-safe storage, or provider idempotency.

## Independent checks

From a clean install in `product/`:

- `npm ci` completed.
- `npx vitest run src/domain/send-ledger/send-ledger.spec.ts src/adapters/pancake/pancake-send-guard.spec.ts`: 6 tests passed.
- `npm run typecheck`: passed.

These tests are offline and synthetic. They do not elevate the provider result beyond NOT_OBSERVED.

## Boundary findings

The private Python/Node harness validates bounded parsing, scoped readbacks, local WAL writes, and no blind retry after an ambiguous send. The observed failure is a parser/transport stop, not proof of provider rejection or delivery. A marker appearing in a source fixture or local artifact must not be treated as provider readback. The current instruction prohibits further provider requests; reconciliation requires a separate Owner-reviewed plan and evidence sufficient to close the incident.

## Traceability

| Claim | Artifact / check | Result |
|---|---|---|
| Read-only source evidence exists | `execution-python.json` entries 1–4, 6 | Observed |
| Mutation was attempted | entry 5, `mutation=true` | Observed, outcome ambiguous |
| Provider send accepted/delivered | no accepted send or exact readback | **Not observed** |
| Recovery resolved marker | `failure=RECOVERY_MARKER_UNRESOLVED` | **Not observed** |
| Automatic retry permitted | control state and harness policy | No |
| New mutation permitted | unresolved terminal state | No |

## Final integrated-source review

The independent agent reran the integrated source
`5489ff9546d9e41790368e549d30a82f33b14023`: **31/31 Vitest tests in five files**
and **26/26 Node boundary tests** passed. The corrected Unicode fixture uses
explicit Vietnamese/emoji code points and compares exact received JSON bytes
and Content-Type. It also verifies explicit binary UTF-8 under a cp1258 locale,
malformed/truncated responses, timeouts, and killed-child metadata loss.

QA counted **18/18 passing lanes** in the main manifest and independently
inspected the supplemental manifest: **9/10 passed**, with only the pilot
launcher failing. Root traced that failure to disk exhaustion on C and ran the
pilot again with task-specific TEMP/TMP on D; the execution tool returned exit
0. This final pilot rerun is root-observed evidence, separately identified from
the QA-inspected manifest. QA inspected the private pilot PostgreSQL readiness
and fast-shutdown cycles without printing sensitive values.

No functional security-boundary defect was found in the offline coordinator,
loopback transport, and HMAC journal. Limits: directory-entry power-loss
durability and production key custody are not established; existing journals
reopen read-only; local reservations do not create provider-side idempotency.
Neither test suite nor manifest establishes live provider acceptance, delivery,
or read state. `SEND_UNRESOLVED`, retry false and mutations false remain required.
