# Unicode and response parser tests

Offline-only tests were run against loopback HTTP fixtures. No credentials, provider host or customer data was used.

- Boundary fixture suite: Agent 2 delivered 23/23 pass for UTF-8 bytes, Vietnamese diacritics, JSON body round trip, query redaction, content-type handling, HTTP statuses, malformed/truncated JSON, `success:false`, stalled response and killed-child stdout metadata loss.
- Root bridge fixtures add 3/3 pass for legacy-locale loss, explicit binary UTF-8 decoding and truncated IPC JSON. Combined Node boundary run: **26/26 pass**.
- Root offline transport fixtures: 8/8 pass for corrected UTF-8 request/response handling, business rejection, malformed JSON, HTML/non-JSON, HTTP errors, timeout and loopback-only destination enforcement.
- Python bridge correction: stdin is decoded explicitly as UTF-8 and categorical stdout is ASCII-safe JSON. This correction happened after the live ambiguous run; the run was not retried.

A parser result never proves provider delivery. Missing process metadata and reset/timeout classes remain `UNKNOWN` until independent provider evidence exists.
