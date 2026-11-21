# DevTools versus API results

Offline capture inspection only; no provider request was executed.

| Check | Result |
|---|---|
| Target conversation id present | true |
| Target conversation type `INBOX` | true |
| Conversation `page_id` matches target page | true |
| `from_psid` equals `from.id` | true |
| A customer `fb_id` matches `from_psid` | true |
| Provider page alias record observed | true |
| Alias inferred from URL alone | false |
| `reply_inbox` observed in capture | false |
| Page token value copied to report | false |
| Credentials/PII copied to report | false |

Captured conversation object fields included `id`, `type`, `page_id`, `from`, `from_psid`, `customers`, `thread_id`, and message/conversation metadata. Values are intentionally omitted.
