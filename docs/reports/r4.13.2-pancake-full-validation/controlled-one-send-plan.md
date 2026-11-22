# R4.13.2 controlled one-send plan (offline preparation)

1. Security and QA review this plan and record approval.
2. Operator sets `PANCAKE_PAGE_TOKEN`, `PANCAKE_CONVERSATION_ID`, and unique `RUN_ID` in process memory only. Never print, persist, or paste the token.
3. Verify alias/page mapping and target conversation from approved capture. Use page `1172702029255664` only.
4. Execute exactly one POST using `bounded-send.js`; route and body are fixed by the official contract. The script follows redirects with `redirect:error`, has a 20-second timeout and 2 MiB response cap, and makes no retries.
5. Stop immediately on auth, redirect, scope, business failure, malformed response, or timeout. Treat ambiguous transport failure as unknown; do not retry.
6. Read back the same conversation via an approved read-only route, matching the unique `RUN_ID`; redact token, customer identifiers, and message body in the journal.
7. Record only status, success classification, timestamps, and sanitized receipt facts. Clear environment variables/process memory after completion.

No provider call was made while preparing this plan.
