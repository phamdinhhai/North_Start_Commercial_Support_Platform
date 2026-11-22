# SEC-01 Mutation safety review (R4.13.2)

This review defines the fail-closed mutation contract for the Pancake pilot. It is a security gate, not provider API documentation.

1. **Reservation before dispatch.** Persist one send reservation containing target Page, exact `c_id`, provider contact fingerprint, message digest, actor and idempotency key before opening the HTTP request. A restart must recover `reserved` as an unresolved mutation and require manual review; it must never silently resend.
2. **Single authorized mutation.** After a human reviews the bounded read and approves the exact draft, permit one dispatch only. The official Page conversation-scoped InboxMessage request is the authority for recipient routing; the executor must not accept an arbitrary recipient override.
3. **Fail closed.** Stop on Page/conversation/contact mismatch, stale or missing history, unknown identity, redirect, timeout, size overflow, malformed response, rate-ledger violation, or any ambiguity about whether the provider accepted the request. Ambiguous dispatch requires provider readback/manual reconciliation, never an automatic retry.
4. **Bounded retries and audit.** At most 25 attempts, spaced by at least one second, with append-only redacted ledger entries. Keep raw immutable evidence separately with token, cookie, authorization header, URL query, and unnecessary PII removed from logs.
5. **Required evidence.** Approval package must include the native executor source, tests for restart recovery and write-ahead ordering, exact request body assertion (action plus message only), scope/readback checks, and redaction/timeout/redirect tests. Without these artifacts, mutation remains blocked.

Current decision: **conditional approval for bounded read; mutation blocked pending executor source and tests.**
