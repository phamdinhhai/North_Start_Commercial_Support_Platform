# Official send-message contract (local evidence)

Source: `pancake_api_document.yaml` (offline only).

Route: `POST https://pages.fm/api/public_api/v1/pages/{page_id}/conversations/{conversation_id}/messages?page_access_token=<page token>`.

JSON `InboxMessage` schema:

- required: `action`, `message`
- `action` enum: `reply_inbox`
- `message`: text content
- optional: `content_ids`, `filename`, `sender_id`, `reply_message_id`
- `message` and `content_ids` are mutually exclusive.

The route is conversation-scoped; the documented InboxMessage schema has no required `recipient` field. HTTP 200 still requires checking response `success`; failures may include `message_code`.

No live request was made.
