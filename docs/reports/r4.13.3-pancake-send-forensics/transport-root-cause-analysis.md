# Transport root-cause analysis

## Finding

The incident is a transport/evidence-boundary failure, not a demonstrated Pancake business rejection. The Node ledger ended with `UND_ERR_CONNECT_TIMEOUT`; the Python bridge later recorded one POST attempt with no confirmed marker and a GET-only recovery. Because the request outcome was ambiguous, the executor correctly stopped in `SEND_UNRESOLVED` and did not retry.

## Reproduction model (offline only)

Use a loopback HTTP emulator with deterministic fault switches. The harness must log phase (`connect`, `write`, `headers`, `body`, `parse`), elapsed time, exception class, bytes written/read, and WAL transition. It must never include credentials or real payloads.

- **Connect timeout:** accept no connection or delay accept beyond the client budget. Node should classify `UND_ERR_CONNECT_TIMEOUT`; Python should expose a connect `socket.timeout`.
- **Write timeout:** accept a connection, then stop reading the request body. The client must record a write/abort phase and leave delivery UNKNOWN.
- **Response timeout:** read a complete request, delay headers or body beyond the budget. A completed write still does not establish provider processing.
- **Reset before body:** send headers or close immediately before any body. Treat as incomplete response.
- **Reset after partial body:** send a prefix of a JSON document, then reset. Preserve byte-count evidence but fail parsing and business confirmation.
- **Partial JSON:** return HTTP success with truncated or malformed JSON. Record `parse_failure`; do not convert HTTP status into a successful commercial result.

The same matrix should be run against Node `fetch`/undici and Python `urllib` with equivalent deadlines. Differences in exception names are runtime-specific; the evidence policy is shared.

## Root-cause chain

1. A bounded Node attempt could not complete TCP connection establishment.
2. Tool metadata for an earlier inline-loader read was discarded, leaving a 0–2 attempt uncertainty.
3. The reviewed Python execution preserved a six-attempt WAL and made one POST, but no marker was observed on recovery.
4. The system therefore had no proof of provider acceptance and entered terminal `SEND_UNRESOLVED`.

The encoding note (Python stdin default `cp1258`) is a separate bridge defect. The local bridge was corrected to explicit UTF-8 after the run; no retry was authorized, so this correction does not change provider outcome evidence.

## Required interpretation rules

- `UND_ERR_CONNECT_TIMEOUT`, reset, and read/write timeout are transport observations only.
- A complete HTTP response with malformed JSON is a parse failure, not a business success.
- “Bytes written” means handed to the local socket, not accepted or committed by the provider.
- Only a scoped, validated readback marker can move `SEND_UNRESOLVED` to confirmed mutation.
- With no such marker, Owner remains **NOT_OBSERVED**, confirmed writes remain zero, and retry remains prohibited.
