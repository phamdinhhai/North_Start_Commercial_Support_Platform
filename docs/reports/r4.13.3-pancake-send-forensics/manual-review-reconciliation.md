# Manual review reconciliation

Owner verdict: **NOT_OBSERVED** for the exact authorized conversation. This records what was visible in the inspected UI at review time. It does not establish that the prior POST was rejected or never processed.

| Field | Required disposition |
|---|---|
| owner_manual_review | NOT_OBSERVED |
| post_attempts | 1 |
| confirmed_provider_writes | 0 |
| send_outcome | SEND_UNRESOLVED |
| automatic_retry_allowed | false |
| new_mutations_allowed | false |
| delivery_status | UNKNOWN |
| read_status | UNKNOWN |

No new provider request is allowed under R4.13.3. A future send requires a separately approved plan after this incident is manually closed.
