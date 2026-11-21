# Controlled outbound message

Status: **BLOCKED — TARGET IDENTITY UNVERIFIED**.

No outbound request was made. P1 remains incomplete: cookie-only Page permission failed, later user-token Page role was observed but explicit mutation capability and alias/native binding remain unknown. Recipient consent exists, but consent cannot replace technical target binding and required capability proof.

The official contract was reviewed offline: text-only `InboxMessage` uses `action=reply_inbox` and `message`; `message` and `content_ids` are mutually exclusive. A future send must reserve one locally generated idempotency key, bind the actual body to a server-owned target, perform one request, and read back the exact conversation before reporting accepted. Ambiguous timeout/5xx must be terminal until readback; no blind retry.

`pancake-send-guard.ts` implements and tests the local single-send reservation. It is not provider idempotency and is not live authorization. No provider message, cleanup or side effect exists for this round.
