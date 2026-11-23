# Live pagination observations

The official Page API was read for the allowlisted conversation at offsets 0 and 30:

| Offset | HTTP/business result | Messages | Scope | Contact | Boundary overlap |
|---:|---|---:|---|---|---:|
| 0 | 200 / success | 30 | All matched Page/conversation | Matched | n/a |
| 30 | 200 / success | 13 | All matched Page/conversation | Matched | 0 |

Completeness remains UNKNOWN. `current_count` is positional and is not a durable cursor. Timestamp order, terminal empty page, concurrent inserts/deletes and lifecycle backfill were not established.
