# Controlled interaction results — R4.13.2

Initial state: **prepared and blocked**. This artifact records the controls and expected evidence for the owner-authorized single controlled interaction; it does not claim a provider result.

- Target binding: owner-approved Page alias and UI-selected conversation; page id `1172702029255664`.
- Message: fabricated unique `RUN_ID`, held in memory and redacted from durable reports.
- Request schema: exactly `action=reply_inbox` plus `message`; no recipient field.
- Bounds: one send, aggregate write-ahead ?25, one-second minimum spacing, no retries, no redirects, 20-second timeout, 2 MiB body cap.
- Failure policy: stop on auth, scope, redirect, business, timeout, malformed JSON, or unsuccessful provider result; ambiguous transport remains UNKNOWN.
- Readback: same conversation only, after a successful send, matching the unique run marker; no enumeration.
- Privacy: tokens, cookies, raw bodies, customer PII and message text are excluded from this report.

No live interaction was performed during preparation.
