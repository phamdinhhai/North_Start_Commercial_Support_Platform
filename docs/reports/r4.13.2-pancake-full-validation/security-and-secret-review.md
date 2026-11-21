# SEC-01 Security and secret review (R4.13.2)

Status: **conditional approval — bounded read and one-shot send design only** (2026-11-21).

## Authentication and target proof

- Use an official Page access token captured for the target Page; keep the token in process secret storage and redact it from logs, errors, fixtures, and reports. Never print or persist token values.
- Do not require undocumented PageToken attestation, private permission maps, or HTML bootstrap fields. The bounded-read proof is sufficient when the capture identifies the target Page, the token is valid for that Page, a conversation history read succeeds, the exact `c_id` is present, and the returned provider contact matches the owner evidence.
- Conversation scope is mandatory. A send must stop when Page, conversation id, or provider contact does not match the reviewed capture. UNKNOWN or ambiguous identity is a hard stop.

## Transport and data handling

- The executor must use the native HTTPS endpoint from source evidence, with no provider network calls during review. Raw URLs are redacted before telemetry and reports (query tokens, cookies, authorization headers, and message bodies are sensitive).
- Enforce explicit connect/headers/body/read timeouts, bounded response bytes, and manual redirect handling. Redirects are never followed automatically across host, scheme, or Page scope.
- Keep an append-only action ledger with at most 25 attempts and at least one second between attempts. Store hashes/metadata, not secrets or full tokens. Preserve provider request/response evidence with PII redaction.

## Authorization boundary

- AI output remains draft-only. Exactly one human-authorized mutation is permitted after review. The official conversation-scoped InboxMessage operation has no recipient field; do not invent one or block on a private recipient parameter. Request body must contain only the reviewed conversation-scoped action and message fields.
- Any scope mismatch, stale history, changed contact, malformed response, timeout after dispatch, or ambiguous provider result stops execution. No automatic retry after an ambiguous send.

## Review gate

Final SEC approval requires source inspection of the actual HTTP executor and tests proving redaction, timeout/size limits, redirect stop, ledger bounds/rate spacing, durable write-ahead reservation across restart, exact body shape, scope checks, and ambiguous-result stop/readback. Until those artifacts are reviewed, status remains conditional and production mutation is blocked.

## Executor source review — read phase

Reviewed private executor SHA-256 `26FF8470AA178FCBD6989651C84E031080014306261C54C19A3EA151723904EF` on 2026-11-21, without credentials or provider calls. **Approved: read phase only, maximum five named GETs** through `accountMetadata` and `history`. The source fixes the native HTTPS host/routes and minimal account fields, uses manual redirects, stops on non-2xx/non-JSON/business failure, caps responses at 2 MiB and 20 seconds, serializes through an exclusive lock, persists inflight/terminal state before dispatch, limits aggregate count to 25 and spacing to at least one second, and emits generic errors without raw URL values.

**Send remains blocked** pending per-request append-only outcome evidence, replacement of the corrupted message marker with the exact approved UTF-8 draft, and fresh identity proof/readback review. This read approval does not attest undocumented private metadata and does not expand provider or platform permissions.
