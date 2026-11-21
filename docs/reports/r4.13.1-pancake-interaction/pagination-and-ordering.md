# Pagination and ordering

Two fresh official reads were executed only for the authorized conversation:

| `current_count` | HTTP / success | Messages | Page/conversation scope | Contact context |
|---:|---|---:|---|---|
| 0 | 200 / true | 30 | Every message matched | Present |
| 30 | 200 / true | 13 | Every message matched | Present |

Message IDs were unique within each page, had zero overlap between these two pages, and the contact reference was stable across pages. This verifies one bounded positional readback sequence. It does not prove total history completeness, timestamp ordering, behavior under concurrent inserts/deletes, or edit/delete lifecycle semantics. `current_count` remains a positional offset, never a durable checkpoint.

The new `planPancakeHistoryOverlap` helper computes a bounded re-read start before an offset and keeps `completeness=UNKNOWN` and `durableResumeSafe=false`. No network, checkpoint, receipt or North Start ingestion is wired.
