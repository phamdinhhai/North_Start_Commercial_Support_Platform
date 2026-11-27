# Incident reconstruction (sanitized)

## Scope and evidence boundary

This reconstruction uses only the persisted, sanitized R4.13.2 verification record and local reports. No provider was contacted while preparing this report. Credential values, raw bodies, customer identifiers, and private script contents are intentionally excluded. `provider_result: UNKNOWN` is retained whenever transport or execution control did not establish an HTTP response.

## Exact WAL timeline

The control record reports two execution ledgers:

1. `execution.json` — one bounded attempt ending in a terminal transport failure (`attempts1/terminal transport failure`). The Node transport classification was `UND_ERR_CONNECT_TIMEOUT`; there is no provider result and no retry.
2. `execution-python.json` — six bounded attempts ending `SEND_UNRESOLVED`. Read metadata/history entries were accepted where scope checks passed; one POST was attempted, but no confirmed write marker was found. One recovery GET was made, no second POST occurred, and retry remained false.

The aggregate record states: `post_attempts: 1`, `confirmed_writes: 0`, `recovery_gets: 1`, `marker_found: false`, `second_post: 0`, `status: SEND_UNRESOLVED`, `total_confirmed_mutations: 0`. It also records `known_credentialed_attempts: 7` and `additional_unledgered_get_attempts: 0-2`; therefore an exact total request count is unavailable. This is an execution-control limitation, not evidence of a provider write.

## Offline transport emulator matrix

A local emulator should model each phase independently, with a fresh request and no credentials:

| Fault injected | Node/fetch class | Python `urllib` analogue | Evidence interpretation |
|---|---|---|---|
| TCP connect never completes | `UND_ERR_CONNECT_TIMEOUT` | `socket.timeout` during connect | No HTTP response; provider result UNKNOWN |
| Request body write stalls | body/write timeout or abort | timeout while `send()`/request write | Delivery UNKNOWN; cannot claim sent |
| Response headers/body stall | headers/read timeout or abort | timeout during `read()` | Delivery UNKNOWN unless an application-level acknowledgement was already captured |
| Peer reset before body | `ECONNRESET`/socket reset | `ConnectionResetError` | No complete response; provider result UNKNOWN |
| Peer reset after partial body | reset after bytes received | reset while reading body | Partial transport evidence only; parse/commit must fail closed |
| Truncated JSON with FIN | parser `SyntaxError`/`JSON.parse` failure | `json.JSONDecodeError` | HTTP may have completed, but business result is unverified |

These classes must remain distinct in WAL: `transport_failure`, `response_partial`, and `parse_failure` are not interchangeable. A timeout or reset never proves that a POST was not received, and it never proves that it was received. A validated business acknowledgement or exact scoped provider readback is needed to establish acceptance; no such acknowledgement is available for this POST.

## Owner verdict

**Owner manual review: NOT_OBSERVED.** This is the Owner's UI observation, not
a provider assignment field or proof of non-delivery. The safe state remains
`SEND_UNRESOLVED`; do not retry, infer success from connection behavior, or
manufacture a business outcome.

## Timestamp reconstruction from the unchanged private WAL

All times below are UTC and indicate local reservation/start, not receipt at
Pancake. No response-completion or body-transmission timestamp was recorded for
the POST. Its historical bytes and provider receive state cannot be recovered
from these records.

| Ledger entry | Start | Observation |
|---|---|---|
| Node metadata 1 | 2026-11-21T12:04:19.471Z | terminal transport/parse stop |
| Python metadata 1 | 2026-11-21T12:11:18.627Z | HTTP 200, business success, alias/Page match |
| Python history 2 | 2026-11-21T12:11:19.638Z | offset 0, scoped success |
| Python history 3 | 2026-11-21T12:11:20.648Z | offset 30, scoped success |
| Python pre-send history 4 | 2026-11-21T12:21:21.404Z | offset 0, scoped success |
| Python send 5 | 2026-11-21T12:21:22.407Z | one mutation attempt, terminal TRANSPORT_OR_PARSE_STOP |
| Python recovery history 6 | 2026-11-21T12:22:24.885Z | scoped success, marker unresolved |

The private `execution-python.json` digest is
`76c07bfffec74e03b0ed515b4cf5efbdaa5b24d720dcd468b465fbb36e7171af`.
Owner reconciliation was appended as `owner-manual-review-r4133.jsonl` beside
the original control artifacts; original hashes were checked unchanged before
and after that append. No original WAL, marker, approval or execution script
was rewritten.
