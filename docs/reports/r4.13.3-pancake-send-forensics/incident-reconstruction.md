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

These classes must remain distinct in WAL: `transport_failure`, `response_partial`, and `parse_failure` are not interchangeable. A timeout or reset never proves that a POST was not received, and it never proves that it was received. Only a validated, scoped readback marker can establish a confirmed mutation.

## Owner verdict

**Owner: NOT_OBSERVED.** The evidence does not identify a provider-side owner or establish provider acceptance. The safe state is `SEND_UNRESOLVED`; do not retry, infer success from connection behavior, or manufacture a business outcome.
