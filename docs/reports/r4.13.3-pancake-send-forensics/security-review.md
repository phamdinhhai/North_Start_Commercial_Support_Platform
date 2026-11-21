# R4.13.3 security review

## Disposition

The Owner reviewed the exact allowlisted conversation and reported `NOT_OBSERVED`.
The prior outbound operation therefore remains `SEND_UNRESOLVED`. The recorded
facts are `post_attempts=1`, `confirmed_provider_writes=0`,
`automatic_retry_allowed=false`, `new_mutations_allowed=false`,
`delivery_status=UNKNOWN`, and `read_status=UNKNOWN`. No provider request,
retry, tag, assignment, note, status change, or other mutation was performed
during R4.13.3.

## Controls reviewed

- The corrected bridge uses explicit UTF-8 bytes for stdin/stdout and does not
  print credential-bearing URLs, headers, cookies, or raw provider bodies.
- The offline HTTP emulator is mechanically restricted to loopback fixtures,
  bounds request/response sizes, rejects redirects by construction, uses a
  fatal UTF-8 decoder, and treats missing or malformed business acknowledgements
  as ambiguous.
- HTTP 4xx/5xx, connection resets, write/response timeouts, partial responses,
  and parser failures do not become `PROVIDER_REJECTED` or `SEND_SUCCESS`.
- The append-only fixture journal writes an HMAC-linked row and calls `fsync`
  before dispatch. An exclusive lock prevents concurrent duplicate fixture
  sends. Recovery after reservation or dispatch transitions to manual review;
  it never schedules a second POST.
- Query-token redaction is covered by an offline test. The HMAC key and all
  fixture payloads are local fabricated values, not provider credentials.

## Limits and residual risk

The fixture journal does not claim power-loss durability: directory-entry fsync,
production key custody, and provider-side idempotency are outside this offline
change. Reopening an existing journal is intentionally read-only; an operator
must close the incident through a separately reviewed reconciliation path. The
historical transport record does not establish whether Pancake received the
body. These limits keep the incident at `SEND_UNRESOLVED`.

No credentials, cookies, authenticated URLs, customer content, or raw provider
responses are included in this report or the source tree.
